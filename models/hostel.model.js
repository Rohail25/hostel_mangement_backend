// ===============================
// Hostel Model
// ===============================

const mongoose = require('mongoose');

const hostelSchema = new mongoose.Schema(
    {
        name: {
            type: String,
            required: [true, 'Hostel name is required'],
            trim: true
        },
        address: {
            street: { type: String, trim: true },
            city: { type: String, required: true, trim: true },
            state: { type: String, trim: true },
            country: { type: String, required: true, trim: true },
            zipCode: { type: String, trim: true }
        },
        description: {
            type: String,
            trim: true
        },
        totalFloors: {
            type: Number,
            default: 0,
            min: [0, 'Total floors cannot be negative']
        },
        totalRooms: {
            type: Number,
            default: 0,
            min: [0, 'Total rooms cannot be negative']
        },
        totalBeds: {
            type: Number,
            default: 0,
            min: [0, 'Total beds cannot be negative']
        },
        occupiedBeds: {
            type: Number,
            default: 0,
            min: [0, 'Occupied beds cannot be negative']
        },
        amenities: [{
            type: String,
            trim: true
        }],
        contactInfo: {
            phone: { type: String, trim: true },
            email: { type: String, trim: true, lowercase: true },
            emergencyContact: { type: String, trim: true }
        },
        operatingHours: {
            checkIn: { type: String, default: '12:00 PM' },
            checkOut: { type: String, default: '11:00 AM' }
        },
        status: {
            type: String,
            enum: ['active', 'inactive', 'under_maintenance'],
            default: 'active'
        },
        managedBy: {
            type: mongoose.Schema.Types.ObjectId,
            ref: 'User',
            default: null
        },
        owner: {
            type: mongoose.Schema.Types.ObjectId,
            ref: 'User',
            default: null
        },
        images: [{
            url: { type: String },
            caption: { type: String }
        }]
    },
    {
        timestamps: true
    }
);

// Indexes for better query performance
hostelSchema.index({ name: 1 });
hostelSchema.index({ status: 1 });
hostelSchema.index({ owner: 1 });
hostelSchema.index({ managedBy: 1 });
hostelSchema.index({ 'address.city': 1 });

module.exports = mongoose.model('Hostel', hostelSchema);


