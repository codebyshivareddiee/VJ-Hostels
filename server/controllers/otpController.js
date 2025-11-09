const OTP = require('../models/OTPModel');
const Visit = require('../models/VisitModel');
const Student = require('../models/StudentModel');
const Guard = require('../models/GuardModel');
const AuditLog = require('../models/AuditLogModel');
const OTPUtils = require('../utils/otpUtils');
const notificationService = require('../services/notificationService');
const { recordFailedAttempt, clearBruteForceRecord } = require('../middleware/rateLimitMiddleware');
const { checkOffensiveContent } = require('../utils/offensiveContentChecker');

class OTPController {
  // Request OTP
  static async requestOTP(req, res) {
    try {
      const { studentId, visitorName, visitorPhone, guardId, purpose, groupSize = 1 } = req.body;

      // Validate required fields
      if (!studentId || !visitorName || !visitorPhone || !guardId || !purpose) {
        return res.status(400).json({
          success: false,
          message: 'Missing required fields: studentId, visitorName, visitorPhone, guardId, purpose',
          code: 'MISSING_FIELDS',
          receivedData: { studentId, visitorName, visitorPhone, guardId, purpose }
        });
      }

      // Check for offensive content in purpose
      const offensiveCheck = await checkOffensiveContent(purpose);
      if (offensiveCheck.isOffensive) {
        console.log('🚫 [Server] Blocked OTP request due to offensive content:', offensiveCheck.reason);
        return res.status(400).json({
          success: false,
          message: 'The purpose of visit contains inappropriate content. Please provide a valid and appropriate purpose.',
          details: offensiveCheck.reason,
          code: 'OFFENSIVE_CONTENT'
        });
      }

      // Validate phone number format
      const phoneRegex = /^[\+]?[(]?[0-9]{3}[)]?[-\s\.]?[0-9]{3}[-\s\.]?[0-9]{4,6}$/;
      if (!phoneRegex.test(visitorPhone.replace(/\s/g, ''))) {
        return res.status(400).json({
          success: false,
          message: 'Invalid phone number format',
          code: 'INVALID_PHONE'
        });
      }

      // Sanitize phone number for consistent storage
      const sanitizedPhone = OTPUtils.sanitizePhoneNumber(visitorPhone);

      // Verify student exists
      const student = await Student.findById(studentId);
      if (!student) {
        return res.status(404).json({
          success: false,
          message: 'Student not found',
          code: 'STUDENT_NOT_FOUND'
        });
      }

      // Verify guard exists
      const guard = await Guard.findById(guardId);
      if (!guard) {
        return res.status(404).json({
          success: false,
          message: 'Guard not found',
          code: 'GUARD_NOT_FOUND'
        });
      }

      // Check if visitor is whitelisted (pre-approved)
      const isWhitelisted = student.whitelist && student.whitelist.some(
        visitor => visitor.phone === sanitizedPhone || visitor.name.toLowerCase() === visitorName.toLowerCase()
      );

      if (isWhitelisted) {
        // Create visit directly for pre-approved visitors
        const visit = await Visit.create({
          visitorName,
          visitorPhone: sanitizedPhone,
          studentId,
          guardId,
          purpose,
          method: 'preapproved',
          status: 'active',
          groupSize: parseInt(groupSize) || 1
        });

        return res.status(200).json({
          success: true,
          message: 'Visitor pre-approved',
          code: 'PRE_APPROVED',
          visit: visit
        });
      }

      // Check if visit is within allowed hours
      const currentHour = new Date().getHours();
      const isOutOfHours = false; // 8 AM to 9 PM

      if (isOutOfHours) {
        return res.status(200).json({
          success: false,
          message: 'This is an out-of-hours visit. An override request will be sent to wardens.',
          code: 'OUT_OF_HOURS'
        });
      }

      // Generate OTP
      const otp = Math.floor(100000 + Math.random() * 900000).toString();
      const otpHash = await OTPUtils.hashOTP(otp, sanitizedPhone);

      // Create OTP record
      const otpRecord = await OTP.create({
        studentId,
        visitorPhone: sanitizedPhone, // Store sanitized phone
        visitorName,
        otpHash,
        otpValue: otp,  // Store the actual OTP value
        purpose,
        createdByGuardId: guardId,
        groupSize: parseInt(groupSize) || 1,
        expiresAt: new Date(Date.now() + 5 * 60 * 1000) // 5 minutes
      });

      // Send OTP to student (Firebase, SMS, Email)
      try {
        await notificationService.sendOTPNotification(student, otp, visitorName);
      } catch (notificationError) {
        console.error('Notification error:', notificationError);
      }

      // Emit socket event
      try {
        const io = req.app.get('io');
        if (io) {
          io.to(`student_${studentId}`).emit('otpGenerated', {
            visitorName,
            visitorPhone: sanitizedPhone,
            otp,
            expiresAt: otpRecord.expiresAt
          });
        }
      } catch (socketError) {
        console.error('Socket error:', socketError);
      }

      res.status(200).json({
        success: true,
        message: 'OTP sent to student successfully',
        code: 'OTP_SENT',
        otpId: otpRecord._id,
        expiresAt: otpRecord.expiresAt
      });

    } catch (error) {
      console.error('OTP Request Error:', error);
      res.status(500).json({
        success: false,
        message: 'Failed to request OTP',
        error: error.message
      });
    }
  }

