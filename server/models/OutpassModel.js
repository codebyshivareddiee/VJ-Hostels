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
    status: { 
        type: String, 
        enum: ['pending', 'approved', 'rejected', 'out', 'returned', 'late'], 
        default: 'pending' 
    },
    qrCodeData: { type: String }, // Unique QR code identifier
    actualOutTime: { type: Date }, // When student actually left (scanned out)
    actualInTime: { type: Date }, // When student actually returned (scanned in)
    approvedBy: { type: String }, // Admin who approved the outpass
    approvedAt: { type: Date }, // When the outpass was approved
    isLate: { type: Boolean, default: false }, // Whether the pass was regenerated after expiration
    regeneratedAt: { type: Date } // When the QR code was regenerated as late
}, { timestamps: true });

const Outpass = mongoose.model('Outpass', outpassSchema);

module.exports = Outpass;
