const express = require('express');
const router = express.Router();
const { authenticateStudent, authenticateAdmin } = require('../middleware/authMiddleware');
const {
  getMonthlyAttendance,
  updateDailyAttendance,
  getMonthlyStats
} = require('../controllers/monthlyAttendanceController');

// Student can view their own attendance
router.get(
  '/student/:studentId/:year/:month',
  authenticateStudent,
  getMonthlyAttendance
);

// Admin/Staff can view any student's attendance
router.get(
  '/admin/student/:studentId/:year/:month',
  authenticateAdmin,
  getMonthlyAttendance
);

// Update attendance (admin/staff only)
router.put(
  '/:studentId/:year/:month/:day',
  authenticateAdmin,
  updateDailyAttendance
);

// Get monthly stats (admin only)
router.get(
  '/stats/:year/:month',
  authenticateAdmin,
  getMonthlyStats
);

module.exports = router;
