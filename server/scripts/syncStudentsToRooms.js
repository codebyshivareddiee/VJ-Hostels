/**
 * Standalone script to sync students to their rooms
 * This script reads student data and updates room occupants
 * 
 * Usage: node scripts/syncStudentsToRooms.js
 */

require('dotenv').config();
const mongoose = require('mongoose');
const Room = require('../models/Room');
const Student = require('../models/StudentModel');

/**
 * Extract floor number from room number
 */
function extractFloorNumber(roomNumber) {
    const roomStr = roomNumber.toString();
    
    // For rooms 1001-1239 (floors 10-12)
    if (roomStr.length === 4 && roomStr.startsWith('1')) {
        return parseInt(roomStr.substring(0, 2));
    }
    
    // For rooms 101-939 (floors 1-9)
    return parseInt(roomStr.charAt(0));
}

async function syncStudentsToRooms() {
    try {
        // Connect to MongoDB
        console.log('🔌 Connecting to MongoDB...');
        await mongoose.connect(process.env.DBURL);
        console.log('✅ Connected to MongoDB\n');

        // Get all students with room assignments
        console.log('📊 Fetching students with room assignments...');
        const studentsWithRooms = await Student.find({
            roomNumber: { $exists: true, $ne: null, $ne: '' },
            is_active: true
        });
        
        console.log(`✅ Found ${studentsWithRooms.length} active students with room assignments\n`);
        
        if (studentsWithRooms.length === 0) {
            console.log('⚠️ No students with room assignments found. Exiting...');
            process.exit(0);
        }

        // Extract unique room numbers
        const uniqueRoomNumbers = [...new Set(studentsWithRooms.map(s => s.roomNumber))];
        console.log(`🏠 Unique rooms in student data: ${uniqueRoomNumbers.length}\n`);

        // Check for missing rooms
        console.log('🔍 Checking for missing rooms...');
        const missingRooms = [];
        for (const roomNumber of uniqueRoomNumbers) {
            const existingRoom = await Room.findOne({ roomNumber });
            if (!existingRoom) {
                missingRooms.push(roomNumber);
            }
        }

        if (missingRooms.length > 0) {
            console.log(`⚠️ Found ${missingRooms.length} missing rooms:`);
            console.log(missingRooms.join(', '));
            console.log('\n📝 Creating missing rooms...');
            
            for (const roomNumber of missingRooms) {
                const floor = extractFloorNumber(roomNumber);
                await Room.create({
                    roomNumber,
                    floor,
                    capacity: 3,
                    occupants: [],
                    allocatedStudents: []
                });
                console.log(`  ✨ Created room ${roomNumber} (Floor ${floor})`);
            }
            console.log(`✅ Created ${missingRooms.length} missing rooms\n`);
        } else {
            console.log('✅ All rooms exist in database\n');
        }

        // Clear all room occupants
        console.log('🧹 Clearing all room occupants for fresh sync...');
        await Room.updateMany({}, { $set: { occupants: [], allocatedStudents: [] } });
        console.log('✅ Cleared all room occupants\n');

        // Group students by room
        console.log('📦 Grouping students by room...');
        const studentsByRoom = {};
        studentsWithRooms.forEach(student => {
            if (!studentsByRoom[student.roomNumber]) {
                studentsByRoom[student.roomNumber] = [];
            }
            studentsByRoom[student.roomNumber].push({
                id: student._id,
                name: student.name,
                rollNumber: student.rollNumber
            });
        });
        console.log(`✅ Grouped students into ${Object.keys(studentsByRoom).length} rooms\n`);

        // Sync students to rooms
        console.log('🔄 Syncing students to rooms...\n');
        let updatedRooms = 0;
        let studentsAllocated = 0;
        const capacityWarnings = [];

        for (const [roomNumber, students] of Object.entries(studentsByRoom)) {
            const room = await Room.findOne({ roomNumber });
            
            if (!room) {
                console.warn(`  ⚠️ Room ${roomNumber} not found, skipping ${students.length} students`);
                continue;
            }

            // Check capacity
            if (students.length > room.capacity) {
                capacityWarnings.push({
                    roomNumber,
                    allocated: students.length,
                    capacity: room.capacity,
                    students: students.map(s => s.rollNumber)
                });
                console.warn(`  ⚠️ Room ${roomNumber}: ${students.length} students > capacity ${room.capacity}`);
            }

            // Update room
            const studentIds = students.map(s => s.id);
            await Room.findOneAndUpdate(
                { roomNumber },
                { 
                    $set: { 
                        occupants: studentIds,
                        allocatedStudents: studentIds
                    } 
                }
            );

            console.log(`  ✅ Room ${roomNumber}: ${students.length}/${room.capacity} students`);
            updatedRooms++;
            studentsAllocated += students.length;
        }

        // Summary
        console.log('\n' + '='.repeat(60));
        console.log('📊 SYNC SUMMARY');
        console.log('='.repeat(60));
        console.log(`✅ Students processed: ${studentsWithRooms.length}`);
        console.log(`✅ Rooms updated: ${updatedRooms}`);
        console.log(`✅ Students allocated: ${studentsAllocated}`);
        console.log(`✅ Unique rooms: ${uniqueRoomNumbers.length}`);
        
        if (missingRooms.length > 0) {
            console.log(`✨ Rooms created: ${missingRooms.length}`);
        }
        
        if (capacityWarnings.length > 0) {
            console.log(`\n⚠️ CAPACITY WARNINGS: ${capacityWarnings.length} rooms exceed capacity`);
            console.log('='.repeat(60));
            capacityWarnings.forEach(warning => {
                console.log(`\nRoom ${warning.roomNumber}:`);
                console.log(`  Allocated: ${warning.allocated} students`);
                console.log(`  Capacity: ${warning.capacity} students`);
                console.log(`  Students: ${warning.students.join(', ')}`);
            });
        }
        
        console.log('\n' + '='.repeat(60));
        console.log('✅ Sync completed successfully!');
        console.log('='.repeat(60) + '\n');

        process.exit(0);
    } catch (error) {
        console.error('\n❌ Error during sync:', error);
        process.exit(1);
    }
}

// Run the sync
syncStudentsToRooms();
