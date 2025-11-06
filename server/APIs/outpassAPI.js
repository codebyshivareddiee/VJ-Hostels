const exp = require('express');
const outpassApp = exp.Router();
const Outpass = require('../models/OutpassModel');
const FoodPause = require('../models/FoodPause');
const StudentModel = require('../models/StudentModel');
const expressAsyncHandler = require('express-async-handler');
const crypto = require('crypto');
const verifyAdmin = require('../middleware/verifyAdminMiddleware');
const verifyStudent = require('../middleware/verifyStudentMiddleware');

// Meal timings (24hr format)
const mealTimings = {
    breakfast: { start: "07:00", end: "09:00" },
    lunch: { start: "12:30", end: "14:00" },
    snacks: { start: "16:30", end: "18:30" },
    dinner: { start: "19:30", end: "21:00" }
};

// Generate unique QR code data
function generateQRCode(outpassId, studentId) {
    const timestamp = Date.now();
    const randomString = crypto.randomBytes(8).toString('hex');
    return `${outpassId}-${studentId}-${timestamp}-${randomString}`;
}

// Helper function to get meals that fall within a time window
function getMealsInTimeWindow(outTime, inTime) {
    const mealsToKeep = [];
    
    // Convert times to time-only format for comparison
    const outTimeStr = outTime.toTimeString().slice(0, 5); // HH:MM format
    const inTimeStr = inTime.toTimeString().slice(0, 5);
    
    // Check each meal
    for (const [meal, timing] of Object.entries(mealTimings)) {
        // If meal window overlaps with out/in window
        // Meal starts before student returns AND meal ends after student leaves
        if (timing.start < inTimeStr && timing.end > outTimeStr) {
            mealsToKeep.push(meal);
        }
    }
    
    return mealsToKeep.length > 0 ? mealsToKeep.join(',') : null;
}

