const express = require('express');
const foodApp = express.Router();
const expressAsyncHandler = require('express-async-handler');
const axios = require('axios');
const { FoodMenu, FoodFeedback } = require('../models/FoodModel');
const FoodPause = require('../models/FoodPause');
const StudentModel = require('../models/StudentModel');
const { verifyAdmin } = require('../middleware/verifyToken');
const { getMonthlyMenu, updateDayMenu, getCurrentWeek, updateWeekMenu } = require('../controllers/weeklyMenuController');
const { getDashboardData, getExportData } = require('../controllers/foodAnalyticsControllerFixed');

// Helper function to format date as YYYY-MM-DD in local timezone (not UTC)
const formatLocalDate = (date) => {
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const day = String(date.getDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
};

// Meal times configuration (in 24-hour format)
const MEAL_TIMES = {
    breakfast: { start: 7, end: 9 },      // 7:00 AM - 9:00 AM
    lunch: { start: 12, end: 14 },         // 12:00 PM - 2:00 PM
    snacks: { start: 16, end: 17 },        // 4:00 PM - 5:00 PM
    dinner: { start: 19, end: 21 }         // 7:00 PM - 9:00 PM
};

// Helper function to get date range based on filter
// All date ranges are capped at TODAY - no future dates included
const getDateRange = (filter, customStart = null, customEnd = null) => {
    const now = new Date();
    const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    today.setHours(0, 0, 0, 0);
    let startDate, endDate;

    switch (filter) {
        case 'today':
            startDate = new Date(today);
            endDate = new Date(today);
            break;
        case 'yesterday':
            endDate = new Date(today.getTime() - 24 * 60 * 60 * 1000);
            startDate = new Date(endDate);
            break;
        case 'thisWeek':
            const dayOfWeek = now.getDay();
            startDate = new Date(now.getTime() - dayOfWeek * 24 * 60 * 60 * 1000);
            startDate.setHours(0, 0, 0, 0);
            endDate = new Date(today); // Cap at today, not end of week
            break;
        case 'lastWeek':
            const lastWeekEnd = new Date(now.getTime() - now.getDay() * 24 * 60 * 60 * 1000);
            lastWeekEnd.setHours(0, 0, 0, 0);
            endDate = new Date(lastWeekEnd.getTime() - 24 * 60 * 60 * 1000); // Yesterday
            startDate = new Date(endDate.getTime() - 6 * 24 * 60 * 60 * 1000); // 7 days back
            break;
        case 'thisMonth':
            startDate = new Date(now.getFullYear(), now.getMonth(), 1);
            startDate.setHours(0, 0, 0, 0);
            endDate = new Date(today); // Cap at today, not end of month
            break;
        case 'lastMonth':
            startDate = new Date(now.getFullYear(), now.getMonth() - 1, 1);
            startDate.setHours(0, 0, 0, 0);
            endDate = new Date(now.getFullYear(), now.getMonth(), 0); // Last day of last month
            endDate.setHours(0, 0, 0, 0);
            break;
        case 'thisYear':
            startDate = new Date(now.getFullYear(), 0, 1);
            startDate.setHours(0, 0, 0, 0);
            endDate = new Date(today); // Cap at today, not end of year
            break;
        case 'lastYear':
            startDate = new Date(now.getFullYear() - 1, 0, 1);
            startDate.setHours(0, 0, 0, 0);
            endDate = new Date(now.getFullYear() - 1, 11, 31); // Last day of last year
            endDate.setHours(0, 0, 0, 0);
            break;
        case 'custom':
            startDate = new Date(customStart);
            startDate.setHours(0, 0, 0, 0);
            endDate = new Date(customEnd);
            endDate.setHours(0, 0, 0, 0);
            // Cap custom end date at today
            if (endDate > today) {
                endDate = new Date(today);
            }
            break;
        default:
            startDate = new Date(now.getFullYear(), now.getMonth(), 1);
            startDate.setHours(0, 0, 0, 0);
            endDate = new Date(today); // Cap at today
    }

    return { startDate, endDate };
};

// Admin API endpoints

// Get all food menus
foodApp.get('/admin/menus', verifyAdmin, expressAsyncHandler(async (req, res) => {
    try {
        const menus = await FoodMenu.find().sort({ date: -1 });
        res.status(200).json(menus);
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
}));

// Get today's food menu
foodApp.get('/admin/menu/today', verifyAdmin, expressAsyncHandler(async (req, res) => {
    try {
        const today = new Date();
        today.setHours(0, 0, 0, 0);
        
        let menu = await FoodMenu.findOne({
            date: {
                $gte: today,
                $lt: new Date(today.getTime() + 24 * 60 * 60 * 1000)
            }
        });
        
        if (!menu) {
            res.status(404).json({ message: "No menu found for today" });
            return;
        }
        
        res.status(200).json(menu);
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
}));

// Create or update food menu
foodApp.post('/admin/menu', verifyAdmin, expressAsyncHandler(async (req, res) => {
    try {
        const { date, breakfast, lunch, dinner, snacks } = req.body;
        
        // Convert date string to Date object and set to midnight
        const menuDate = new Date(date);
        menuDate.setHours(0, 0, 0, 0);
        
        // Check if menu already exists for this date
        let menu = await FoodMenu.findOne({
            date: {
                $gte: menuDate,
                $lt: new Date(menuDate.getTime() + 24 * 60 * 60 * 1000)
            }
        });
        
        if (menu) {
            // Update existing menu
            menu.breakfast = breakfast;
            menu.lunch = lunch;
            menu.dinner = dinner;
            menu.snacks = snacks;
            await menu.save();
            res.status(200).json({ message: "Menu updated successfully", menu });
        } else {
            // Create new menu
            const newMenu = new FoodMenu({
                date: menuDate,
                breakfast,
                lunch,
                dinner,
                snacks
            });
            await newMenu.save();
            res.status(201).json({ message: "Menu created successfully", menu: newMenu });
        }
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
}));

// Get all feedback with filtering
foodApp.get('/admin/feedback', verifyAdmin, expressAsyncHandler(async (req, res) => {
    try {
        const {
            dateFilter = 'thisMonth', // Changed default to show more data
            customStartDate,
            customEndDate,
            mealType = 'all',
            showOnlyWithComments = 'false' // Show all by default
        } = req.query;

        console.log('===== FEEDBACK REQUEST =====');
        console.log('Query params:', req.query);
        console.log('Date Filter:', dateFilter);
        console.log('Meal Type:', mealType);
        console.log('Show Only With Comments:', showOnlyWithComments);

        // Build date filter using dateStr field (YYYY-MM-DD string)
        let startDateStr, endDateStr;
        
        const today = new Date();
        const todayStr = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, '0')}-${String(today.getDate()).padStart(2, '0')}`;

        switch (dateFilter) {
            case 'today':
                startDateStr = todayStr;
                endDateStr = todayStr;
                break;
            case 'yesterday':
                const yesterday = new Date(today);
                yesterday.setDate(today.getDate() - 1);
                const yesterdayStr = `${yesterday.getFullYear()}-${String(yesterday.getMonth() + 1).padStart(2, '0')}-${String(yesterday.getDate()).padStart(2, '0')}`;
                startDateStr = yesterdayStr;
                endDateStr = yesterdayStr;
                break;
            case 'thisWeek':
                const dayOfWeek = today.getDay();
                const weekStart = new Date(today);
                weekStart.setDate(today.getDate() - dayOfWeek);
                startDateStr = `${weekStart.getFullYear()}-${String(weekStart.getMonth() + 1).padStart(2, '0')}-${String(weekStart.getDate()).padStart(2, '0')}`;
                endDateStr = todayStr;
                break;
            case 'lastWeek':
                const weekStartLast = new Date(today);
                weekStartLast.setDate(today.getDate() - today.getDay() - 7);
                const weekEndLast = new Date(weekStartLast);
                weekEndLast.setDate(weekStartLast.getDate() + 6);
                startDateStr = `${weekStartLast.getFullYear()}-${String(weekStartLast.getMonth() + 1).padStart(2, '0')}-${String(weekStartLast.getDate()).padStart(2, '0')}`;
                endDateStr = `${weekEndLast.getFullYear()}-${String(weekEndLast.getMonth() + 1).padStart(2, '0')}-${String(weekEndLast.getDate()).padStart(2, '0')}`;
                break;
            case 'thisMonth':
                startDateStr = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, '0')}-01`;
                endDateStr = todayStr;
                break;
            case 'lastMonth':
                const lastMonth = today.getMonth() === 0 ? 11 : today.getMonth() - 1;
                const lastMonthYear = today.getMonth() === 0 ? today.getFullYear() - 1 : today.getFullYear();
                const lastMonthDays = new Date(lastMonthYear, lastMonth + 1, 0).getDate();
                startDateStr = `${lastMonthYear}-${String(lastMonth + 1).padStart(2, '0')}-01`;
                endDateStr = `${lastMonthYear}-${String(lastMonth + 1).padStart(2, '0')}-${String(lastMonthDays).padStart(2, '0')}`;
                break;
            case 'thisYear':
                startDateStr = `${today.getFullYear()}-01-01`;
                endDateStr = todayStr;
                break;
            case 'all':
                // No date filter - return all feedback
                startDateStr = null;
                endDateStr = null;
                break;
            case 'custom':
                if (customStartDate && customEndDate) {
                    startDateStr = customStartDate;
                    endDateStr = customEndDate > todayStr ? todayStr : customEndDate;
                } else {
                    startDateStr = todayStr;
                    endDateStr = todayStr;
                }
                break;
            default:
                // Default to this month
                startDateStr = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, '0')}-01`;
                endDateStr = todayStr;
        }

        // Build query filter using $and to properly combine conditions
        let filter = { $and: [] };
        
        // Date filter - only add if not 'all'
        if (startDateStr && endDateStr) {
            const startDate = new Date(startDateStr);
            startDate.setHours(0, 0, 0, 0);
            
            const endDate = new Date(endDateStr);
            endDate.setHours(23, 59, 59, 999);
            
            // Use $or to handle both dateStr and date fields for compatibility
            filter.$and.push({
                $or: [
                    {
                        dateStr: {
                            $gte: startDateStr,
                            $lte: endDateStr
                        }
                    },
                    {
                        date: {
                            $gte: startDate,
                            $lte: endDate
                        }
                    }
                ]
            });
        }

        // Add meal type filter if specified
        if (mealType && mealType !== 'all') {
            filter.$and.push({ mealType: mealType });
        }

        // Only show feedback with comments if requested
        if (showOnlyWithComments === 'true') {
            filter.$and.push({ 
                feedback: { 
                    $exists: true, 
                    $ne: '',
                    $regex: /.+/  // Must have at least one character
                } 
            });
            console.log('Filtering: Only showing feedback WITH comments');
        } else {
            console.log('Filtering: Showing ALL feedback (with and without comments)');
        }

        // If no filters were added, remove the $and wrapper
        if (filter.$and.length === 0) {
            filter = {};
        } else if (filter.$and.length === 1) {
            // If only one condition, unwrap it
            filter = filter.$and[0];
        }

        console.log('Feedback Filter:', JSON.stringify(filter, null, 2));
        console.log('Date Range:', startDateStr, 'to', endDateStr);
        console.log('Meal Type:', mealType);

        // First, let's check total count in database
        const totalCount = await FoodFeedback.countDocuments({});
        console.log('Total feedback in database:', totalCount);

        // Fetch feedback and populate student name
        const feedback = await FoodFeedback.find(filter)
            .populate('student_id', 'name rollNumber') // Populate student name and rollNumber
            .select('-__v') // Exclude only version field
            .sort({ date: -1, createdAt: -1 }); // Sort by date (newest first), then creation time
        
        // Transform the response to include student name at top level
        const feedbackWithStudentName = feedback.map(item => ({
            ...item.toObject(),
            studentName: item.student_id?.name || 'Unknown',
            studentRollNumber: item.student_id?.rollNumber || 'N/A'
        }));
        
        console.log('Feedback found with filter:', feedbackWithStudentName.length);
        if (feedbackWithStudentName.length > 0) {
            console.log('Sample feedback (first 3):');
            feedbackWithStudentName.slice(0, 3).forEach((f, i) => {
                console.log(`  ${i + 1}. Student: ${f.studentName}, Date: ${f.dateStr || 'no dateStr'}, Meal: ${f.mealType}, Rating: ${f.rating}`);
            });
        } else {
            console.log('No feedback matched the filter!');
        }
        console.log('=============================\n');
        
        res.status(200).json(feedbackWithStudentName);
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
}));

// Get feedback statistics
foodApp.get('/admin/feedback/stats', verifyAdmin, expressAsyncHandler(async (req, res) => {
    try {
        // Get average ratings by meal type
        const avgRatingsByMeal = await FoodFeedback.aggregate([
            {
                $group: {
                    _id: "$mealType",
                    averageRating: { $avg: "$rating" },
                    count: { $sum: 1 }
                }
            }
        ]);
        
        // Get rating distribution
        const ratingDistribution = await FoodFeedback.aggregate([
            {
                $group: {
                    _id: "$rating",
                    count: { $sum: 1 }
                }
            },
            { $sort: { _id: 1 } }
        ]);
        
        // Get recent feedback trends (last 7 days) using normalized dateStr
        const recentDatesSet = [];
        for (let i = 6; i >= 0; i--) {
            const d = new Date();
            d.setDate(d.getDate() - i);
            recentDatesSet.push(d.toISOString().split('T')[0]);
        }

        const recentTrends = await FoodFeedback.aggregate([
            {
                $match: {
                    dateStr: { $in: recentDatesSet }
                }
            },
            {
                $group: {
                    _id: {
                        date: "$dateStr",
                        mealType: "$mealType"
                    },
                    averageRating: { $avg: "$rating" }
                }
            },
            {
                $sort: { "_id.date": 1 }
            }
        ]);
        
        res.status(200).json({
            avgRatingsByMeal,
            ratingDistribution,
            recentTrends
        });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
}));

// Get student food pause/resume status
foodApp.get('/student-status', expressAsyncHandler(async (req, res) => {
    try {
        const { studentId } = req.query;

        if (!studentId) {
            return res.status(400).json({ message: 'studentId is required' });
        }
        
        const student = await StudentModel.findOne({ rollNumber: studentId });
        if (!student) {
            return res.status(404).json({ message: 'Student not found' });
        }

        // Get food pause record for this student
        const foodPause = await FoodPause.findOne({ student_id: student._id });
        
        if (!foodPause) {
            return res.status(200).json({
                pause_from: null,
                resume_from: null,
                pause_meals: null,
                resume_meals: null
            });
        }

        res.status(200).json({
            pause_from: foodPause.pause_from,
            resume_from: foodPause.resume_from,
            pause_meals: foodPause.pause_meals,
            resume_meals: foodPause.resume_meals
        });
    } catch (error) {
        console.error('Error fetching student status:', error);
        res.status(500).json({ 
            message: 'Failed to fetch student status',
            error: error.message 
        });
    }
}));

// Get weekly food menu for students
foodApp.get('/student/menu/week', expressAsyncHandler(async (req, res) => {
    try {
        // Get start and end of current week (Monday to Sunday)
        const now = new Date();
        const dayOfWeek = now.getDay(); // 0 (Sun) - 6 (Sat)
        // Calculate Monday
        const monday = new Date(now);
        monday.setDate(now.getDate() - ((dayOfWeek + 6) % 7));
        // Get YYYY-MM-DD for Monday and Sunday
        const mondayStr = monday.toISOString().split('T')[0];
        const sunday = new Date(monday);
        sunday.setDate(monday.getDate() + 6);
        const sundayStr = sunday.toISOString().split('T')[0];
        // Find all menus where date is between monday and sunday (date part only)
        const menus = await FoodMenu.aggregate([
            {
                $addFields: {
                    dateStr: { $dateToString: { format: "%Y-%m-%d", date: "$date", timezone: "UTC" } }
                }
            },
            {
                $match: {
                    dateStr: { $gte: mondayStr, $lte: sundayStr }
                }
            },
            { $sort: { date: 1 } }
        ]);
        res.status(200).json(menus);
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
}));

// Get today's food menu for students
foodApp.get('/student/menu/today', expressAsyncHandler(async (req, res) => {
    try {
        const today = new Date();
        // Get YYYY-MM-DD string for today in UTC
        const todayStr = today.toISOString().split('T')[0];
        // Find menu where date matches today (date part only)
        let menu = await FoodMenu.findOne({
            $expr: {
                $eq: [
                    { $dateToString: { format: "%Y-%m-%d", date: "$date", timezone: "UTC" } },
                    todayStr
                ]
            }
        });
        if (!menu) {
            res.status(404).json({ message: "No menu found for today" });
            return;
        }
        res.status(200).json(menu);
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
}));

// Submit food feedback
// Expects: { studentId: <rollNumber or ObjectId>, mealType, rating, feedback }
foodApp.post('/student/feedback', expressAsyncHandler(async (req, res) => {
    try {
        const { studentId, mealType, rating, feedback } = req.body;

        if (!studentId || !mealType || !rating) {
            return res.status(400).json({ message: 'studentId, mealType and rating are required' });
        }

        // Backend validation: Check for offensive content in feedback text
        if (feedback && feedback.trim().length > 0) {
            try {
                const axios = require('axios');
                const PYTHON_API_URL = process.env.PYTHON_API_URL || 'http://localhost:8001';
                
                const offensiveCheckResponse = await axios.post(`${PYTHON_API_URL}/check_offensive`, {
                    text: feedback
                });
                
                const { offensive, confidence } = offensiveCheckResponse.data;
                
                if (offensive === true) {
                    return res.status(400).json({ 
                        message: 'Feedback contains inappropriate or offensive language. Please revise your message.',
                        offensive: true,
                        confidence: confidence
                    });
                }
            } catch (offensiveCheckError) {
                console.error('⚠️ [Backend] Error checking offensive content:', offensiveCheckError.message);
                // If the offensive check API fails, log the error but don't block the feedback
                // This ensures the service remains available even if the Python API is down
                console.log('⚠️ [Backend] Continuing with feedback submission despite check failure');
            }
        }

        // Resolve student: allow rollNumber or _id
        let student = null;
        if (/^[0-9a-fA-F]{24}$/.test(String(studentId))) {
            student = await StudentModel.findById(studentId);
        }
        if (!student) {
            student = await StudentModel.findOne({ rollNumber: studentId });
        }
        if (!student) return res.status(404).json({ message: 'Student not found' });

        // Today's normalized date string
        const today = new Date();
        const dateStr = formatLocalDate(today);

        // Upsert feedback for (student_id, mealType, dateStr)
        const update = {
            student_id: student._id,
            mealType,
            rating,
            feedback: feedback || '',
            date: today,
            dateStr
        };

        const opts = { new: true, upsert: true, setDefaultsOnInsert: true };

        const saved = await FoodFeedback.findOneAndUpdate(
            { student_id: student._id, mealType: mealType, dateStr: dateStr },
            update,
            opts
        );

        res.status(201).json({ message: 'Feedback submitted successfully', feedback: saved });
    } catch (error) {
        // Handle unique index conflicts (should not happen due to upsert) and other errors
        console.error('Error saving feedback:', error);
        res.status(500).json({ error: error.message });
    }
}));

// Get today's feedback status for current student
foodApp.get('/student/feedback/today-status', expressAsyncHandler(async (req, res) => {
    try {
        const { studentId } = req.query;

        if (!studentId) {
            return res.status(400).json({ message: 'studentId is required' });
        }

        // Resolve student: allow rollNumber or _id
        let student = null;
        if (/^[0-9a-fA-F]{24}$/.test(String(studentId))) {
            student = await StudentModel.findById(studentId);
        }
        if (!student) {
            student = await StudentModel.findOne({ rollNumber: studentId });
        }
        if (!student) return res.status(404).json({ message: 'Student not found' });

        // Today's normalized date string
        const today = new Date();
        const dateStr = formatLocalDate(today);

        // Find feedback for all 4 meals for today
        const mealTypes = ['breakfast', 'lunch', 'snacks', 'dinner'];
        const feedbackStatus = {};

        for (const mealType of mealTypes) {
            const feedback = await FoodFeedback.findOne({
                student_id: student._id,
                mealType: mealType,
                dateStr: dateStr
            });
            feedbackStatus[mealType] = {
                submitted: !!feedback,
                rating: feedback ? feedback.rating : null,
                feedback: feedback ? feedback.feedback : null
            };
        }

        res.status(200).json(feedbackStatus);
    } catch (error) {
        console.error('Error fetching feedback status:', error);
        res.status(500).json({ error: error.message });
    }
}));

// Note: Student feedback history endpoint removed since feedback is now anonymous

// Get weekly menu for students with date-based structure (next 7 days from today)
foodApp.get('/student/menu/weekly-schedule', expressAsyncHandler(async (req, res) => {
    try {
        // Get next 7 days starting from today
        const today = new Date();
        const todayStr = formatLocalDate(today);
        
        // Calculate 7 days from today
        const endDate = new Date(today);
        endDate.setDate(today.getDate() + 6); // 6 days ahead (today + 6 = 7 days total)
        const endDateStr = formatLocalDate(endDate);
        
        console.log(`[WEEKLY SCHEDULE] Fetching menus from ${todayStr} to ${endDateStr}`);
        
        // Find all menus where date is between today and next 6 days
        const menus = await FoodMenu.aggregate([
            {
                $addFields: {
                    dateStr: { $dateToString: { format: "%Y-%m-%d", date: "$date", timezone: "UTC" } }
                }
            },
            {
                $match: {
                    dateStr: { $gte: todayStr, $lte: endDateStr }
                }
            },
            { $sort: { date: 1 } }
        ]);
        
        console.log(`[WEEKLY SCHEDULE] Found ${menus.length} menus for the next 7 days:`, menus.map(m => ({ date: m.dateStr, hasBreakfast: !!m.breakfast, hasLunch: !!m.lunch, hasDinner: !!m.dinner, hasSnacks: !!m.snacks })));
        
        // Create a complete schedule array with all 7 days (fill missing days with sample menus)
        const schedule = [];
        const sampleMenus = {
            breakfast: 'Bread, Butter, Jam',
            lunch: 'Rice, Dal Fry, Salad',
            snacks: 'Fruit Salad, Tea',
            dinner: 'Chapati, Veg Korma, Curd'
        };
        
        for (let i = 0; i < 7; i++) {
            const date = new Date(today);
            date.setDate(today.getDate() + i);
            const dateStr = date.toISOString().split('T')[0];
            
            // Find menu for this date
            const menu = menus.find(m => m.dateStr === dateStr);
            
            if (menu) {
                schedule.push({
                    date: dateStr,
                    dateStr: dateStr,
                    weekday: date.toLocaleDateString('en-US', { weekday: 'long' }),
                    breakfast: menu.breakfast || sampleMenus.breakfast,
                    lunch: menu.lunch || sampleMenus.lunch,
                    snacks: menu.snacks || sampleMenus.snacks,
                    dinner: menu.dinner || sampleMenus.dinner
                });
            } else {
                // Add sample menu for missing dates
                schedule.push({
                    date: dateStr,
                    dateStr: dateStr,
                    weekday: date.toLocaleDateString('en-US', { weekday: 'long' }),
                    breakfast: sampleMenus.breakfast,
                    lunch: sampleMenus.lunch,
                    snacks: sampleMenus.snacks,
                    dinner: sampleMenus.dinner
                });
            }
        }
        
        console.log(`[WEEKLY SCHEDULE] Returning schedule with ${schedule.length} days`);
        res.status(200).json(schedule);
    } catch (error) {
        console.error('Error fetching weekly schedule:', error);
        res.status(500).json({ error: error.message });
    }
}));

// Get weekly schedule from WeeklyFoodMenu model (the working version)
foodApp.get('/student/menu/weekly-schedule-structured', expressAsyncHandler(async (req, res) => {
    try {
        const { WeeklyFoodMenu } = require('../models/FoodModel');
        
        const today = new Date();
        const dayOfMonth = today.getDate();

        // Calculate rotation-based current week (use same logic as controllers)
        const ROTATION_EPOCH_UTC = new Date(Date.UTC(2025, 0, 6));
        function getRotationWeekIndex(date = new Date()) {
            const d = new Date(Date.UTC(date.getFullYear(), date.getMonth(), date.getDate()));
            const msPerWeek = 7 * 24 * 60 * 60 * 1000;
            const weeksSinceEpoch = Math.floor((d - ROTATION_EPOCH_UTC) / msPerWeek);
            const idx = ((weeksSinceEpoch % 4) + 4) % 4;
            return idx + 1;
        }

        const currentWeek = getRotationWeekIndex(today);

        console.log(`[WEEKLY SCHEDULE STRUCTURED] Fetching rotation-based week: ${currentWeek}`);

        // Get the current week's menu template
        const weekMenu = await WeeklyFoodMenu.findOne({
            week: currentWeek
        });
        
        console.log(`[WEEKLY SCHEDULE STRUCTURED] Found week menu:`, weekMenu ? 'Yes' : 'No');
        
        // Generate next 7 days starting from today
        const schedule = [];
        const dayNames = ['sunday', 'monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday'];
        
        for (let i = 0; i < 7; i++) {
            const date = new Date(today);
            date.setDate(today.getDate() + i);
            
            // Format date as YYYY-MM-DD in local timezone (not UTC)
            const year = date.getFullYear();
            const month = String(date.getMonth() + 1).padStart(2, '0');
            const day = String(date.getDate()).padStart(2, '0');
            const dateStr = `${year}-${month}-${day}`;
            
            const dayOfWeek = date.getDay();
            const dayName = dayNames[dayOfWeek];
            
            let dayMenuData = {
                breakfast: 'Bread, Butter, Jam',
                lunch: 'Rice, Dal Fry, Salad', 
                snacks: 'Fruit Salad, Tea',
                dinner: 'Chapati, Veg Korma, Curd'
            };
            
            // If we have week menu data, use it
            if (weekMenu && weekMenu.days && weekMenu.days[dayName]) {
                const menuDay = weekMenu.days[dayName];
                dayMenuData = {
                    breakfast: menuDay.breakfast || dayMenuData.breakfast,
                    lunch: menuDay.lunch || dayMenuData.lunch,
                    snacks: menuDay.snacks || dayMenuData.snacks,
                    dinner: menuDay.dinner || dayMenuData.dinner
                };
            }
            
            schedule.push({
                date: dateStr,
                dateStr: dateStr,
                weekday: date.toLocaleDateString('en-US', { weekday: 'long' }),
                ...dayMenuData
            });
        }
        res.status(200).json(schedule);
        
    } catch (error) {
        console.error('Error fetching structured weekly schedule:', error);
        res.status(500).json({ error: error.message });
    }
}));

// Return raw weekly rotation templates (useful for admin UI / seeding verification)
foodApp.get('/menu/templates', expressAsyncHandler(async (req, res) => {
    try {
        const { WeeklyFoodMenu } = require('../models/FoodModel');
        const templates = await WeeklyFoodMenu.find({}).sort({ week: 1 });
        res.status(200).json({ success: true, data: templates });
    } catch (error) {
        console.error('Error fetching weekly templates:', error);
        res.status(500).json({ success: false, message: error.message });
    }
}));

// Get today's menu from weekly schedule
foodApp.get('/student/menu/today-from-schedule', expressAsyncHandler(async (req, res) => {
    try {
        const { WeeklyFoodMenu } = require('../models/FoodModel');
        
        const today = new Date();
        const dayOfWeek = today.getDay();

        // Calculate rotation-based week
        const ROTATION_EPOCH_UTC = new Date(Date.UTC(2025, 0, 6));
        function getRotationWeekIndex(date = new Date()) {
            const d = new Date(Date.UTC(date.getFullYear(), date.getMonth(), date.getDate()));
            const msPerWeek = 7 * 24 * 60 * 60 * 1000;
            const weeksSinceEpoch = Math.floor((d - ROTATION_EPOCH_UTC) / msPerWeek);
            const idx = ((weeksSinceEpoch % 4) + 4) % 4;
            return idx + 1;
        }

        const adjustedWeek = getRotationWeekIndex(today);
        
        const dayNames = ['sunday', 'monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday'];
        const dayName = dayNames[dayOfWeek];
        
        // Find the appropriate week menu template
        const weekMenu = await WeeklyFoodMenu.findOne({
            week: adjustedWeek
        });
        
        if (!weekMenu || !weekMenu.days[dayName]) {
            return res.status(404).json({ message: "No menu found for today" });
        }
        
        // Format date as YYYY-MM-DD in local timezone (not UTC)
        const year = today.getFullYear();
        const month = String(today.getMonth() + 1).padStart(2, '0');
        const date = String(today.getDate()).padStart(2, '0');
        
        const todayMenu = {
            date: `${year}-${month}-${date}`,
            weekday: today.toLocaleDateString('en-US', { weekday: 'long' }),
            ...weekMenu.days[dayName]
        };
        
        res.status(200).json(todayMenu);
    } catch (error) {
        console.error('Error fetching today\'s menu:', error);
        res.status(500).json({ error: error.message });
    }
}));

// Get daily food statistics for admin
foodApp.get('/admin/food/stats/today', verifyAdmin, expressAsyncHandler(async (req, res) => {
    try {
        // Import models at the top of the try block to catch any import errors
        let FoodPauseEnhanced;
        let Outpass;
        
        try {
            FoodPauseEnhanced = require('../models/FoodPauseEnhanced');
            Outpass = require('../models/OutpassModel');
        } catch (modelError) {
            console.error('Error loading models:', modelError);
            // Fallback to basic stats if enhanced models not available
            const totalStudents = await StudentModel.countDocuments({ is_active: true });
            return res.status(200).json({
                date: formatLocalDate(new Date()),
                summary: {
                    totalStudents,
                    availableStudents: totalStudents,
                    totalStudentsWithPause: 0,
                    studentsTakingMeals: totalStudents,
                    totalMealsAvailable: totalStudents * 4,
                    totalMealsPaused: 0,
                    totalMealsServed: totalStudents * 4,
                    pausePercentage: 0
                },
                mealWiseStats: {
                    breakfast: { paused: 0, available: totalStudents, served: totalStudents, students: [] },
                    lunch: { paused: 0, available: totalStudents, served: totalStudents, students: [] },
                    snacks: { paused: 0, available: totalStudents, served: totalStudents, students: [] },
                    dinner: { paused: 0, available: totalStudents, served: totalStudents, students: [] }
                },
                statusDistribution: {},
                allPauses: []
            });
        }
        
        const today = new Date();
        today.setHours(0, 0, 0, 0);

        // Convert today's date to YYYY-MM-DD format
        const todayStr = formatLocalDate(today);
        
        // Total number of active students
        const totalStudents = await StudentModel.countDocuments({ is_active: true });

        // Get students NOT on outpass today (with status 'out' or 'returned')
        const todayEnd = new Date(today);
        todayEnd.setHours(23, 59, 59, 999);

        let studentsOnOutpass = [];
        try {
            studentsOnOutpass = await Outpass.find({
                status: { $in: ['out', 'returned'] },
                outTime: { $lt: todayEnd },
                inTime: { $gt: today }
            }).distinct('student_id');
        } catch (outpassError) {
            console.warn('Outpass query failed, continuing without outpass data:', outpassError.message);
        }

        // Available students (not on outpass)
        const availableStudents = totalStudents - studentsOnOutpass.length;

        // Calculate total available meals (based on meal times - only count meals before their end time)
        let totalMealsAvailable = 0;
        const mealWiseAvailable = {
            breakfast: 0,
            lunch: 0,
            snacks: 0,
            dinner: 0
        };

        const now = new Date();
        const currentHour = now.getHours();

        // For each meal, check if it's still available (before end time)
        ['breakfast', 'lunch', 'snacks', 'dinner'].forEach(meal => {
            const mealEndHour = MEAL_TIMES[meal].end;
            if (currentHour < mealEndHour) {
                // Meal is still available
                mealWiseAvailable[meal] = availableStudents;
                totalMealsAvailable += availableStudents;
            } else {
                // Meal has passed, set to 0
                mealWiseAvailable[meal] = 0;
            }
        });

        // Find all active pauses for today
        let pausesForToday = [];
        try {
            pausesForToday = await FoodPauseEnhanced.find({
                is_active: true,
                pause_start_date: { $lte: todayStr },
                pause_end_date: { $gte: todayStr }
            }).populate('student_id', 'rollNumber name hostel');
        } catch (pauseError) {
            console.warn('Pause query failed, continuing without pause data:', pauseError.message);
        }

        // Group pauses by meal type
        const mealPauseStats = {
            breakfast: {
                available: mealWiseAvailable.breakfast,
                paused: 0,
                served: 0,
                students: []
            },
            lunch: {
                available: mealWiseAvailable.lunch,
                paused: 0,
                served: 0,
                students: []
            },
            snacks: {
                available: mealWiseAvailable.snacks,
                paused: 0,
                served: 0,
                students: []
            },
            dinner: {
                available: mealWiseAvailable.dinner,
                paused: 0,
                served: 0,
                students: []
            }
        };

        // Track students with any pause (to avoid double counting)
        const studentsWithPause = new Set();
        let totalPausedMeals = 0;

        // Process pauses and organize by meal type
        for (const pause of pausesForToday) {
            // Check if student_id is populated
            if (!pause.student_id) {
                console.warn('Pause record without student_id:', pause._id);
                continue;
            }

            const mealType = pause.meal_type;
            if (mealPauseStats[mealType]) {
                mealPauseStats[mealType].paused++;
                mealPauseStats[mealType].students.push({
                    student_id: pause.student_id._id,
                    rollNumber: pause.student_id.rollNumber,
                    name: pause.student_id.name,
                    hostel: pause.student_id.hostel || 'N/A',
                    pause_id: pause._id,
                    pause_type: pause.pause_type
                });
                totalPausedMeals++;
                studentsWithPause.add(pause.student_id._id.toString());
            }
        }

        // Calculate served meals for each meal type
        ['breakfast', 'lunch', 'snacks', 'dinner'].forEach(meal => {
            mealPauseStats[meal].served = Math.max(0, mealPauseStats[meal].available - mealPauseStats[meal].paused);
        });

        // Calculate total students with any pause
        const totalStudentsWithPause = studentsWithPause.size;
        const totalMealsServed = Math.max(0, totalMealsAvailable - totalPausedMeals);

        // Get status distribution
        let statusMap = {};
        try {
            const statusCounts = await FoodPauseEnhanced.aggregate([
                {
                    $match: {
                        pause_start_date: { $lte: todayStr },
                        pause_end_date: { $gte: todayStr }
                    }
                },
                {
                    $group: {
                        _id: '$approval_status',
                        count: { $sum: 1 }
                    }
                }
            ]);

            for (const status of statusCounts) {
                statusMap[status._id] = status.count;
            }
        } catch (aggregateError) {
            console.warn('Status aggregation failed:', aggregateError.message);
        }

        res.status(200).json({
            date: todayStr,
            summary: {
                totalStudents,
                availableStudents,
                totalStudentsWithPause,
                studentsTakingMeals: Math.max(0, availableStudents - totalStudentsWithPause),
                totalMealsAvailable,
                totalMealsPaused: totalPausedMeals,
                totalMealsServed,
                pausePercentage: totalMealsAvailable > 0 ? ((totalPausedMeals / totalMealsAvailable) * 100).toFixed(2) : 0
            },
            mealWiseStats: mealPauseStats,
            statusDistribution: statusMap,
            allPauses: pausesForToday.map(p => ({
                _id: p._id,
                student: p.student_id ? {
                    id: p.student_id._id,
                    rollNumber: p.student_id.rollNumber,
                    name: p.student_id.name,
                    hostel: p.student_id.hostel || 'N/A'
                } : null,
                meal_type: p.meal_type,
                pause_type: p.pause_type,
                pause_start_date: p.pause_start_date,
                pause_end_date: p.pause_end_date,
                approval_status: p.approval_status,
                is_active: p.is_active,
                notes: p.notes
            })).filter(p => p.student !== null)
        });
    } catch (error) {
        console.error('Error fetching food stats:', error);
        res.status(500).json({ 
            error: 'Failed to fetch food statistics',
            details: error.message,
            stack: process.env.NODE_ENV === 'development' ? error.stack : undefined
        });
    }
}));

// Get daily food statistics for admin (flexible date)
foodApp.get('/admin/food/stats/date', verifyAdmin, expressAsyncHandler(async (req, res) => {
    try {
        const { date } = req.query; // Expected format: YYYY-MM-DD
        
        // Import models at the top of the try block to catch any import errors
        let FoodPauseEnhanced;
        let Outpass;
        
        try {
            FoodPauseEnhanced = require('../models/FoodPauseEnhanced');
            Outpass = require('../models/OutpassModel');
        } catch (modelError) {
            console.error('Error loading models:', modelError);
            const totalStudents = await StudentModel.countDocuments({ is_active: true });
            return res.status(200).json({
                date: date || formatLocalDate(new Date()),
                summary: {
                    totalStudents,
                    availableStudents: totalStudents,
                    totalStudentsWithPause: 0,
                    studentsTakingMeals: totalStudents,
                    totalMealsAvailable: totalStudents * 4,
                    totalMealsPaused: 0,
                    totalMealsServed: totalStudents * 4,
                    pausePercentage: 0
                },
                mealWiseStats: {
                    breakfast: { paused: 0, available: totalStudents, served: totalStudents, students: [] },
                    lunch: { paused: 0, available: totalStudents, served: totalStudents, students: [] },
                    snacks: { paused: 0, available: totalStudents, served: totalStudents, students: [] },
                    dinner: { paused: 0, available: totalStudents, served: totalStudents, students: [] }
                },
                statusDistribution: {},
                allPauses: []
            });
        }
        
        // Parse the date or use today
        let targetDate;
        if (date) {
            targetDate = new Date(date);
        } else {
            targetDate = new Date();
        }
        targetDate.setHours(0, 0, 0, 0);

        const targetDateStr = formatLocalDate(targetDate);
        
        // Total number of active students
        const totalStudents = await StudentModel.countDocuments({ is_active: true });

        // Get students on outpass for the target date
        const targetDateEnd = new Date(targetDate);
        targetDateEnd.setHours(23, 59, 59, 999);

        let studentsOnOutpass = [];
        try {
            studentsOnOutpass = await Outpass.find({
                status: { $in: ['out', 'returned'] },
                outTime: { $lt: targetDateEnd },
                inTime: { $gt: targetDate }
            }).distinct('student_id');
        } catch (outpassError) {
            console.warn('Outpass query failed:', outpassError.message);
        }

        const availableStudents = totalStudents - studentsOnOutpass.length;

        // For future dates, all meals are available
        const now = new Date();
        const isToday = targetDateStr === formatLocalDate(now);
        const isFuture = targetDate > now;
        
        let totalMealsAvailable = 0;
        const mealWiseAvailable = {
            breakfast: 0,
            lunch: 0,
            snacks: 0,
            dinner: 0
        };

        if (isFuture) {
            // All meals available for future dates
            ['breakfast', 'lunch', 'snacks', 'dinner'].forEach(meal => {
                mealWiseAvailable[meal] = availableStudents;
                totalMealsAvailable += availableStudents;
            });
        } else if (isToday) {
            // For today, check meal times
            const currentHour = now.getHours();
            ['breakfast', 'lunch', 'snacks', 'dinner'].forEach(meal => {
                const mealEndHour = MEAL_TIMES[meal].end;
                if (currentHour < mealEndHour) {
                    mealWiseAvailable[meal] = availableStudents;
                    totalMealsAvailable += availableStudents;
                }
            });
        } else {
            // Past dates - no meals available
            totalMealsAvailable = 0;
        }

        // Find all active pauses for target date
        let pausesForDate = [];
        try {
            pausesForDate = await FoodPauseEnhanced.find({
                is_active: true,
                pause_start_date: { $lte: targetDateStr },
                pause_end_date: { $gte: targetDateStr }
            }).populate('student_id', 'rollNumber name hostel');
        } catch (pauseError) {
            console.warn('Pause query failed:', pauseError.message);
        }

        // Group pauses by meal type
        const mealPauseStats = {
            breakfast: { available: mealWiseAvailable.breakfast, paused: 0, served: 0, students: [] },
            lunch: { available: mealWiseAvailable.lunch, paused: 0, served: 0, students: [] },
            snacks: { available: mealWiseAvailable.snacks, paused: 0, served: 0, students: [] },
            dinner: { available: mealWiseAvailable.dinner, paused: 0, served: 0, students: [] }
        };

        const studentsWithPause = new Set();
        let totalPausedMeals = 0;

        for (const pause of pausesForDate) {
            if (!pause.student_id) continue;

            const mealType = pause.meal_type;
            if (mealPauseStats[mealType]) {
                mealPauseStats[mealType].paused++;
                mealPauseStats[mealType].students.push({
                    student_id: pause.student_id._id,
                    rollNumber: pause.student_id.rollNumber,
                    name: pause.student_id.name,
                    hostel: pause.student_id.hostel || 'N/A',
                    pause_id: pause._id,
                    pause_type: pause.pause_type
                });
                totalPausedMeals++;
                studentsWithPause.add(pause.student_id._id.toString());
            }
        }

        ['breakfast', 'lunch', 'snacks', 'dinner'].forEach(meal => {
            mealPauseStats[meal].served = Math.max(0, mealPauseStats[meal].available - mealPauseStats[meal].paused);
            // Add foodCountToPrepare for each meal
            mealPauseStats[meal].foodCountToPrepare = mealPauseStats[meal].served;
        });

        const totalStudentsWithPause = studentsWithPause.size;
        const totalMealsServed = Math.max(0, totalMealsAvailable - totalPausedMeals);

        // Calculate total food count to prepare
        const foodCountToPrepare = {
            breakfast: mealPauseStats.breakfast.foodCountToPrepare,
            lunch: mealPauseStats.lunch.foodCountToPrepare,
            snacks: mealPauseStats.snacks.foodCountToPrepare,
            dinner: mealPauseStats.dinner.foodCountToPrepare,
            total: mealPauseStats.breakfast.foodCountToPrepare + 
                   mealPauseStats.lunch.foodCountToPrepare + 
                   mealPauseStats.snacks.foodCountToPrepare + 
                   mealPauseStats.dinner.foodCountToPrepare
        };

        let statusMap = {};
        try {
            const statusCounts = await FoodPauseEnhanced.aggregate([
                {
                    $match: {
                        pause_start_date: { $lte: targetDateStr },
                        pause_end_date: { $gte: targetDateStr }
                    }
                },
                {
                    $group: {
                        _id: '$approval_status',
                        count: { $sum: 1 }
                    }
                }
            ]);

            for (const status of statusCounts) {
                statusMap[status._id] = status.count;
            }
        } catch (aggregateError) {
            console.warn('Status aggregation failed:', aggregateError.message);
        }

        res.status(200).json({
            date: targetDateStr,
            summary: {
                totalStudents,
                availableStudents,
                totalStudentsWithPause,
                studentsTakingMeals: Math.max(0, availableStudents - totalStudentsWithPause),
                totalMealsAvailable,
                totalMealsPaused: totalPausedMeals,
                totalMealsServed,
                pausePercentage: totalMealsAvailable > 0 ? ((totalPausedMeals / totalMealsAvailable) * 100).toFixed(2) : 0
            },
            foodCountToPrepare, // Add this field for kitchen planning
            mealWiseStats: mealPauseStats,
            statusDistribution: statusMap,
            allPauses: pausesForDate.map(p => ({
                _id: p._id,
                student: p.student_id ? {
                    id: p.student_id._id,
                    rollNumber: p.student_id.rollNumber,
                    name: p.student_id.name,
                    hostel: p.student_id.hostel || 'N/A'
                } : null,
                meal_type: p.meal_type,
                pause_type: p.pause_type,
                pause_start_date: p.pause_start_date,
                pause_end_date: p.pause_end_date,
                approval_status: p.approval_status,
                is_active: p.is_active,
                notes: p.notes
            })).filter(p => p.student !== null)
        });
    } catch (error) {
        console.error('Error fetching food stats for date:', error);
        res.status(500).json({ 
            error: 'Failed to fetch food statistics',
            details: error.message,
            stack: process.env.NODE_ENV === 'development' ? error.stack : undefined
        });
    }
}));

// Weekly menu management routes
foodApp.get('/menu/monthly', getMonthlyMenu);
foodApp.put('/menu/day', updateDayMenu);
foodApp.get('/menu/current-week', getCurrentWeek);
foodApp.put('/menu/week', updateWeekMenu);

// Analytics endpoints
foodApp.get('/analytics/dashboard-data', verifyAdmin, getDashboardData);
foodApp.get('/analytics/export-data', verifyAdmin, getExportData);

// Enhanced food pause management
const foodEnhancedRoutes = require('./foodAPIEnhanced');
foodApp.use('/enhanced', foodEnhancedRoutes);

module.exports = foodApp;
