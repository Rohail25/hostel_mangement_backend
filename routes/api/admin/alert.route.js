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
 * Base path: /api/admin/alerts
 * 
 * Note: Uncomment authentication middleware when ready
 * Use: authenticate, authorize(['admin', 'manager'])
 */

// ==================== ALERT STATISTICS ====================

/**
 * @route   GET /api/admin/alerts/stats
 * @desc    Get alert statistics (danger, warning, info counts, tab counts, etc.)
 * @access  Admin, Manager
 * @query   hostelId? - Filter by hostel ID
 * @query   type? - Filter by type (bill|maintenance) before counting
 * @returns { danger, warning, info, tabs: { bills, maintenance }, total, pending, overdue, ... }
 */
router.get('/alerts/stats', getAlertStats);

/**
 * @route   GET /api/admin/alerts/overdue
 * @desc    Get all overdue alerts (status not resolved and dueDate < now)
 * @access  Admin, Manager
 * @query   hostelId? - Filter by hostel ID
 * @query   page? - Page number (default: 1)
 * @query   limit? - Items per page (default: 20)
 * @returns { alerts: [], pagination: { total, page, limit, totalPages } }
 */
router.get('/alerts/overdue', getOverdueAlerts);

// ==================== ALERT CRUD OPERATIONS ====================

/**
 * @route   GET /api/admin/alerts
 * @desc    Get all alerts with filters, pagination, and sorting
 * @access  Admin, Manager
 * @query   type? - bill|maintenance|rent|payable|receivable (bill includes bill, rent, payable, receivable)
 * @query   status? - pending|in_progress|resolved|dismissed|open|closed
 * @query   priority? - low|medium|high|urgent
 * @query   severity? - DANGER|WARN|INFO (maps to priority)
 * @query   hostelId? - Filter by hostel ID
 * @query   roomId? - Filter by room ID
 * @query   tenantId? - Filter by tenant ID
 * @query   assignedTo? - Filter by assigned user ID
 * @query   maintenanceType? - room_cleaning|repairs|purchase_demand
 * @query   search? - Search in title, description, tenant name/email
 * @query   page? - Page number (default: 1)
 * @query   limit? - Items per page (default: 50)
 * @query   sortBy? - Field to sort by (default: createdAt)
 * @query   sortOrder? - asc|desc (default: desc)
 * @returns { alerts: [], pagination: { total, page, limit, totalPages } }
 */
router.get('/alerts', getAllAlerts);

/**
 * @route   POST /api/admin/alerts
 * @desc    Create a new alert
 * @access  Admin, Manager
 * @body    { type (required), title (required), severity?, priority?, description?, maintenanceType?, 
 *           hostelId?, roomId?, tenantId?, allocationId?, paymentId?, amount?, dueDate?, 
 *           assignedTo? (user ID or name string), metadata?, attachments?, remarks? }
 * @returns { id, type, severity, title, description, status, assignedTo, created, ... }
 */
router.post('/alerts', createAlert);

/**
 * @route   GET /api/admin/alerts/:id
 * @desc    Get single alert by ID with full details
 * @access  Admin, Manager
 * @params  id - Alert ID
 * @returns { id, type, severity, title, description, status, assignedTo, assignedUser, ... }
 */
router.get('/alerts/:id', getAlertById);

/**
 * @route   PUT /api/admin/alerts/:id
 * @desc    Update an alert
 * @access  Admin, Manager
 * @params  id - Alert ID
 * @body    { type?, status?, priority?, severity?, title?, description?, maintenanceType?, 
 *           hostelId?, roomId?, tenantId?, allocationId?, paymentId?, amount?, dueDate?, 
 *           assignedTo? (user ID or name string), metadata?, attachments?, remarks? }
 * @returns { id, type, severity, title, description, status, assignedTo, ... }
 */
router.put('/alerts/:id', updateAlert);

/**
 * @route   PUT /api/admin/alerts/:id/status
 * @desc    Update alert status (pending, in_progress, resolved, dismissed)
 * @access  Admin, Manager
 * @params  id - Alert ID
 * @body    { status (required), remarks? }
 * @returns { id, type, severity, title, description, status, ... }
 */
router.put('/alerts/:id/status', updateAlertStatus);

/**
 * @route   PUT /api/admin/alerts/:id/assign
 * @desc    Assign alert to a user (by user ID or name string)
 * @access  Admin, Manager
 * @params  id - Alert ID
 * @body    { assignedTo (required) - user ID (number) or name string (e.g., "David Kim") }
 * @returns { id, type, severity, title, description, status, assignedTo, assignedUser, ... }
 */
router.put('/alerts/:id/assign', assignAlert);

/**
 * @route   DELETE /api/admin/alerts/:id
 * @desc    Delete an alert
 * @access  Admin only
 * @params  id - Alert ID
 * @returns { success: true, message: "Alert deleted successfully" }
 */
router.delete('/alerts/:id', deleteAlert);

module.exports = router;

