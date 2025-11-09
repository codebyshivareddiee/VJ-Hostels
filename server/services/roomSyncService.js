const Room = require('../models/Room');
const Student = require('../models/StudentModel');

/**
 * Extract floor number from room number
 * Examples: 001 -> 0, 101 -> 1, 939 -> 9, 1001 -> 10, 1201 -> 12
 */
function extractFloorNumber(roomNumber) {
    const roomStr = roomNumber.toString();
    
    // Special case for room 001 (ground floor or special room)
    if (roomStr === '001') {
        return 0;
    }
    
    // For rooms 1001-1239 (floors 10-12) - 4 digit room numbers starting with 1
    if (roomStr.length === 4 && roomStr.startsWith('1')) {
        return parseInt(roomStr.substring(0, 2));
    }
    
    // For rooms 101-939 (floors 1-9) - 3 digit room numbers
    if (roomStr.length === 3) {
        return parseInt(roomStr.charAt(0));
    }
    
    // Default fallback - extract first digit
    return parseInt(roomStr.charAt(0)) || 1;
}

/**
 * Generate all hostel rooms based on the floor and room numbering pattern
 * 12 floors × 39 rooms per floor + 1 extra room (001) = 469 total rooms
 */
async function generateAllRooms() {
    const TOTAL_FLOORS = 12;
    const ROOMS_PER_FLOOR = 39;
    const DEFAULT_CAPACITY = 3;
    
    const roomsToCreate = [];
    const existingRoomNumbers = new Set();
    
    // Get all existing rooms
    const existingRooms = await Room.find({}, 'roomNumber');
    existingRooms.forEach(room => existingRoomNumbers.add(room.roomNumber));
    
    // Create room 001 if it doesn't exist (special extra room)
    if (!existingRoomNumbers.has('001')) {
        roomsToCreate.push({
            roomNumber: '001',
            floor: 0, // Ground floor or special designation
            capacity: DEFAULT_CAPACITY,
            occupants: [],
            allocatedStudents: []
        });
    }
    
    // Generate room numbers for all floors
    for (let floor = 1; floor <= TOTAL_FLOORS; floor++) {
        for (let roomNum = 1; roomNum <= ROOMS_PER_FLOOR; roomNum++) {
            let roomNumber;
            
            // Room numbering pattern
            if (floor < 10) {
                // Floors 1-9: 101-139, 201-239, ..., 901-939
                roomNumber = `${floor}${roomNum.toString().padStart(2, '0')}`;
            } else {
                // Floors 10-12: 1001-1039, 1101-1139, 1201-1239
                roomNumber = `${floor}${roomNum.toString().padStart(2, '0')}`;
            }
            
            // Only create if room doesn't exist
            if (!existingRoomNumbers.has(roomNumber)) {
                roomsToCreate.push({
                    roomNumber,
                    floor,
                    capacity: DEFAULT_CAPACITY,
                    occupants: [],
                    allocatedStudents: []
                });
            }
        }
    }
    
    // Bulk insert new rooms
    if (roomsToCreate.length > 0) {
        await Room.insertMany(roomsToCreate);
        console.log(`✅ Created ${roomsToCreate.length} new rooms`);
    } else {
        console.log('ℹ️ All rooms already exist');
    }
    
    return {
        created: roomsToCreate.length,
        total: (TOTAL_FLOORS * ROOMS_PER_FLOOR) + 1 // +1 for room 001
    };
}

/**
 * Sync students to their rooms based on room field in student collection
 * Works with existing pre-generated rooms
 */
async function syncStudentsToRooms() {
    try {
        // Get all students with room numbers (active students only)
        // Note: Students have 'room' field, not 'roomNumber'
        const studentsWithRooms = await Student.find({
            room: { $exists: true, $ne: null, $ne: '' },
            is_active: true
        });
        
        console.log(`📊 Found ${studentsWithRooms.length} active students with room assignments`);
        
        // Extract unique room numbers from students (filter out null/invalid values)
        const uniqueRoomNumbers = [...new Set(
            studentsWithRooms
                .map(s => s.room)
                .filter(room => room && room !== null && room !== '')
        )];
        console.log(`🏠 Unique room numbers in student data: ${uniqueRoomNumbers.length}`);
        
        // Check for missing rooms and create them if needed
        const createdRooms = [];
        for (const roomNumber of uniqueRoomNumbers) {
            const existingRoom = await Room.findOne({ roomNumber });
            
            if (!existingRoom) {
                const floor = extractFloorNumber(roomNumber);
                const newRoom = await Room.create({
                    roomNumber,
                    floor,
                    capacity: 3,
                    occupants: [],
                    allocatedStudents: []
                });
                createdRooms.push(newRoom);
                console.log(`✨ Created missing room ${roomNumber} from student data`);
            }
        }
        
        // Clear all room occupants first (to avoid duplicates and ensure clean sync)
        await Room.updateMany({}, { $set: { occupants: [], allocatedStudents: [] } });
        console.log('🧹 Cleared all room occupants for fresh sync');
        
        // Group students by room number
        const studentsByRoom = {};
        const capacityWarnings = [];
        
        studentsWithRooms.forEach(student => {
            // Safety check: ensure room is valid
            if (!student.room || student.room === null || student.room === '') {
                console.warn(`⚠️  Student ${student.rollNumber} has invalid room assignment, skipping...`);
                return;
            }
            
            const roomKey = student.room.toString();
            if (!studentsByRoom[roomKey]) {
                studentsByRoom[roomKey] = [];
            }
            studentsByRoom[roomKey].push(student._id);
        });
        
        // Update each room with its students and check capacity
        let updatedRooms = 0;
        let studentsAllocated = 0;
        
        for (const [roomNumber, studentIds] of Object.entries(studentsByRoom)) {
            const room = await Room.findOne({ roomNumber });
            
            if (!room) {
                console.warn(`⚠️ Room ${roomNumber} not found, skipping ${studentIds.length} students`);
                continue;
            }
            
            // Check capacity
            if (studentIds.length > room.capacity) {
                capacityWarnings.push({
                    roomNumber,
                    allocated: studentIds.length,
                    capacity: room.capacity
                });
                console.warn(`⚠️ Room ${roomNumber} has ${studentIds.length} students but capacity is ${room.capacity}`);
            }
            
            // Update room with students (even if over capacity - admin can fix later)
            await Room.findOneAndUpdate(
                { roomNumber },
                { 
                    $set: { 
                        occupants: studentIds,
                        allocatedStudents: studentIds
                    } 
                }
            );
            
            updatedRooms++;
            studentsAllocated += studentIds.length;
        }
        
        console.log(`✅ Updated ${updatedRooms} rooms with ${studentsAllocated} student allocations`);
        
        if (capacityWarnings.length > 0) {
            console.warn(`⚠️ ${capacityWarnings.length} rooms exceed capacity`);
        }
        
        return {
            studentsProcessed: studentsWithRooms.length,
            roomsCreated: createdRooms.length,
            roomsUpdated: updatedRooms,
            uniqueRooms: uniqueRoomNumbers.length,
            capacityWarnings: capacityWarnings.length > 0 ? capacityWarnings : undefined
        };
    } catch (error) {
        console.error('❌ Error syncing students to rooms:', error);
        throw error;
    }
}

