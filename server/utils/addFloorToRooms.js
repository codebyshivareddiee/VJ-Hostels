/**
 * Migration Script: Add Floor Field to Existing Rooms
 * 
 * This script adds the 'floor' field to all existing rooms in the database
 * based on their room number.
 * 
 * Usage: node server/utils/addFloorToRooms.js
 */

require('dotenv').config();
const mongoose = require('mongoose');
const Room = require('../models/Room');

/**
 * Extract floor number from room number
 */
function extractFloorNumber(roomNumber) {
    const roomStr = roomNumber.toString();
    
    // Special case for room 001
    if (roomStr === '001') {
        return 0;
    }
    
    // For rooms 1001-1239 (floors 10-12)
    if (roomStr.length === 4 && roomStr.startsWith('1')) {
        return parseInt(roomStr.substring(0, 2));
    }
    
    // For rooms 101-939 (floors 1-9)
    return parseInt(roomStr.charAt(0));
}

async function addFloorToRooms() {
    try {
        // Connect to MongoDB
        console.log('🔌 Connecting to MongoDB...');
        await mongoose.connect(process.env.DBURL);
        console.log('✅ Connected to MongoDB\n');

        // Fetch all rooms
        console.log('🏠 Fetching all rooms...');
        const rooms = await Room.find();
        console.log(`✅ Found ${rooms.length} rooms\n`);

        if (rooms.length === 0) {
            console.log('⚠️ No rooms found in database.');
            process.exit(0);
        }

        // Update rooms with floor field
        console.log('🔄 Adding floor field to rooms...\n');
        let updatedCount = 0;
        let skippedCount = 0;

        for (const room of rooms) {
            // Skip if floor already exists
            if (room.floor !== undefined && room.floor !== null) {
                skippedCount++;
                continue;
            }

            // Extract and set floor
            const floor = extractFloorNumber(room.roomNumber);
            room.floor = floor;
            
            try {
                await room.save();
                console.log(`  ✅ Room ${room.roomNumber}: Floor ${floor}`);
                updatedCount++;
            } catch (error) {
                console.error(`  ❌ Error updating room ${room.roomNumber}:`, error.message);
            }
        }

        // Summary
        console.log('\n' + '='.repeat(60));
        console.log('📊 MIGRATION SUMMARY');
        console.log('='.repeat(60));
        console.log(`✅ Rooms updated: ${updatedCount}`);
        console.log(`⏭️  Rooms skipped (already had floor): ${skippedCount}`);
        console.log(`🏠 Total rooms: ${rooms.length}`);
        console.log('='.repeat(60));
        console.log('\n✅ Migration completed successfully!');
        console.log('💡 You can now run the sync script: node utils/syncStudentsToRooms.js\n');

        process.exit(0);

    } catch (error) {
        console.error('\n❌ ERROR during migration:', error);
        console.error(error.stack);
        process.exit(1);
    }
}

// Run the migration
console.log('\n' + '='.repeat(60));
console.log('🔧 ROOM FLOOR MIGRATION SCRIPT');
console.log('='.repeat(60) + '\n');

addFloorToRooms();
