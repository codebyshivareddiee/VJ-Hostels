const mongoose = require('mongoose');
const Student = require('./models/StudentModel');
const Room = require('./models/Room');
require('dotenv').config();

/**
 * Extract floor number from room number
 */
function extractFloorNumber(roomNumber) {
    const roomStr = roomNumber.toString();
    
    // Special case for room 001 (ground floor or special room)
    if (roomStr === '001') {
        return 0;
    }
    
    // For rooms 1001-1239 (floors 10-12)
    if (roomStr.length === 4 && roomStr.startsWith('1')) {
        return parseInt(roomStr.substring(0, 2));
    }
    
    // For rooms 101-939 (floors 1-9)
    if (roomStr.length === 3) {
        return parseInt(roomStr.charAt(0));
    }
    
    // Default fallback
    return 1;
}

async function fixRoomSync() {
  try {
    console.log('🔄 Starting room sync fix...\n');
    
    await mongoose.connect(process.env.MONGODB_URL);
    console.log('✅ Connected to DB\n');
    
    // Step 1: Get all students with room assignments
    const students = await Student.find({ 
      room: { $exists: true, $ne: null, $ne: '' },
      is_active: true 
    }).select('_id rollNumber name room');
    
    console.log(`📊 Found ${students.length} active students with room assignments\n`);
    
    // Step 2: Get unique room numbers
    const uniqueRoomNumbers = [...new Set(students.map(s => s.room))];
    console.log(`🏠 Unique room numbers: ${uniqueRoomNumbers.length}\n`);
    
    // Step 3: Create missing rooms
    let roomsCreated = 0;
    for (const roomNumber of uniqueRoomNumbers) {
      const existingRoom = await Room.findOne({ roomNumber });
      
      if (!existingRoom) {
        const floor = extractFloorNumber(roomNumber);
        await Room.create({
          roomNumber,
          floor,
          capacity: 3,
          occupants: [],
          allocatedStudents: []
        });
        roomsCreated++;
        console.log(`✨ Created missing room ${roomNumber} (Floor ${floor})`);
      }
    }
    
    if (roomsCreated > 0) {
      console.log(`\n✅ Created ${roomsCreated} missing rooms\n`);
    } else {
      console.log('ℹ️  All rooms already exist\n');
    }
    
    // Step 4: Clear all room occupants
    await Room.updateMany({}, { $set: { occupants: [], allocatedStudents: [] } });
    console.log('🧹 Cleared all room occupants for fresh sync\n');
    
    // Step 5: Group students by room
    const studentsByRoom = {};
    students.forEach(student => {
      if (!studentsByRoom[student.room]) {
        studentsByRoom[student.room] = [];
      }
      studentsByRoom[student.room].push(student._id);
    });
    
    // Step 6: Update each room with its students
    let roomsUpdated = 0;
    let studentsAllocated = 0;
    const capacityWarnings = [];
    
    for (const [roomNumber, studentIds] of Object.entries(studentsByRoom)) {
      const room = await Room.findOne({ roomNumber });
      
      if (!room) {
        console.warn(`⚠️  Room ${roomNumber} not found, skipping ${studentIds.length} students`);
        continue;
      }
      
      // Check capacity
      if (studentIds.length > room.capacity) {
        capacityWarnings.push({
          roomNumber,
          allocated: studentIds.length,
          capacity: room.capacity
        });
      }
      
      // Update room with students
      await Room.findOneAndUpdate(
        { roomNumber },
        { 
          $set: { 
            occupants: studentIds,
            allocatedStudents: studentIds
          } 
        }
      );
      
      roomsUpdated++;
      studentsAllocated += studentIds.length;
    }
    
    console.log(`✅ Updated ${roomsUpdated} rooms with ${studentsAllocated} student allocations\n`);
    
    // Step 7: Verify by floor
    console.log('📊 Verification by floor:');
    const roomsWithOccupants = await Room.find({ occupants: { $exists: true, $ne: [] } });
    
    const byFloor = {};
    for (const room of roomsWithOccupants) {
      const floor = room.floor || 0;
      if (!byFloor[floor]) {
        byFloor[floor] = { rooms: 0, students: 0 };
      }
      byFloor[floor].rooms++;
      byFloor[floor].students += room.occupants.length;
    }
    
    Object.keys(byFloor).sort((a,b) => Number(a)-Number(b)).forEach(floor => {
      console.log(`   Floor ${floor}: ${byFloor[floor].rooms} rooms with ${byFloor[floor].students} students`);
    });
    
    if (capacityWarnings.length > 0) {
      console.log(`\n⚠️  ${capacityWarnings.length} rooms exceed capacity:`);
      capacityWarnings.forEach(w => {
        console.log(`   Room ${w.roomNumber}: ${w.allocated} students / ${w.capacity} capacity`);
      });
    }
    
    console.log('\n✅ Room sync completed successfully!');
    process.exit(0);
  } catch (err) {
    console.error('❌ Error:', err);
    process.exit(1);
  }
}

fixRoomSync();
