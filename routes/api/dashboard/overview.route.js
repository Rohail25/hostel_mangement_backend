const express = require('express');
const router = express.Router();
const { getDashboardOverview } = require('../../../controllers/api/dashboard/overview.controller');
const { authenticate, authorize } = require('../../../middleware/auth.middleware');

// =================== DASHBOARD OVERVIEW ROUTE ===================

/**
 * @route   GET /api/admin/dashboard/overview
 * @desc    Get dashboard overview with statistics (cached)
 * @access  Admin, Manager
 * @query   hostelId (optional) - Filter by specific hostel
 * @returns Dashboard data including:
 *          - Occupancy statistics (occupied/vacant rates, growth)
 *          - Monthly revenue (current vs last month, growth)
 *          - Active tenants/vendors counts with growth
 *          - Open alerts and pending payments
 *          - Profit & Loss (last 3 months from FPA)
 *          - Rental applications (last 30 days)
 *          - Recent maintenance requests
 *          - Unpaid rent breakdown by age buckets
 *          - Recent payments
 */
router.get('/dashboard/overview', 
    authenticate, 
    authorize('admin', 'manager'),
    getDashboardOverview
);

module.exports = router;

