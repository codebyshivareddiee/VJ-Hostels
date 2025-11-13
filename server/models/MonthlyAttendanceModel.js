const mongoose = require('mongoose');

const monthlyAttendanceSchema = new mongoose.Schema({
  student_id: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Student',
    required: true
  },
  year: {
    type: Number,
    required: true
  },
  month: {
    type: Number, // 1-12
    required: true,
    min: 1,
    max: 12
  },
  attendance: {
    type: Map,
    of: {
      type: String,
      enum: ['P', 'A', 'H'],
      default: 'A' // Default to absent if not marked
    },
    default: {}
  },
  summary: {
    present: {
      type: Number,
      default: 0,
      min: 0
    },
    absent: {
      type: Number,
      default: 0,
      min: 0
    },
    home_pass: {
      type: Number,
      default: 0,
      min: 0
    }
  }
}, { timestamps: true });

// Compound index for fast lookups
monthlyAttendanceSchema.index({ student_id: 1, year: 1, month: 1 }, { unique: true });

// Pre-save hook to ensure summary is always in sync
monthlyAttendanceSchema.pre('save', function(next) {
  // Reset all counts
  this.summary = { present: 0, absent: 0, home_pass: 0 };
  
  // Count each status
  for (const [day, status] of this.attendance) {
    if (status === 'P') this.summary.present++;
    else if (status === 'A') this.summary.absent++;
    else if (status === 'H') this.summary.home_pass++;
  }
  
  next();
});

// Static method to ensure a monthly attendance document exists
monthlyAttendanceSchema.statics.ensureExists = async function(studentId, year, month) {
  let doc = await this.findOne({ student_id: studentId, year, month });
  
  if (!doc) {
    doc = new this({
      student_id: studentId,
      year,
      month,
      attendance: {},
      summary: { present: 0, absent: 0, home_pass: 0 }
    });
    await doc.save();
  }
  
  return doc;
};

// Method to update attendance for a specific day
monthlyAttendanceSchema.methods.updateDay = async function(day, status) {
  // Validate day
  const dayNum = parseInt(day);
  if (isNaN(dayNum) || dayNum < 1 || dayNum > 31) {
    throw new Error('Day must be between 1 and 31');
  }
  
  // Get previous status if it exists
  const prevStatus = this.attendance.get(day) || 'A'; // Default to absent if not set
  
  // Update the attendance map
  this.attendance.set(day, status);
  
  // No need to manually update summary - the pre-save hook will handle it
  
  return this.save();
};

const MonthlyAttendance = mongoose.model('MonthlyAttendance', monthlyAttendanceSchema);

module.exports = MonthlyAttendance;
