const mongoose = require('mongoose');
const roomSyncService = require('./services/roomSyncService');
const Student = require('./models/StudentModel');
const Room = require('./models/Room');
require('dotenv').config();

async function testRoomSync() {
    try {
        // Connect to MongoDB
        await mongoose.connect(process.env.MONGO_URL);
        console.log('✅ Connected to MongoDB\n');
        
        // Test 1: Check students with rooms
        console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
        console.log('📊 TEST 1: Students with Room Assignments');
        console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
        
        const studentsWithRooms = await Student.find({
            room: { $exists: true, $ne: null, $ne: '' },
            is_active: true
        }).limit(5);
        
        console.log(`Found ${studentsWithRooms.length} students (showing first 5):`);
        studentsWithRooms.forEach(s => {
            console.log(`  - ${s.rollNumber} (${s.name}): Room ${s.room}`);
        });
        
        // Test 2: Check room occupants
        console.log('\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
        console.log('🏠 TEST 2: Room Occupants (Before Sync)');
        console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
        
        const roomsBeforeSync = await Room.find({ occupants: { $ne: [] } }).limit(5);
        console.log(`Rooms with occupants: ${roomsBeforeSync.length} (showing first 5)`);
        for (const room of roomsBeforeSync) {
            console.log(`  - Room ${room.roomNumber}: ${room.occupants.length} occupants`);
        }
        
        // Test 3: Sync a specific room
        if (studentsWithRooms.length > 0) {
            const testRoomNumber = studentsWithRooms[0].room;
            console.log('\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
            console.log(`🔄 TEST 3: Syncing Room ${testRoomNumber}`);
            console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
            
            const result = await roomSyncService.syncSingleRoom(testRoomNumber);
            console.log('Sync Result:', result);
            
            // Verify the sync
            const roomAfterSync = await Room.findOne({ roomNumber: testRoomNumber });
            console.log(`\nRoom ${testRoomNumber} after sync:`);
            console.log(`  - Occupants: ${roomAfterSync.occupants.length}`);
            console.log(`  - Capacity: ${roomAfterSync.capacity}`);
        }
        
        // Test 4: Full system sync
        console.log('\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
        console.log('🌍 TEST 4: Full System Sync');
        console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
        
        const fullSyncResult = await roomSyncService.syncStudentsToRooms();
        console.log('Full Sync Result:');
        console.log(`  - Students Processed: ${fullSyncResult.studentsProcessed}`);
        console.log(`  - Rooms Updated: ${fullSyncResult.roomsUpdated}`);
        console.log(`  - Rooms Created: ${fullSyncResult.roomsCreated}`);
        console.log(`  - Unique Rooms: ${fullSyncResult.uniqueRooms}`);
        
        // Test 5: Verify room occupants after full sync
        console.log('\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
        console.log('✅ TEST 5: Room Occupants (After Full Sync)');
        console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
        
        const roomsAfterSync = await Room.find({ occupants: { $ne: [] } }).limit(10);
        console.log(`Rooms with occupants: ${roomsAfterSync.length} (showing first 10)`);
        for (const room of roomsAfterSync) {
            const students = await Student.find({ _id: { $in: room.occupants } });
            console.log(`  - Room ${room.roomNumber}: ${room.occupants.length}/${room.capacity} occupants`);
            students.forEach(s => {
                console.log(`      └─ ${s.rollNumber} (${s.name})`);
            });
        }
        
        // Test 6: Statistics
        console.log('\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
        console.log('📈 TEST 6: Room Statistics');
        console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
        
        const stats = await roomSyncService.getRoomStatistics();
        console.log('Statistics:');
        console.log(`  - Total Rooms: ${stats.totalRooms}`);
        console.log(`  - Total Capacity: ${stats.totalCapacity}`);
        console.log(`  - Total Occupied: ${stats.totalOccupied}`);
        console.log(`  - Occupancy Rate: ${stats.occupancyRate}%`);
        console.log(`  - Fully Occupied: ${stats.fullyOccupiedRooms}`);
        console.log(`  - Partially Occupied: ${stats.partiallyOccupiedRooms}`);
        console.log(`  - Vacant: ${stats.vacantRooms}`);
        
        console.log('\n✅ All tests completed successfully!');
        process.exit(0);
        
    } catch (error) {
        console.error('❌ Test failed:', error);
        process.exit(1);
    }
}

testRoomSync();
