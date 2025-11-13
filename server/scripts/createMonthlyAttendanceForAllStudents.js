const mongoose = require('mongoose');
const dotenv = require('dotenv');
const Student = require('../models/StudentModel');
const MonthlyAttendance = require('../models/MonthlyAttendanceModel');

dotenv.config();

async function createMonthlyAttendanceForAllStudents() {
  try {
    // Connect to MongoDB
    await mongoose.connect(process.env.DBURL);
    console.log('Connected to MongoDB');

    const now = new Date();
    const year = now.getFullYear();
    const month = now.getMonth() + 1; // 1-12

    // Get all active students
    const students = await Student.find({ is_active: { $ne: false } }).select('_id');
    console.log(`Found ${students.length} active students`);

    let createdCount = 0;
    let skippedCount = 0;

    // Process in batches to avoid memory issues
    const batchSize = 100;
    for (let i = 0; i < students.length; i += batchSize) {
      const batch = students.slice(i, i + batchSize);
      
      // Check which students don't have a record for this month
      const studentIds = batch.map(s => s._id);
      
      const existingRecords = await MonthlyAttendance.find({
        student_id: { $in: studentIds },
        year: year,
        month: month
      }).select('student_id');
      
      const existingStudentIds = new Set(existingRecords.map(r => r.student_id.toString()));
      const newStudentIds = studentIds.filter(id => !existingStudentIds.has(id.toString()));
      
      // Create records for students who don't have one
      if (newStudentIds.length > 0) {
        const newRecords = newStudentIds.map(studentId => ({
          student_id: studentId,
          year: year,
          month: month,
          attendance: {},
          summary: { present: 0, absent: 0, home_pass: 0 }
        }));
        
        await MonthlyAttendance.insertMany(newRecords);
        createdCount += newStudentIds.length;
        console.log(`Created ${newStudentIds.length} records in batch ${i / batchSize + 1}`);
      } else {
        console.log(`No new records needed in batch ${i / batchSize + 1}`);
      }
      
      skippedCount += studentIds.length - newStudentIds.length;
    }

    console.log('\n--- Summary ---');
    console.log(`Total students: ${students.length}`);
    console.log(`New records created: ${createdCount}`);
    console.log(`Records already existed: ${skippedCount}`);
    
  } catch (error) {
    console.error('Error creating monthly attendance records:', error);
  } finally {
    await mongoose.connection.close();
    console.log('MongoDB connection closed');
  }
}

// Run the script
createMonthlyAttendanceForAllStudents();
