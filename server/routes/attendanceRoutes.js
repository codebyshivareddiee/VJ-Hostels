const express = require('express');
const attendanceRouter = express.Router();
const { AttendanceRecord } = require('../models/AttendanceModel');
const MonthlyAttendance = require('../models/MonthlyAttendanceModel');
const Student = require('../models/StudentModel');
const Room = require('../models/Room');
const Outpass = require('../models/OutpassModel');
const expressAsyncHandler = require('express-async-handler');
const jwt = require('jsonwebtoken');
const mongoose = require('mongoose');
require('dotenv').config();

// Helper: determine operational attendance date and whether marking is allowed now
function getOperationalAttendanceDate(now = new Date()) {
  const current = new Date(now);
  const today = new Date(current);
  today.setHours(0, 0, 0, 0);

  let allowed = false;
  let attendanceDate = new Date(today);
  let startWindow, endWindow;

  // Check if we're between midnight and 4 AM
  if (current.getHours() >= 0 && current.getHours() < 4) {
    // We're in the early morning hours (12 AM - 4 AM)
    // This is the END of yesterday's attendance window
    // Attendance should be marked for YESTERDAY
    const yesterday = new Date(today);
    yesterday.setDate(yesterday.getDate() - 1);
    attendanceDate = yesterday;
    
    // Window started yesterday at 9 PM
    startWindow = new Date(yesterday);
    startWindow.setHours(21, 0, 0, 0);
    
    // Window ends today at 4 AM
    endWindow = new Date(today);
    endWindow.setHours(4, 0, 0, 0);
    
    allowed = true;
  } 
  // Check if we're between 9 PM and midnight
  else if (current.getHours() >= 21) {
    // We're in the evening (9 PM - 11:59 PM)
    // This is the START of today's attendance window
    // Attendance should be marked for TODAY
    attendanceDate = new Date(today);
    
    // Window starts today at 9 PM
    startWindow = new Date(today);
    startWindow.setHours(21, 0, 0, 0);
    
    // Window ends tomorrow at 4 AM
    endWindow = new Date(today);
    endWindow.setDate(endWindow.getDate() + 1);
    endWindow.setHours(4, 0, 0, 0);
    
    allowed = true;
  }
  // Outside attendance window
  else {
    // Between 4 AM and 9 PM - not allowed
    const yesterday = new Date(today);
    yesterday.setDate(yesterday.getDate() - 1);
    
    startWindow = new Date(yesterday);
    startWindow.setHours(21, 0, 0, 0);
    
    endWindow = new Date(today);
    endWindow.setHours(4, 0, 0, 0);
    
    allowed = false;
    attendanceDate = new Date(today);
  }

  attendanceDate.setHours(0, 0, 0, 0);
  return { attendanceDate, allowed, startWindow, endWindow };
}

// Helper: Update MonthlyAttendance when attendance is marked
async function updateMonthlyAttendance(studentId, attendanceDate, status) {
  try {
    const year = attendanceDate.getFullYear();
    const month = attendanceDate.getMonth() + 1;
    const day = attendanceDate.getDate();
    
    // Convert studentId to ObjectId if it's a string
    let studentObjectId = studentId;
    if (typeof studentId === 'string' && mongoose.Types.ObjectId.isValid(studentId)) {
      studentObjectId = new mongoose.Types.ObjectId(studentId);
    }
    
    // Map status to attendance character
    let attendanceChar = 'A'; // Default to absent
    if (status === 'present') {
      attendanceChar = 'P';
    } else if (status.includes('home_pass') || status.includes('late_pass')) {
      attendanceChar = 'H';
    }

    console.log(`[Monthly Attendance] Updating: studentId=${studentObjectId}, year=${year}, month=${month}, day=${day}, status=${status}, char=${attendanceChar}`);

    // Ensure monthly record exists (uses static method from model)
    let monthlyRecord = await MonthlyAttendance.ensureExists(studentObjectId, year, month);
    
    // Use Map.set() to update the attendance for this day
    // The pre-save hook will automatically recalculate the summary
    monthlyRecord.attendance.set(day.toString(), attendanceChar);
    
    await monthlyRecord.save();
    console.log(`[Monthly Attendance] ✓ Saved. Summary: present=${monthlyRecord.summary.present}, absent=${monthlyRecord.summary.absent}, home_pass=${monthlyRecord.summary.home_pass}`);
  } catch (error) {
    console.error('[Monthly Attendance] ✗ Error:', error);
    // Don't throw - allow attendance marking to succeed even if monthly update fails
  }
}

