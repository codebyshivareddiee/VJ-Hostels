const { FoodFeedback } = require('../models/FoodModel');

/**
 * Submit or update food feedback
 * POST /food-api/feedback
 */
const submitFeedback = async (req, res) => {
    try {
        const { student_id, mealType, rating, feedback, date } = req.body;

        if (!student_id || !mealType || !rating) {
            return res.status(400).json({
                success: false,
                message: 'Missing required fields: student_id, mealType, rating'
            });
        }

        // Validate rating
        if (rating < 1 || rating > 5) {
            return res.status(400).json({
                success: false,
                message: 'Rating must be between 1 and 5'
            });
        }

        // Create date string for the feedback (YYYY-MM-DD)
        const feedbackDate = date ? new Date(date) : new Date();
        const dateStr = feedbackDate.toISOString().split('T')[0];

        // Upsert feedback (update if exists, create if not)
        const feedbackData = await FoodFeedback.findOneAndUpdate(
            { student_id, mealType, dateStr },
            {
                student_id,
                mealType,
                rating: Number(rating),
                feedback: feedback || '',
                date: feedbackDate,
                dateStr
            },
            {
                upsert: true,
                new: true,
                runValidators: true
            }
        );

        res.status(200).json({
            success: true,
            message: 'Feedback submitted successfully',
            data: feedbackData
        });
    } catch (error) {
        console.error('Error submitting feedback:', error);
        res.status(500).json({
            success: false,
            message: 'Failed to submit feedback',
            error: error.message
        });
    }
};

/**
 * Get all feedback (for admin)
 * GET /food-api/feedback
 */
const getAllFeedback = async (req, res) => {
    try {
        const { startDate, endDate, mealType } = req.query;

        // Build query
        const query = {};

        // Filter by date range
        if (startDate || endDate) {
            query.dateStr = {};
            if (startDate) query.dateStr.$gte = startDate;
            if (endDate) query.dateStr.$lte = endDate;
        }

        // Filter by meal type
        if (mealType && mealType !== 'all') {
            query.mealType = mealType;
        }

        const feedbacks = await FoodFeedback.find(query)
            .populate('student_id', 'name email rollNumber')
            .sort({ date: -1 })
            .lean();

        res.status(200).json({
            success: true,
            data: feedbacks,
            count: feedbacks.length
        });
    } catch (error) {
        console.error('Error fetching feedback:', error);
        res.status(500).json({
            success: false,
            message: 'Failed to fetch feedback',
            error: error.message
        });
    }
};

/**
 * Get feedback statistics
 * GET /food-api/feedback/stats
 */
const getFeedbackStats = async (req, res) => {
    try {
        const { startDate, endDate, mealType } = req.query;

        // Build match stage
        const matchStage = {};
        
        if (startDate || endDate) {
            matchStage.dateStr = {};
            if (startDate) matchStage.dateStr.$gte = startDate;
            if (endDate) matchStage.dateStr.$lte = endDate;
        }

        if (mealType && mealType !== 'all') {
            matchStage.mealType = mealType;
        }

        // Aggregate statistics
        const stats = await FoodFeedback.aggregate([
            { $match: matchStage },
            {
                $group: {
                    _id: '$mealType',
                    averageRating: { $avg: '$rating' },
                    totalReviews: { $sum: 1 },
                    ratings: { $push: '$rating' }
                }
            }
        ]);

        // Calculate rating distribution
        const ratingDistribution = await FoodFeedback.aggregate([
            { $match: matchStage },
            {
                $group: {
                    _id: '$rating',
                    count: { $sum: 1 }
                }
            },
            { $sort: { _id: 1 } }
        ]);

        // Recent trends (last 7 days by meal type)
        const sevenDaysAgo = new Date();
        sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);
        const sevenDaysAgoStr = sevenDaysAgo.toISOString().split('T')[0];

        const trends = await FoodFeedback.aggregate([
            { 
                $match: { 
                    dateStr: { $gte: sevenDaysAgoStr },
                    ...(mealType && mealType !== 'all' ? { mealType } : {})
                } 
            },
            {
                $group: {
                    _id: {
                        date: '$dateStr',
                        mealType: '$mealType'
                    },
                    averageRating: { $avg: '$rating' },
                    count: { $sum: 1 }
                }
            },
            { $sort: { '_id.date': 1 } }
        ]);

        res.status(200).json({
            success: true,
            data: {
                byMealType: stats,
                ratingDistribution,
                recentTrends: trends
            }
        });
    } catch (error) {
        console.error('Error fetching feedback stats:', error);
        res.status(500).json({
            success: false,
            message: 'Failed to fetch feedback statistics',
            error: error.message
        });
    }
};

/**
 * Get student's own feedback
 * GET /food-api/feedback/student/:studentId
 */
const getStudentFeedback = async (req, res) => {
    try {
        const { studentId } = req.params;

        const feedbacks = await FoodFeedback.find({ student_id: studentId })
            .sort({ date: -1 })
            .lean();

        res.status(200).json({
            success: true,
            data: feedbacks
        });
    } catch (error) {
        console.error('Error fetching student feedback:', error);
        res.status(500).json({
            success: false,
            message: 'Failed to fetch student feedback',
            error: error.message
        });
    }
};

module.exports = {
    submitFeedback,
    getAllFeedback,
    getFeedbackStats,
    getStudentFeedback
};
