const express = require('express');
const router = express.Router();
const multer = require('multer');
const path = require('path');
const fs = require('fs');
const { authenticate, authorize } = require('../../../middleware/auth.middleware');
const {
  getServiceManagement,
  assignVendorToService,
  removeVendorAssignment,
  getAllServices,
  getAvailableVendors,
  createService,
  updateService,
  deleteService,
} = require('../../../controllers/api/vendor-management.controller');

// Configure multer for file uploads
const uploadDir = path.join(__dirname, '../../../uploads/vendor-assignments');
if (!fs.existsSync(uploadDir)) {
  fs.mkdirSync(uploadDir, { recursive: true });
}

const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    cb(null, uploadDir);
  },
  filename: (req, file, cb) => {
    const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
    cb(null, 'attachment-' + uniqueSuffix + path.extname(file.originalname));
  },
});

const upload = multer({
  storage: storage,
  limits: { fileSize: 5 * 1024 * 1024 }, // 5MB limit
  fileFilter: (req, file, cb) => {
    // Only allow images
    if (file.mimetype.startsWith('image/')) {
      cb(null, true);
    } else {
      cb(new Error('Only image files are allowed'), false);
    }
  },
});

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
router.post('/vendor/management/assign', upload.single('attachment'), assignVendorToService);

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
 * Create Service
 * POST /api/admin/vendor/management/services
 * 
 * Body:
 * {
 *   "name": "Service Name",      // Required
 *   "description": "...",         // Optional
 *   "category": "...",            // Optional
 *   "price": 100.00,              // Optional
 *   "unit": "per hour"            // Optional
 * }
 * 
 * Returns: Created service
 */
router.post('/vendor/management/services', createService);

/**
 * Update Service
 * PUT /api/admin/vendor/management/services/:id
 * 
 * Body:
 * {
 *   "name": "Service Name",      // Optional
 *   "description": "...",         // Optional
 *   "category": "...",            // Optional
 *   "price": 100.00,              // Optional
 *   "unit": "per hour",           // Optional
 *   "isActive": true              // Optional
 * }
 * 
 * Returns: Updated service
 */
router.put('/vendor/management/services/:id', updateService);

/**
 * Delete Service
 * DELETE /api/admin/vendor/management/services/:id
 * 
 * Returns: Success message
 */
router.delete('/vendor/management/services/:id', deleteService);

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

