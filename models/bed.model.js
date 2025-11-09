// ===============================
// Bed Model
// ===============================

const mongoose = require('mongoose');

const bedSchema = new mongoose.Schema(
    {
        hostel: {
            type: mongoose.Schema.Types.ObjectId,
            ref: 'Hostel',
            required: [true, 'Hostel reference is required']
        },
        floor: {
            type: mongoose.Schema.Types.ObjectId,
            ref: 'Floor',
            required: [true, 'Floor reference is required']
        },
        room: {
            type: mongoose.Schema.Types.ObjectId,
            ref: 'Room',
            required: [true, 'Room reference is required']
        },
        bedNumber: {
            type: String,
            required: [true, 'Bed number is required'],
            trim: true
        },
        bedType: {
            type: String,
            enum: ['single', 'bunk_upper', 'bunk_lower', 'double', 'queen', 'king'],
            default: 'single'
        },
        position: {
            x: { type: Number }, // X coordinate for floor plan
            y: { type: Number }  // Y coordinate for floor plan
        },
        status: {
            type: String,
            enum: ['available', 'occupied', 'reserved', 'under_maintenance'],
            default: 'available'
        },
        currentUser: {
            type: mongoose.Schema.Types.ObjectId,
            ref: 'User',
            default: null
        },
        reservedUser: {
            type: mongoose.Schema.Types.ObjectId,
            ref: 'User',
            default: null
        },
        reservationExpiry: {
            type: Date,
            default: null
        },
        condition: {
            type: String,
            enum: ['good', 'fair', 'needs_repair'],
            default: 'good'
        },
        notes: {
            type: String,
            trim: true
        }
    },
    {
        timestamps: true
    }
);

// Compound index to ensure unique bed number per room
bedSchema.index({ room: 1, bedNumber: 1 }, { unique: true });
bedSchema.index({ status: 1 });
bedSchema.index({ currentUser: 1 });

module.exports = mongoose.model('Bed', bedSchema);


