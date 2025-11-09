const mongoose = require('mongoose');
const roomSyncService = require('./services/roomSyncService');
require('dotenv').config();

async function fixAllRooms() {
    try {
        await mongoose.connect(process.env.MONGO_URL);
        console.log('✅ Connected to MongoDB\n');
        
        console.log('🔄 Running FULL room sync to fix all rooms...\n');
        
        const result = await roomSyncService.syncStudentsToRooms();
        
        console.log('\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
        console.log('✅ SYNC COMPLETED SUCCESSFULLY!');
        console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
        console.log(`📊 Students Processed: ${result.studentsProcessed}`);
        console.log(`🏠 Rooms Updated: ${result.roomsUpdated}`);
        console.log(`✨ Rooms Created: ${result.roomsCreated}`);
        console.log(`🔢 Unique Rooms: ${result.uniqueRooms}`);
        
        if (result.capacityWarnings) {
            console.log(`\n⚠️  Capacity Warnings: ${result.capacityWarnings.length} rooms`);
            result.capacityWarnings.forEach(w => {
                console.log(`   - Room ${w.roomNumber}: ${w.allocated} students / ${w.capacity} capacity`);
            });
        }
        
        console.log('\n✅ All room occupants are now correctly synced with student data!');
        console.log('✅ You can now check your database - rooms should show occupants.');
        
        process.exit(0);
    } catch (error) {
        console.error('❌ Error:', error);
        process.exit(1);
    }
}

fixAllRooms();
