const MonthlyAttendance = require('../models/MonthlyAttendanceModel');
const Student = require('../models/StudentModel');

/**
 * Get or create monthly attendance for a student
 * @param {Object} req - Express request object
 * @param {Object} res - Express response object
 */
const getMonthlyAttendance = async (req, res) => {
  try {
    const { studentId, year, month } = req.params;
    
    // Validate input
    if (!studentId || !year || !month) {
      return res.status(400).json({ error: 'Missing required parameters' });
    }
    
    const numYear = parseInt(year);
    const numMonth = parseInt(month);
    
    if (isNaN(numYear) || isNaN(numMonth) || numMonth < 1 || numMonth > 12) {
      return res.status(400).json({ error: 'Invalid year or month' });
    }
    
    // Check if student exists
    const student = await Student.findById(studentId);
    if (!student) {
      return res.status(404).json({ error: 'Student not found' });
    }
    
    // Get or create the monthly attendance
    const attendance = await MonthlyAttendance.ensureExists(studentId, numYear, numMonth);
    
    res.json({
      student_id: attendance.student_id,
      year: attendance.year,
      month: attendance.month,
      attendance: Object.fromEntries(attendance.attendance), // Convert Map to object
      summary: attendance.summary
    });
    
  } catch (error) {
    console.error('Error getting monthly attendance:', error);
    res.status(500).json({ error: 'Failed to get monthly attendance' });
  }
};

/**
 * Update attendance for a specific day
 * @param {Object} req - Express request object
 * @param {Object} res - Express response object
 */
const updateDailyAttendance = async (req, res) => {
  try {
    const { studentId, year, month, day } = req.params;
    const { status } = req.body;
    
    // Validate input
    if (!studentId || !year || !month || !day || !status) {
      return res.status(400).json({ error: 'Missing required parameters' });
    }
    
    if (!['P', 'A', 'H'].includes(status)) {
      return res.status(400).json({ error: "Status must be 'P', 'A', or 'H'" });
    }
    
    const numYear = parseInt(year);
    const numMonth = parseInt(month);
    const numDay = parseInt(day);
    
    if (isNaN(numYear) || isNaN(numMonth) || numMonth < 1 || numMonth > 12) {
      return res.status(400).json({ error: 'Invalid year or month' });
    }
    
    if (isNaN(numDay) || numDay < 1 || numDay > 31) {
      return res.status(400).json({ error: 'Day must be between 1 and 31' });
    }
    
    // Check if student exists
    const student = await Student.findById(studentId);
    if (!student) {
      return res.status(404).json({ error: 'Student not found' });
    }
    
    // Get or create the monthly attendance
    const attendance = await MonthlyAttendance.ensureExists(studentId, numYear, numMonth);
    
    // Update the attendance for the specific day
    await attendance.updateDay(day, status);
    
    res.json({
      success: true,
      message: 'Attendance updated successfully',
      attendance: Object.fromEntries(attendance.attendance),
      summary: attendance.summary
    });
    
  } catch (error) {
    console.error('Error updating attendance:', error);
    res.status(500).json({ error: 'Failed to update attendance' });
  }
};

/**
 * Get monthly statistics for all students (Admin only)
 * @param {Object} req - Express request object
 * @param {Object} res - Express response object
 */
const getMonthlyStats = async (req, res) => {
  try {
    const { year, month } = req.params;
    
    // Validate input
    if (!year || !month) {
      return res.status(400).json({ error: 'Missing required parameters' });
    }
    
    const numYear = parseInt(year);
    const numMonth = parseInt(month);
    
    if (isNaN(numYear) || isNaN(numMonth) || numMonth < 1 || numMonth > 12) {
      return res.status(400).json({ error: 'Invalid year or month' });
    }
    
    // Aggregate to get total counts for the month
    const stats = await MonthlyAttendance.aggregate([
      {
        $match: {
          year: numYear,
          month: numMonth
        }
      },
      {
        $group: {
          _id: null,
          totalPresent: { $sum: '$summary.present' },
          totalAbsent: { $sum: '$summary.absent' },
          totalHomePass: { $sum: '$summary.home_pass' },
          studentCount: { $sum: 1 }
        }
      }
    ]);
    
    const result = stats[0] || {
      totalPresent: 0,
      totalAbsent: 0,
      totalHomePass: 0,
      studentCount: 0
    };
    
    res.json({
      year: numYear,
      month: numMonth,
      ...result
    });
    
  } catch (error) {
    console.error('Error getting monthly stats:', error);
    res.status(500).json({ error: 'Failed to get monthly statistics' });
  }
};

module.exports = {
  getMonthlyAttendance,
  updateDailyAttendance,
  getMonthlyStats
};
