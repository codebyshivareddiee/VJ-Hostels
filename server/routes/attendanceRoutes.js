const express = require('express');
const attendanceRouter = express.Router();
const AttendanceRecord = require('../models/AttendanceModel');
const Student = require('../models/StudentModel');
const Room = require('../models/Room');
const Outpass = require('../models/OutpassModel');
const expressAsyncHandler = require('express-async-handler');
const jwt = require('jsonwebtoken');
require('dotenv').config();

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

    // Parse date or use today
    const attendanceDate = date ? new Date(date) : new Date();
    attendanceDate.setHours(0, 0, 0, 0);

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

    // Get active outpasses for today
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const tomorrow = new Date(today);
    tomorrow.setDate(tomorrow.getDate() + 1);

    const activeOutpasses = await Outpass.find({
      status: { $in: ['approved', 'out'] },
      type: 'home pass',
      outTime: { $lte: tomorrow },
      inTime: { $gte: today }
    });

    // Create a map of student attendance
    const attendanceMap = {};
    attendanceRecords.forEach(record => {
      attendanceMap[record.studentId.toString()] = record.status;
    });

    // Create a map of students with home passes
    const homePassMap = {};
    activeOutpasses.forEach(pass => {
      const studentKey = pass.rollNumber;
      homePassMap[studentKey] = {
        status: pass.status === 'out' ? 'home_pass_used' : 'home_pass_approved',
        outTime: pass.actualOutTime || pass.outTime,
        inTime: pass.inTime
      };
    });

    // Enrich room data with attendance status
    const enrichedRooms = rooms.map(room => {
      const studentsWithStatus = room.occupants.map(student => {
        const studentId = student._id.toString();
        const rollNumber = student.rollNumber;
        
        // Check if student has attendance marked
        let status = attendanceMap[studentId];
        
        // If no attendance marked, check for home pass
        if (!status && homePassMap[rollNumber]) {
          status = homePassMap[rollNumber].status;
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
          homePassInfo: homePassMap[rollNumber] || null
        };
      });

      return {
        _id: room._id,
        roomNumber: room.roomNumber,
        floor: room.floor,
        capacity: room.capacity,
        currentOccupancy: room.occupants.length,
        students: studentsWithStatus
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

    // Parse date or use today
    const attendanceDate = date ? new Date(date) : new Date();
    attendanceDate.setHours(0, 0, 0, 0);

    // Validate: Only allow marking attendance for today
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    
    if (attendanceDate.getTime() !== today.getTime()) {
      return res.status(403).json({ 
        message: "Cannot mark attendance for past or future dates. Only today's attendance can be marked.",
        requestedDate: attendanceDate.toISOString().split('T')[0],
        todayDate: today.toISOString().split('T')[0]
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

    // Parse date or use today
    const attendanceDate = date ? new Date(date) : new Date();
    attendanceDate.setHours(0, 0, 0, 0);

    // Validate: Only allow marking attendance for today
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    
    if (attendanceDate.getTime() !== today.getTime()) {
      return res.status(403).json({ 
        message: "Cannot mark attendance for past or future dates. Only today's attendance can be marked.",
        requestedDate: attendanceDate.toISOString().split('T')[0],
        todayDate: today.toISOString().split('T')[0]
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

    // Get floor-wise completion
    const floorCompletion = await AttendanceRecord.aggregate([
      {
        $match: { date: attendanceDate }
      },
      {
        $group: {
          _id: '$floor',
          markedCount: { $sum: 1 }
        }
      },
      {
        $sort: { _id: 1 }
      }
    ]);

    // Get total students per floor
    const floorTotals = await Room.aggregate([
      {
        $match: { floor: { $exists: true, $ne: null } }
      },
      {
        $group: {
          _id: '$floor',
          totalStudents: { $sum: { $size: '$occupants' } }
        }
      }
    ]);

    // Merge floor data
    const floorMap = {};
    floorTotals.forEach(floor => {
      floorMap[floor._id] = { total: floor.totalStudents, marked: 0 };
    });

    floorCompletion.forEach(floor => {
      if (floorMap[floor._id]) {
        floorMap[floor._id].marked = floor.markedCount;
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
      home_pass_used: 0
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
