const express = require('express');
const expressAsyncHandler = require('express-async-handler');
const AttendanceRecord = require('../models/AttendanceModel');
const Room = require('../models/Room');
const Student = require('../models/StudentModel');
const Outpass = require('../models/OutpassModel');
const Guard = require('../models/GuardModel');

const adminAttendanceRouter = express.Router();

// KPI Data Endpoint
adminAttendanceRouter.get('/kpi', expressAsyncHandler(async (req, res) => {
  try {
    const { date, floors, guard } = req.query;
    const inputDate = date || new Date().toISOString().split('T')[0];
    const attendanceDate = new Date(inputDate);
    attendanceDate.setHours(0, 0, 0, 0);

    const nextDay = new Date(attendanceDate);
    nextDay.setDate(nextDay.getDate() + 1);

    console.log('Admin Analytics - Querying attendance for date range:', {
      from: attendanceDate.toISOString(),
      to: nextDay.toISOString(),
      inputDate
    });

    // Build match criteria for attendance records
    const matchCriteria = {
      date: { $gte: attendanceDate, $lt: nextDay }
    };

    let totalStudents = 0;

    if (floors && floors !== '') {
      const floorNumber = parseInt(floors, 10);
      matchCriteria.floor = floorNumber;

      const floorStudents = await Room.aggregate([
        { $match: { floor: floorNumber } },
        {
          $project: {
            occupantCount: {
              $size: {
                $ifNull: ['$occupants', []]
              }
            }
          }
        },
        {
          $group: {
            _id: null,
            total: { $sum: '$occupantCount' }
          }
        }
      ]);

      totalStudents = floorStudents[0]?.total || 0;

      if (totalStudents === 0) {
        const distinctStudents = await AttendanceRecord.distinct('studentId', matchCriteria);
        totalStudents = distinctStudents.length;
      }
    } else {
      totalStudents = await Student.countDocuments({ is_active: true });
    }

    if (guard && guard !== '') {
      matchCriteria.markedBy = guard;
    }

    console.log('Admin Analytics - Match criteria:', matchCriteria);

    const attendanceSummary = await AttendanceRecord.aggregate([
      { $match: matchCriteria },
      { $group: { _id: '$status', count: { $sum: 1 } } }
    ]);

    // Calculate completion based on scope
    const roomMatch = floors && floors !== ''
      ? { floor: parseInt(floors, 10) }
      : {};

    const totalRooms = await Room.countDocuments(roomMatch);
    const completedRooms = await AttendanceRecord.distinct('roomNumber', matchCriteria);

    const statusCounts = attendanceSummary.reduce((acc, curr) => {
      acc[curr._id] = curr.count;
      return acc;
    }, {});

    res.json({
      totalStudents,
      presentCount: statusCounts.present || 0,
      absentCount: statusCounts.absent || 0,
      homePassUsedCount: statusCounts.home_pass_used || 0,
      roomsCompleted: completedRooms.length,
      totalRooms
    });
  } catch (error) {
    console.error('Admin Analytics - KPI error:', error);
    res.status(500).json({ error: error.message });
  }
}));

