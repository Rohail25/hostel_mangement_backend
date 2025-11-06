const express = require('express');
const router = express.Router();
const {
    createAlert,
    getAllAlerts,
    getAlertById,
    updateAlert,
    updateAlertStatus,
    assignAlert,
    deleteAlert,
    getAlertStats,
    getOverdueAlerts
} = require('../../../controllers/api/alert.controller');
// const { authenticate, authorize } = require('../../../middleware/auth.middleware');

/**
 * =====================================================
 * ALERT ROUTES - Complete Alert Management System
 * =====================================================
 * 
 * Note: Uncomment authentication middleware when ready
 * Use: authenticate, authorize(['admin', 'manager'])
 */

// Get alert statistics
router.get('/alerts/stats', getAlertStats);

// Get overdue alerts
router.get('/alerts/overdue', getOverdueAlerts);

// Get all alerts (with filters)
router.get('/alerts', getAllAlerts);

// Get single alert by ID
router.get('/alert/:id', getAlertById);

// Create new alert
router.post('/alerts', createAlert);

// Update alert
router.put('/alert/:id', updateAlert);

// Update alert status
router.put('/alert/:id/status', updateAlertStatus);

// Assign alert to user
router.put('/alert/:id/assign', assignAlert);

// Delete alert
router.delete('/alert/:id', deleteAlert);

module.exports = router;