  // Verify OTP
  static async verifyOTP(req, res) {
    try {
      const { visitorPhone, providedOtp, guardId } = req.body;

      // Validate required fields
      if (!visitorPhone || !providedOtp || !guardId) {
        return res.status(400).json({
          success: false,
          message: 'Missing required fields',
          code: 'MISSING_FIELDS'
        });
      }

      // Sanitize phone number to match stored format
      const sanitizedPhone = OTPUtils.sanitizePhoneNumber(visitorPhone);

      console.log('Verifying OTP for phone:', sanitizedPhone, 'OTP:', providedOtp);

      // Find the latest unused OTP for this phone
      const otpRecord = await OTP.findOne({
        visitorPhone: sanitizedPhone,
        used: false,
        locked: false
      }).sort({ createdAt: -1 });

      if (!otpRecord) {
        console.log('No OTP found for phone:', sanitizedPhone);
        recordFailedAttempt(sanitizedPhone);
        return res.status(404).json({
          success: false,
          message: 'No valid OTP found for this visitor',
          code: 'OTP_NOT_FOUND'
        });
      }

      // Check if OTP is expired
      if (OTPUtils.isOTPExpired(otpRecord.expiresAt)) {
        await OTP.findByIdAndUpdate(otpRecord._id, { locked: true });
        recordFailedAttempt(sanitizedPhone);
        
        await AuditLog.create({
          action: 'otp_failed',
          actorId: guardId,
          actorType: 'guard',
          targetId: otpRecord._id,
          targetType: 'otp',
          meta: {
            reason: 'expired',
            visitorPhone: sanitizedPhone,
            attempts: otpRecord.attempts + 1
          },
          ipAddress: req.ip,
          userAgent: req.get('User-Agent'),
          severity: 'warning'
        });

        return res.status(400).json({
          success: false,
          message: 'OTP has expired',
          code: 'OTP_EXPIRED'
        });
      }

      // Check attempts limit
      if (otpRecord.attempts >= 3) {
        await OTP.findByIdAndUpdate(otpRecord._id, { locked: true });
        recordFailedAttempt(sanitizedPhone);
        
        return res.status(400).json({
          success: false,
          message: 'Maximum verification attempts exceeded',
          code: 'OTP_LOCKED'
        });
      }

      // Verify OTP
      const isValid = await OTPUtils.verifyOTP(providedOtp, sanitizedPhone, otpRecord.otpHash);

      if (!isValid) {
        // Increment attempts
        await OTP.findByIdAndUpdate(otpRecord._id, {
          $inc: { attempts: 1 }
        });
        
        recordFailedAttempt(sanitizedPhone);

        await AuditLog.create({
          action: 'otp_failed',
          actorId: guardId,
          actorType: 'guard',
          targetId: otpRecord._id,
          targetType: 'otp',
          meta: {
            reason: 'invalid',
            visitorPhone: sanitizedPhone,
            attempts: otpRecord.attempts + 1
          },
          ipAddress: req.ip,
          userAgent: req.get('User-Agent'),
          severity: 'warning'
        });

        return res.status(400).json({
          success: false,
          message: 'Invalid OTP',
          code: 'OTP_INVALID',
          attemptsRemaining: 3 - (otpRecord.attempts + 1)
        });
      }

      // OTP is valid - mark as used
      await OTP.findByIdAndUpdate(otpRecord._id, { used: true });

      // Clear brute force record
      clearBruteForceRecord(sanitizedPhone);

      // Create visit record
      const visit = await Visit.create({
        visitorName: otpRecord.visitorName,
        visitorPhone: sanitizedPhone,
        studentId: otpRecord.studentId,
        guardId,
        purpose: otpRecord.purpose,
        method: 'otp',
        otpId: otpRecord._id,
        groupVisitors: otpRecord.isGroupOTP ? [{ 
          name: otpRecord.visitorName, 
          phone: sanitizedPhone 
        }] : [],
        isGroupVisit: otpRecord.isGroupOTP
      });

      // Get student info for response
      const student = await Student.findById(otpRecord.studentId).select('name room');

      // Log successful verification
      await AuditLog.create({
        action: 'otp_verified',
        actorId: guardId,
        actorType: 'guard',
        targetId: visit._id,
        targetType: 'visit',
        meta: {
          otpId: otpRecord._id,
          visitorName: otpRecord.visitorName,
          visitorPhone: sanitizedPhone,
          studentId: otpRecord.studentId
        },
        ipAddress: req.ip,
        userAgent: req.get('User-Agent')
      });

      // Emit socket event to all clients
      req.io.emit('otpVerified', {
        visit,
        student,
        otp: otpRecord
      });

      // Emit specific event to student
      req.io.emit(`student-${otpRecord.studentId}`, {
        type: 'otp_verified',
        visit,
        otp: otpRecord
      });

      res.json({
        success: true,
        message: 'OTP verified successfully. Entry granted.',
        visit,
        student
      });

    } catch (error) {
      console.error('OTP verification error:', error);
      res.status(500).json({
        success: false,
        message: 'Internal server error',
        code: 'SERVER_ERROR'
      });
    }
  }