// Middleware to verify security role
const verifySecurityRole = (req, res, next) => {
  try {
    const token = req.headers.authorization?.split(" ")[1];
    if (!token) {
      return res.status(401).json({ message: "Unauthorized - No token provided" });
    }

    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    console.log('Token decoded:', { role: decoded.role, id: decoded.id }); // Debug log
    
    // Accept both 'security' and 'guard' roles for backward compatibility
    if (decoded.role !== 'security' && decoded.role !== 'guard') {
      return res.status(403).json({ 
        message: "Access denied - Security role required",
        receivedRole: decoded.role 
      });
    }

    req.guardId = decoded.id;
    req.guardName = decoded.name;
    next();
  } catch (error) {
    console.error('Token verification error:', error.message);
    res.status(401).json({ message: "Invalid token" });
  }
};

// Apply security middleware to all routes
attendanceRouter.use(verifySecurityRole);

// Get all floors with room counts
attendanceRouter.get('/floors', expressAsyncHandler(async (req, res) => {
  try {
    const floors = await Room.aggregate([
      {
        $match: { floor: { $exists: true, $ne: null } }
      },
      {
        $group: {
          _id: '$floor',
          roomCount: { $sum: 1 },
          totalCapacity: { $sum: '$capacity' },
          totalOccupants: { $sum: { $size: '$occupants' } }
        }
      },
      {
        $sort: { _id: 1 }
      }
    ]);

    res.status(200).json(floors);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
}));

// Get rooms by floor with student details
attendanceRouter.get('/floor/:floorNumber/rooms', expressAsyncHandler(async (req, res) => {
  try {
    const { floorNumber } = req.params;
    const { date } = req.query;

    // Parse date if provided else use operational date (9 PM to 4 AM window)
    let attendanceDate;
    if (date) {
      attendanceDate = new Date(date);
      attendanceDate.setHours(0, 0, 0, 0);
    } else {
      const { attendanceDate: opDate } = getOperationalAttendanceDate();
      attendanceDate = opDate;
    }

    const rooms = await Room.find({ floor: parseInt(floorNumber) })
      .populate({
        path: 'occupants',
        select: 'name rollNumber email phoneNumber room'
      })
      .sort({ roomNumber: 1 });

    // Get attendance records for this floor and date
    const attendanceRecords = await AttendanceRecord.find({
      floor: parseInt(floorNumber),
      date: attendanceDate
    });

    // Get active outpasses for the selected date window [attendanceDate, nextDay)
    const nextDay = new Date(attendanceDate);
    nextDay.setDate(nextDay.getDate() + 1);

    const activeOutpasses = await Outpass.find({
      status: { $in: ['approved', 'out'] },
      type: { $in: ['home pass', 'late pass'] },
      $or: [
        // Approved passes planned for the selected day
        { status: 'approved', outTime: { $gte: attendanceDate, $lt: nextDay } },
        // Students who are currently out during the selected day (inTime may be null until they return)
        {
          status: 'out',
          $and: [
            { $or: [
              { actualOutTime: { $gte: attendanceDate, $lt: nextDay } },
              { outTime: { $gte: attendanceDate, $lt: nextDay } }
            ]},
            { $or: [ { inTime: null }, { inTime: { $gte: attendanceDate } } ] }
          ]
        },
        // Any pass that overlaps the selected day window
        {
          outTime: { $lt: nextDay },
          inTime: { $gte: attendanceDate }
        }
      ]
    });

    // Create a map of student attendance
    const attendanceMap = {};
    attendanceRecords.forEach(record => {
      attendanceMap[record.studentId.toString()] = record.status;
    });

    // Create a map of students with outpasses (home pass and late pass)
    const outpassMap = {};
    activeOutpasses.forEach(pass => {
      const studentKey = pass.rollNumber; // Outpass model stores rollNumber; used to match student.rollNumber
      let status;
      
      if (pass.type === 'home pass') {
        status = pass.status === 'out' ? 'home_pass_used' : 'home_pass_approved';
      } else if (pass.type === 'late pass') {
        status = pass.status === 'out' ? 'late_pass_used' : 'late_pass_approved';
      }
      
      outpassMap[studentKey] = {
        status: status,
        type: pass.type,
        outTime: pass.actualOutTime || pass.outTime,
        inTime: pass.inTime
      };
    });

    // Create a map of rooms that have been marked (have attendance records for this date)
    const markedRooms = new Set();
    attendanceRecords.forEach(record => {
      markedRooms.add(record.roomNumber);
    });

    // Enrich room data with attendance status
    const enrichedRooms = rooms.map(room => {
      const studentsWithStatus = room.occupants.map(student => {
        const studentId = student._id.toString();
        const rollNumber = student.rollNumber;
        
        // Check if student has attendance marked
        let status = attendanceMap[studentId];
        
        // If no attendance marked, check for outpass (home pass or late pass)
        if (!status && outpassMap[rollNumber]) {
          status = outpassMap[rollNumber].status;
        }
        
        // Default to absent if no status
        if (!status) {
          status = 'absent';
        }

        return {
          _id: student._id,
          name: student.name,
          rollNumber: student.rollNumber,
          email: student.email,
          phoneNumber: student.phoneNumber,
          status: status,
          outpassInfo: outpassMap[rollNumber] || null
        };
      });

      return {
        _id: room._id,
        roomNumber: room.roomNumber,
        floor: room.floor,
        capacity: room.capacity,
        currentOccupancy: room.occupants.length,
        students: studentsWithStatus,
        isMarked: markedRooms.has(room.roomNumber) // Add room save status
      };
    });

    res.status(200).json(enrichedRooms);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
}));

// Mark attendance for a room
attendanceRouter.post('/mark-room', expressAsyncHandler(async (req, res) => {
  try {
    const { roomNumber, floor, students, date } = req.body;

    if (!roomNumber || floor === null || floor === undefined || !students || !Array.isArray(students)) {
      return res.status(400).json({ message: "Invalid request data" });
    }

    // Parse date if provided else use operational date (9 PM to 4 AM window)
    let attendanceDate;
    if (date) {
      attendanceDate = new Date(date);
      attendanceDate.setHours(0, 0, 0, 0);
    } else {
      const { attendanceDate: opDate } = getOperationalAttendanceDate();
      attendanceDate = opDate;
    }

    // Validate time window: Only allow marking 21:00 - 04:00
    const { allowed, startWindow, endWindow } = getOperationalAttendanceDate();
    if (!allowed) {
      return res.status(403).json({
        message: 'Attendance can be marked only between 9:00 PM and 4:00 AM.',
        allowedWindow: {
          start: startWindow.toTimeString().split(' ')[0],
          end: endWindow.toTimeString().split(' ')[0]
        }
      });
    }

    const results = [];
    const errors = [];

    for (const studentData of students) {
      try {
        const { studentId, rollNumber, name, status } = studentData;

        // Skip if status is home_pass_used (auto-managed)
        if (status === 'home_pass_used') {
          continue;
        }

        // Update or create attendance record
        const attendanceRecord = await AttendanceRecord.findOneAndUpdate(
          {
            studentId: studentId,
            date: attendanceDate
          },
          {
            studentId: studentId,
            rollNumber: rollNumber,
            name: name,
            roomNumber: roomNumber,
            floor: parseInt(floor),
            status: status,
            date: attendanceDate,
            markedBy: req.guardId,
            markedAt: new Date()
          },
          {
            upsert: true,
            new: true,
            setDefaultsOnInsert: true
          }
        );

        // Update monthly attendance record for the student
        await updateMonthlyAttendance(studentId, attendanceDate, status);

        results.push(attendanceRecord);
      } catch (error) {
        errors.push({
          studentId: studentData.studentId,
          error: error.message
        });
      }
    }

    res.status(200).json({
      message: "Attendance marked successfully",
      success: results.length,
      failed: errors.length,
      results: results,
      errors: errors
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
}));

// Mark attendance for entire floor
attendanceRouter.post('/mark-floor', expressAsyncHandler(async (req, res) => {
  try {
    const { floor, rooms, date } = req.body;

    if (floor === null || floor === undefined || !rooms || !Array.isArray(rooms)) {
      return res.status(400).json({ message: "Invalid request data" });
    }

    // Parse date if provided else use operational date (9 PM to 4 AM window)
    let attendanceDate;
    if (date) {
      attendanceDate = new Date(date);
      attendanceDate.setHours(0, 0, 0, 0);
    } else {
      const { attendanceDate: opDate } = getOperationalAttendanceDate();
      attendanceDate = opDate;
    }

    // Validate time window: Only allow marking 21:00 - 04:00
    const { allowed, startWindow, endWindow } = getOperationalAttendanceDate();
    if (!allowed) {
      return res.status(403).json({
        message: 'Attendance can be marked only between 9:00 PM and 4:00 AM.',
        allowedWindow: {
          start: startWindow.toTimeString().split(' ')[0],
          end: endWindow.toTimeString().split(' ')[0]
        }
      });
    }

    let totalSuccess = 0;
    let totalFailed = 0;
    const roomResults = [];

    for (const roomData of rooms) {
      const { roomNumber, students } = roomData;
      
      const results = [];
      const errors = [];

      for (const studentData of students) {
        try {
          const { studentId, rollNumber, name, status } = studentData;

          // Skip if status is home_pass_used (auto-managed)
          if (status === 'home_pass_used') {
            continue;
          }

          const attendanceRecord = await AttendanceRecord.findOneAndUpdate(
            {
              studentId: studentId,
              date: attendanceDate
            },
            {
              studentId: studentId,
              rollNumber: rollNumber,
              name: name,
              roomNumber: roomNumber,
              floor: parseInt(floor),
              status: status,
              date: attendanceDate,
              markedBy: req.guardId,
              markedAt: new Date()
            },
            {
              upsert: true,
              new: true,
              setDefaultsOnInsert: true
            }
          );

          // Update monthly attendance record for the student
          await updateMonthlyAttendance(studentId, attendanceDate, status);

          results.push(attendanceRecord);
          totalSuccess++;
        } catch (error) {
          errors.push({
            studentId: studentData.studentId,
            error: error.message
          });
          totalFailed++;
        }
      }

      roomResults.push({
        roomNumber: roomNumber,
        success: results.length,
        failed: errors.length
      });
    }

    res.status(200).json({
      message: "Floor attendance marked successfully",
      totalSuccess: totalSuccess,
      totalFailed: totalFailed,
      roomResults: roomResults
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
}));

// Get daily summary
attendanceRouter.get('/summary', expressAsyncHandler(async (req, res) => {
  try {
    const { date } = req.query;

    // Parse date or use today
    const attendanceDate = date ? new Date(date) : new Date();
    attendanceDate.setHours(0, 0, 0, 0);

    // Get total students
    const totalStudents = await Student.countDocuments({ is_active: true, room: { $ne: null } });

    // Get attendance summary
    const attendanceSummary = await AttendanceRecord.aggregate([
      {
        $match: { date: attendanceDate }
      },
      {
        $group: {
          _id: '$status',
          count: { $sum: 1 }
        }
      }
    ]);

    // Get floor-wise room coverage (unique rooms that have been marked)
    const floorRoomCoverage = await AttendanceRecord.aggregate([
      {
        $match: { date: attendanceDate }
      },
      {
        $group: {
          _id: { 
            floor: '$floor',
            roomNumber: '$roomNumber'
          }
        }
      },
      {
        $group: {
          _id: '$_id.floor',
          markedRooms: { $sum: 1 }
        }
      },
      {
        $sort: { _id: 1 }
      }
    ]);

    // Get total rooms per floor
    const floorRoomTotals = await Room.aggregate([
      {
        $match: { floor: { $exists: true, $ne: null } }
      },
      {
        $group: {
          _id: '$floor',
          totalRooms: { $sum: 1 }
        }
      }
    ]);

    // Merge floor data
    const floorMap = {};
    floorRoomTotals.forEach(floor => {
      floorMap[floor._id] = { total: floor.totalRooms, marked: 0 };
    });

    floorRoomCoverage.forEach(floor => {
      if (floorMap[floor._id]) {
        floorMap[floor._id].marked = floor.markedRooms;
      }
    });

    const floorProgress = Object.keys(floorMap).map(floor => ({
      floor: parseInt(floor),
      total: floorMap[floor].total,
      marked: floorMap[floor].marked,
      percentage: floorMap[floor].total > 0 
        ? Math.round((floorMap[floor].marked / floorMap[floor].total) * 100) 
        : 0
    })).sort((a, b) => a.floor - b.floor);

    // Format attendance summary
    const statusCounts = {
      present: 0,
      absent: 0,
      home_pass_approved: 0,
      home_pass_used: 0,
      late_pass_approved: 0,
      late_pass_used: 0
    };

    attendanceSummary.forEach(item => {
      statusCounts[item._id] = item.count;
    });

    const totalMarked = Object.values(statusCounts).reduce((sum, count) => sum + count, 0);
    const completionPercentage = totalStudents > 0 
      ? Math.round((totalMarked / totalStudents) * 100) 
      : 0;

    res.status(200).json({
      date: attendanceDate,
      totalStudents: totalStudents,
      totalMarked: totalMarked,
      completionPercentage: completionPercentage,
      statusCounts: statusCounts,
      floorProgress: floorProgress
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
}));

// Get attendance history for a specific date range
attendanceRouter.get('/history', expressAsyncHandler(async (req, res) => {
  try {
    const { startDate, endDate, floor, roomNumber } = req.query;

    const query = {};

    if (startDate && endDate) {
      const start = new Date(startDate);
      start.setHours(0, 0, 0, 0);
      const end = new Date(endDate);
      end.setHours(23, 59, 59, 999);
      query.date = { $gte: start, $lte: end };
    }

    if (floor) {
      query.floor = parseInt(floor);
    }

    if (roomNumber) {
      query.roomNumber = roomNumber;
    }

    const records = await AttendanceRecord.find(query)
      .populate('markedBy', 'name username')
      .sort({ date: -1, floor: 1, roomNumber: 1 });

    res.status(200).json(records);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
}));

module.exports = attendanceRouter;
