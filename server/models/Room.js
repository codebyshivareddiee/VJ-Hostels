const mongoose = require('mongoose');

const roomSchema = new mongoose.Schema({
  roomNumber: { type: String, required: true, unique: true },
  floor: { type: Number, required: false }, // Made optional for backward compatibility with existing rooms
  capacity: { type: Number, required: true, default: 3 },
  occupants: [{ type: mongoose.Schema.Types.ObjectId, ref: 'Student' }],
  allocatedStudents: [{ type: mongoose.Schema.Types.ObjectId, ref: 'Student' }], // Alias for occupants
}, { timestamps: true });

// Virtual to keep backward compatibility
roomSchema.virtual('currentOccupancy').get(function() {
  return this.occupants.length;
});

// Ensure allocatedStudents stays in sync with occupants
roomSchema.pre('save', function(next) {
  this.allocatedStudents = this.occupants;
  next();
});

module.exports = mongoose.model('Room', roomSchema);
