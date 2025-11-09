const Student = require('../models/StudentModel');
const roomSyncService = require('./roomSyncService');

/**
 * MongoDB Change Stream Watcher for Real-time Room Syncing
 * 
 * This service watches the Student collection for any changes and automatically
 * triggers room syncing when:
 * - A student is inserted with a room assignment
 * - A student's room field is updated
 * - A student is deleted/deactivated
 * 
 * Benefits:
 * - Works for ALL database changes (API, MongoDB Compass, bulk imports, etc.)
 * - Real-time syncing without server restart or page reload
 * - Efficient - only syncs affected rooms
 * - No polling required
 */

let changeStream = null;

/**
 * Start watching the Student collection for changes
 */
function startRoomChangeStreamWatcher() {
    try {
        // Check if already watching
        if (changeStream) {
            console.log('⚠️  Change stream already active, skipping initialization');
            return;
        }

        console.log('🔍 Starting MongoDB Change Stream for real-time room syncing...');

        // Create change stream to watch Student collection
        // We're interested in: insert, update, replace, delete operations
        changeStream = Student.watch([], {
            fullDocument: 'updateLookup', // Get the full document after update
            fullDocumentBeforeChange: 'whenAvailable' // Get document before change (MongoDB 6.0+)
        });

        // Listen for changes
        changeStream.on('change', async (change) => {
            try {
                await handleStudentChange(change);
            } catch (error) {
                console.error('❌ Error handling student change:', error);
            }
        });

        // Handle stream errors
        changeStream.on('error', (error) => {
            console.error('❌ Change stream error:', error);
            // Attempt to reconnect after error
            setTimeout(() => {
                console.log('🔄 Attempting to restart change stream...');
                stopRoomChangeStreamWatcher();
                startRoomChangeStreamWatcher();
            }, 5000); // Wait 5 seconds before reconnecting
        });

        // Handle stream close
        changeStream.on('close', () => {
            console.log('🔒 Change stream closed');
            changeStream = null;
        });

        console.log('✅ Room change stream watcher started successfully');
        console.log('📡 Now monitoring Student collection for real-time changes...');

    } catch (error) {
        console.error('❌ Failed to start change stream:', error);
        changeStream = null;
    }
}

/**
 * Stop watching the Student collection
 */
async function stopRoomChangeStreamWatcher() {
    if (changeStream) {
        console.log('🛑 Stopping change stream watcher...');
        await changeStream.close();
        changeStream = null;
        console.log('✅ Change stream watcher stopped');
    }
}

/**
 * Handle different types of student changes
 */
async function handleStudentChange(change) {
    const { operationType, fullDocument, documentKey, updateDescription, fullDocumentBeforeChange } = change;

    console.log(`\n🔔 Student change detected: ${operationType}`);

    switch (operationType) {
        case 'insert':
            // New student created
            await handleStudentInsert(fullDocument);
            break;

        case 'update':
            // Student data updated
            await handleStudentUpdate(fullDocument, updateDescription, fullDocumentBeforeChange);
            break;

        case 'replace':
            // Entire student document replaced
            await handleStudentReplace(fullDocument, fullDocumentBeforeChange);
            break;

        case 'delete':
            // Student deleted
            await handleStudentDelete(fullDocumentBeforeChange, documentKey);
            break;

        default:
            console.log(`ℹ️  Ignoring operation type: ${operationType}`);
    }
}

/**
 * Handle new student insertion
 */
async function handleStudentInsert(student) {
    if (!student) return;

    console.log(`📝 New student created: ${student.rollNumber}`);

    // Check if student has a room assignment
    if (student.room && student.room !== '' && student.is_active) {
        console.log(`🏠 Student assigned to room: ${student.room}`);
        await roomSyncService.syncSingleRoom(student.room);
    } else {
        console.log('ℹ️  Student has no room assignment, no sync needed');
    }
}

/**
 * Handle student update
 */
async function handleStudentUpdate(student, updateDescription, previousStudent) {
    if (!student) return;

    console.log(`✏️  Student updated: ${student.rollNumber}`);

    const updatedFields = updateDescription?.updatedFields || {};
    const removedFields = updateDescription?.removedFields || [];

    // Check if 'room' field was modified
    const roomFieldUpdated = 'room' in updatedFields || removedFields.includes('room');
    const isActiveUpdated = 'is_active' in updatedFields;

    if (!roomFieldUpdated && !isActiveUpdated) {
        console.log('ℹ️  Room field not modified, no sync needed');
        return;
    }

    // Get old and new room values
    const oldRoom = previousStudent?.room;
    const newRoom = student.room;
    const isActive = student.is_active;

    console.log(`🔄 Room change detected - Old: ${oldRoom || 'none'}, New: ${newRoom || 'none'}, Active: ${isActive}`);

    // Sync both old and new rooms
    const roomsToSync = new Set();

    // Add old room if it exists
    if (oldRoom && oldRoom !== '') {
        roomsToSync.add(oldRoom);
    }

    // Add new room if it exists and student is active
    if (newRoom && newRoom !== '' && isActive) {
        roomsToSync.add(newRoom);
    }

    // If student was deactivated, sync their current room
    if (isActiveUpdated && !isActive && student.room) {
        roomsToSync.add(student.room);
    }

    // Sync all affected rooms
    for (const roomNumber of roomsToSync) {
        await roomSyncService.syncSingleRoom(roomNumber);
    }

    if (roomsToSync.size === 0) {
        console.log('ℹ️  No rooms to sync');
    }
}

/**
 * Handle student document replacement
 */
async function handleStudentReplace(student, previousStudent) {
    if (!student) return;

    console.log(`🔁 Student replaced: ${student.rollNumber}`);

    // Treat replacement like an update with both old and new room
    const oldRoom = previousStudent?.room;
    const newRoom = student.room;

    const roomsToSync = new Set();

    if (oldRoom && oldRoom !== '') {
        roomsToSync.add(oldRoom);
    }

    if (newRoom && newRoom !== '' && student.is_active) {
        roomsToSync.add(newRoom);
    }

    for (const roomNumber of roomsToSync) {
        await roomSyncService.syncSingleRoom(roomNumber);
    }
}

/**
 * Handle student deletion
 */
async function handleStudentDelete(previousStudent, documentKey) {
    console.log(`🗑️  Student deleted: ${documentKey._id}`);

    // Sync the room the student was in (if any)
    if (previousStudent?.room) {
        console.log(`🏠 Syncing room after student deletion: ${previousStudent.room}`);
        await roomSyncService.syncSingleRoom(previousStudent.room);
    } else {
        console.log('ℹ️  Deleted student had no room assignment');
    }
}

/**
 * Check if change stream is active
 */
function isWatcherActive() {
    return changeStream !== null && !changeStream.closed;
}

module.exports = {
    startRoomChangeStreamWatcher,
    stopRoomChangeStreamWatcher,
    isWatcherActive
};
