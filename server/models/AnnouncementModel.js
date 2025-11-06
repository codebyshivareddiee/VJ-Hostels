// import mongoose from 'mongoose';
const mongoose = require('mongoose');

const announcementSchema = new mongoose.Schema({
    title: {
        type: String,
        required: true
    },
    description: {
        type: String,
        required: true
    },
    // Optional image stored as binary data in MongoDB
    image: {
        data: Buffer,
        contentType: String
    },
    dateTime: {
        type: Date,
        default: Date.now
    }
}, { timestamps: true });

const AnnouncementModel = mongoose.model('Announcement', announcementSchema);

// export default AnnouncementModel;
module.exports=AnnouncementModel;
