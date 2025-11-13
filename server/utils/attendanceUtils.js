const MonthlyAttendance = require('../models/MonthlyAttendanceModel');

/**
 * Auto-create monthly attendance documents for existing students.
 * @param {Array} students - List of student objects.
 */
const autoCreateMonthlyAttendance = async (students) => {
  const currentYear = new Date().getFullYear();
  const currentMonth = new Date().getMonth() + 1; // Months are 0-indexed in JS

  for (const student of students) {
    const existingDoc = await MonthlyAttendance.findOne({
      student_id: student._id,
      year: currentYear,
      month: currentMonth
    });

    if (!existingDoc) {
      await MonthlyAttendance.create({
        student_id: student._id,
        year: currentYear,
        month: currentMonth,
        attendance: {},
        summary: { present: 0, absent: 0, home_pass: 0 }
      });
    }
  }
};

/**
 * Update attendance for a specific day.
 * @param {String} studentId - The ID of the student.
 * @param {Number} year - The year of the attendance record.
 * @param {Number} month - The month of the attendance record.
 * @param {Number} day - The day to update.
 * @param {String} status - The new status ('P', 'A', 'H').
 */
const updateAttendanceForDay = async (studentId, year, month, day, status) => {
  const attendanceDoc = await MonthlyAttendance.findOne({ student_id: studentId, year, month });

  if (!attendanceDoc) {
    throw new Error('Attendance document not found');
  }

  const previousStatus = attendanceDoc.attendance.get(day.toString());

  // Update the attendance for the day
  attendanceDoc.attendance.set(day.toString(), status);

  // Adjust the summary
  if (previousStatus) {
    attendanceDoc.summary[previousStatus.toLowerCase()] -= 1;
  }
  attendanceDoc.summary[status.toLowerCase()] += 1;

  await attendanceDoc.save();
};

/**
 * Fetch student monthly attendance.
 * @param {String} studentId - The ID of the student.
 * @param {Number} year - The year of the attendance record.
 * @param {Number} month - The month of the attendance record.
 * @returns {Object} - The attendance object and summary.
 */
const fetchStudentMonthlyAttendance = async (studentId, year, month) => {
  const attendanceDoc = await MonthlyAttendance.findOne({ student_id: studentId, year, month });

  if (!attendanceDoc) {
    throw new Error('Attendance document not found');
  }

  return {
    attendance: attendanceDoc.attendance,
    summary: attendanceDoc.summary
  };
};

/**
 * Fetch admin statistics for attendance.
 * @param {Number} year - The year of the attendance records.
 * @param {Number} month - The month of the attendance records.
 * @returns {Object} - Total present, absent, and home pass counts.
 */
const fetchAdminAttendanceStats = async (year, month) => {
  const stats = await MonthlyAttendance.aggregate([
    { $match: { year, month } },
    {
      $group: {
        _id: null,
        totalPresent: { $sum: '$summary.present' },
        totalAbsent: { $sum: '$summary.absent' },
        totalHomePass: { $sum: '$summary.home_pass' }
      }
    }
  ]);

  return stats.length > 0 ? stats[0] : { totalPresent: 0, totalAbsent: 0, totalHomePass: 0 };
};

module.exports = { autoCreateMonthlyAttendance, updateAttendanceForDay, fetchStudentMonthlyAttendance, fetchAdminAttendanceStats };