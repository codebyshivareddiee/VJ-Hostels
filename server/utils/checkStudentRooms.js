require('dotenv').config();
const mongoose = require('mongoose');
const Student = require('../models/StudentModel');

async function checkStudentRooms() {
    try {
        await mongoose.connect(process.env.DBURL);
        console.log('✅ Connected to MongoDB\n');

        const total = await Student.countDocuments();
        const withRoom = await Student.countDocuments({ 
            room: { $exists: true, $ne: null, $ne: '' } 
        });
        const withoutRoom = total - withRoom;

        console.log('📊 Student Room Statistics:');
        console.log(`Total students: ${total}`);
        console.log(`Students WITH room: ${withRoom}`);
        console.log(`Students WITHOUT room: ${withoutRoom}\n`);

        if (withRoom > 0) {
            console.log('Sample students with rooms:');
            const samples = await Student.find({ 
                room: { $exists: true, $ne: null, $ne: '' } 
            }).limit(5).lean();
            
            samples.forEach(s => {
                console.log(`  - ${s.name}: Room ${s.room}`);
            });
        } else {
            console.log('⚠️ No students have room assignments!');
            console.log('\nSample student data:');
            const samples = await Student.find().limit(3).lean();
            samples.forEach(s => {
                console.log(`  - ${s.name}:`);
                console.log(`    room field: ${s.room}`);
                console.log(`    roomNumber field: ${s.roomNumber}`);
            });
        }

        process.exit(0);
    } catch (error) {
        console.error('Error:', error);
        process.exit(1);
    }
}

checkStudentRooms();
