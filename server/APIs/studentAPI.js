const exp = require('express');
const expressAsyncHandler = require('express-async-handler');
const studentApp = exp.Router();
const Announcement = require('../models/AnnouncementModel');
const Complaint = require('../models/ComplaintModel');
const CommunityPost = require('../models/CommunityPostModel');
const Outpass = require('../models/OutpassModel');
const jwt = require('jsonwebtoken');
const bcrypt = require('bcrypt');
const Student = require('../models/StudentModel');
const mongoose = require('mongoose');
const { uploadProfilePhoto, uploadComplaintImage, uploadCommunityPostImage } = require('../middleware/uploadMiddleware');
const { AttendanceRecord } = require('../models/AttendanceModel');
const MonthlyAttendance = require('../models/MonthlyAttendanceModel');
const { verifyStudent } = require('../middleware/verifyToken');
const { checkOffensiveContent } = require('../utils/offensiveContentChecker');
require('dotenv').config();



// APIs
studentApp.get('/', (req, res) => {
    res.send('message from Student API');
});


studentApp.post('/login', expressAsyncHandler(async (req, res) => {
    try {
        const { rollNumber, username, password } = req.body;

        // Try finding student by rollNumber or username
        const student = await Student.findOne({
            $or: [
                { rollNumber },
                { username }
            ],
            is_active: true
        });
        
        if (!student || !(await bcrypt.compare(password, student.password))) {
            return res.status(401).json({ message: "Invalid credentials or inactive account" });
        }

        const token = jwt.sign({ id: student._id, role: 'student' }, process.env.JWT_SECRET, { expiresIn: '7d' });

        res.status(200).json({
            message: "Login successful",
            token,
            student: {
                id: student._id,
                name: student.name,
                rollNumber: student.rollNumber,
                branch: student.branch,
                year: student.year,
                room: student.room,
                profilePhoto: student.profilePhoto,
                phoneNumber: student.phoneNumber || '',
                parentMobileNumber: student.parentMobileNumber || '',
                email: student.email,

                is_active: student.is_active
            }
        });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
}));

// Attendance stats for the logged-in student using MonthlyAttendance model
// GET /student-api/attendance/stats?from=YYYY-MM-DD&to=YYYY-MM-DD
studentApp.get('/attendance/stats', verifyStudent, expressAsyncHandler(async (req, res) => {
    try {
        const { from, to } = req.query;
        
        // Use current date in IST timezone properly
        const now = new Date();
        const end = to ? new Date(to + 'T23:59:59') : new Date(now.getFullYear(), now.getMonth(), now.getDate());
        const start = from ? new Date(from + 'T00:00:00') : new Date(end.getFullYear(), end.getMonth(), end.getDate() - 29);

        console.log(`[Attendance Stats API] Query params - from: ${from}, to: ${to}`);
        console.log(`[Attendance Stats API] Now: ${now.toISOString()}`);
        console.log(`[Attendance Stats API] Start date: ${start.toISOString()} (${start.toDateString()})`);
        console.log(`[Attendance Stats API] End date: ${end.toISOString()} (${end.toDateString()})`);
        console.log(`[Attendance Stats API] Start month: ${start.getMonth() + 1}, End month: ${end.getMonth() + 1}`);

        // Get student ID as ObjectId
        const studentId = req.studentId;
        
        // Convert to ObjectId if it's a string
        let studentObjectId = studentId;
        if (typeof studentId === 'string' && mongoose.Types.ObjectId.isValid(studentId)) {
            studentObjectId = new mongoose.Types.ObjectId(studentId);
        }
        
        console.log(`[Attendance Stats API] studentId=${studentId}, type=${typeof studentId}`);
        
        const student = await Student.findById(studentObjectId).select('_id').lean();
        if (!student) {
            console.log(`[Attendance Stats API] Student not found`);
            return res.status(404).json({ error: 'Student not found' });
        }

        // Collect all months in the date range
        const months = [];
        const startYear = start.getFullYear();
        const startMonth = start.getMonth(); // 0-11
        const endYear = end.getFullYear();
        const endMonth = end.getMonth(); // 0-11
        
        let currentYear = startYear;
        let currentMonth = startMonth;
        
        while (currentYear < endYear || (currentYear === endYear && currentMonth <= endMonth)) {
            months.push({ 
                year: currentYear, 
                month: currentMonth + 1  // Convert to 1-12
            });
            
            // Move to next month
            currentMonth++;
            if (currentMonth > 11) {
                currentMonth = 0;
                currentYear++;
            }
        }

        console.log(`[Attendance Stats API] Searching months:`, months);

        // Fetch all monthly attendance records using ObjectId
        const monthlyRecords = await MonthlyAttendance.find({
            student_id: studentObjectId,
            $or: months.map(m => ({ year: m.year, month: m.month }))
        }).lean();

        console.log(`[Attendance Stats API] Found ${monthlyRecords.length} records`);

        // Build attendance map (date -> status) and accumulate TOTAL counts
        // IMPORTANT: Totals are cumulative across ALL months in the date range
        // This gives the student their total attendance for the selected period
        const attendanceByDate = new Map();
        let totalPresent = 0, totalAbsent = 0, totalHomePass = 0;

        monthlyRecords.forEach(record => {
            console.log(`[Attendance Stats API] Processing record: year=${record.year}, month=${record.month}`);
            
            // Accumulate summary counts from pre-computed MongoDB summary
            // Each monthly record has a summary that's auto-calculated by pre-save hook
            if (record.summary) {
                totalPresent += record.summary.present || 0;
                totalAbsent += record.summary.absent || 0;
                totalHomePass += record.summary.home_pass || 0;
                console.log(`[Attendance Stats API] Added summary: P=${record.summary.present}, A=${record.summary.absent}, H=${record.summary.home_pass}`);
            }

            // Map each day in attendance for calendar display
            // .lean() returns plain object (not Map), so use Object.entries()
            if (record.attendance) {
                Object.entries(record.attendance).forEach(([day, status]) => {
                    const dateStr = `${record.year}-${String(record.month).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
                    attendanceByDate.set(dateStr, status);
                });
            }
        });

        const totalMarked = totalPresent + totalAbsent + totalHomePass;
        const attendanceRate = totalMarked > 0 ? Math.round((totalPresent / totalMarked) * 100) : 0;

        console.log(`[Attendance Stats API] Totals: P=${totalPresent}, A=${totalAbsent}, H=${totalHomePass}, Rate=${attendanceRate}%`);

        // Build time series for each day in range
        const days = [];
        const iterDate = new Date(start);
        while (iterDate <= end) {
            const year = iterDate.getFullYear();
            const month = String(iterDate.getMonth() + 1).padStart(2, '0');
            const day = String(iterDate.getDate()).padStart(2, '0');
            const dateStr = `${year}-${month}-${day}`;
            
            const status = attendanceByDate.get(dateStr) || null;
            let present = 0, absent = 0, homePass = 0;
            if (status === 'P') present = 1;
            else if (status === 'A') absent = 1;
            else if (status === 'H') homePass = 1;

            days.push({
                date: dateStr,
                present,
                absent,
                homePass
            });
            
            iterDate.setDate(iterDate.getDate() + 1);
        }

        console.log(`[Attendance Stats API] Returning ${days.length} days`);

        const formatDate = (d) => {
            const year = d.getFullYear();
            const month = String(d.getMonth() + 1).padStart(2, '0');
            const day = String(d.getDate()).padStart(2, '0');
            return `${year}-${month}-${day}`;
        };

        res.json({
            range: { from: formatDate(start), to: formatDate(end) },
            present: totalPresent,
            absent: totalAbsent,
            homePass: totalHomePass,
            totalMarked,
            attendanceRate,
            series: days
        });
    } catch (error) {
        console.error('[Attendance Stats API] Error:', error);
        res.status(500).json({ error: error.message });
    }
}));

// Recent attendance records for the student
// GET /student-api/attendance/recent?limit=20
studentApp.get('/attendance/recent', verifyStudent, expressAsyncHandler(async (req, res) => {
    try {
        const limit = Math.min(parseInt(req.query.limit || '20', 10), 100);
        const studentId = req.studentId;

        // Fetch recent monthly records (last few months)
        const now = new Date();
        const months = [];
        for (let i = 0; i < 4; i++) {
            const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
            months.push({ year: d.getFullYear(), month: d.getMonth() + 1 });
        }

        const monthlyRecords = await MonthlyAttendance.find({
            student_id: studentId,
            $or: months.map(m => ({ year: m.year, month: m.month }))
        }).sort({ year: -1, month: -1 }).lean();

        // Convert to recent attendance records
        const records = [];
        monthlyRecords.forEach(record => {
            if (record.attendance && typeof record.attendance === 'object') {
                // Handle Map-like object from lean()
                Object.entries(record.attendance).forEach(([day, status]) => {
                    records.push({
                        date: `${record.year}-${String(record.month).padStart(2, '0')}-${String(day).padStart(2, '0')}`,
                        status: status === 'P' ? 'present' : status === 'A' ? 'absent' : 'home_pass',
                        roomNumber: null,
                        floor: null,
                        markedAt: record.updatedAt
                    });
                });
            }
        });

        // Sort by date descending and limit
        records.sort((a, b) => new Date(b.date) - new Date(a.date));
        res.json(records.slice(0, limit).map(r => ({
            date: r.date,
            status: r.status,
            roomNumber: r.roomNumber,
            floor: r.floor,
            markedAt: r.markedAt
        })));
    } catch (error) {
        console.error('Recent attendance error:', error);
        res.status(500).json({ error: error.message });
    }
}));

// Test endpoint to generate token for existing Google OAuth user (temporary for debugging)
studentApp.post('/test-token', expressAsyncHandler(async (req, res) => {
    try {
        const { email } = req.body;

        const student = await Student.findOne({ email, is_active: true });
        if (!student) {
            return res.status(404).json({ message: "Student not found" });
        }

        const token = jwt.sign({ id: student._id, role: 'student' }, process.env.JWT_SECRET, { expiresIn: '7d' });

        res.status(200).json({
            message: "Test token generated",
            token,
            student: {
                id: student._id,
                name: student.name,
                rollNumber: student.rollNumber,
                email: student.email
            }
        });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
}));

// Get current student profile
studentApp.get('/profile', verifyStudent, expressAsyncHandler(async (req, res) => {
    try {
        const student = await Student.findById(req.studentId).select('-password');
        if (!student) {
            return res.status(404).json({ message: "Student not found" });
        }

        res.status(200).json({
            id: student._id,
            name: student.name,
            rollNumber: student.rollNumber,
            branch: student.branch,
            year: student.year,
            room: student.room,
            profilePhoto: student.profilePhoto,
            phoneNumber: student.phoneNumber || '',
            parentMobileNumber: student.parentMobileNumber || '',
            email: student.email,

            is_active: student.is_active
        });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
}));

// to read announcement
studentApp.get('/all-announcements',expressAsyncHandler(async (req, res) => {
    try {
        const announcements = await Announcement.find().sort({ createdAt: -1 });
        const mapped = announcements.map(a => {
            const obj = a.toObject();
            if (obj.image && obj.image.data) {
                try {
                    obj.imageUrl = `data:${obj.image.contentType};base64,${obj.image.data.toString('base64')}`;
                } catch (e) {
                    obj.imageUrl = null;
                }
                delete obj.image;
            }
            return obj;
        });
        res.status(200).json(mapped);
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
}))

// to read today's announcements
studentApp.get('/announcements',expressAsyncHandler(async (req, res) => {
    try {
        const today = new Date();
        today.setHours(0, 0, 0, 0);
        const announcements = await Announcement.find({
            createdAt: { $gte: today }
        }).sort({ createdAt: -1 });

        const mapped = announcements.map(a => {
            const obj = a.toObject();
            if (obj.image && obj.image.data) {
                try {
                    obj.imageUrl = `data:${obj.image.contentType};base64,${obj.image.data.toString('base64')}`;
                } catch (e) {
                    obj.imageUrl = null;
                }
                delete obj.image;
            }
            return obj;
        });

        res.status(200).json(mapped);
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
}))

// mark a single announcement as seen by the authenticated student
studentApp.put('/announcement/:id/seen', verifyStudent, expressAsyncHandler(async (req, res) => {
    try {
        const { id } = req.params;
        const announcement = await Announcement.findByIdAndUpdate(
            id,
            { $addToSet: { seen: req.studentId } },
            { new: true }
        );

        if (!announcement) return res.status(404).json({ message: 'Announcement not found' });

        return res.status(200).json({ success: true, seenCount: announcement.seen?.length || 0 });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
}));

// mark multiple announcements as seen (expects { ids: [id1, id2, ...] })
studentApp.put('/announcements/mark-seen', verifyStudent, expressAsyncHandler(async (req, res) => {
    try {
        const { ids } = req.body;
        if (!Array.isArray(ids) || ids.length === 0) {
            return res.status(400).json({ message: 'ids array is required' });
        }

        await Announcement.updateMany(
            { _id: { $in: ids } },
            { $addToSet: { seen: req.studentId } }
        );

        const updated = await Announcement.find({ _id: { $in: ids } }).select('_id seen');
        const counts = updated.map(a => ({ id: a._id, seenCount: a.seen.length }));
        res.status(200).json({ success: true, counts });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
}));

// to post a general complaint
studentApp.post('/post-complaint', uploadComplaintImage, expressAsyncHandler(async (req, res) => {
    try {
        const { category, description, complaintBy } = req.body;

        // Create complaint object
        const complaintData = {
            category,
            description,
            complaintBy
        };

        // If an image was uploaded, add it to the complaint
        if (req.file) {
            const imageUrl = `${req.protocol}://${req.get('host')}/uploads/complaints/${req.file.filename}`;
            complaintData.images = [imageUrl]; // Store as an array for future multiple image support
        }

        const newComplaint = new Complaint(complaintData);
        await newComplaint.save();

        res.status(201).json({ message: "Complaint posted successfully", complaint: newComplaint });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
}));

// to get all complaints posted by the student
studentApp.get('/get-complaints/:rollNumber', expressAsyncHandler(async (req, res) => {
    try {
        const { rollNumber } = req.params;
        const complaints = await Complaint.find({ complaintBy: rollNumber }).sort({ createdAt: -1 });
        res.status(200).json(complaints);
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
}));



// to post community message
studentApp.post('/post-community-message', uploadCommunityPostImage, expressAsyncHandler(async (req, res) => {
    try {
        const { content, postedBy, category } = req.body;

        // Create post data
        const postData = {
            content,
            postedBy: JSON.parse(postedBy),
            category
        };

        // If an image was uploaded, add it to the post
        if (req.file) {
            const imageUrl = `${req.protocol}://${req.get('host')}/uploads/community-posts/${req.file.filename}`;
            postData.images = [imageUrl]; // Store as an array for future multiple image support
        }

        const newPost = new CommunityPost(postData);
        await newPost.save();

        res.status(201).json({ message: "Community message posted successfully", post: newPost });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
}));

// to read community messages
studentApp.get('/get-community-messages', expressAsyncHandler(async (req, res) => {
    try {
        const communityPosts = await CommunityPost.find().sort({ createdAt: -1 });

        res.status(200).json(communityPosts);
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
}));
// apply for outpass
studentApp.post('/apply-outpass', expressAsyncHandler(async (req, res) => {
    try {
        const { name, rollNumber, outTime, inTime, studentMobileNumber, parentMobileNumber, reason, type } = req.body;

        // Validate all required fields
        if (!name || !rollNumber || !outTime || !inTime || !studentMobileNumber || !parentMobileNumber || !reason || !type) {
            return res.status(400).json({ 
                message: 'All fields are required',
                received: { name, rollNumber, outTime, inTime, studentMobileNumber, parentMobileNumber, reason, type }
            });
        }

        // Fetch student to get their year
        const student = await Student.findOne({ rollNumber });
        const studentYear = student?.year || null;

        // Check for offensive content in reason
        const offensiveCheck = await checkOffensiveContent(reason);
        if (offensiveCheck.isOffensive) {
            console.log('🚫 [Server] Blocked outpass request due to offensive content:', offensiveCheck.reason);
            return res.status(400).json({ 
                message: 'Your reason contains inappropriate content. Please provide a valid and appropriate reason.',
                details: offensiveCheck.reason
            });
        }

        // Check if the user has any active pass (approved or out)
        const activePass = await Outpass.findOne({
            rollNumber,
            status: { $in: ['approved', 'out'] }
        });

        if (activePass) {
            return res.status(400).json({ 
                message: "You already have an active pass. Please complete or return your current pass before requesting a new one.",
                activePassType: activePass.type,
                activePassStatus: activePass.status
            });
        }

        // Check if the user has any pending pass
        const pendingPass = await Outpass.findOne({
            rollNumber,
            status: 'pending'
        });

        if (pendingPass) {
            return res.status(400).json({ 
                message: "You already have a pending pass request. Please wait for admin approval or contact admin.",
                pendingPassType: pendingPass.type
            });
        }

        const currentDate = new Date();
        const currentMonth = currentDate.getMonth() + 1;
        const currentYear = currentDate.getFullYear();

        const acceptedOutpassCount = await Outpass.countDocuments({
            rollNumber,
            month: currentMonth,
            year: currentYear,
            status: 'approved'
        });

        if (acceptedOutpassCount >= 6) {
            return res.status(400).json({ message: "Outpass limit reached for this month." });
        }

        const newOutpass = new Outpass({
            name,
            rollNumber,
            outTime,
            inTime,
            studentMobileNumber,
            parentMobileNumber,
            reason,
            type,
            month: currentMonth,
            year: currentYear,
            studentYear, // Add student's batch year
            status: 'pending'
        });

        await newOutpass.save();
        res.status(201).json({ message: "Outpass request submitted successfully", outpass: newOutpass });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
}));

// to get all the outpasses applied by the student
// Get all outpass requests by a student's roll number
studentApp.get('/all-outpasses/:rollNumber', expressAsyncHandler(async (req, res) => {
    try {
        const { rollNumber } = req.params;
        const studentOutpasses = await Outpass.find({ rollNumber }).sort({ createdAt: -1 });
        if (!studentOutpasses.length) {
            return res.status(404).json({ message: 'No outpass requests found for this student' });
        }
        res.status(200).json({ studentOutpasses });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
}));

// Change password endpoint
studentApp.put('/change-password', expressAsyncHandler(async (req, res) => {
    try {
        const { rollNumber, currentPassword, newPassword } = req.body;

        // Find the student
        const student = await Student.findOne({ rollNumber });
        if (!student) {
            return res.status(404).json({ message: "Student not found" });
        }

        // Verify current password
        const isPasswordValid = await bcrypt.compare(currentPassword, student.password);
        if (!isPasswordValid) {
            return res.status(401).json({ message: "Current password is incorrect" });
        }

        // Hash the new password
        const hashedPassword = await bcrypt.hash(newPassword, 10);

        // Update the password
        student.password = hashedPassword;
        await student.save();

        res.status(200).json({ message: "Password changed successfully" });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
}));

// Update profile photo endpoint
studentApp.put('/update-profile-photo', uploadProfilePhoto, expressAsyncHandler(async (req, res) => {
    try {
        const { rollNumber } = req.body;

        // Find the student
        const student = await Student.findOne({ rollNumber });
        if (!student) {
            return res.status(404).json({ message: "Student not found" });
        }

        // If a file was uploaded, update the profile photo
        if (req.file) {
            // Create the URL for the uploaded file
            const profilePhotoUrl = `${req.protocol}://${req.get('host')}/uploads/profiles/${req.file.filename}`;

            // Update the profile photo
            student.profilePhoto = profilePhotoUrl;
            await student.save();

            res.status(200).json({
                message: "Profile photo updated successfully",
                profilePhoto: student.profilePhoto
            });
        } else {
            return res.status(400).json({ message: "No profile photo uploaded" });
        }
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
}));

// Update student profile
studentApp.put('/update-profile/:rollNumber', expressAsyncHandler(async (req, res) => {
    try {
        const { rollNumber } = req.params;
        const { phoneNumber, parentMobileNumber } = req.body;

        if (!phoneNumber || !parentMobileNumber) {
            return res.status(400).json({ message: 'Both phone numbers are required' });
        }

        const updatedStudent = await Student.findOneAndUpdate(
            { rollNumber },
            { phoneNumber, parentMobileNumber },
            { new: true }
        );

        if (!updatedStudent) {
            return res.status(404).json({ message: 'Student not found' });
        }

        res.json({ 
            success: true, 
            message: 'Profile updated successfully',
            student: updatedStudent
        });
    } catch (error) {
        res.status(500).json({ message: error.message });
    }
}));

module.exports = studentApp;