  // Checkout visitor
  static async checkout(req, res) {
    try {
      const { visitId } = req.params;
      const { guardId, notes } = req.body;

      if (!guardId) {
        return res.status(400).json({
          success: false,
          message: 'Guard ID is required',
          code: 'MISSING_GUARD_ID'
        });
      }

      // Find the visit
      const visit = await Visit.findById(visitId).populate('studentId', 'name room');

      if (!visit) {
        return res.status(404).json({
          success: false,
          message: 'Visit not found',
          code: 'VISIT_NOT_FOUND'
        });
      }

      if (visit.exitAt) {
        return res.status(400).json({
          success: false,
          message: 'Visitor has already checked out',
          code: 'ALREADY_CHECKED_OUT'
        });
      }

      // Update visit with checkout time
      const updatedVisit = await Visit.findByIdAndUpdate(
        visitId,
        {
          exitAt: new Date(),
          status: 'completed',
          notes: notes || visit.notes
        },
        { new: true }
      ).populate('studentId', 'name room');

      // Log the checkout
      await AuditLog.create({
        action: 'visit_checkout',
        actorId: guardId,
        actorType: 'guard',
        targetId: visitId,
        targetType: 'visit',
        meta: {
          visitorName: visit.visitorName,
          visitorPhone: visit.visitorPhone,
          studentId: visit.studentId._id,
          duration: Math.round((updatedVisit.exitAt - visit.entryAt) / 60000) // duration in minutes
        },
        ipAddress: req.ip,
        userAgent: req.get('User-Agent')
      });

      // Emit socket event
      req.io.emit('visitCheckedOut', {
        visit: updatedVisit
      });

      res.json({
        success: true,
        message: 'Visitor checked out successfully',
        visit: updatedVisit
      });

    } catch (error) {
      console.error('Checkout error:', error);
      res.status(500).json({
        success: false,
        message: 'Internal server error',
        code: 'SERVER_ERROR'
      });
    }
  }

  // Get active visits
  static async getActiveVisits(req, res) {
    try {
      const { guardId } = req.query;

      const query = { exitAt: null, status: 'active' };
      if (guardId) {
        query.guardId = guardId;
      }

      const visits = await Visit.find(query)
        .populate('studentId', 'name room phoneNumber')
        .populate('guardId', 'name username')
        .sort({ entryAt: -1 })
        .limit(50);

      res.json({
        success: true,
        visits
      });

    } catch (error) {
      console.error('Get active visits error:', error);
      res.status(500).json({
        success: false,
        message: 'Internal server error',
        code: 'SERVER_ERROR'
      });
    }
  }

  // Get visit history
  static async getVisitHistory(req, res) {
    try {
      const { studentId, guardId, page = 1, limit = 20 } = req.query;

      const query = {};
      if (studentId) query.studentId = studentId;
      if (guardId) query.guardId = guardId;

      const skip = (page - 1) * limit;

      const visits = await Visit.find(query)
        .populate('studentId', 'name room phoneNumber')
        .populate('guardId', 'name username')
        .sort({ entryAt: -1 })
        .skip(skip)
        .limit(parseInt(limit));

      const total = await Visit.countDocuments(query);

      res.json({
        success: true,
        visits,
        pagination: {
          page: parseInt(page),
          limit: parseInt(limit),
          total,
          pages: Math.ceil(total / limit)
        }
      });

    } catch (error) {
      console.error('Get visit history error:', error);
      res.status(500).json({
        success: false,
        message: 'Internal server error',
        code: 'SERVER_ERROR'
      });
    }
  }

