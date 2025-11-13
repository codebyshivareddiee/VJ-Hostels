const express = require('express');
const expressAsyncHandler = require('express-async-handler');
const { AttendanceRecord } = require('../models/AttendanceModel');
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

    // Compute Home Pass (Used) from Outpass, then optionally filter by floor using student's current room
    const nextDayForOutpass = new Date(attendanceDate);
    nextDayForOutpass.setDate(nextDayForOutpass.getDate() + 1);

    const outpassMatch = {
      status: 'out',
      type: 'home pass',
      $or: [
        { actualOutTime: { $gte: attendanceDate, $lt: nextDayForOutpass } },
        { outTime: { $lt: nextDayForOutpass }, inTime: { $gte: attendanceDate } }
      ]
    };

    const activeHomePasses = await Outpass.find(outpassMatch).select('rollNumber name status type actualOutTime outTime inTime').lean();
    let homePassUsedCount = activeHomePasses.length;
    if (floors && floors !== '') {
      const floorNumber = parseInt(floors, 10);
      // Resolve each rollNumber to student's room and filter by floor
      const filtered = [];
      for (const p of activeHomePasses) {
        const student = await Student.findOne({ rollNumber: p.rollNumber }).select('_id').lean();
        if (!student?._id) continue;
        const room = await Room.findOne({ occupants: student._id }).select('floor').lean();
        if (room && room.floor === floorNumber) filtered.push(p);
      }
      homePassUsedCount = filtered.length;
    }

    res.json({
      totalStudents,
      presentCount: statusCounts.present || 0,
      absentCount: statusCounts.absent || 0,
      homePassUsedCount,
      roomsCompleted: completedRooms.length,
      totalRooms
    });
  } catch (error) {
    console.error('Admin Analytics - KPI error:', error);
    res.status(500).json({ error: error.message });
  }
}));

// Export attendance for a date. CSV when format=csv; JSON otherwise. Optional floor filter.
adminAttendanceRouter.get('/export', expressAsyncHandler(async (req, res) => {
  try {
    const { date, floors, format = 'csv' } = req.query;
    const inputDate = date || new Date().toISOString().split('T')[0];
    const attendanceDate = new Date(inputDate);
    attendanceDate.setHours(0, 0, 0, 0);
    const nextDay = new Date(attendanceDate);
    nextDay.setDate(nextDay.getDate() + 1);

    if (String(format).toLowerCase() === 'csv') {
      // Build roster from rooms and occupants (respect floor filter if provided)
      const roomMatch = floors && floors !== '' ? { floor: parseInt(floors, 10) } : {};
      const rooms = await Room.find(roomMatch)
        .select('roomNumber floor occupants')
        .populate({ path: 'occupants', select: 'rollNumber name email phoneNumber' })
        .sort({ roomNumber: 1 })
        .lean();

      // Flatten students with room context
      const roster = [];
      for (const r of rooms) {
        for (const s of r.occupants) {
          roster.push({
            rollNumber: s.rollNumber,
            name: s.name,
            roomNumber: r.roomNumber,
            floor: r.floor
          });
        }
      }

      // Attendance records map by rollNumber for date
      const attendanceRecords = await AttendanceRecord.find({
        date: { $gte: attendanceDate, $lt: nextDay },
        ...(floors && floors !== '' ? { floor: parseInt(floors, 10) } : {})
      }).select('rollNumber status markedAt').lean();

      const attendanceMap = new Map();
      attendanceRecords.forEach(rec => {
        attendanceMap.set(rec.rollNumber, { status: rec.status, markedAt: rec.markedAt });
      });

      // Outpass overlap map for the selected day (home/late pass used and approved)
      const outpasses = await Outpass.find({
        type: { $in: ['home pass', 'late pass'] },
        $or: [
          { status: 'out', $or: [ { actualOutTime: { $gte: attendanceDate, $lt: nextDay } }, { outTime: { $lt: nextDay }, inTime: { $gte: attendanceDate } } ] },
          { status: 'approved', outTime: { $gte: attendanceDate, $lt: nextDay } }
        ]
      }).select('rollNumber type status actualOutTime outTime').lean();

      const outpassMap = new Map();
      outpasses.forEach(p => {
        const used = p.status === 'out';
        const key = p.rollNumber;
        const status = p.type === 'home pass'
          ? (used ? 'home_pass_used' : 'home_pass_approved')
          : (used ? 'late_pass_used' : 'late_pass_approved');
        const markedAt = p.actualOutTime || p.outTime || null;
        outpassMap.set(key, { status, markedAt });
      });

      // Build CSV rows
      const headers = ['slno', 'roll', 'name', 'room', 'status', 'marked_at'];
      const rows = [headers.join(',')];
      let slno = 1;
      roster.forEach(s => {
        // default: unmarked (no attendance and no overlapping outpass)
        let status = 'unmarked';
        let markedAt = '';
        if (attendanceMap.has(s.rollNumber)) {
          const rec = attendanceMap.get(s.rollNumber);
          status = rec.status || 'unmarked';
          markedAt = rec.markedAt ? new Date(rec.markedAt).toISOString() : '';
        } else if (outpassMap.has(s.rollNumber)) {
          const op = outpassMap.get(s.rollNumber);
          status = op.status;
          markedAt = op.markedAt ? new Date(op.markedAt).toISOString() : '';
        }
        const line = [
          slno,
          s.rollNumber,
          (s.name || '').replace(/,/g, ' '),
          s.roomNumber,
          status,
          markedAt
        ].join(',');
        rows.push(line);
        slno += 1;
      });

      const csv = rows.join('\n');
      const filename = `attendance-${attendanceDate.toISOString().split('T')[0]}${floors && floors !== '' ? `-floor-${floors}` : ''}.csv`;

      res.setHeader('Content-Type', 'text/csv');
      res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
      return res.status(200).send(csv);
    }

    // JSON format: detailed records with joins (includes markedByName)
    const exportData = await AttendanceRecord.aggregate([
      { $match: { 
        date: { $gte: attendanceDate, $lt: nextDay },
        ...(floors && floors !== '' ? { floor: parseInt(floors, 10) } : {})
      } },
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
      {
        $lookup: {
          from: 'guards',
          localField: 'markedBy',
          foreignField: '_id',
          as: 'guard'
        }
      },
      { $unwind: '$student' },
      { $unwind: '$room' },
      { $unwind: { path: '$guard', preserveNullAndEmptyArrays: true } },
      {
        $project: {
          date: 1,
          floor: 1,
          roomNumber: 1,
          studentName: '$student.name',
          rollNumber: '$student.rollNumber',
          status: 1,
          markedAt: '$createdAt',
          markedBy: 1,
          markedByName: '$guard.name'
        }
      }
    ]);

    return res.json(exportData);
  } catch (error) {
    console.error('Admin Attendance - export error:', error);
    res.status(500).json({ error: error.message });
  }
}));

