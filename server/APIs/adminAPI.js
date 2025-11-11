const exp = require('express');
const adminApp = exp.Router();
const Student = require('../models/StudentModel');
const Admin = require('../models/AdminModel');
const Room = require('../models/Room');
const expressAsyncHandler = require('express-async-handler');
const Announcement = require('../models/AnnouncementModel');
const { uploadAnnouncementImage } = require('../middleware/uploadMiddleware');
const CommunityPost = require('../models/CommunityPostModel');
const Complaint = require('../models/ComplaintModel');
const Outpass = require('../models/OutpassModel');
const jwt = require('jsonwebtoken');
const bcrypt = require('bcrypt');
require('dotenv').config();
const verifyAdmin = require('../middleware/verifyAdminMiddleware');
const roomSyncService = require('../services/roomSyncService');



// APIs
adminApp.get('/', (req, res) => {
    res.send('message from Admin API');
});

// Admin registration (this would typically be done manually or through a secure setup process)
adminApp.post('/register', expressAsyncHandler(async (req, res) => {
    try {
        const { username, password, name, email } = req.body;

        // Check if admin already exists
        const existingAdmin = await Admin.findOne({ $or: [{ username }, { email }] });
        if (existingAdmin) {
            return res.status(400).json({ message: "Admin with this username or email already exists" });
        }

        // Create new admin
        const newAdmin = new Admin({
            username,
            password,
            name,
            email,
            role: 'admin'
        });

        await newAdmin.save();
        res.status(201).json({ message: "Admin registered successfully" });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
}));

// Admin login
adminApp.post('/login', expressAsyncHandler(async (req, res) => {
    try {
        const { username, password } = req.body;

        // Find admin by username
        const admin = await Admin.findOne({ username });
        if (!admin) {
            return res.status(401).json({ message: "Invalid credentials" });
        }

        // Verify password
        const isPasswordValid = await bcrypt.compare(password, admin.password);
        if (!isPasswordValid) {
            return res.status(401).json({ message: "Invalid credentials" });
        }

        // Generate JWT token
        const token = jwt.sign(
            { id: admin._id, role: 'admin', username: admin.username },
            process.env.JWT_SECRET,
            { expiresIn: '24h' }
        );

        // Return admin data and token
        res.status(200).json({
            message: "Login successful",
            token,
            admin: {
                id: admin._id,
                username: admin.username,
                name: admin.name,
                email: admin.email,
                role: admin.role
            }
        });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
}));

// Get admin profile
adminApp.get('/profile', expressAsyncHandler(async (req, res) => {
    try {
        const token = req.headers.authorization?.split(" ")[1];
        if (!token) {
            return res.status(401).json({ message: "Unauthorized" });
        }

        const decoded = jwt.verify(token, process.env.JWT_SECRET);
        if (decoded.role !== 'admin') {
            return res.status(403).json({ message: "Access denied" });
        }

        const admin = await Admin.findById(decoded.id).select('-password');
        if (!admin) {
            return res.status(404).json({ message: "Admin not found" });
        }

        res.status(200).json(admin);
    } catch (error) {
        res.status(401).json({ message: "Invalid token" });
    }
}));


// create new student profile with automatic room allocation
adminApp.post('/student-register', verifyAdmin, expressAsyncHandler(async (req, res) => {
    try {
        const { name, rollNumber, branch, year, profilePhoto, phoneNumber, email, parentMobileNumber, password, parentName } = req.body;
        let { roomNumber } = req.body;

        const existingStudent = await Student.findOne({ rollNumber });
        if (existingStudent) {
            return res.status(400).json({ message: "Student already exists" });
        }

        // If no room number is provided, automatically allocate a room
        if (!roomNumber) {
            // Find a room with available space
            const availableRooms = await Room.find().populate('occupants');

            // First, try to find rooms that already have at least one student (to maintain minimum 2 per room)
            let vacantRoom = availableRooms.find(room =>
                room.occupants.length >= 1 && room.occupants.length < room.capacity
            );

            // If no partially filled rooms are available, only then use an empty room
            if (!vacantRoom) {
                vacantRoom = availableRooms.find(room => room.occupants.length < room.capacity);
            }

            if (!vacantRoom) {
                return res.status(400).json({ message: "No vacant rooms available. Please create rooms first." });
            }

            roomNumber = vacantRoom.roomNumber;
        }

        // Create the new student
        const newStudent = new Student({
            name,
            rollNumber,
            username: rollNumber, // Use rollNumber as username
            branch,
            phoneNumber,
            email,
            parentMobileNumber,
            parentName: parentName || 'Not Provided', // Default value if not provided
            room: roomNumber, // Use 'room' field as per model schema
            password,
            is_active: true
        });

        // Save the student
        const savedStudent = await newStudent.save();

        // ✅ AUTOMATIC SYNC: Update the room immediately after student registration
        if (roomNumber) {
            try {
                await roomSyncService.syncSingleRoom(roomNumber);
                console.log(`✅ Auto-synced room ${roomNumber} after student registration`);
            } catch (syncError) {
                console.error('⚠️  Room sync warning after registration:', syncError);
                // Don't fail the registration if sync fails - log and continue
            }
        }

        res.status(201).json({
            message: "Student registered successfully and allocated to room " + roomNumber,
            student: savedStudent
        });

    } catch (error) {
        console.error('Error registering student:', error);
        res.status(500).json({ error: error.message });
    }
}));

// to deactivate a student-profile and unassign room
adminApp.put('/student-delete', verifyAdmin, expressAsyncHandler(async (req, res) => {
    try {
        const { rollNumber } = req.body;

        // First, find the student
        const student = await Student.findOne({ rollNumber });

        if (!student) {
            return res.status(404).json({ message: "Student not found" });
        }

        const oldRoomNumber = student.room; // Store for auto-sync

        // Clear the student's room and deactivate
        student.room = "";
        student.is_active = false;
        await student.save();

        // ✅ AUTOMATIC SYNC: Update the room immediately after student deactivation
        if (oldRoomNumber) {
            try {
                await roomSyncService.syncSingleRoom(oldRoomNumber);
                console.log(`✅ Auto-synced room ${oldRoomNumber} after student deactivation`);
            } catch (syncError) {
                console.error('⚠️  Room sync warning after deactivation:', syncError);
                // Don't fail the deactivation if sync fails - log and continue
            }
        }

        res.status(200).json({
            message: "Student deactivated successfully and unassigned from room",
            student
        });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
}));

// to get all active students
adminApp.get('/get-active-students', verifyAdmin, expressAsyncHandler(async (req, res) => {
    try {
        const activeStudents = await Student.find({ is_active: true })
            .sort({ room: 1, rollNumber: 1 }); // Sort by room number, then by roll number
        res.status(200).json(activeStudents);
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
}));

// to get all inactive students
adminApp.get('/get-inactive-students', verifyAdmin, expressAsyncHandler(async (req, res) => {
    try {
        const inactiveStudents = await Student.find({ is_active: false })
            .sort({ room: 1, rollNumber: 1 }); // Sort by room number, then by roll number
        res.status(200).json(inactiveStudents);
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
}));

// to get student details by roll number
adminApp.get('/student-details/:rollNumber', verifyAdmin, expressAsyncHandler(async (req, res) => {
    try {
        const { rollNumber } = req.params;
        const student = await Student.findOne({ rollNumber });

        if (!student) {
            return res.status(404).json({ message: "Student not found" });
        }

        res.status(200).json(student);
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
}));


// to post an announcement
// post announcement with optional image (uploadAnnouncementImage uses memoryStorage)
adminApp.post('/post-announcement', verifyAdmin, uploadAnnouncementImage, expressAsyncHandler(async (req, res) => {
    try {
        const { title, description } = req.body;

        if (!title || !description) {
            return res.status(400).json({ message: 'Title and description are required' });
        }

        const announcementData = { title, description };

        // If an image was uploaded, optionally compress then store buffer and contentType
        if (req.file && req.file.buffer) {
            let bufferToStore = req.file.buffer;
            try {
                const sharp = require('sharp');
                // If image is larger than ~500KB, downscale/compress
                if (bufferToStore.length > 500 * 1024) {
                    bufferToStore = await sharp(bufferToStore)
                        .rotate()
                        .resize({ width: 1200, withoutEnlargement: true })
                        .jpeg({ quality: 80 })
                        .toBuffer();
                }
            } catch (e) {
                // sharp not available or compression failed — fall back to original buffer
                console.warn('Image compression skipped:', e.message || e);
            }

            announcementData.image = {
                data: bufferToStore,
                contentType: req.file.mimetype
            };
        }

        const newAnnouncement = new Announcement(announcementData);
        await newAnnouncement.save();

        // Return announcement with image metadata omitted for brevity
        res.status(201).json({ message: "Announcement posted successfully", announcement: newAnnouncement });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
}));

// to edit announcement
// edit announcement; allow updating description and optional image
adminApp.put('/edit-announcement/:id', verifyAdmin, uploadAnnouncementImage, expressAsyncHandler(async (req, res) => {
    try {
        const { id } = req.params;
        const { description } = req.body;

        const updateData = {};
        if (description) updateData.description = description;

        if (req.file && req.file.buffer) {
            let bufferToStore = req.file.buffer;
            try {
                const sharp = require('sharp');
                if (bufferToStore.length > 500 * 1024) {
                    bufferToStore = await sharp(bufferToStore)
                        .rotate()
                        .resize({ width: 1200, withoutEnlargement: true })
                        .jpeg({ quality: 80 })
                        .toBuffer();
                }
            } catch (e) {
                console.warn('Image compression skipped:', e.message || e);
            }

            updateData.image = {
                data: bufferToStore,
                contentType: req.file.mimetype
            };
        }

        const updatedAnnouncement = await Announcement.findByIdAndUpdate(
            id,
            updateData,
            { new: true }
        );

        if (!updatedAnnouncement) {
            return res.status(404).json({ message: "Announcement not found" });
        }

        res.status(200).json({ message: "Announcement updated successfully", announcement: updatedAnnouncement });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
}));

// delete announcement
adminApp.delete('/delete-announcement/:id', verifyAdmin, expressAsyncHandler(async (req, res) => {
    try {
        const { id } = req.params;
        const deleted = await Announcement.findByIdAndDelete(id);
        if (!deleted) return res.status(404).json({ message: 'Announcement not found' });
        res.status(200).json({ message: 'Announcement deleted successfully' });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
}));


// to read announcement
adminApp.get('/all-announcements', verifyAdmin, expressAsyncHandler(async (req, res) => {
    try {
        const announcements = await Announcement.find().sort({ createdAt: -1 });
        // convert image buffer to data URI for transport if present
        const mapped = announcements.map(a => {
            const obj = a.toObject();
            if (obj.image && obj.image.data) {
                try {
                    obj.imageUrl = `data:${obj.image.contentType};base64,${obj.image.data.toString('base64')}`;
                } catch (e) {
                    obj.imageUrl = null;
                }
                // Remove raw binary to reduce payload
                delete obj.image;
            }
            // Add seenCount and avoid returning raw seen array to reduce payload
            obj.seenCount = Array.isArray(obj.seen) ? obj.seen.length : 0;
            delete obj.seen;
            return obj;
        });
        res.status(200).json(mapped);
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
}))

// Get viewers for a specific announcement (names and roll numbers)
adminApp.get('/announcement/:id/viewers', verifyAdmin, expressAsyncHandler(async (req, res) => {
    try {
        const { id } = req.params;
        const announcement = await Announcement.findById(id).populate('seen', 'name rollNumber');
        if (!announcement) return res.status(404).json({ message: 'Announcement not found' });

        // Return only the populated student info
        const viewers = Array.isArray(announcement.seen) ? announcement.seen.map(s => ({ id: s._id, name: s.name, rollNumber: s.rollNumber })) : [];
        res.status(200).json({ viewers });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
}));

// to read today's announcements
adminApp.get('/announcements', verifyAdmin, expressAsyncHandler(async (req, res) => {
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
            obj.seenCount = Array.isArray(obj.seen) ? obj.seen.length : 0;
            delete obj.seen;
            return obj;
        });

        res.status(200).json(mapped);
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
}))


// // to post community message
// adminApp.post('/post-community-message', expressAsyncHandler(async (req, res) => {
//     try {
//         const { content, images, postedBy, category } = req.body;

//         const newPost = new CommunityPost({ content, images, postedBy, category });

//         await newPost.save();

//         res.status(201).json({ message: "Community message posted successfully", post: newPost });
//     } catch (error) {
//         res.status(500).json({ error: error.message });
//     }
// }));

// to read community messages
adminApp.get('/get-community-messages', verifyAdmin, expressAsyncHandler(async (req, res) => {
    try {
        const communityPosts = await CommunityPost.find().sort({ createdAt: -1 });

        res.status(200).json(communityPosts);
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
}));


//  // complaints section

// to read all complaints
adminApp.get('/get-complaints', verifyAdmin, expressAsyncHandler(async (req, res) => {
    try {
        const complaints = await Complaint.find().sort({ createdAt: -1 });
        res.status(200).json(complaints);
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
}));

// to read active complaints
adminApp.get('/get-active-complaints', verifyAdmin, expressAsyncHandler(async (req, res) => {
    try {
        const activeComplaints = await Complaint.find({ status: 'active' }).sort({ createdAt: -1 });
        res.status(200).json(activeComplaints);
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
}));

// to update complaint status to solved
adminApp.put('/mark-complaint-solved/:id', verifyAdmin, expressAsyncHandler(async (req, res) => {
    try {
        const { id } = req.params;

        const updatedComplaint = await Complaint.findByIdAndUpdate(
            id,
            { status: 'solved' },
            { new: true }
        );

        if (!updatedComplaint) {
            return res.status(404).json({ message: "Complaint not found" });
        }

        res.status(200).json({ message: "Complaint marked as solved", complaint: updatedComplaint });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
}));


// handle the outpasses
adminApp.put('/update-outpass-status/:id', verifyAdmin, expressAsyncHandler(async (req, res) => {
    try {
        const { id } = req.params;
        const { status } = req.body;
        const crypto = require('crypto');

        if (!['approved', 'rejected'].includes(status)) {
            return res.status(400).json({ message: "Invalid status. Use 'approved' or 'rejected'." });
        }

        const outpass = await Outpass.findById(id);
        if (!outpass) {
            return res.status(404).json({ message: "Outpass not found" });
        }

        // Generate QR code if approved
        if (status === 'approved') {
            const timestamp = Date.now();
            const randomString = crypto.randomBytes(8).toString('hex');
            outpass.qrCodeData = `${outpass._id}-${outpass.rollNumber}-${timestamp}-${randomString}`;
            outpass.approvedAt = new Date();
        }

        outpass.status = status;
        await outpass.save();

        res.status(200).json({ message: `Outpass ${status} successfully`, outpass });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
}));

// to read all pending outpasses
adminApp.get('/pending-outpasses', verifyAdmin, expressAsyncHandler(async (req, res) => {
    try {
        const pendingOutpasses = await Outpass.find({ status: 'pending' });
        res.status(200).json({ pendingOutpasses });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
}));

// to read all outpasses (for history)
adminApp.get('/all-outpasses', verifyAdmin, expressAsyncHandler(async (req, res) => {
    try {
        // Use aggregation to join with Student collection and get year
        const outpasses = await Outpass.aggregate([
            {
                $sort: { createdAt: -1 }
            },
            {
                $lookup: {
                    from: 'students', // MongoDB collection name (lowercase + pluralized)
                    localField: 'rollNumber',
                    foreignField: 'rollNumber',
                    as: 'studentInfo'
                }
            },
            {
                $addFields: {
                    studentYear: { $arrayElemAt: ['$studentInfo.year', 0] }
                }
            },
            {
                $project: {
                    studentInfo: 0 // Remove the studentInfo array to reduce payload size
                }
            }
        ]);
        
        // Get unique years from Student collection
        const uniqueYears = await Student.distinct('year');
        
        res.status(200).json({ outpasses, uniqueYears: uniqueYears.sort() });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
}));





// Room Management APIs
// Get all rooms with occupancy details
adminApp.get('/rooms', verifyAdmin, expressAsyncHandler(async (req, res) => {
    try {
        const rooms = await Room.find()
            .populate('occupants', 'name rollNumber branch year')
            .sort({ roomNumber: 1 }); // Sort by room number
        res.status(200).json(rooms);
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
}));

// Get rooms by vacancy status
adminApp.get('/rooms/vacancy', verifyAdmin, expressAsyncHandler(async (req, res) => {
    try {
        const { status } = req.query; // 'vacant', 'occupied', or 'all'
        let query = {};

        if (status === 'vacant') {
            // Find rooms with available space
            const rooms = await Room.find();
            const vacantRooms = rooms.filter(room => room.occupants.length < room.capacity);
            return res.status(200).json(vacantRooms);
        } else if (status === 'occupied') {
            // Find fully occupied rooms
            const rooms = await Room.find();
            const occupiedRooms = rooms.filter(room => room.occupants.length === room.capacity);
            return res.status(200).json(occupiedRooms);
        }

        // If status is 'all' or not specified, return all rooms
        const allRooms = await Room.find();
        res.status(200).json(allRooms);
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
}));

// Get students by room number
adminApp.get('/room/:roomNumber/students', verifyAdmin, expressAsyncHandler(async (req, res) => {
    try {
        const { roomNumber } = req.params;
        const room = await Room.findOne({ roomNumber }).populate('occupants');

        if (!room) {
            return res.status(404).json({ message: "Room not found" });
        }

        res.status(200).json(room.occupants);
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
}));

// Create a new room
adminApp.post('/room', verifyAdmin, expressAsyncHandler(async (req, res) => {
    try {
        const { roomNumber, capacity } = req.body;

        // Check if room already exists
        const existingRoom = await Room.findOne({ roomNumber });
        if (existingRoom) {
            return res.status(400).json({ message: "Room already exists" });
        }

        const newRoom = new Room({
            roomNumber,
            capacity,
            occupants: []
        });

        await newRoom.save();
        res.status(201).json({ message: "Room created successfully", room: newRoom });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
}));

// Update student details
adminApp.put('/update-student/:id', verifyAdmin, expressAsyncHandler(async (req, res) => {
    try {
        const { id } = req.params;
        const { name, branch, year, phoneNumber, email, parentMobileNumber, roomNumber } = req.body;

        // Find the student
        const student = await Student.findById(id);
        if (!student) {
            return res.status(404).json({ message: "Student not found" });
        }

        const oldRoomNumber = student.room; // Store for auto-sync
        const roomChanged = roomNumber !== student.room;

    // Update student details
    student.name = name || student.name;
    student.branch = branch || student.branch;
    student.year = year !== undefined ? year : student.year; // allow updating batch/year
    student.phoneNumber = phoneNumber || student.phoneNumber;
    student.email = email || student.email;
    student.parentMobileNumber = parentMobileNumber || student.parentMobileNumber;
    student.room = roomNumber !== undefined ? roomNumber : student.room;

        await student.save();

        // ✅ AUTOMATIC SYNC: Update rooms if room assignment changed
        if (roomChanged) {
            try {
                await Promise.all([
                    oldRoomNumber ? roomSyncService.syncSingleRoom(oldRoomNumber) : Promise.resolve(),
                    roomNumber ? roomSyncService.syncSingleRoom(roomNumber) : Promise.resolve()
                ]);
                console.log(`✅ Auto-synced rooms after student update: ${oldRoomNumber || 'none'} → ${roomNumber || 'none'}`);
            } catch (syncError) {
                console.error('⚠️  Room sync warning after student update:', syncError);
                // Don't fail the update if sync fails - log and continue
            }
        }

        res.status(200).json({
            message: "Student updated successfully",
            student
        });
    } catch (error) {
        console.error('Error updating student:', error);

        // Handle duplicate key (unique) errors gracefully
        if (error.name === 'MongoServerError' && error.code === 11000) {
            // extract the duplicated field
            const field = Object.keys(error.keyValue || {})[0];
            return res.status(400).json({ message: `Duplicate value for field: ${field}` });
        }

        // Handle Mongoose validation errors
        if (error.name === 'ValidationError') {
            const messages = Object.values(error.errors).map(e => e.message).join('; ');
            return res.status(400).json({ message: messages });
        }

        res.status(500).json({ error: error.message });
    }
}));

// Change student's room
adminApp.put('/change-student-room', verifyAdmin, expressAsyncHandler(async (req, res) => {
    try {
        const { studentId, newRoomNumber } = req.body;

        if (!studentId || !newRoomNumber) {
            return res.status(400).json({ message: "Student ID and new room number are required" });
        }

        // Find the student
        const student = await Student.findById(studentId);
        if (!student) {
            return res.status(404).json({ message: "Student not found" });
        }

        // Check if the new room exists
        const newRoom = await Room.findOne({ roomNumber: newRoomNumber });
        if (!newRoom) {
            return res.status(404).json({ message: "Room not found" });
        }

        // Check if the new room has space
        if (newRoom.occupants.length >= newRoom.capacity) {
            return res.status(400).json({ message: "Room is already at full capacity" });
        }

        const oldRoomNumber = student.room; // Store for auto-sync

        // Update the student's room number
        student.room = newRoomNumber;
        await student.save();

        // ✅ AUTOMATIC SYNC: Update both old and new rooms after room change
        try {
            // Sync both rooms in parallel
            await Promise.all([
                oldRoomNumber ? roomSyncService.syncSingleRoom(oldRoomNumber) : Promise.resolve(),
                roomSyncService.syncSingleRoom(newRoomNumber)
            ]);
            console.log(`✅ Auto-synced rooms ${oldRoomNumber || 'none'} and ${newRoomNumber} after room change`);
        } catch (syncError) {
            console.error('⚠️  Room sync warning after room change:', syncError);
            // Don't fail the room change if sync fails - log and continue
        }

        res.status(200).json({
            message: `Student ${student.name} moved from ${oldRoomNumber || 'no room'} to ${newRoomNumber}`,
            student
        });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
}));

// Unassign student from room
adminApp.put('/unassign-student-room', verifyAdmin, expressAsyncHandler(async (req, res) => {
    try {
        const { studentId } = req.body;

        if (!studentId) {
            return res.status(400).json({ message: "Student ID is required" });
        }

        // Find the student
        const student = await Student.findById(studentId);
        if (!student) {
            return res.status(404).json({ message: "Student not found" });
        }

        // Get the current room
        const currentRoom = await Room.findOne({ roomNumber: student.room });

        // If student doesn't have a room assigned
        if (!student.room) {
            return res.status(400).json({ message: "Student doesn't have a room assigned" });
        }

        // Store old room number for syncing
        const oldRoomNumber = student.room;

        // Update the student's room number to empty
        student.room = "";
        await student.save();

        // Auto-sync the old room to update occupants
        await roomSyncService.syncSingleRoom(oldRoomNumber);

        res.status(200).json({
            message: `Student ${student.name} unassigned from room ${oldRoomNumber}`,
            student
        });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
}));

// Exchange rooms between two students
adminApp.put('/exchange-student-rooms', verifyAdmin, expressAsyncHandler(async (req, res) => {
    try {
        const { studentId1, studentId2 } = req.body;

        if (!studentId1 || !studentId2) {
            return res.status(400).json({ message: "Both student IDs are required" });
        }

        // Find the students
        const student1 = await Student.findById(studentId1);
        const student2 = await Student.findById(studentId2);

        if (!student1 || !student2) {
            return res.status(404).json({ message: "One or both students not found" });
        }

        // Check if both students have rooms assigned
        if (!student1.room || !student2.room) {
            return res.status(400).json({ message: "Both students must have rooms assigned" });
        }

        // Get the rooms for validation
        const room1 = await Room.findOne({ roomNumber: student1.room });
        const room2 = await Room.findOne({ roomNumber: student2.room });

        if (!room1 || !room2) {
            return res.status(404).json({ message: "One or both rooms not found" });
        }

        // Store room numbers for syncing
        const room1Number = student1.room;
        const room2Number = student2.room;

        // Swap room numbers for students
        student1.room = room2Number;
        student2.room = room1Number;

        // Save student changes
        await student1.save();
        await student2.save();

        // Auto-sync both rooms to update occupants
        await roomSyncService.syncSingleRoom(room1Number);
        await roomSyncService.syncSingleRoom(room2Number);

        res.status(200).json({
            message: `Successfully exchanged rooms: ${student1.name} moved to ${student1.room} and ${student2.name} moved to ${student2.room}`,
            students: [student1, student2]
        });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
}));

// Allocate rooms to existing students
adminApp.post('/allocate-rooms', verifyAdmin, expressAsyncHandler(async (req, res) => {
    try {
        // Get all active students without room allocation or with invalid room numbers
        const studentsToAllocate = await Student.find({
            is_active: true,
            $or: [
                { roomNumber: { $exists: false } },
                { roomNumber: null },
                { roomNumber: "" }
            ]
        });

        if (studentsToAllocate.length === 0) {
            return res.status(200).json({ message: "No students need room allocation" });
        }

        // Get all rooms with available space
        const rooms = await Room.find().populate('occupants');

        // Separate rooms into partially filled and empty rooms
        const partiallyFilledRooms = rooms.filter(room => room.occupants.length > 0 && room.occupants.length < room.capacity);
        const emptyRooms = rooms.filter(room => room.occupants.length === 0);

        // Combine them with partially filled rooms first (to maintain at least 2 per room)
        let vacantRooms = [...partiallyFilledRooms, ...emptyRooms];

        if (vacantRooms.length === 0) {
            return res.status(400).json({ message: "No vacant rooms available. Please create rooms first." });
        }

        let allocatedCount = 0;
        let roomIndex = 0;
        const affectedRooms = new Set(); // Track rooms that need syncing

        // Allocate students to rooms
        for (const student of studentsToAllocate) {
            // Find a room with available space
            while (roomIndex < vacantRooms.length) {
                const room = vacantRooms[roomIndex];

                // Check if room has space
                if (room.occupants.length < room.capacity) {
                    // Update student's room number
                    student.room = room.roomNumber;
                    await student.save();

                    affectedRooms.add(room.roomNumber); // Track for syncing
                    allocatedCount++;
                    break;
                }

                roomIndex++;

                // If we've gone through all rooms, start from the beginning
                if (roomIndex >= vacantRooms.length) {
                    roomIndex = 0;

                    // Refresh vacant rooms data
                    const updatedRooms = await Room.find().populate('occupants');

                    // Again prioritize partially filled rooms
                    const updatedPartiallyFilledRooms = updatedRooms.filter(
                        room => room.occupants.length > 0 && room.occupants.length < room.capacity
                    );
                    const updatedEmptyRooms = updatedRooms.filter(room => room.occupants.length === 0);
                    const updatedVacantRooms = [...updatedPartiallyFilledRooms, ...updatedEmptyRooms];

                    if (updatedVacantRooms.length === 0) {
                        // ✅ AUTOMATIC SYNC: Sync all affected rooms before returning
                        try {
                            await Promise.all(Array.from(affectedRooms).map(roomNum => 
                                roomSyncService.syncSingleRoom(roomNum)
                            ));
                            console.log(`✅ Auto-synced ${affectedRooms.size} rooms after allocation`);
                        } catch (syncError) {
                            console.error('⚠️  Room sync warning after allocation:', syncError);
                        }

                        return res.status(200).json({
                            message: `Allocated ${allocatedCount} students to rooms. No more vacant rooms available.`,
                            allocatedCount
                        });
                    }

                    vacantRooms.length = 0;
                    vacantRooms.push(...updatedVacantRooms);
                }
            }
        }

        // ✅ AUTOMATIC SYNC: Sync all affected rooms after allocation
        try {
            await Promise.all(Array.from(affectedRooms).map(roomNum => 
                roomSyncService.syncSingleRoom(roomNum)
            ));
            console.log(`✅ Auto-synced ${affectedRooms.size} rooms after student allocation`);
        } catch (syncError) {
            console.error('⚠️  Room sync warning after allocation:', syncError);
        }

        res.status(200).json({
            message: `Successfully allocated ${allocatedCount} students to rooms`,
            allocatedCount
        });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
}));

// Generate random students
adminApp.post('/generate-students', verifyAdmin, expressAsyncHandler(async (req, res) => {
    try {
        const bcrypt = require('bcrypt');
        const TOTAL_STUDENTS = 560;
        const DEFAULT_PASSWORD = '1234';
        const BRANCHES = [
            'CSE', 'CSE-AIML', 'CSE-DS', 'CSE-CYS', 'AIDS',
            'MECH', 'EEE', 'ECE', 'CIVIL', 'AE', 'IT', 'CSBS'
        ];

        // Only boy names for random generation
        const FIRST_NAMES = [
            'Aarav', 'Akshay', 'Arjun', 'Chaitanya', 'Dhruv', 'Gaurav', 'Ishaan',
            'Krishna', 'Manish', 'Nikhil', 'Pranav', 'Rahul', 'Rohan', 'Sanjay',
            'Siddharth', 'Varun', 'Vikram', 'Yash', 'Aditya', 'Arnav', 'Farhan',
            'Harish', 'Karan', 'Omkar', 'Rajat', 'Tarun', 'Vivek', 'Abhishek',
            'Arun', 'Deepak', 'Karthik', 'Mohit', 'Naveen', 'Prakash', 'Ravi',
            'Suresh', 'Vijay', 'Ajay', 'Amit', 'Anand', 'Dinesh', 'Girish',
            'Hari', 'Jayesh', 'Kunal', 'Manoj', 'Neeraj', 'Pankaj', 'Ramesh',
            'Sachin', 'Sunil', 'Vinay', 'Vishal', 'Ashish', 'Saurabh', 'Shyam'
        ];

        const LAST_NAMES = [
            'Sharma', 'Patel', 'Singh', 'Kumar', 'Reddy', 'Rao', 'Verma', 'Joshi',
            'Gupta', 'Malhotra', 'Nair', 'Pillai', 'Iyer', 'Mukherjee', 'Chatterjee',
            'Das', 'Banerjee', 'Shah', 'Mehta', 'Agarwal', 'Kapoor', 'Khanna', 'Bose',
            'Sengupta', 'Desai', 'Menon', 'Naidu', 'Choudhury', 'Bhat', 'Hegde',
            'Kaur', 'Chauhan', 'Lal', 'Chowdhury', 'Patil', 'Chandra', 'Saxena', 'Trivedi',
            'Shetty', 'Nayak', 'Gowda', 'Rajan', 'Krishnan', 'Venkatesh', 'Subramaniam'
        ];

        // Set to track used roll numbers to ensure uniqueness
        const usedRollNumbers = new Set();

        // Generate a unique random roll number based on year and branch
        function generateRollNumber(year, branch) {
            const yearPrefix = (25 - year).toString(); // 1st year: 24, 2nd year: 23, etc.
            const branchCode = getBranchCode(branch);

            let rollNumber;
            let attempts = 0;

            // Keep generating until we find a unique roll number
            do {
                const randomSuffix = Math.floor(Math.random() * 90 + 10).toString() + getRandomHexChar();
                rollNumber = `${yearPrefix}071a${branchCode}${randomSuffix}`;
                attempts++;

                // Safety check to prevent infinite loops
                if (attempts > 100) {
                    // Add a timestamp to ensure uniqueness in extreme cases
                    rollNumber = `${yearPrefix}071a${branchCode}${Date.now().toString().slice(-5)}`;
                    break;
                }
            } while (usedRollNumbers.has(rollNumber));

            // Add to used roll numbers set
            usedRollNumbers.add(rollNumber);
            return rollNumber;
        }

        // Get a random hexadecimal character
        function getRandomHexChar() {
            const hexChars = '0123456789abcdef';
            return hexChars.charAt(Math.floor(Math.random() * hexChars.length));
        }

        // Map branch to a two-digit code
        function getBranchCode(branch) {
            const branchCodes = {
                'CSE': '05',
                'CSE-AIML': '66',
                'CSE-DS': '67',
                'CSE-CYS': '68',
                'AIDS': '69',
                'MECH': '03',
                'EEE': '02',
                'ECE': '04',
                'CIVIL': '01',
                'AE': '21',
                'IT': '54',
                'CSBS': '70'
            };
            return branchCodes[branch] || '00';
        }

        // Generate a college email based on roll number
        function generateEmail(rollNumber) {
            return `${rollNumber}@vnrvjiet.in`;
        }

        // Generate a random 10-digit phone number
        function generatePhoneNumber() {
            return '9' + Math.floor(Math.random() * 9000000000 + 1000000000).toString().substring(1);
        }

        // Generate a random name
        function generateName() {
            const firstName = FIRST_NAMES[Math.floor(Math.random() * FIRST_NAMES.length)];
            const lastName = LAST_NAMES[Math.floor(Math.random() * LAST_NAMES.length)];
            return `${firstName} ${lastName}`;
        }

        // First, check if we have rooms
        const roomCount = await Room.countDocuments();
        if (roomCount === 0) {
            return res.status(400).json({ message: "No rooms found. Please create rooms first." });
        }

        // Clear existing students and rooms
        await Student.deleteMany({});

        // Reset room occupants
        const rooms = await Room.find();
        for (const room of rooms) {
            room.occupants = [];
            await room.save();
        }

        // Hash the default password
        const hashedPassword = await bcrypt.hash(DEFAULT_PASSWORD, 10);

        // Organize rooms by floor
        const roomsByFloor = {};
        for (const room of rooms) {
            // Extract floor number
            let floorNumber;
            if (room.roomNumber.length >= 4 && room.roomNumber.startsWith('1')) {
                // For floors 10-12 (1001-1249)
                floorNumber = parseInt(room.roomNumber.substring(0, 2));
            } else {
                // For floors 1-9 (101-949)
                floorNumber = parseInt(room.roomNumber.charAt(0));
            }

            if (!roomsByFloor[floorNumber]) {
                roomsByFloor[floorNumber] = [];
            }
            roomsByFloor[floorNumber].push(room);
        }

        // Assign years to floors
        // 1st year: floors 1-2
        // 3rd year: floors 3-5
        // 4th year: floors 6-9
        // 2nd year: floors 10-12
        const floorYearMap = {};
        for (let floor = 1; floor <= 12; floor++) {
            if (floor <= 2) floorYearMap[floor] = 1;
            else if (floor <= 5) floorYearMap[floor] = 3;
            else if (floor <= 9) floorYearMap[floor] = 4;
            else floorYearMap[floor] = 2;
        }

        // Create students and assign them to rooms by year
        const students = [];
        const studentsPerYear = Math.floor(TOTAL_STUDENTS / 4);

        for (let year = 1; year <= 4; year++) {
            // Get floors for this year
            const yearFloors = Object.keys(floorYearMap).filter(floor => floorYearMap[floor] === year);

            // Get all rooms for this year
            let yearRooms = [];
            for (const floor of yearFloors) {
                if (roomsByFloor[floor]) {
                    yearRooms = yearRooms.concat(roomsByFloor[floor]);
                }
            }

            // Shuffle rooms to randomize assignments
            yearRooms.sort(() => Math.random() - 0.5);

            // Create students for this year
            const yearStudents = [];
            for (let i = 0; i < studentsPerYear; i++) {
                const branch = BRANCHES[Math.floor(Math.random() * BRANCHES.length)];
                const rollNumber = generateRollNumber(year, branch);
                const name = generateName();

                yearStudents.push({
                    name,
                    rollNumber,
                    branch,
                    year,
                    email: generateEmail(rollNumber),
                    phoneNumber: generatePhoneNumber(),
                    parentMobileNumber: generatePhoneNumber(),
                    password: hashedPassword,
                    is_active: true,
                    roomNumber: "" // Will be assigned later
                });
            }

            // Create student objects without IDs yet
            for (let i = 0; i < studentsPerYear; i++) {
                const branch = BRANCHES[Math.floor(Math.random() * BRANCHES.length)];
                const rollNumber = generateRollNumber(year, branch);
                const name = generateName();

                students.push({
                    name,
                    rollNumber,
                    branch,
                    year,
                    email: generateEmail(rollNumber),
                    phoneNumber: generatePhoneNumber(),
                    parentMobileNumber: generatePhoneNumber(),
                    password: hashedPassword,
                    is_active: true,
                    roomNumber: "" // Will be assigned after saving
                });
            }
        }

        // Save students to database
        const savedStudents = await Student.insertMany(students);
        console.log(`Saved ${savedStudents.length} students to database`);

        // Now allocate rooms to students
        // Group students by year
        const studentsByYear = {
            1: [],
            2: [],
            3: [],
            4: []
        };

        for (const student of savedStudents) {
            studentsByYear[student.year].push(student);
        }

        let allocatedCount = 0;

        // Allocate students by year to appropriate floors
        for (let year = 1; year <= 4; year++) {
            const yearStudents = studentsByYear[year];
            console.log(`Allocating ${yearStudents.length} students of year ${year}`);

            // Get floors for this year
            const yearFloors = Object.keys(floorYearMap).filter(floor => floorYearMap[floor] === year);

            // Get all rooms for this year
            let yearRooms = [];
            for (const floor of yearFloors) {
                if (roomsByFloor[floor]) {
                    yearRooms = yearRooms.concat(roomsByFloor[floor]);
                }
            }

            // Shuffle rooms to randomize assignments
            yearRooms.sort(() => Math.random() - 0.5);

            // Calculate how many students we have to ensure at least 2 per room when possible
            const totalStudents = yearStudents.length;

            // If we have enough students to put at least 2 in each room
            const canFillWithTwo = totalStudents >= yearRooms.length * 2;

            if (canFillWithTwo) {
                // First pass: allocate 2 students to each room
                let studentIndex = 0;

                // First, ensure each room gets at least 2 students (if we have enough)
                for (let i = 0; i < yearRooms.length && studentIndex < yearStudents.length - 1; i++) {
                    const room = yearRooms[i];

                    // Add 2 students to this room
                    for (let j = 0; j < 2 && studentIndex < yearStudents.length; j++) {
                        const student = yearStudents[studentIndex];

                        // Update student's room number
                        student.room = room.roomNumber;
                        await student.save();

                        studentIndex++;
                        allocatedCount++;
                    }
                }

                // Second pass: distribute remaining students
                let roomIndex = 0;

                for (let i = studentIndex; i < yearStudents.length; i++) {
                    const student = yearStudents[i];
                    const room = yearRooms[roomIndex];

                    // If current room is full, move to next room
                    if (room.occupants.length >= room.capacity) {
                        roomIndex = (roomIndex + 1) % yearRooms.length;
                        i--; // Try this student again with the next room
                        continue;
                    }

                    // Update student's room number
                    student.room = room.roomNumber;
                    await student.save();

                    allocatedCount++;

                    // Move to next room for better distribution
                    roomIndex = (roomIndex + 1) % yearRooms.length;
                }
            } else {
                // Not enough students to put 2 in each room, use original algorithm
                let roomIndex = 0;
                let studentsInCurrentRoom = 0;
                let currentRoom = yearRooms[roomIndex];

                for (const student of yearStudents) {
                    // If current room is full, move to next room
                    if (studentsInCurrentRoom >= currentRoom.capacity) {
                        roomIndex++;
                        studentsInCurrentRoom = 0;

                        // If we've used all rooms, start over
                        if (roomIndex >= yearRooms.length) {
                            roomIndex = 0;
                        }

                        currentRoom = yearRooms[roomIndex];
                    }

                    // Update student's room number
                    student.room = currentRoom.roomNumber;
                    await student.save();

                    studentsInCurrentRoom++;
                    allocatedCount++;
                }
            }
        }

        // ✅ AUTOMATIC SYNC: Sync all rooms after bulk student generation
        try {
            console.log('🔄 Syncing all rooms after bulk student generation...');
            const syncResult = await roomSyncService.syncStudentsToRooms();
            console.log(`✅ Full room sync completed: ${syncResult.roomsUpdated} rooms updated`);
        } catch (syncError) {
            console.error('⚠️  Room sync warning after generation:', syncError);
        }

        res.status(201).json({
            message: `Successfully created ${students.length} random students and allocated ${allocatedCount} to rooms by year`,
            count: students.length
        });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
}));

// Generate all rooms automatically
adminApp.post('/generate-rooms', verifyAdmin, expressAsyncHandler(async (req, res) => {
    try {
        // Room pattern for each floor (rooms 01-39 only)
        const roomPattern = [
            { suffix: '01', capacity: 3 }, { suffix: '02', capacity: 3 }, { suffix: '03', capacity: 2 },
            { suffix: '04', capacity: 3 }, { suffix: '05', capacity: 2 }, { suffix: '06', capacity: 3 },
            { suffix: '07', capacity: 2 }, { suffix: '08', capacity: 3 }, { suffix: '09', capacity: 3 },
            { suffix: '10', capacity: 2 },

            // Rooms 11-20
            { suffix: '11', capacity: 3 }, { suffix: '12', capacity: 2 }, { suffix: '13', capacity: 3 },
            { suffix: '14', capacity: 2 }, { suffix: '15', capacity: 3 }, { suffix: '16', capacity: 2 },
            { suffix: '17', capacity: 3 }, { suffix: '18', capacity: 2 }, { suffix: '19', capacity: 3 },
            { suffix: '20', capacity: 2 },

            // Rooms 21-30
            { suffix: '21', capacity: 3 }, { suffix: '22', capacity: 2 }, { suffix: '23', capacity: 3 },
            { suffix: '24', capacity: 2 }, { suffix: '25', capacity: 3 }, { suffix: '26', capacity: 2 },
            { suffix: '27', capacity: 3 }, { suffix: '28', capacity: 2 }, { suffix: '29', capacity: 3 },
            { suffix: '30', capacity: 2 },

            // Rooms 31-39
            { suffix: '31', capacity: 3 }, { suffix: '32', capacity: 2 }, { suffix: '33', capacity: 3 },
            { suffix: '34', capacity: 2 }, { suffix: '35', capacity: 3 }, { suffix: '36', capacity: 2 },
            { suffix: '37', capacity: 3 }, { suffix: '38', capacity: 3 }, { suffix: '39', capacity: 2 }
        ];

        // First, clear existing rooms
        await Room.deleteMany({});

        const rooms = [];

        // Generate rooms for 12 floors
        for (let floor = 1; floor <= 12; floor++) {
            // For floors 1-9, use format 101-139, 201-239, etc.
            // For floors 10-12, use special format with increments of 10:
            // 10th floor: 1001, 1011, 1021, 1031, etc.
            // 11th floor: 1101, 1111, 1121, 1131, etc.
            // 12th floor: 1201, 1211, 1221, 1231, etc.

            if (floor < 10) {
                // Regular format for floors 1-9
                const floorPrefix = floor.toString();

                for (const room of roomPattern) {
                    const roomNumber = floorPrefix + room.suffix;
                    rooms.push({
                        roomNumber,
                        capacity: room.capacity,
                        occupants: []
                    });
                }
            } else {
                // Special format for floors 10-12
                const floorPrefix = floor.toString();

                // Create rooms with standard numbering: 1001-1039, 1101-1139, 1201-1239
                for (const room of roomPattern) {
                    // Calculate the room number: 1001, 1002, 1003, etc.
                    const roomNumber = floorPrefix + room.suffix;
                    rooms.push({
                        roomNumber,
                        capacity: room.capacity,
                        occupants: []
                    });
                }
            }
        }

        // Insert all rooms
        await Room.insertMany(rooms);

        res.status(201).json({
            message: `Successfully created ${rooms.length} rooms across 12 floors`,
            count: rooms.length
        });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
}));

// Get dashboard statistics
adminApp.get('/dashboard-stats', verifyAdmin, expressAsyncHandler(async (req, res) => {
    try {
        const totalStudents = await Student.countDocuments({ is_active: true });
        const totalAnnouncements = await Announcement.countDocuments();
        const pendingOutpassesCount = await Outpass.countDocuments({ status: 'pending' });
        const activeComplaintsCount = await Complaint.countDocuments({ status: 'active' });

        // Get recent complaints
        const recentComplaints = await Complaint.find()
            .sort({ createdAt: -1 })
            .limit(5);

        // Get recent outpasses
        const recentOutpasses = await Outpass.find()
            .sort({ createdAt: -1 })
            .limit(5);

        // Get today's announcements
        const today = new Date();
        today.setHours(0, 0, 0, 0);
        const todayAnnouncementsCount = await Announcement.countDocuments({
            createdAt: { $gte: today }
        });

        res.status(200).json({
            totalStudents,
            totalAnnouncements,
            pendingOutpassesCount,
            activeComplaintsCount,
            todayAnnouncementsCount,
            recentComplaints,
            recentOutpasses
        });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
}));

// Get enhanced dashboard statistics with comprehensive data
adminApp.get('/dashboard-stats-enhanced', verifyAdmin, expressAsyncHandler(async (req, res) => {
    try {
        const today = new Date();
        today.setHours(0, 0, 0, 0);
        const tomorrow = new Date(today);
        tomorrow.setDate(today.getDate() + 1);
        
        const startOfMonth = new Date(today.getFullYear(), today.getMonth(), 1);
        const endOfMonth = new Date(today.getFullYear(), today.getMonth() + 1, 0);

        // Basic counts
        const totalStudents = await Student.countDocuments({ is_active: true });
        const totalAnnouncements = await Announcement.countDocuments();
        const pendingOutpassesCount = await Outpass.countDocuments({ status: 'pending' });
        const activeComplaintsCount = await Complaint.countDocuments({ status: 'active' });

        // Room occupancy (with error handling)
        let totalRooms = 0;
        let occupiedRooms = 0;
        
        try {
            totalRooms = await Room.countDocuments();
            // Check if rooms have occupants array or individual student fields
            const sampleRoom = await Room.findOne();
            if (sampleRoom && sampleRoom.occupants) {
                // Using occupants array
                occupiedRooms = await Room.countDocuments({ 
                    occupants: { $exists: true, $not: { $size: 0 } }
                });
            } else {
                // Using individual student fields
                occupiedRooms = await Room.countDocuments({ 
                    $or: [
                        { student1: { $ne: null } },
                        { student2: { $ne: null } },
                        { student3: { $ne: null } }
                    ]
                });
            }
        } catch (error) {
            console.log('Room occupancy calculation error:', error.message);
        }

        // Food management stats (with error handling)
        let todayMealPauses = 0;
        let mealPauses = {
            breakfast: 0,
            lunch: 0,
            snacks: 0,
            dinner: 0
        };
        let foodFeedbackCount = 0;
        let averageFoodRating = 0;

        try {
            const { FoodPause, FoodFeedback } = require('../models/FoodModel');
            
            // Today's meal pauses
            todayMealPauses = await FoodPause.countDocuments({
                pause_from: { $lte: today },
                $or: [
                    { resume_from: { $gte: tomorrow } },
                    { resume_from: null }
                ]
            });

            const todayPauses = await FoodPause.find({
                pause_from: { $lte: today },
                $or: [
                    { resume_from: { $gte: tomorrow } },
                    { resume_from: null }
                ]
            });

            todayPauses.forEach(pause => {
                if (pause.pause_meals) {
                    const meals = pause.pause_meals.split(',').map(m => m.trim());
                    meals.forEach(meal => {
                        if (mealPauses.hasOwnProperty(meal)) {
                            mealPauses[meal]++;
                        }
                    });
                }
            });

            // Food feedback stats
            foodFeedbackCount = await FoodFeedback.countDocuments({
                createdAt: { $gte: startOfMonth, $lte: endOfMonth }
            });

            const feedbackAggregation = await FoodFeedback.aggregate([
                {
                    $match: {
                        createdAt: { $gte: startOfMonth, $lte: endOfMonth }
                    }
                },
                {
                    $group: {
                        _id: null,
                        averageRating: { $avg: '$rating' }
                    }
                }
            ]);

            averageFoodRating = feedbackAggregation.length > 0 
                ? Math.round(feedbackAggregation[0].averageRating * 10) / 10 
                : 0;
        } catch (error) {
            console.log('Food models not found, using default values:', error.message);
        }

        // Outpass detailed stats (with error handling)
        let outpassTypes = { late: 0, home: 0 };
        let studentsCurrentlyOut = 0;
        let overdueReturns = 0;

        try {
            outpassTypes = {
                late: await Outpass.countDocuments({ 
                    type: 'late', 
                    createdAt: { $gte: today, $lt: tomorrow } 
                }),
                home: await Outpass.countDocuments({ 
                    type: 'home', 
                    createdAt: { $gte: today, $lt: tomorrow } 
                })
            };

            // Students currently out (approved outpasses where current time is between outTime and inTime)
            const now = new Date();
            studentsCurrentlyOut = await Outpass.countDocuments({
                status: 'accepted',
                outTime: { $lte: now },
                inTime: { $gte: now }
            });

            // Overdue returns (students who should have returned but haven't)
            overdueReturns = await Outpass.countDocuments({
                status: 'accepted',
                inTime: { $lt: now },
                actualInTime: null // Assuming actualInTime is set when student returns
            });
        } catch (error) {
            console.log('Outpass stats calculation error:', error.message);
        }

        // Visitor management stats (if visitor model exists)
        let visitorsToday = 0;
        let visitorsInside = 0;
        let visitorsCheckedOut = 0;
        let visitorsThisMonth = 0;

        try {
            const Visitor = require('../models/VisitorModel');
            
            visitorsToday = await Visitor.countDocuments({
                checkInTime: { $gte: today, $lt: tomorrow }
            });

            visitorsInside = await Visitor.countDocuments({
                checkInTime: { $gte: today },
                checkOutTime: null
            });

            visitorsCheckedOut = await Visitor.countDocuments({
                checkInTime: { $gte: today, $lt: tomorrow },
                checkOutTime: { $ne: null }
            });

            visitorsThisMonth = await Visitor.countDocuments({
                checkInTime: { $gte: startOfMonth, $lte: endOfMonth }
            });
        } catch (error) {
            console.log('Visitor model not found, using default values');
        }

        // Recent activities
        const recentComplaints = await Complaint.find()
            .sort({ createdAt: -1 })
            .limit(5);

        const recentOutpasses = await Outpass.find()
            .sort({ createdAt: -1 })
            .limit(5);

        res.status(200).json({
            // Basic stats
            totalStudents,
            totalAnnouncements,
            pendingOutpassesCount,
            activeComplaintsCount,
            
            // Room stats
            totalRooms,
            occupiedRooms,
            
            // Food management
            todayMealPauses,
            mealPauses,
            foodFeedbackCount,
            averageFoodRating,
            
            // Outpass details
            outpassTypes,
            studentsCurrentlyOut,
            overdueReturns,
            
            // Visitor management
            visitorsToday,
            visitorsInside,
            visitorsCheckedOut,
            visitorsThisMonth,
            
            // Recent activities
            recentComplaints,
            recentOutpasses
        });
    } catch (error) {
        console.error('Enhanced dashboard stats error:', error);
        res.status(500).json({ error: error.message });
    }
}));

// ==================== ROOM SYNC AND GENERATION ENDPOINTS ====================

/**
 * Sync students to their existing rooms
 * Works with pre-generated rooms and allocates students based on their roomNumber field
 */
adminApp.post('/rooms/sync', verifyAdmin, expressAsyncHandler(async (req, res) => {
    try {
        console.log('🔄 Starting student-room sync process...');
        
        // Sync students to their rooms (will create missing rooms if needed)
        const syncResult = await roomSyncService.syncStudentsToRooms();
        console.log(`👥 Student sync: ${syncResult.studentsProcessed} students, ${syncResult.roomsUpdated} rooms updated`);
        
        // Get updated statistics
        const stats = await roomSyncService.getRoomStatistics();
        
        const response = {
            message: 'Student-room sync completed successfully',
            sync: syncResult,
            statistics: stats
        };
        
        // Include capacity warnings if any
        if (syncResult.capacityWarnings) {
            response.warnings = {
                message: `${syncResult.capacityWarnings.length} rooms exceed capacity`,
                details: syncResult.capacityWarnings
            };
        }
        
        res.status(200).json(response);
    } catch (error) {
        console.error('❌ Room sync error:', error);
        res.status(500).json({ error: error.message });
    }
}));

/**
 * Get all rooms with their allocated students
 * Returns rooms grouped by floor with full student details
 */
adminApp.get('/rooms/all-with-students', verifyAdmin, expressAsyncHandler(async (req, res) => {
    try {
        const rooms = await roomSyncService.getAllRoomsWithStudents();
        res.status(200).json(rooms);
    } catch (error) {
        console.error('❌ Error fetching rooms with students:', error);
        res.status(500).json({ error: error.message });
    }
}));

/**
 * Get rooms grouped by floor
 */
adminApp.get('/rooms/by-floor', verifyAdmin, expressAsyncHandler(async (req, res) => {
    try {
        const roomsByFloor = await roomSyncService.getRoomsByFloor();
        res.status(200).json(roomsByFloor);
    } catch (error) {
        console.error('❌ Error fetching rooms by floor:', error);
        res.status(500).json({ error: error.message });
    }
}));

/**
 * Get room statistics
 */
adminApp.get('/rooms/statistics', verifyAdmin, expressAsyncHandler(async (req, res) => {
    try {
        const stats = await roomSyncService.getRoomStatistics();
        res.status(200).json(stats);
    } catch (error) {
        console.error('❌ Error fetching room statistics:', error);
        res.status(500).json({ error: error.message });
    }
}));

/**
 * Generate all 468 rooms (without syncing students)
 */
adminApp.post('/rooms/generate-all', verifyAdmin, expressAsyncHandler(async (req, res) => {
    try {
        const result = await roomSyncService.generateAllRooms();
        res.status(200).json({
            message: `Successfully generated rooms`,
            ...result
        });
    } catch (error) {
        console.error('❌ Room generation error:', error);
        res.status(500).json({ error: error.message });
    }
}));

module.exports = adminApp;