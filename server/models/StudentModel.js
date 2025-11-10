const mongoose = require('mongoose');
const bcrypt = require('bcrypt');


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

const StudentModel = mongoose.model('Student', studentSchema);

module.exports = StudentModel;
