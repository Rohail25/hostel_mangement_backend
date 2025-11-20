const express = require('express');
const router = express.Router();
const { authenticate, authorize } = require('../../../middleware/auth.middleware');
const {
  getServiceManagement,
  assignVendorToService,
  removeVendorAssignment,
  getAllServices,
  getAvailableVendors,
} = require('../../../controllers/api/vendor-management.controller');

// All routes require authentication and admin/manager role
router.use(authenticate, authorize('admin', 'manager'));

/**
 * =====================================================
 * VENDOR MANAGEMENT ROUTES - Service Assignments
 * =====================================================
 * 
 * Base path: /api/admin/vendor/management
 */

/**
 * Service Management Dashboard
 * GET /api/admin/vendor/management
 * 
 * Query Parameters:
 * - hostelId (optional): Filter by hostel ID
 * - search (optional): Search by service name, description, or category
 * - page (optional): Page number for pagination (default: 1)
 * - limit (optional): Items per page (default: 50)
 * 
 * Returns: List of services with their assigned vendors and hostels
 */
router.get('/vendor/management', getServiceManagement);

/**
 * Assign Vendor to Service
 * POST /api/admin/vendor/management/assign
 * 
 * Body:
 * {
 *   "serviceId": 1,      // Required
 *   "vendorId": 1,       // Required
 *   "hostelId": 1,       // Optional
 *   "notes": "..."       // Optional
 * }
 * 
 * Returns: Created assignment with service, vendor, and hostel details
 */
router.post('/vendor/management/assign', assignVendorToService);

/**
 * Remove Vendor Assignment
 * DELETE /api/admin/vendor/management/assign/:id
 * 
 * Params:
 * - id: Assignment ID
 * 
 * Returns: Success message
 */
router.delete('/vendor/management/assign/:id', removeVendorAssignment);

/**
 * Get All Services
 * GET /api/admin/vendor/management/services
 * 
 * Query Parameters:
 * - search (optional): Search by name, description, or category
 * - category (optional): Filter by category
 * - isActive (optional): Filter by active status (default: true)
 * 
 * Returns: List of all available services
 */
router.get('/vendor/management/services', getAllServices);

/**
 * Get Available Vendors
 * GET /api/admin/vendor/management/vendors
 * 
 * Query Parameters:
 * - search (optional): Search by name, company, email, or phone
 * - hostelId (optional): Filter by hostel ID (shows vendors for that hostel or global vendors)
 * - status (optional): Filter by vendor status (default: 'active', use 'all' for all statuses)
 * 
 * Returns: List of available vendors for assignment
 */
router.get('/vendor/management/vendors', getAvailableVendors);

module.exports = router;