// Home Pass (Used) Students List for Analytics
adminAttendanceRouter.get('/homepass-list', expressAsyncHandler(async (req, res) => {
  try {
    const { date, floors } = req.query;
    const attendanceDate = new Date(date || new Date().toISOString().split('T')[0]);
    attendanceDate.setHours(0, 0, 0, 0);
    const nextDay = new Date(attendanceDate);
    nextDay.setDate(nextDay.getDate() + 1);

    const outpassQuery = {
      status: 'out',
      type: 'home pass',
      $or: [
        { actualOutTime: { $gte: attendanceDate, $lt: nextDay } },
        { outTime: { $lt: nextDay }, inTime: { $gte: attendanceDate } }
      ]
    };

    const activeHomePasses = await Outpass.find(outpassQuery).lean();

    // Enrich with student and room details
    let results = await Promise.all(activeHomePasses.map(async (p) => {
      const student = await Student.findOne({ rollNumber: p.rollNumber }).select('name email phoneNumber rollNumber').lean();
      let roomInfo = null;
      if (student?._id) {
        const room = await Room.findOne({ occupants: student._id }).select('roomNumber floor').lean();
        if (room) roomInfo = { roomNumber: room.roomNumber, floor: room.floor };
      }
      return {
        rollNumber: p.rollNumber,
        name: student?.name || p.name,
        type: p.type,
        status: p.status,
        outTime: p.actualOutTime || p.outTime,
        expectedIn: p.inTime,
        roomNumber: roomInfo?.roomNumber || null,
        floor: roomInfo?.floor || null
      };
    }));

    // If floor filter provided, filter results after enrichment
    if (floors && floors !== '') {
      const floorNumber = parseInt(floors, 10);
      results = results.filter(r => r.floor === floorNumber);
    }

    res.json(results);
  } catch (error) {
    console.error('Admin Analytics - homepass-list error:', error);
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
    attendanceDate.setHours(0, 0, 0, 0);
    const nextDay = new Date(attendanceDate);
    nextDay.setDate(nextDay.getDate() + 1);
    
    const alerts = [];
    
    // Check for low completion rate
    const totalRooms = await Room.countDocuments();
    const completedRooms = await AttendanceRecord.distinct('roomNumber', { date: { $gte: attendanceDate, $lt: nextDay } });
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
      { $match: { date: { $gte: attendanceDate, $lt: nextDay } } },
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

// (Removed duplicate /export endpoint by merging logic above)

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