  // Get student's active OTPs
  static async getStudentActiveOTPs(req, res) {
    try {
      const { studentId } = req.params;

      // Get OTPs with the actual OTP values for students to share
      const otpsWithValues = await OTP.find({
        studentId,
        used: false,
        locked: false,
        expiresAt: { $gt: new Date() }
      })
      .select('+otpValue') // Include the OTP value field
      .populate('createdByGuardId', 'name username')
      .sort({ createdAt: -1 });

      const formattedOTPs = otpsWithValues.map(otp => ({
        _id: otp._id,
        visitorName: otp.visitorName,
        visitorPhone: otp.visitorPhone,
        purpose: otp.purpose,
        createdAt: otp.createdAt,
        expiresAt: otp.expiresAt,
        attempts: otp.attempts,
        groupSize: otp.groupSize,
        isGroupOTP: otp.isGroupOTP,
        createdByGuard: otp.createdByGuardId,
        otp: otp.otpValue // Include OTP for student to share
      }));

      res.json({
        success: true,
        otps: formattedOTPs
      });

    } catch (error) {
      console.error('Get student active OTPs error:', error);
      res.status(500).json({
        success: false,
        message: 'Internal server error',
        code: 'SERVER_ERROR'
      });
    }
  }

  // Get student's visit history
  static async getStudentVisits(req, res) {
    try {
      const { studentId } = req.params;
      const { page = 1, limit = 20 } = req.query;

      const skip = (page - 1) * limit;

      const visits = await Visit.find({ studentId })
        .populate('guardId', 'name username')
        .sort({ entryAt: -1 })
        .skip(skip)
        .limit(parseInt(limit));

      const total = await Visit.countDocuments({ studentId });

      res.json({
        success: true,
        visits,
        pagination: {
          page: parseInt(page),
          limit: parseInt(limit),
          total,
          pages: Math.ceil(total / limit)
        }
      });

    } catch (error) {
      console.error('Get student visits error:', error);
      res.status(500).json({
        success: false,
        message: 'Internal server error',
        code: 'SERVER_ERROR'
      });
    }
  }

  // Generate OTP by student
  static async generateStudentOTP(req, res) {
    try {
      const { visitorName, visitorPhone, purpose, groupSize = 1 } = req.body;
      const studentId = req.student._id;

      // Validate required fields
      if (!visitorName || !visitorPhone || !purpose) {
        return res.status(400).json({
          success: false,
          message: 'Missing required fields',
          code: 'MISSING_FIELDS'
        });
      }

      // Check for offensive content in purpose
      const offensiveCheck = await checkOffensiveContent(purpose);
      if (offensiveCheck.isOffensive) {
        console.log('🚫 [Server] Blocked OTP generation due to offensive content:', offensiveCheck.reason);
        return res.status(400).json({
          success: false,
          message: 'The purpose of visit contains inappropriate content. Please provide a valid and appropriate purpose.',
          details: offensiveCheck.reason,
          code: 'OFFENSIVE_CONTENT'
        });
      }

      // Validate phone number format
      const phoneRegex = /^[\+]?[(]?[0-9]{3}[)]?[-\s\.]?[0-9]{3}[-\s\.]?[0-9]{4,6}$/;
      if (!phoneRegex.test(visitorPhone.replace(/\s/g, ''))) {
        return res.status(400).json({
          success: false,
          message: 'Invalid phone number format',
          code: 'INVALID_PHONE'
        });
      }

      // Sanitize phone number
      const sanitizedPhone = OTPUtils.sanitizePhoneNumber(visitorPhone);

      // Generate OTP
      const otp = OTPUtils.generateOTP(6);
      const otpHash = await OTPUtils.hashOTP(otp, sanitizedPhone);

      // Create OTP record
      const otpRecord = await OTP.create({
        studentId,
        visitorPhone: sanitizedPhone,
        visitorName,
        otpHash,
        otpValue: otp,
        purpose,
        createdByStudentId: studentId,
        groupSize: parseInt(groupSize) || 1,
        isStudentGenerated: true
      });

      // Emit socket event
      const io = req.app.get('io');
      if (io) {
        io.to(`student_${studentId}`).emit('otpGenerated', {
          type: 'new_otp',
          otp: {
            _id: otpRecord._id,
            visitorName,
            visitorPhone: sanitizedPhone,
            purpose,
            groupSize,
            createdAt: otpRecord.createdAt,
            expiresAt: otpRecord.expiresAt,
            attempts: 0,
            otp
          }
        });
      }

      res.status(200).json({
        success: true,
        message: 'OTP generated successfully',
        otp: {
          _id: otpRecord._id,
          visitorName,
          visitorPhone: sanitizedPhone,
          purpose,
          groupSize,
          createdAt: otpRecord.createdAt,
          expiresAt: otpRecord.expiresAt,
          attempts: 0,
          otp
        }
      });

    } catch (error) {
      console.error('Generate student OTP error:', error);
      res.status(500).json({
        success: false,
        message: 'Failed to generate OTP',
        error: error.message
      });
    }
  }
}

module.exports = OTPController;
