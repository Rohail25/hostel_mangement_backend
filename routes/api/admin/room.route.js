// ===============================
// Room Routes
// ===============================

const express = require('express');
const router = express.Router();
const {
    createRoom,
    getAllRooms,
    getRoomsByHostel,
    getRoomsByFloor,
    getRoomById,
    updateRoom,
    updateRoomStatus,
    scheduleMaintenance,
    deleteRoom
} = require('../../../controllers/api/room.controller');
const { authenticate, authorize } = require('../../../middleware/auth.middleware');

// All routes require authentication and admin/manager role

// Create room (Admin & Manager only)
router.post('/room', authenticate, authorize('admin', 'manager', 'owner'), createRoom);

// Get all rooms (Admin & Manager only)
router.get('/rooms', authenticate, authorize('admin', 'manager', 'owner'), getAllRooms);

// Get rooms by hostel (Admin & Manager only)
router.get('/room/hostel/:hostelId', authenticate, authorize('admin', 'manager', 'owner'), getRoomsByHostel);

// Get rooms by floor (Admin & Manager only)
router.get('/room/floor/:floorId', authenticate, authorize('admin', 'manager', 'owner'), getRoomsByFloor);

// Get room by ID (Admin & Manager only)
router.get('/room/:id', authenticate, authorize('admin', 'manager', 'owner'), getRoomById);

// Update room (Admin & Manager only)
router.put('/room/:id', authenticate, authorize('admin', 'manager', 'owner'), updateRoom);

// Update room status (Admin & Manager only)
router.put('/room/:id/status', authenticate, authorize('admin', 'manager', 'owner'), updateRoomStatus);

// Schedule maintenance (Admin & Manager only)
router.post('/rooms/:id/maintenance', authenticate, authorize('admin', 'manager', 'owner'), scheduleMaintenance);

// Delete room (Admin only)
router.delete('/room/:id', authenticate, authorize('admin', 'owner'), deleteRoom);

module.exports = router;


