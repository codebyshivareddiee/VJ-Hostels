const mongoose = require('mongoose');
const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '../.env') });

const Student = require('../models/StudentModel');

async function verifyStudent(email) {
  try {
    await mongoose.connect(process.env.DBURL);
    console.log('✓ Connected to MongoDB\n');

    const student = await Student.findOne({ email });

    if (!student) {
      console.log(`✗ Student with email ${email} not found`);
      return null;
    }

    console.log('✓ Student found in database:');
    console.log('═' * 60);
    console.log(`  ID: ${student._id}`);
    console.log(`  Name: ${student.name}`);
    console.log(`  Roll Number: ${student.rollNumber}`);
    console.log(`  Username: ${student.username}`);
    console.log(`  Email: ${student.email}`);
    console.log(`  Branch: ${student.branch}`);
    console.log(`  Role: ${student.role}`);
    console.log(`  Active: ${student.is_active}`);
    console.log(`  Room: ${student.room || 'Not assigned'}`);
    console.log(`  Phone: ${student.phoneNumber || 'Not provided'}`);
    console.log(`  Parent Name: ${student.parentName || 'Not provided'}`);
    console.log(`  Parent Phone: ${student.parentMobileNumber || 'Not provided'}`);
    console.log(`  Google ID: ${student.googleId ? 'Yes (OAuth enabled)' : 'No'}`);
    console.log(`  Created: ${student.createdAt}`);
    console.log(`  Updated: ${student.updatedAt}`);
    console.log('═' * 60);

    return student;

  } catch (error) {
    console.error('✗ Error:', error.message);
    throw error;
  } finally {
    await mongoose.connection.close();
    console.log('\n✓ Disconnected from MongoDB');
  }
}

// Verify the student
if (require.main === module) {
  const emailToVerify = 'mkrishna@vnrvjiet.in'; //karthikbtechcse2006@gmail.com
  console.log('Verifying student:', emailToVerify);
  console.log('═' * 60);
  
  verifyStudent(emailToVerify)
    .then(() => process.exit(0))
    .catch(() => process.exit(1));
}

module.exports = verifyStudent;