const express = require('express');
const router = express.Router();
const {
  createVendor,
  listVendors,
  getVendorById,
  getVendorsByHostelId,
  updateVendor,
  deleteVendor,
  updateVendorFinancials,
  recordVendorScore,
  getVendorScores,
} = require('../../../controllers/api/vendor.controller');
const { authenticate, authorize } = require('../../../middleware/auth.middleware');

// 🔒 All vendor routes are protected
router.use(authenticate);
router.use(authorize('admin', 'manager'));

// ==================== VENDOR CRUD OPERATIONS ====================

/**
 * @route   POST /api/admin/vendors
 * @desc    Create new vendor
 * @access  Admin, Manager
 * @body    { name, specialty?, category?, phone, email, hostelId, status?, rating?, services?, ... }
 */
router.post('/vendors', createVendor);

/**
 * @route   GET /api/admin/vendors
 * @desc    Get all vendors with filters, pagination, and sorting
 * @access  Admin, Manager
 * @query   search?, status?, category?, paymentTerms?, hostelId?, page?, limit?, sortBy?, sortOrder?
 */
router.get('/vendors', listVendors);

/**
 * @route   GET /api/admin/vendors/hostel/:hostelId
 * @desc    Get all vendors for a specific hostel
 * @access  Admin, Manager
 * @params  hostelId - Hostel ID
 */
router.get('/vendors/hostel/:hostelId', getVendorsByHostelId);

/**
 * @route   GET /api/admin/vendors/:id
 * @desc    Get vendor by ID with recent scores and full details
 * @access  Admin, Manager
 * @params  id - Vendor ID
 */
router.get('/vendors/:id', getVendorById);

/**
 * @route   PUT /api/admin/vendors/:id
 * @desc    Update vendor details
 * @access  Admin, Manager
 * @params  id - Vendor ID
 * @body    { name?, specialty?, category?, phone?, email?, status?, ... }
 */
router.put('/vendors/:id', updateVendor);

/**
 * @route   DELETE /api/admin/vendors/:id
 * @desc    Delete vendor
 * @access  Admin only
 * @params  id - Vendor ID
 */
router.delete('/vendors/:id', authorize('admin'), deleteVendor);

// ==================== VENDOR FINANCIAL OPERATIONS ====================

/**
 * @route   PATCH /api/admin/vendors/:id/financials
 * @desc    Update vendor financial balances (totalPayable, totalPaid, balance)
 * @access  Admin, Manager
 * @params  id - Vendor ID
 * @body    { deltaPayable?, deltaPaid? }
 */
router.patch('/vendors/:id/financials', updateVendorFinancials);

// ==================== VENDOR RATING/SCORE OPERATIONS ====================

/**
 * @route   POST /api/admin/vendors/:id/score
 * @desc    Record a vendor score/rating
 * @access  Admin, Manager
 * @params  id - Vendor ID
 * @body    { score (required), criteria?, remarks? }
 */
router.post('/vendors/:id/score', recordVendorScore);

/**
 * @route   GET /api/admin/vendors/:id/scores
 * @desc    Get vendor score history
 * @access  Admin, Manager
 * @params  id - Vendor ID
 * @query   limit? - Number of scores to return (default: 20, max: 100)
 */
router.get('/vendors/:id/scores', getVendorScores);

module.exports = router;
