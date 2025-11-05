const mongoose = require('mongoose');
require('dotenv').config();
const { FoodFeedback } = require('../models/FoodModel');
const StudentModel = require('../models/StudentModel');

async function seedFeedback() {
    try {
        // Connect to MongoDB
        await mongoose.connect(process.env.DBURL);
        console.log('Connected to MongoDB');

        // Get some students
        const students = await StudentModel.find().limit(10);
        
        if (students.length === 0) {
            console.log('No students found. Please add students first.');
            process.exit(1);
        }

        console.log(`Found ${students.length} students`);

        // Generate feedback for the last 7 days
        const feedbackData = [];
        const mealTypes = ['breakfast', 'lunch', 'snacks', 'dinner'];
        const feedbackComments = [
            'Excellent food quality!',
            'Very tasty and fresh',
            'Good meal, enjoyed it',
            'Could be better',
            'Average taste',
            'Not satisfied with the quality',
            '',
            'Great variety today',
            'Too spicy for me',
            'Perfect portion size'
        ];

        for (let dayOffset = 0; dayOffset < 7; dayOffset++) {
            const date = new Date();
            date.setDate(date.getDate() - dayOffset);
            date.setHours(12, 0, 0, 0); // Set to noon
            const dateStr = date.toISOString().split('T')[0];

            // Generate 2-5 random feedback entries per day per meal
            for (const mealType of mealTypes) {
                const numFeedbacks = Math.floor(Math.random() * 4) + 2; // 2-5 feedbacks
                
                for (let i = 0; i < numFeedbacks && i < students.length; i++) {
                    const student = students[i];
                    const rating = Math.floor(Math.random() * 3) + 3; // 3-5 stars (mostly positive)
                    const feedback = feedbackComments[Math.floor(Math.random() * feedbackComments.length)];

                    feedbackData.push({
                        student_id: student._id,
                        date: date,
                        dateStr: dateStr,
                        mealType: mealType,
                        rating: rating,
                        feedback: feedback
                    });
                }
            }
        }

        console.log(`Preparing to insert ${feedbackData.length} feedback entries...`);

        // Clear existing feedback (optional - comment out if you want to keep existing data)
        await FoodFeedback.deleteMany({});
        console.log('Cleared existing feedback');

        // Insert feedback data using insertMany to handle duplicates
        const result = await FoodFeedback.insertMany(feedbackData, { ordered: false });
        console.log(`✅ Successfully inserted ${result.length} feedback entries`);

        // Show statistics
        const stats = await FoodFeedback.aggregate([
            {
                $group: {
                    _id: '$mealType',
                    count: { $sum: 1 },
                    avgRating: { $avg: '$rating' }
                }
            },
            { $sort: { _id: 1 } }
        ]);

        console.log('\n📊 Feedback Statistics:');
        stats.forEach(stat => {
            console.log(`  ${stat._id}: ${stat.count} reviews, avg rating: ${stat.avgRating.toFixed(2)}`);
        });

        await mongoose.connection.close();
        console.log('\n✅ Database connection closed');
        process.exit(0);
    } catch (error) {
        console.error('❌ Error seeding feedback:', error);
        process.exit(1);
    }
}

seedFeedback();