// Floor Data Endpoint
adminAttendanceRouter.get('/floors', expressAsyncHandler(async (req, res) => {
  try {
    const { date } = req.query;
    const inputDate = date || new Date().toISOString().split('T')[0];
    const attendanceDate = new Date(inputDate);
    attendanceDate.setHours(0, 0, 0, 0);
    
    const nextDay = new Date(attendanceDate);
    nextDay.setDate(nextDay.getDate() + 1);
    
    const floorData = await Room.aggregate([
      {
        $group: {
          _id: '$floor',
          totalRooms: { $sum: 1 },
          totalStudents: { $sum: { $size: '$occupants' } }
        }
      },
      {
        $lookup: {
          from: 'attendancerecords',
          let: { floor: '$_id' },
          pipeline: [
            { 
              $match: { 
                $expr: { $eq: ['$floor', '$$floor'] },
                date: { $gte: attendanceDate, $lt: nextDay }
              } 
            },
            { $group: { _id: '$roomNumber', present: { $sum: { $cond: [{ $eq: ['$status', 'present'] }, 1, 0] } } } }
          ],
          as: 'attendance'
        }
      },
      {
        $addFields: {
          completedRooms: { $size: '$attendance' },
          completionPercentage: { $multiply: [{ $divide: [{ $size: '$attendance' }, '$totalRooms'] }, 100] },
          present: { $sum: '$attendance.present' }
        }
      },
      { $sort: { _id: 1 } }
    ]);
    
    res.json(floorData.map(floor => ({
      floorId: floor._id,
      totalRooms: floor.totalRooms,
      roomsCompleted: floor.completedRooms,
      completionPercentage: Math.round(floor.completionPercentage || 0),
      total: floor.totalStudents,
      present: floor.present || 0
    })));
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
}));

// Room Data Endpoint
adminAttendanceRouter.get('/rooms', expressAsyncHandler(async (req, res) => {
  try {
    const { date, floors } = req.query;
    const inputDate = date || new Date().toISOString().split('T')[0];
    const attendanceDate = new Date(inputDate);
    attendanceDate.setHours(0, 0, 0, 0);
    
    const nextDay = new Date(attendanceDate);
    nextDay.setDate(nextDay.getDate() + 1);
    
    let floorFilter = {};
    if (floors) {
      floorFilter = { floor: { $in: floors.split(',').map(f => parseInt(f)) } };
    }
    
    const roomData = await Room.aggregate([
      { $match: floorFilter },
      {
        $lookup: {
          from: 'attendancerecords',
          let: { roomNumber: '$roomNumber' },
          pipeline: [
            { 
              $match: { 
                $expr: { $eq: ['$roomNumber', '$$roomNumber'] },
                date: { $gte: attendanceDate, $lt: nextDay }
              } 
            },
            { $group: { 
              _id: '$status', 
              count: { $sum: 1 },
              lastUpdated: { $max: '$updatedAt' }
            }}
          ],
          as: 'attendance'
        }
      },
      {
        $addFields: {
          present: { $sum: { $cond: [{ $eq: ['$attendance._id', 'present'] }, '$attendance.count', 0] } },
          absent: { $sum: { $cond: [{ $eq: ['$attendance._id', 'absent'] }, '$attendance.count', 0] } },
          homePass: { $sum: { $cond: [{ $in: ['$attendance._id', ['home_pass_approved', 'home_pass_used']] }, '$attendance.count', 0] } },
          completed: { $gt: [{ $size: '$attendance' }, 0] },
          lastUpdated: { $max: '$attendance.lastUpdated' }
        }
      }
    ]);
    
    res.json(roomData.map(room => ({
      roomId: room._id,
      roomNumber: room.roomNumber,
      floor: room.floor,
      total: room.occupants.length,
      present: room.present || 0,
      absent: room.absent || 0,
      homePass: room.homePass || 0,
      completed: room.completed,
      lastUpdated: room.lastUpdated
    })));
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
}));

// Guard Activity Endpoint
adminAttendanceRouter.get('/guards', expressAsyncHandler(async (req, res) => {
  try {
    const { date } = req.query;
    const attendanceDate = new Date(date || new Date().toISOString().split('T')[0]);
    
    const guardActivity = await Guard.aggregate([
      { $match: { role: { $in: ['security', 'head_security'] } } },
      {
        $lookup: {
          from: 'attendancerecords',
          let: { guardId: '$_id', date: attendanceDate },
          pipeline: [
            { $match: { $expr: { $and: [{ $eq: ['$markedBy', '$$guardId'] }, { $eq: ['$date', '$$date'] }] } } },
            { $group: { 
              _id: '$floor',
              roomsCompleted: { $addToSet: '$roomNumber' },
              lastActivity: { $max: '$updatedAt' }
            }}
          ],
          as: 'activity'
        }
      },
      {
        $addFields: {
          floorsAssigned: '$activity._id',
          totalRoomsCompleted: { $sum: { $size: '$activity.roomsCompleted' } },
          lastActivity: { $max: '$activity.lastActivity' },
          isActive: { $gt: [{ $size: '$activity' }, 0] }
        }
      }
    ]);
    
    res.json(guardActivity.map(guard => ({
      guardId: guard._id,
      name: guard.name,
      floorsAssigned: guard.floorsAssigned || [],
      roomsCompleted: guard.totalRoomsCompleted || 0,
      totalRooms: 50, // This should be calculated based on assigned floors
      completionPercentage: Math.round(((guard.totalRoomsCompleted || 0) / 50) * 100),
      lastActivity: guard.lastActivity || null,
      isActive: guard.isActive
    })));
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
}));

// Time Series Data Endpoint
adminAttendanceRouter.get('/timeseries', expressAsyncHandler(async (req, res) => {
  try {
    const { date, days = 7 } = req.query;
    const endDate = new Date(date || new Date().toISOString().split('T')[0]);
    const startDate = new Date(endDate);
    startDate.setDate(startDate.getDate() - parseInt(days));
    
    const timeSeriesData = [];
    for (let d = new Date(startDate); d <= endDate; d.setDate(d.getDate() + 1)) {
      const dayDate = new Date(d);
      const nextDay = new Date(dayDate);
      nextDay.setDate(nextDay.getDate() + 1);
      
      const dayStats = await AttendanceRecord.aggregate([
        { $match: { date: { $gte: dayDate, $lt: nextDay } } },
        { $group: { _id: '$status', count: { $sum: 1 } } }
      ]);
      
      const stats = { date: dayDate.toISOString().split('T')[0], present: 0, absent: 0, homePass: 0 };
      dayStats.forEach(stat => {
        if (stat._id === 'present') stats.present = stat.count;
        else if (stat._id === 'absent') stats.absent = stat.count;
        else if (stat._id.includes('home_pass') || stat._id.includes('late_pass')) stats.homePass += stat.count;
      });
      
      timeSeriesData.push(stats);
    }
    
    res.json(timeSeriesData);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
}));

// Alerts Endpoint
adminAttendanceRouter.get('/alerts', expressAsyncHandler(async (req, res) => {
  try {
    const { date } = req.query;
    const attendanceDate = new Date(date || new Date().toISOString().split('T')[0]);
    
    const alerts = [];
    
    // Check for low completion rate
    const totalRooms = await Room.countDocuments();
    const completedRooms = await AttendanceRecord.distinct('roomNumber', { date: attendanceDate });
    const completionRate = (completedRooms.length / totalRooms) * 100;
    
    if (completionRate < 90) {
      alerts.push({
        title: 'Low Attendance Completion',
        message: `Only ${completionRate.toFixed(1)}% of rooms have completed attendance`,
        severity: 'high',
        timestamp: new Date()
      });
    }
    
    // Check for students with conflicting states
    const conflictingStudents = await AttendanceRecord.aggregate([
      { $match: { date: attendanceDate } },
      { $group: { _id: '$studentId', statuses: { $addToSet: '$status' }, count: { $sum: 1 } } },
      { $match: { count: { $gt: 1 } } }
    ]);
    
    if (conflictingStudents.length > 0) {
      alerts.push({
        title: 'Conflicting Attendance Records',
        message: `${conflictingStudents.length} students have multiple attendance records`,
        severity: 'medium',
        timestamp: new Date()
      });
    }
    
    res.json(alerts);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
}));

// Home Pass Flow Endpoint
adminAttendanceRouter.get('/homepass-flow', expressAsyncHandler(async (req, res) => {
  try {
    const { date } = req.query;
    const attendanceDate = new Date(date || new Date().toISOString().split('T')[0]);
    const nextDay = new Date(attendanceDate);
    nextDay.setDate(nextDay.getDate() + 1);
    
    const homePassFlow = await Outpass.aggregate([
      { 
        $match: { 
          outTime: { $gte: attendanceDate, $lt: nextDay },
          type: { $in: ['home pass', 'late pass'] }
        }
      },
      { $group: { _id: '$status', count: { $sum: 1 } } }
    ]);
    
    const flow = { approved: 0, used: 0, returned: 0 };
    homePassFlow.forEach(item => {
      if (item._id === 'approved') flow.approved = item.count;
      else if (item._id === 'out') flow.used = item.count;
      else if (item._id === 'returned') flow.returned = item.count;
    });
    
    res.json(flow);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
}));

// Export endpoint
adminAttendanceRouter.get('/export', expressAsyncHandler(async (req, res) => {
  try {
    const { date, format = 'csv' } = req.query;
    const attendanceDate = new Date(date || new Date().toISOString().split('T')[0]);
    
    // Get comprehensive attendance data
    const exportData = await AttendanceRecord.aggregate([
      { $match: { date: attendanceDate } },
      {
        $lookup: {
          from: 'students',
          localField: 'studentId',
          foreignField: '_id',
          as: 'student'
        }
      },
      {
        $lookup: {
          from: 'rooms',
          localField: 'roomNumber',
          foreignField: 'roomNumber',
          as: 'room'
        }
      },
      { $unwind: '$student' },
      { $unwind: '$room' },
      {
        $project: {
          date: 1,
          floor: 1,
          roomNumber: 1,
          studentName: '$student.name',
          rollNumber: '$student.rollNumber',
          status: 1,
          markedAt: '$createdAt',
          markedBy: 1
        }
      }
    ]);
    
    if (format === 'csv') {
      const csv = [
        'Date,Floor,Room,Student Name,Roll Number,Status,Marked At,Marked By',
        ...exportData.map(record => 
          `${record.date.toISOString().split('T')[0]},${record.floor},${record.roomNumber},"${record.studentName}",${record.rollNumber},${record.status},${record.markedAt.toISOString()},${record.markedBy}`
        )
      ].join('\n');
      
      res.setHeader('Content-Type', 'text/csv');
      res.setHeader('Content-Disposition', `attachment; filename=attendance-${date}.csv`);
      res.send(csv);
    } else {
      res.json(exportData);
    }
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
}));

// Floors filter endpoint
adminAttendanceRouter.get('/floors-list', expressAsyncHandler(async (req, res) => {
  try {
    const floors = await Room.aggregate([
      { $group: { _id: '$floor', roomCount: { $sum: 1 } } },
      { $sort: { _id: 1 } }
    ]);
    
    res.json(floors.map(floor => ({
      _id: floor._id,
      roomCount: floor.roomCount
    })));
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
}));

// Guards filter endpoint
adminAttendanceRouter.get('/guards-list', expressAsyncHandler(async (req, res) => {
  try {
    const guards = await Guard.find({ isActive: true }, { _id: 1, name: 1, role: 1 });
    res.json(guards);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
}));

module.exports = adminAttendanceRouter;
