// ===============================
// Bed Routes
// ===============================

const express = require('express');
const router = express.Router();
const {
    getAllBeds,
    getBedsByRoom,
    getBedById,
    getAvailableBeds
} = require('../../../controllers/api/bed.controller');
const { authenticate, authorize } = require('../../../middleware/auth.middleware');

// All routes require authentication and admin/manager role

// Get all beds (Admin & Manager only)
router.get('/beds', authenticate, getAllBeds);

// Get beds by room (Admin & Manager only)
router.get('/beds/room/:roomId', authenticate, getBedsByRoom);


// Get bed by ID (Admin & Manager only)
router.get('/bed/:id', authenticate, getBedById);


module.exports = router;


