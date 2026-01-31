// ===============================
// Allocation Routes (Tenant Management)
// ===============================

const express = require('express');
const router = express.Router();
const {
    allocateTenant,
    checkOutTenant,
    transferTenant,
    getAllAllocations,
    getAllocationById,
    getActiveAllocationsByHostel,
    updateAllocation,
    updateBedAllocation
} = require('../../../controllers/api/allocation.controller');
const { authenticate, authorize } = require('../../../middleware/auth.middleware');

// All routes require authentication and admin/manager role

// Allocate tenant to bed (Admin & Manager only)
router.post('/allocation', authenticate, authorize('admin', 'manager', 'owner'), allocateTenant);

// Check out tenant (Admin & Manager only)
router.post('/allocations/:allocationId/checkout', authenticate, authorize('admin', 'manager', 'owner'), checkOutTenant);

// Transfer tenant to another bed (Admin & Manager only)
router.post('/allocations/:allocationId/transfer', authenticate, authorize('admin', 'manager', 'owner'), transferTenant);

// Get all allocations (Admin & Manager only)
router.get('/allocations', authenticate, authorize('admin', 'manager', 'owner'), getAllAllocations);

// Get active allocations by hostel (Admin & Manager only)
router.get('/allocations/hostel/:hostelId/active', authenticate, authorize('admin', 'manager', 'owner'), getActiveAllocationsByHostel);

// Get allocation by ID (Admin & Manager only)
router.get('/allocation/:id', authenticate, authorize('admin', 'manager', 'owner'), getAllocationById);

// Update allocation (Admin & Manager only)
router.put('/allocation/:id', authenticate, authorize('admin', 'manager', 'owner'), updateAllocation);

// Update bed allocation - change which bed a tenant is assigned to (Admin & Manager only)
router.put('/allocation/bed/:id', authenticate, authorize('admin', 'manager', 'owner'), updateBedAllocation);

module.exports = router;


