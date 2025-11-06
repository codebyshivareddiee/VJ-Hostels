/**
 * Sync Students to Rooms Utility
 * 
 * This script synchronizes students with their assigned rooms by:
 * 1. Fetching all students from the database
 * 2. Matching each student's room field with existing rooms
 * 3. Adding student IDs to room occupants arrays
 * 4. Ensuring no room exceeds capacity (3 students)
 * 
 * Usage: node server/utils/syncStudentsToRooms.js
 */

require('dotenv').config();
const mongoose = require('mongoose');
const Room = require('../models/Room');
const Student = require('../models/StudentModel');

/**
 * Main synchronization function
 */
async function syncStudentsToRooms() {
    try {
        // Connect to MongoDB
        console.log('🔌 Connecting to MongoDB...');
        await mongoose.connect(process.env.DBURL);
        console.log('✅ Connected to MongoDB\n');

        // Step 1: Ensure room 001 exists
        console.log('🔍 Checking for room 001...');
        let room001 = await Room.findOne({ roomNumber: '001' });
        if (!room001) {
            room001 = await Room.create({
                roomNumber: '001',
                floor: 0,
                capacity: 3,
                occupants: []
            });
            console.log('✨ Created room 001\n');
        } else {
            console.log('✅ Room 001 exists\n');
        }

        // Step 2: Fetch all students
        console.log('📊 Fetching students from database...');
        const students = await Student.find();
        console.log(`✅ Found ${students.length} students in database\n`);

        if (students.length === 0) {
            console.log('⚠️ No students found in database.');
            console.log('💡 You may need to import students from Excel files first.');
            console.log('   Files: server/seedData/vnrboys-2.xls, vnrboys-3.xls, vnrboys-4.xls\n');
            process.exit(0);
        }

        // Step 3: Fetch all rooms and create a map
        console.log('🏠 Fetching all rooms...');
        const rooms = await Room.find();
        console.log(`✅ Found ${rooms.length} rooms in database\n`);

        // Create a map for quick room lookup
        const roomMap = new Map();
        for (const room of rooms) {
            roomMap.set(room.roomNumber, room);
        }

        // Step 4: Clear all room occupants for fresh sync
        console.log('🧹 Clearing all room occupants for fresh sync...');
        for (const room of rooms) {
            room.occupants = [];
        }
        console.log('✅ Cleared all occupants\n');

        // Step 5: Sync students to rooms
        console.log('🔄 Syncing students to rooms...\n');
        
        let syncedCount = 0;
        let skippedNoRoom = 0;
        let skippedCapacityFull = 0;
        const capacityWarnings = [];
        const missingRooms = new Set();

        for (const student of students) {
            // Skip students without room assignment
            // Note: Students have 'room' field, not 'roomNumber'
            if (!student.room || student.room === '') {
                skippedNoRoom++;
                continue;
            }

            // Find the corresponding room
            const room = roomMap.get(student.room);

            if (!room) {
                // Room doesn't exist
                missingRooms.add(student.room);
                continue;
            }

            // Check capacity
            if (room.occupants.length >= room.capacity) {
                skippedCapacityFull++;
                capacityWarnings.push({
                    roomNumber: room.roomNumber,
                    student: student.rollNumber
                });
                continue;
            }

            // Check if student already in room (avoid duplicates)
            const alreadyExists = room.occupants.some(
                id => id.toString() === student._id.toString()
            );

            if (!alreadyExists) {
                room.occupants.push(student._id);
                syncedCount++;
            }
        }

        // Step 6: Save all updated rooms
        console.log('💾 Saving updated rooms to database...');
        let savedCount = 0;
        for (const room of roomMap.values()) {
            await room.save();
            savedCount++;
        }
        console.log(`✅ Saved ${savedCount} rooms\n`);

        // Step 7: Display summary
        console.log('='.repeat(60));
        console.log('📊 SYNCHRONIZATION SUMMARY');
        console.log('='.repeat(60));
        console.log(`✅ Students synced: ${syncedCount}`);
        console.log(`⏭️  Students without room: ${skippedNoRoom}`);
        console.log(`⚠️  Students skipped (capacity full): ${skippedCapacityFull}`);
        console.log(`🏠 Total rooms: ${rooms.length}`);
        console.log(`👥 Total students: ${students.length}`);

        if (missingRooms.size > 0) {
            console.log(`\n⚠️  MISSING ROOMS (${missingRooms.size}):`);
            console.log('   ' + Array.from(missingRooms).join(', '));
        }

        if (capacityWarnings.length > 0) {
            console.log(`\n⚠️  CAPACITY WARNINGS (${capacityWarnings.length} students couldn't be assigned):`);
            capacityWarnings.slice(0, 10).forEach(w => {
                console.log(`   Room ${w.roomNumber} is full, couldn't add student ${w.student}`);
            });
            if (capacityWarnings.length > 10) {
                console.log(`   ... and ${capacityWarnings.length - 10} more`);
            }
        }

        // Step 8: Show sample room occupancy
        console.log('\n' + '='.repeat(60));
        console.log('📋 SAMPLE ROOM OCCUPANCY');
        console.log('='.repeat(60));
        
        const occupiedRooms = rooms.filter(r => r.occupants.length > 0).slice(0, 10);
        for (const room of occupiedRooms) {
            console.log(`Room ${room.roomNumber}: ${room.occupants.length}/${room.capacity} students`);
        }

        console.log('\n' + '='.repeat(60));
        console.log('✅ SYNCHRONIZATION COMPLETE!');
        console.log('='.repeat(60));
        console.log('\n💡 Next steps:');
        console.log('   1. Check your MongoDB to verify room occupants');
        console.log('   2. Open Admin Portal > Room Management');
        console.log('   3. Click on any room to see occupants\n');

        process.exit(0);

    } catch (error) {
        console.error('\n❌ ERROR during synchronization:', error);
        console.error(error.stack);
        process.exit(1);
    }
}

// Run the sync
console.log('\n' + '='.repeat(60));
console.log('🚀 STUDENT-ROOM SYNCHRONIZATION SCRIPT');
console.log('='.repeat(60) + '\n');

syncStudentsToRooms();
