const mongoose = require('mongoose');
const bcrypt = require('bcrypt');
const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '../.env') });

// Import the Student model
const Student = require('../models/StudentModel');

/**
 * Add a single student to the database
 * Run with: node addSingleStudent.js
 */

async function addStudent(studentData) {
  try {
    // Connect to MongoDB
    await mongoose.connect(process.env.DBURL);
    console.log('✓ Connected to MongoDB');

    // Check if student already exists
    const existingStudent = await Student.findOne({
      $or: [
        { email: studentData.email },
        { rollNumber: studentData.rollNumber }
      ]
    });

    if (existingStudent) {
      console.log(`⚠ Student already exists:`);
      console.log(`  Name: ${existingStudent.name}`);
      console.log(`  Roll Number: ${existingStudent.rollNumber}`);
      console.log(`  Email: ${existingStudent.email}`);
      console.log(`  Room: ${existingStudent.room || 'Not assigned'}`);
      
      // Ask if we should update
      console.log('\n✓ Student data is already in the system.');
      return existingStudent;
    }

    // Create new student
    const newStudent = new Student(studentData);
    await newStudent.save();

    console.log('\n✓ Student added successfully!');
    console.log('=' * 50);
    console.log(`  Name: ${newStudent.name}`);
    console.log(`  Roll Number: ${newStudent.rollNumber}`);
    console.log(`  Email: ${newStudent.email}`);
    console.log(`  Branch: ${newStudent.branch}`);
    console.log(`  Room: ${newStudent.room || 'Not assigned'}`);
    console.log(`  Parent: ${newStudent.parentName || 'Not provided'}`);
    console.log(`  Parent Phone: ${newStudent.parentMobileNumber || 'Not provided'}`);
    console.log('=' * 50);

    return newStudent;

  } catch (error) {
    console.error('✗ Error adding student:', error.message);
    throw error;
  } finally {
    // Close the connection
    await mongoose.connection.close();
    console.log('\n✓ Disconnected from MongoDB');
  }
}

// Student data for 22071A1216@vnrvjiet.in
const studentData = {
  rollNumber: 'mkrishna',
  username: 'mkrishna',
  name: 'mkrishna', // Replace with actual name if known
  email: 'mkrishna@vnrvjiet.in',
  branch: 'CSD',
  role: 'student',
  is_active: true,
  room: null, // Will be assigned later
  phoneNumber:9876543210, // Add if known
  parentMobileNumber: 9876543210, // Add if known
  parentName: "xyz", // Required field - placeholder
  googleId: `google_${Date.now()}`, // Dummy Google ID to bypass password requirement
  fcmToken: null,
  backupContacts: [],
  whitelist: [],
  autoApproveParents: false,
  preferences: {
    allowVisitorsOutOfHours: false,
    requirePhotoVerification: true,
    maxVisitorsPerDay: 5
  }
};

// Run the script
if (require.main === module) {
  console.log('=' * 60);
  console.log('Add Single Student Script');
  console.log('=' * 60);
  console.log(`\nAdding student: ${studentData.email}\n`);
  
  addStudent(studentData)
    .then(() => {
      console.log('\n✓ Script completed successfully!');
      process.exit(0);
    })
    .catch((error) => {
      console.error('\n✗ Script failed:', error);
      process.exit(1);
    });
}

module.exports = addStudent;