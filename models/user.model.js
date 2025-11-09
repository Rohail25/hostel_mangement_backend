// ===============================
// User Model (Mongoose Schema)
// ===============================

// Import required packages
const mongoose = require('mongoose');

// Define Role Enum — same as Prisma
const ROLE_ENUM = ['admin', 'owner', 'manager', 'staff', 'user'];

// Define User Schema
const userSchema = new mongoose.Schema(
  {
    name: {
      type: String,
      default: null,
    },
    email: {
      type: String,
      unique: true,
      sparse: true, // allows multiple nulls if needed
      default: null,
    },
    phone: {
      type: String,
      default: null,
    },
    password: {
      type: String,
      default: null,
    },
    status: {
      type: String,
      enum: ['active', 'inactive', 'suspended'],
      default: 'active',
    },
    role: {
      type: String,
      enum: ROLE_ENUM,
      default: 'user',
    },
  },
  {
    timestamps: true, // adds createdAt & updatedAt automatically
  }
);

// Export model
module.exports = mongoose.model('User', userSchema);
