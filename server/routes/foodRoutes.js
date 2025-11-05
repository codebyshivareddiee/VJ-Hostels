const express = require('express');
const router = express.Router();

const { pauseFood, resumeFood, getFoodCount } = require('../controllers/foodController');
const { calculateAndUpdateFoodCount } = require('../controllers/foodCountController');
const { googleOAuth, getStudentsByHostel } = require('../controllers/studentFoodController');
const { wardenLogin, wardenLoginUsingBcrypt } = require('../controllers/wardenFoodController');
const { getMonthlyMenu, updateDayMenu, getCurrentWeek, updateWeekMenu } = require('../controllers/weeklyMenuController');
const { getDashboardData, getExportData } = require('../controllers/foodAnalyticsControllerFixed');
const { submitFeedback, getAllFeedback, getFeedbackStats, getStudentFeedback } = require('../controllers/foodFeedbackController');

// Food pause/resume routes
router.post('/pause', pauseFood);
router.post('/resume', resumeFood);
router.get('/food-count', getFoodCount);

// Food count calculation routes
router.post('/food-count/calculate', calculateAndUpdateFoodCount);

// Student authentication and management routes
router.post('/student/oauth', googleOAuth);
router.get('/students/:hostelId', getStudentsByHostel);

// Warden authentication routes
router.post('/warden/login', wardenLogin);
router.post('/warden/login-bcrypt', wardenLoginUsingBcrypt);

// Weekly menu management routes
router.get('/menu/monthly', getMonthlyMenu);
router.put('/menu/day', updateDayMenu);
router.get('/menu/current-week', getCurrentWeek);
router.put('/menu/week', updateWeekMenu);

// Analytics routes
router.get('/analytics/dashboard-data', getDashboardData);
router.get('/analytics/export-data', getExportData);

// Feedback routes
router.post('/feedback', submitFeedback);
router.get('/feedback', getAllFeedback);
router.get('/feedback/stats', getFeedbackStats);
router.get('/feedback/student/:studentId', getStudentFeedback);

module.exports = router;
