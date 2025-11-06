require('dotenv').config();
const mongoose = require('mongoose');
const { adminUsers, studentUsers, securityUsers } = require('./users');
const AdminModel = require('../models/AdminModel');
const StudentModel = require('../models/StudentModel');
const GuardModel = require('../models/GuardModel');

const importData = async () => {
    try {
        await mongoose.connect(process.env.DBURL);
        console.log('Connected to MongoDB');

        // Clear existing data
        await AdminModel.deleteMany({});
        console.log('Cleared existing users');

        // Insert admin users
        for (const admin of adminUsers) {
            await AdminModel.create(admin);
        }
        console.log('Admin users imported successfully');

        // Clear and Insert student users
        await StudentModel.deleteMany({});
        for (const student of studentUsers) {
            await StudentModel.create(student);
        }
        console.log('Student users imported successfully');

        // Clear and Insert security users
        await GuardModel.deleteMany({});
        for (const guard of securityUsers) {
            await GuardModel.create(guard);
        }
        console.log('Security users imported successfully');

        console.log('All data imported successfully!');
        process.exit(0);
    } catch (error) {
        console.error('Error importing data:', error);
        process.exit(1);
    }
};

importData();