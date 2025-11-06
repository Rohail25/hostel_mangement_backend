const express = require('express');
const router = express.Router();
const {
    listAlerts,
    getAlertsSummary,
    getAlertsTabs,
    getAlertById,
    createAlert,
    updateAlert,
    updateAlertStatus,
    assignAlert,
    deleteAlert
} = require('../../../controllers/api/alerts/alerts.controller');
// const { authenticate, authorize } = require('../../../middleware/auth.middleware');

/**
 * =====================================================
 * ALERTS ROUTES - Dashboard Alerts Management
 * =====================================================
 * 
 * Note: Uncomment authentication middleware when ready
 * Use: authenticate, authorize(['admin', 'manager'])
 */

// Dashboard endpoints
router.get('/alerts/list', listAlerts); // List alerts for dashboard table
router.get('/alerts/summary', getAlertsSummary); // Get summary cards (Danger, Warning, Info)
router.get('/alerts/tabs', getAlertsTabs); // Get tab counts (Bills, Maintenance)

// Alert management endpoints
router.get('/alerts/:id', getAlertById); // Get single alert by ID
router.post('/alerts', createAlert); // Create new alert
router.put('/alerts/:id', updateAlert); // Update alert
router.put('/alerts/:id/status', updateAlertStatus); // Update alert status
router.put('/alerts/:id/assign', assignAlert); // Assign alert to user
router.delete('/alerts/:id', deleteAlert); // Delete alert

module.exports = router;

