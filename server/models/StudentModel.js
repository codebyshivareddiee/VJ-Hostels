const mongoose = require('mongoose');
const bcrypt = require('bcrypt');
const MonthlyAttendance = require('./MonthlyAttendanceModel');


const studentSchema = new mongoose.Schema({
    googleId: { 
        type: String, 
        unique: true, 
        sparse: true },
    rollNumber: {
        type: String,
        required: true,
        unique: true
    },
    year: {
        type: String,
        required: true
    },
    username: {
        type: String,
        // required: true,
        unique: true
    },
    phoneNumber: {
        type: String,
        // required: true
    },
    parentMobileNumber: {
        type: String,
        // required: true
    },
    parentName: {
        type: String,
        required: true
    },
    password: {
        type: String,
        required: function () {
    return !this.googleId;  // only required if no Google login
  }
    },
    name: {
        type: String,
        required: true
    },
    email: {
        type: String,
        required: true,
        unique: true
    },
    branch: {
        type: String,
        required: true
    },
    role: {
        type: String,
        default: 'student'
    },
    is_active: {
        type: Boolean,
        default: true
    },
    isBookmarked: {
        type: Boolean,
        default: false
    },
    room: {
        type: String,
        default: null
    },
    fcmToken: {
        type: String,
        default: null
    },
    backupContacts: [{
        name: {
            type: String,
            required: true,
            trim: true
        },
        phone: {
            type: String,
            required: true,
            trim: true
        }
    }],
    whitelist: [{
        name: {
            type: String,
            required: true,
            trim: true
        },
        phone: {
            type: String,
            required: true,
            trim: true
        }
    }],
    autoApproveParents: {
        type: Boolean,
        default: false
    },
    preferences: {
        allowVisitorsOutOfHours: {
            type: Boolean,
            default: false
        },
        requirePhotoVerification: {
            type: Boolean,
            default: true
        },
        maxVisitorsPerDay: {
            type: Number,
            default: 5
        }
    }
}, { timestamps: true });

// Hash password before saving
studentSchema.pre('save', async function (next) {
    if (!this.isModified('password')) return next();
    this.password = await bcrypt.hash(this.password, 10);
    next();
});

// Method to compare password
studentSchema.methods.comparePassword = async function(candidatePassword) {
    return await bcrypt.compare(candidatePassword, this.password);
};

// Post-save hook to create monthly attendance record for new students
studentSchema.post('save', async function(doc, next) {
  try {
    const now = new Date();
    const year = now.getFullYear();
    const month = now.getMonth() + 1; // 1-12
    
    // Check if a record already exists for this student, year, and month
    const existingRecord = await MonthlyAttendance.findOne({
      student_id: doc._id,
      year: year,
      month: month
    });
    
    if (!existingRecord) {
      await MonthlyAttendance.create({
        student_id: doc._id,
        year: year,
        month: month,
        attendance: {},
        summary: { present: 0, absent: 0, home_pass: 0 }
      });
      console.log(`Created monthly attendance record for student ${doc._id}`);
    }
  } catch (error) {
    console.error('Error creating monthly attendance record:', error);
    // Don't throw error to prevent student creation from failing
  }
  next();
});

const StudentModel = mongoose.model('Student', studentSchema);

module.exports = StudentModel;
