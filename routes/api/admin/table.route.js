const express = require('express');
const router = express.Router();
const tableController = require('../../../controllers/api/table.controller');
const { authenticate, authorize } = require('../../../middleware/auth.middleware');

// =================== TABLE ROUTES ===================

// Apply authentication to all routes
router.use('/table', authenticate);

/**
 * @route   GET /api/admin/table/tenants
 * @desc    Get all tenants with relevant data in table format
 * @access  Admin, Manager, Staff
 * @query   status, search, page, limit, sortBy, sortOrder
 * @returns Paginated list of tenants with allocations, payments, transactions
 */
router.get('/table/tenants',
    authorize('admin', 'manager', 'staff'),
    tableController.getAllTenantsTable
);

/**
 * @route   GET /api/admin/table/staff
 * @desc    Get all staff members with relevant data
 * @access  Admin, Manager
 * @query   status, department, search, page, limit, sortBy, sortOrder
 * @returns Paginated list of staff members
 */
router.get('/table/staff',
    authorize('admin', 'manager'),
    tableController.getAllStaffTable
);

/**
 * @route   GET /api/admin/table/managers
 * @desc    Get all managers with relevant data
 * @access  Admin only
 * @query   status, search, page, limit, sortBy, sortOrder
 * @returns Paginated list of managers
 */
router.get('/table/managers',
    authorize('admin'),
    tableController.getAllManagersTable
);

/**
 * @route   PUT /api/admin/table/staff/:id
 * @desc    Update staff member (managers can update staff, but NOT admins)
 * @access  Admin, Manager
 * @params  id - Employee ID
 * @body    { name, email, phone, department, designation, salary, status, workingHours, address, emergencyContact }
 * @note    Managers CANNOT update admin users
 */
router.put('/table/staff/:id',
    authorize('admin', 'manager'),
    tableController.updateStaffMember
);

/**
 * @route   PUT /api/admin/table/manager/:id
 * @desc    Update manager (only admin can update managers)
 * @access  Admin only
 * @params  id - Employee ID
 * @body    { name, email, phone, department, designation, salary, status, workingHours, address, emergencyContact }
 */
router.put('/table/manager/:id',
    authorize('admin'),
    tableController.updateManager
);

module.exports = router;

