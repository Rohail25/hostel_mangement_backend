const express = require('express');
const router = express.Router();
const { getDashboardStats } = require('../../../controllers/api/dashboard.controller');
const { authenticate, authorize } = require('../../../middleware/auth.middleware');

// =================== DASHBOARD ROUTE ===================

/**
 * @route   GET /api/admin/dashboard
 * @desc    Get comprehensive dashboard statistics
 * @access  Admin, Manager
 * @returns Dashboard data including:
 *          - Tenant statistics (total, active, inactive, blacklisted)
 *          - Payment statistics (pending, paid, partial, overdue)
 *          - Transaction statistics (by status and gateway)
 *          - Employee statistics (by role and status)
 *          - Room statistics (occupancy, beds, by type)
 *          - Booking statistics
 *          - Hostel statistics
 *          - Allocation statistics
 *          - Financial summary
 */
router.get('/dashboard', 
    authenticate, 
    authorize('admin', 'manager'),
    getDashboardStats
);

module.exports = router;

