const cron = require('node-cron');
const roomSyncService = require('../services/roomSyncService');

/**
 * Schedule automatic room syncing to handle any direct database changes
 * Runs every day at 2:00 AM
 */
function scheduleRoomSync() {
    // Schedule: Run at 2:00 AM every day
    // Cron format: minute hour day month weekday
    cron.schedule('0 2 * * *', async () => {
        try {
            console.log('🔄 [Scheduled] Running daily room sync at 2:00 AM...');
            const result = await roomSyncService.syncStudentsToRooms();
            console.log(`✅ [Scheduled] Daily sync complete: ${result.roomsUpdated} rooms, ${result.studentsProcessed} students`);
        } catch (error) {
            console.error('❌ [Scheduled] Daily room sync failed:', error);
        }
    }, {
        timezone: "Asia/Kolkata" // Adjust to your timezone
    });

    console.log('📅 Scheduled daily room sync job at 2:00 AM (Asia/Kolkata)');
}

/**
 * Alternative: More frequent sync for development (every hour)
 * Uncomment if you want hourly syncing during development
 */
function scheduleHourlySync() {
    // Run every hour
    cron.schedule('0 * * * *', async () => {
        try {
            console.log('🔄 [Scheduled] Running hourly room sync...');
            const result = await roomSyncService.syncStudentsToRooms();
            console.log(`✅ [Scheduled] Hourly sync complete: ${result.roomsUpdated} rooms updated`);
        } catch (error) {
            console.error('❌ [Scheduled] Hourly room sync failed:', error);
        }
    });

    console.log('📅 Scheduled hourly room sync job');
}

module.exports = {
    scheduleRoomSync,
    scheduleHourlySync
};
