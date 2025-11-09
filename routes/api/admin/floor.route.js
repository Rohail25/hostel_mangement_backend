// ===============================
// Floor Routes
// ===============================

const express = require('express');
const router = express.Router();
const {
    createFloor,
    getAllFloors,
    getFloorsByHostel,
    getFloorById,
    updateFloor,
    deleteFloor
} = require('../../../controllers/api/floor.controller');
const { authenticate, authorize } = require('../../../middleware/auth.middleware');

// All routes require authentication and admin/manager role

// Create floor (Admin & Manager only)
router.post('/floor', authenticate, authorize('admin', 'manager', 'owner'), createFloor);

// Get all floors (Admin & Manager only)
router.get('/floors', authenticate, authorize('admin', 'manager', 'owner'), getAllFloors);

// Get floors by hostel (Admin & Manager only)
router.get('/floors/hostel/:hostelId', authenticate, authorize('admin', 'manager', 'owner'), getFloorsByHostel);

// Get floor by ID (Admin & Manager only)
router.get('/floor/:id', authenticate, authorize('admin', 'manager', 'owner'), getFloorById);

// Update floor (Admin & Manager only)
router.put('/floor/:id', authenticate, authorize('admin', 'manager', 'owner'), updateFloor);

// Delete floor (Admin only)
router.delete('/floor/:id', authenticate, authorize('admin', 'owner'), deleteFloor);

module.exports = router;