/**
 * Get all rooms with their allocated students (populated)
 */
async function getAllRoomsWithStudents() {
    try {
        const rooms = await Room.find()
            .populate('occupants', 'name rollNumber branch year phoneNumber email parentMobileNumber')
            .sort({ roomNumber: 1 });
        
        // Add computed fields
        const roomsWithDetails = rooms.map(room => ({
            ...room.toObject(),
            floor: room.floor,
            currentOccupancy: room.occupants.length,
            availableBeds: room.capacity - room.occupants.length,
            isFullyOccupied: room.occupants.length >= room.capacity,
            isVacant: room.occupants.length === 0
        }));
        
        return roomsWithDetails;
    } catch (error) {
        console.error('❌ Error fetching rooms with students:', error);
        throw error;
    }
}

/**
 * Get rooms grouped by floor
 */
async function getRoomsByFloor() {
    try {
        const rooms = await getAllRoomsWithStudents();
        
        // Group by floor
        const roomsByFloor = {};
        rooms.forEach(room => {
            if (!roomsByFloor[room.floor]) {
                roomsByFloor[room.floor] = [];
            }
            roomsByFloor[room.floor].push(room);
        });
        
        return roomsByFloor;
    } catch (error) {
        console.error('❌ Error grouping rooms by floor:', error);
        throw error;
    }
}

/**
 * Get statistics about room occupancy
 */
async function getRoomStatistics() {
    try {
        const rooms = await Room.find();
        
        const stats = {
            totalRooms: rooms.length,
            totalCapacity: rooms.reduce((sum, room) => sum + room.capacity, 0),
            totalOccupied: rooms.reduce((sum, room) => sum + room.occupants.length, 0),
            fullyOccupiedRooms: rooms.filter(r => r.occupants.length >= r.capacity).length,
            partiallyOccupiedRooms: rooms.filter(r => r.occupants.length > 0 && r.occupants.length < r.capacity).length,
            vacantRooms: rooms.filter(r => r.occupants.length === 0).length,
            occupancyRate: 0
        };
        
        stats.occupancyRate = stats.totalCapacity > 0 
            ? ((stats.totalOccupied / stats.totalCapacity) * 100).toFixed(2)
            : 0;
        
        return stats;
    } catch (error) {
        console.error('❌ Error calculating room statistics:', error);
        throw error;
    }
}

/**
 * Sync a single room with its current students (for automatic syncing)
 * This is much faster than syncing all rooms and should be used after individual operations
 */
async function syncSingleRoom(roomNumber) {
    try {
        if (!roomNumber || roomNumber === '') {
            console.warn('⚠️  No room number provided for single room sync');
            return { success: false, message: 'No room number provided' };
        }

        console.log(`🔄 Syncing single room: ${roomNumber}`);

        // Find all active students assigned to this room
        const students = await Student.find({
            room: roomNumber,
            is_active: true
        }).select('_id rollNumber name');

        // Find or create the room
        let room = await Room.findOne({ roomNumber });
        
        if (!room) {
            // Create room if it doesn't exist
            const floor = extractFloorNumber(roomNumber);
            room = new Room({
                roomNumber,
                floor,
                capacity: 3,
                occupants: [],
                allocatedStudents: []
            });
            console.log(`✨ Created new room ${roomNumber} during sync`);
        }

        // Update room with current students
        const studentIds = students.map(s => s._id);
        room.occupants = studentIds;
        room.allocatedStudents = studentIds;
        
        await room.save();
        
        console.log(`✅ Room ${roomNumber} synced: ${studentIds.length} students`);
        
        return {
            success: true,
            roomNumber,
            studentCount: studentIds.length,
            students: students.map(s => ({ id: s._id, rollNumber: s.rollNumber, name: s.name }))
        };
    } catch (error) {
        console.error(`❌ Error syncing room ${roomNumber}:`, error);
        throw error;
    }
}

module.exports = {
    generateAllRooms,
    syncStudentsToRooms,
    syncSingleRoom,  // NEW: For automatic syncing after individual operations
    getAllRoomsWithStudents,
    getRoomsByFloor,
    getRoomStatistics,
    extractFloorNumber
};
