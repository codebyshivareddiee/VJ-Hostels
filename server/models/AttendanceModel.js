const mongoose = require('mongoose');

const attendanceRecordSchema = new mongoose.Schema({
  studentId: { 
    type: mongoose.Schema.Types.ObjectId, 
    ref: 'Student', 
    required: true 
  },
  rollNumber: { 
    type: String, 
    required: true 
  },
  name: { 
    type: String, 
    required: true 
  },
  roomNumber: { 
    type: String, 
    required: true 
  },
  floor: { 
    type: Number, 
    required: true 
  },
  status: {
    type: String,
    enum: ['present', 'absent', 'home_pass_approved', 'home_pass_used', 'late_pass_approved', 'late_pass_used'],
    required: true
  },
  date: {
    type: Date,
    required: true
  },
  markedBy: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Guard',
    required: true
  },
  markedAt: {
    type: Date,
    default: Date.now
  },
  notes: {
    type: String,
    default: ''
  }
}, { timestamps: true });

// Compound index to ensure one attendance record per student per day
attendanceRecordSchema.index({ studentId: 1, date: 1 }, { unique: true });

// Index for efficient queries
attendanceRecordSchema.index({ date: 1, floor: 1 });
attendanceRecordSchema.index({ date: 1, roomNumber: 1 });

const AttendanceRecord = mongoose.model('AttendanceRecord', attendanceRecordSchema);

const attendanceMonthlySchema = new mongoose.Schema({
  student_id: { type: String, required: true },
  year: { type: Number, required: true },
  month: { type: Number, required: true },
  attendance: { type: Map, of: String },
  summary: {
    present: { type: Number, default: 0 },
    absent: { type: Number, default: 0 },
    home_pass: { type: Number, default: 0 }
  }
});

const AttendanceMonthly = mongoose.model('AttendanceMonthly', attendanceMonthlySchema);

module.exports = { AttendanceRecord, AttendanceMonthly };
