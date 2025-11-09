// ===============================
// Bed Routes
// ===============================

const express = require('express');
const router = express.Router();
const {
    createBed,
    createMultipleBeds,
    getAllBeds,
    getBedsByRoom,
    getBedById,
    updateBed,
    updateBedStatus,
    deleteBed,
    getAvailableBeds
} = require('../../../controllers/api/bed.controller');
const { authenticate, authorize } = require('../../../middleware/auth.middleware');

// All routes require authentication and admin/manager role

// Create bed (Admin & Manager only)
router.post('/bed', authenticate, authorize('admin', 'manager', 'owner'), createBed);

// Create multiple beds at once (Admin & Manager only)
router.post('/beds/bulk', authenticate, authorize('admin', 'manager', 'owner'), createMultipleBeds);

// Get all beds (Admin & Manager only)
router.get('/beds', authenticate, authorize('admin', 'manager', 'owner'), getAllBeds);

// Get beds by room (Admin & Manager only)
router.get('/beds/room/:roomId', authenticate, authorize('admin', 'manager', 'owner'), getBedsByRoom);


// Get bed by ID (Admin & Manager only)
router.get('/bed/:id', authenticate, authorize('admin', 'manager', 'owner'), getBedById);

// Update bed (Admin & Manager only)
router.put('/bed/:id', authenticate, authorize('admin', 'manager', 'owner'), updateBed);

// Update bed status (Admin & Manager only)
router.patch('/bed/:id/status', authenticate, authorize('admin', 'manager', 'owner'), updateBedStatus);

// Delete bed (Admin only)
router.delete('/bed/:id', authenticate, authorize('admin', 'owner'), deleteBed);

module.exports = router;