// Admin approves an outpass
outpassApp.put('/approve/:id', verifyAdmin, expressAsyncHandler(async (req, res) => {
    try {
        const { id } = req.params;
        const { adminName } = req.body; // Admin's name from the request

        const outpass = await Outpass.findById(id);
        if (!outpass) {
            return res.status(404).json({ message: "Outpass not found" });
        }

        if (outpass.status !== 'pending') {
            return res.status(400).json({ message: "Outpass is not in pending status" });
        }

        // Generate QR code data
        const qrCodeData = generateQRCode(outpass._id, outpass.rollNumber);

        // Update outpass status
        outpass.status = 'approved';
        outpass.qrCodeData = qrCodeData;
        outpass.approvedBy = adminName || 'Admin';
        outpass.approvedAt = new Date();

        await outpass.save();

        // Pause meals for the student during the outpass period
        try {
            const student = await StudentModel.findOne({ rollNumber: outpass.rollNumber });
            if (student) {
                // Get meals that fall within the outpass time window
                const mealsInWindow = getMealsInTimeWindow(outpass.outTime, outpass.inTime);
                
                if (mealsInWindow) {
                    // Convert dates to YYYY-MM-DD format for FoodPause
                    const pauseFromDate = outpass.outTime.toISOString().split('T')[0];
                    const resumeFromDate = outpass.inTime.toISOString().split('T')[0];
                    
                    console.log(`Creating food pause for student ${student.rollNumber}:`);
                    console.log(`- Pause from: ${pauseFromDate}`);
                    console.log(`- Resume from: ${resumeFromDate}`);
                    console.log(`- Meals: ${mealsInWindow}`);
                    
                    // Create or update FoodPause record with only relevant meals
                    const foodPause = await FoodPause.findOneAndUpdate(
                        { student_id: student._id },
                        {
                            $set: {
                                pause_from: pauseFromDate,
                                pause_meals: mealsInWindow,
                                resume_from: resumeFromDate,
                                resume_meals: mealsInWindow
                            }
                        },
                        { new: true, upsert: true }
                    );
                    
                    console.log('Food pause record created/updated:', foodPause);
                } else {
                    console.log(`No meals to pause for outpass from ${outpass.outTime} to ${outpass.inTime}`);
                }
            }
        } catch (foodPauseError) {
            console.error('Error creating food pause record:', foodPauseError);
            // Don't fail the outpass approval if food pause fails
        }

        res.status(200).json({
            message: 'Outpass approved successfully',
            outpass: updatedOutpass,
            redirectToFoodPause: true, // Signal frontend to redirect
            foodPauseUrl: `/student/food-pause?outpassId=${outpass._id}&approved=true`
        });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
}));

// Admin rejects an outpass
outpassApp.put('/reject/:id', verifyAdmin, expressAsyncHandler(async (req, res) => {
    try {
        const { id } = req.params;
        const { adminName } = req.body;

        const outpass = await Outpass.findById(id);
        if (!outpass) {
            return res.status(404).json({ message: "Outpass not found" });
        }

        if (outpass.status !== 'pending') {
            return res.status(400).json({ message: "Outpass is not in pending status" });
        }

        outpass.status = 'rejected';
        outpass.approvedBy = adminName || 'Admin';
        outpass.approvedAt = new Date();

        await outpass.save();

        res.status(200).json({ 
            message: "Outpass rejected successfully", 
            outpass 
        });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
}));

// Get approved outpasses for a student (Current Passes)
outpassApp.get('/current-passes/:rollNumber', verifyStudent, expressAsyncHandler(async (req, res) => {
    try {
        const { rollNumber } = req.params;

        // Get approved, late, and out outpasses that are not yet returned
        const currentPasses = await Outpass.find({ 
            rollNumber,
            status: { $in: ['approved', 'late', 'out'] }
        }).sort({ approvedAt: -1 });

        res.status(200).json({ currentPasses });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
}));

// Get outpass history (returned or rejected)
outpassApp.get('/history/:rollNumber', verifyStudent, expressAsyncHandler(async (req, res) => {
    try {
        const { rollNumber } = req.params;

        const history = await Outpass.find({ 
            rollNumber,
            status: { $in: ['returned', 'rejected'] }
        }).sort({ createdAt: -1 });

        res.status(200).json({ history });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
}));

// Security scan QR code - Mark as OUT
outpassApp.post('/scan/out', expressAsyncHandler(async (req, res) => {
    try {
        const { qrCodeData } = req.body;

        if (!qrCodeData) {
            return res.status(400).json({ message: "QR code data is required" });
        }

        const outpass = await Outpass.findOne({ qrCodeData });
        if (!outpass) {
            return res.status(404).json({ message: "Invalid QR code" });
        }

        // Allow both 'approved' and 'late' status to scan out
        if (outpass.status !== 'approved' && outpass.status !== 'late') {
            return res.status(400).json({ 
                message: `Cannot scan out. Current status: ${outpass.status}` 
            });
        }

        // Update status to 'out'
        outpass.status = 'out';
        outpass.actualOutTime = new Date();
        await outpass.save();

        // Include late indicator in response
        const lateMessage = outpass.isLate ? " (Late Entry)" : "";
        
        res.status(200).json({ 
            message: `Student checked out successfully${lateMessage}`, 
            outpass,
            student: {
                name: outpass.name,
                rollNumber: outpass.rollNumber,
                outTime: outpass.actualOutTime,
                isLate: outpass.isLate
            }
        });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
}));

// Security scan QR code - Mark as RETURNED
outpassApp.post('/scan/in', expressAsyncHandler(async (req, res) => {
    try {
        const { qrCodeData } = req.body;

        if (!qrCodeData) {
            return res.status(400).json({ message: "QR code data is required" });
        }

        const outpass = await Outpass.findOne({ qrCodeData });
        if (!outpass) {
            return res.status(404).json({ message: "Invalid QR code" });
        }

        if (outpass.status !== 'out') {
            return res.status(400).json({ 
                message: `Cannot scan in. Current status: ${outpass.status}` 
            });
        }

        // Check if QR code has expired (past scheduled in-time) and not regenerated as late
        const now = new Date();
        const scheduledInTime = new Date(outpass.inTime);
        
        if (now > scheduledInTime && !outpass.isLate) {
            return res.status(400).json({ 
                message: "QR code expired. Return time has passed. Student must regenerate QR code as Late.",
                scheduledInTime: outpass.inTime,
                currentTime: now,
                requiresRegeneration: true
            });
        }

        // Update status to 'returned'
        outpass.status = 'returned';
        outpass.actualInTime = new Date();
        await outpass.save();

        // Update resume_from date if student has returned before inTime
        try {
            const student = await StudentModel.findOne({ rollNumber: outpass.rollNumber });
            if (student) {
                // Get the food pause record to find which meals were paused
                const foodPause = await FoodPause.findOne({ student_id: student._id });
                
                if (foodPause && foodPause.pause_meals) {
                    // Get meals that were paused
                    const resumeMeals = foodPause.pause_meals;
                    
                    // Get current time string in HH:MM format
                    const actualReturnTimeStr = outpass.actualInTime.toTimeString().slice(0, 5);
                    const expectedReturnTimeStr = outpass.inTime.toTimeString().slice(0, 5);
                    
                    let resumeDate;
                    
                    // If student returned before expected inTime, resume from today
                    if (actualReturnTimeStr < expectedReturnTimeStr) {
                        resumeDate = new Date().toISOString().split('T')[0];
                    } else {
                        // If returned after or at expected inTime, resume from original inTime date
                        resumeDate = outpass.inTime.toISOString().split('T')[0];
                    }
                    
                    // Update the FoodPause record with new resume date
                    await FoodPause.findOneAndUpdate(
                        { student_id: student._id },
                        {
                            $set: {
                                resume_from: resumeDate,
                                resume_meals: resumeMeals
                            }
                        },
                        { new: true }
                    );
                }
            }
        } catch (foodPauseError) {
            console.error('Error updating food pause record:', foodPauseError);
            // Don't fail the scan-in if food resume fails
        }

        // Include late indicator in response
        const lateMessage = outpass.isLate ? " (Late Return)" : "";
        
        res.status(200).json({ 
            message: `Student checked in successfully${lateMessage}`, 
            outpass,
            student: {
                name: outpass.name,
                rollNumber: outpass.rollNumber,
                inTime: outpass.actualInTime,
                isLate: outpass.isLate
            }
        });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
}));

// Get outpass details by ID
outpassApp.get('/details/:id', expressAsyncHandler(async (req, res) => {
    try {
        const { id } = req.params;
        
        const outpass = await Outpass.findById(id);
        if (!outpass) {
            return res.status(404).json({ message: "Outpass not found" });
        }

        res.status(200).json(outpass);
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
}));

// Get outpass details by QR code (for verification)
outpassApp.post('/verify-qr', expressAsyncHandler(async (req, res) => {
    try {
        const { qrCodeData } = req.body;

        if (!qrCodeData) {
            return res.status(400).json({ message: "QR code data is required" });
        }

        const outpass = await Outpass.findOne({ qrCodeData });
        if (!outpass) {
            return res.status(404).json({ message: "Invalid QR code" });
        }

        const now = new Date();
        const scheduledInTime = new Date(outpass.inTime);
        
        // Check if QR code has expired based on status and time
        let isExpired = false;
        let expirationReason = null;
        
        // For 'out' status: Check if current time is past scheduled in-time
        if (outpass.status === 'out' && !outpass.isLate && now > scheduledInTime) {
            isExpired = true;
            expirationReason = 'QR code expired. Return time has passed. Please regenerate as Late.';
        }

        res.status(200).json({ 
            valid: !isExpired,
            expired: isExpired,
            expirationReason: expirationReason,
            outpass: {
                _id: outpass._id,
                name: outpass.name,
                rollNumber: outpass.rollNumber,
                status: outpass.status,
                outTime: outpass.outTime,
                inTime: outpass.inTime,
                reason: outpass.reason,
                type: outpass.type,
                actualOutTime: outpass.actualOutTime,
                actualInTime: outpass.actualInTime,
                isLate: outpass.isLate,
                regeneratedAt: outpass.regeneratedAt
            }
        });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
}));

// Get all active outpasses (for security dashboard)
outpassApp.get('/active-passes', expressAsyncHandler(async (req, res) => {
    try {
        const activePasses = await Outpass.find({ 
            status: { $in: ['approved', 'late', 'out'] }
        }).sort({ approvedAt: -1 });

        res.status(200).json({ activePasses });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
}));

// Get security dashboard statistics
outpassApp.get('/security-stats', expressAsyncHandler(async (req, res) => {
    try {
        const today = new Date();
        today.setHours(0, 0, 0, 0);

        const approvedCount = await Outpass.countDocuments({ status: 'approved' });
        const outCount = await Outpass.countDocuments({ status: 'out' });
        const returnedTodayCount = await Outpass.countDocuments({ 
            status: 'returned',
            actualInTime: { $gte: today }
        });

        const recentActivity = await Outpass.find({
            $or: [
                { actualOutTime: { $gte: today } },
                { actualInTime: { $gte: today } }
            ]
        }).sort({ updatedAt: -1 }).limit(10);

        res.status(200).json({
            approvedCount,
            outCount,
            returnedTodayCount,
            recentActivity
        });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
}));

// Regenerate QR code for expired pass (mark as late)
outpassApp.post('/regenerate-qr/:id', verifyStudent, expressAsyncHandler(async (req, res) => {
    try {
        const { id } = req.params;
        
        const outpass = await Outpass.findById(id);
        if (!outpass) {
            return res.status(404).json({ message: "Outpass not found" });
        }

        const now = new Date();
        const scheduledOutTime = new Date(outpass.outTime);
        const scheduledInTime = new Date(outpass.inTime);
        
        // Handle 'approved' status - expired before check-out
        if (outpass.status === 'approved') {
            // Allow regeneration if current time is past the scheduled out time
            // or within a grace period (e.g., 30 minutes before)
            const gracePeriodMinutes = 30;
            const gracePeriodTime = new Date(scheduledOutTime.getTime() - (gracePeriodMinutes * 60 * 1000));
            
            if (now < gracePeriodTime) {
                return res.status(400).json({ 
                    message: "QR code is still valid. Can only regenerate after scheduled time",
                    scheduledOutTime: outpass.outTime
                });
            }

            // Generate new QR code and mark as late
            const newQRCodeData = generateQRCode(outpass._id, outpass.rollNumber);
            
            outpass.qrCodeData = newQRCodeData;
            outpass.status = 'late';
            outpass.isLate = true;
            outpass.regeneratedAt = new Date();

            await outpass.save();

            return res.status(200).json({
                message: 'QR code regenerated successfully. Pass marked as Late for check-out.',
                outpass: {
                    _id: outpass._id,
                    name: outpass.name,
                    rollNumber: outpass.rollNumber,
                    status: outpass.status,
                    qrCodeData: outpass.qrCodeData,
                    outTime: outpass.outTime,
                    inTime: outpass.inTime,
                    type: outpass.type,
                    reason: outpass.reason,
                    isLate: outpass.isLate,
                    regeneratedAt: outpass.regeneratedAt,
                    parentMobileNumber: outpass.parentMobileNumber,
                    studentMobileNumber: outpass.studentMobileNumber,
                    actualOutTime: outpass.actualOutTime
                }
            });
        }
        
        // Handle 'out' status - expired after student left, trying to check-in late
        if (outpass.status === 'out') {
            // Check if current time is past scheduled in-time
            if (now <= scheduledInTime) {
                return res.status(400).json({ 
                    message: "QR code is still valid for check-in. Return time has not passed yet.",
                    scheduledInTime: outpass.inTime
                });
            }

            // Generate new QR code for late check-in
            const newQRCodeData = generateQRCode(outpass._id, outpass.rollNumber);
            
            outpass.qrCodeData = newQRCodeData;
            outpass.isLate = true;
            outpass.regeneratedAt = new Date();
            // Keep status as 'out' but mark as late

            await outpass.save();

            return res.status(200).json({
                message: 'QR code regenerated successfully. Marked as Late for check-in.',
                outpass: {
                    _id: outpass._id,
                    name: outpass.name,
                    rollNumber: outpass.rollNumber,
                    status: outpass.status,
                    qrCodeData: outpass.qrCodeData,
                    outTime: outpass.outTime,
                    inTime: outpass.inTime,
                    type: outpass.type,
                    reason: outpass.reason,
                    isLate: outpass.isLate,
                    regeneratedAt: outpass.regeneratedAt,
                    parentMobileNumber: outpass.parentMobileNumber,
                    studentMobileNumber: outpass.studentMobileNumber,
                    actualOutTime: outpass.actualOutTime
                }
            });
        }

        // Invalid status for regeneration
        return res.status(400).json({ 
            message: `Cannot regenerate QR code for ${outpass.status} passes`,
            currentStatus: outpass.status
        });

    } catch (error) {
        console.error('Error regenerating QR code:', error);
        res.status(500).json({ error: error.message });
    }
}));

module.exports = outpassApp;