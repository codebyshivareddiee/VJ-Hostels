const mongoose = require('mongoose');

const outpassSchema = new mongoose.Schema({
    name: { type: String, required: true },
    rollNumber: { type: String, required: true },
    outTime: { type: Date, required: true },
    inTime: { type: Date, required: true },
    reason: { type: String, required: true },
    type: {
        type: String,
        enum: ['late pass', 'home pass'],
        required: true
    },
    studentMobileNumber: { type: String, required: true },
    parentMobileNumber: { type: String, required: true },
    month: { type: Number, required: true },
    year: { type: Number, required: true },
    studentYear: { type: String },
    status: { 
        type: String, 
        enum: ['pending', 'pending_parent_approval', 'pending_admin_approval', 'approved', 'rejected', 'out', 'returned', 'late'], 
        default: 'pending' 
    },
    
    // ===== PARENT APPROVAL FLOW =====
    parentApproval: {
        status: {
            type: String,
            enum: ['pending', 'approved', 'rejected'],
            default: 'pending'
        },
        otp: { type: String }, // 6-digit OTP sent to parent
        otpExpiry: { type: Date }, // OTP expiration time (5 minutes)
        otpAttempts: { type: Number, default: 0 }, // Failed OTP attempts
        maxOtpAttempts: { type: Number, default: 5 }, // Max attempts allowed
        approvedAt: { type: Date }, // When parent approved
        rejectedAt: { type: Date }, // When parent rejected
        rejectionReason: { type: String } // Why parent rejected
    },
    
    // ===== ADMIN APPROVAL FLOW =====
    adminApproval: {
        status: {
            type: String,
            enum: ['pending', 'approved', 'rejected'],
            default: 'pending'
        },
        approvedBy: { type: String }, // Admin ID/email who approved
        approvedAt: { type: Date }, // When admin approved
        rejectedBy: { type: String }, // Admin ID/email who rejected
        rejectedAt: { type: Date }, // When admin rejected
        rejectionReason: { type: String }, // Why admin rejected
        remarks: { type: String } // Admin remarks
    },
    
    // ===== QR CODE & TRACKING =====
    qrCodeData: { type: String }, // Unique QR code identifier (generated after admin approval)
    actualOutTime: { type: Date }, // When student actually left (scanned out)
    actualInTime: { type: Date }, // When student actually returned (scanned in)
    isLate: { type: Boolean, default: false }, // Whether the pass was regenerated after expiration
    regeneratedAt: { type: Date } // When the QR code was regenerated as late
}, { timestamps: true });

const Outpass = mongoose.model('Outpass', outpassSchema);

module.exports = Outpass;