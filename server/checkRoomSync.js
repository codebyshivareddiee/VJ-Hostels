const mongoose = require('mongoose');
const Student = require('./models/StudentModel');
const Room = require('./models/Room');
require('dotenv').config();

async function checkRoomSync() {
  try {
    await mongoose.connect(process.env.MONGODB_URL);
    console.log('✅ Connected to DB\n');
    
    // Get all students with room field
    const students = await Student.find({ 
      room: { $exists: true, $ne: null, $ne: '' },
      is_active: true 
    }).select('rollNumber name room');
    
    console.log(`📊 Total students with rooms: ${students.length}\n`);
    
    // Group by floor
    const byFloor = {};
    students.forEach(s => {
      const room = s.room.toString();
      let floor;
      if (room === '001') floor = 0;
      else if (room.length === 4 && room.startsWith('1')) floor = parseInt(room.substring(0, 2));
      else floor = parseInt(room.charAt(0));
      
      if (!byFloor[floor]) byFloor[floor] = [];
      byFloor[floor].push(s);
    });
    
    console.log('👥 Students by floor:');
    Object.keys(byFloor).sort((a,b) => Number(a)-Number(b)).forEach(floor => {
      console.log(`   Floor ${floor}: ${byFloor[floor].length} students`);
    });
    
    // Get unique room numbers from students
    const uniqueRooms = [...new Set(students.map(s => s.room))];
    console.log(`\n🏠 Total unique rooms in student data: ${uniqueRooms.length}`);
    console.log('   Sample room numbers:', uniqueRooms.slice(0, 20).sort());
    
    // Check rooms in Room collection
    const rooms = await Room.find();
    console.log(`\n🏢 Total rooms in Room collection: ${rooms.length}`);
    
    const roomsWithOccupants = await Room.find({ occupants: { $exists: true, $ne: [] } });
    console.log(`   Rooms with occupants: ${roomsWithOccupants.length}`);
    
    // Check which rooms have occupants by floor
    const roomsByFloor = {};
    for (const room of roomsWithOccupants) {
      const floor = room.floor || 0;
      if (!roomsByFloor[floor]) roomsByFloor[floor] = [];
      roomsByFloor[floor].push(room);
    }
    
    console.log('\n🏠 Rooms with occupants by floor:');
    Object.keys(roomsByFloor).sort((a,b) => Number(a)-Number(b)).forEach(floor => {
      const totalOccupants = roomsByFloor[floor].reduce((sum, r) => sum + r.occupants.length, 0);
      console.log(`   Floor ${floor}: ${roomsByFloor[floor].length} rooms with ${totalOccupants} occupants`);
    });
    
    // Find missing rooms
    const roomNumbersInDB = new Set(rooms.map(r => r.roomNumber));
    const missingRooms = uniqueRooms.filter(r => !roomNumbersInDB.has(r));
    
    if (missingRooms.length > 0) {
      console.log(`\n⚠️  Missing rooms (exist in student data but not in Room collection): ${missingRooms.length}`);
      console.log('   Sample missing rooms:', missingRooms.slice(0, 10));
    }
    
    // Check for rooms that should have students but don't
    const roomsWithStudentsAssigned = new Set(students.map(s => s.room));
    const emptyRoomsThatShouldHaveStudents = [];
    
    for (const roomNum of roomsWithStudentsAssigned) {
      const room = await Room.findOne({ roomNumber: roomNum });
      if (room && room.occupants.length === 0) {
        emptyRoomsThatShouldHaveStudents.push(roomNum);
      }
    }
    
    if (emptyRoomsThatShouldHaveStudents.length > 0) {
      console.log(`\n❌ Rooms that should have students but are empty: ${emptyRoomsThatShouldHaveStudents.length}`);
      console.log('   Sample:', emptyRoomsThatShouldHaveStudents.slice(0, 10));
    }
    
    process.exit(0);
  } catch (err) {
    console.error('❌ Error:', err);
    process.exit(1);
  }
}

checkRoomSync();
