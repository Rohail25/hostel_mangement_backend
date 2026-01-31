// ===============================
// Mess Management Routes
// ===============================

const express = require('express');
const router = express.Router();
const {
    getMessEntriesByHostel,
    getMessEntryById,
    createMessEntry,
    updateMessEntry,
    deleteMessEntry,
    getMessStats
} = require('../../../controllers/api/mess.controller');
const { authenticate, authorize } = require('../../../middleware/auth.middleware');

// All routes require authentication and admin/manager/owner role

// Get all mess entries for a hostel
router.get('/mess/hostel/:hostelId', authenticate, authorize('admin', 'manager', 'owner'), getMessEntriesByHostel);

// Get mess stats for a hostel
router.get('/mess/hostel/:hostelId/stats', authenticate, authorize('admin', 'manager', 'owner'), getMessStats);

// Get mess entry by ID
router.get('/mess/:id', authenticate, authorize('admin', 'manager', 'owner'), getMessEntryById);

// Create mess entry
router.post('/mess', authenticate, authorize('admin', 'manager', 'owner'), createMessEntry);

// Update mess entry
router.put('/mess/:id', authenticate, authorize('admin', 'manager', 'owner'), updateMessEntry);

// Delete mess entry
router.delete('/mess/:id', authenticate, authorize('admin', 'manager', 'owner'), deleteMessEntry);

module.exports = router;
