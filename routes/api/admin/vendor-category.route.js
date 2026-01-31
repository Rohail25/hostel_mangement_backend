const express = require('express');
const router = express.Router();
const { authenticate, authorize } = require('../../../middleware/auth.middleware');
const {
  getVendorCategories,
  createVendorCategory,
  getVendorCategoryById,
  updateVendorCategory,
  deleteVendorCategory,
} = require('../../../controllers/api/vendor-category.controller');

// All routes require authentication and admin/manager role
router.use(authenticate);
router.use(authorize('admin', 'manager'));

/**
 * =====================================================
 * VENDOR CATEGORY ROUTES
 * =====================================================
 * 
 * Base path: /api/admin/vendor-categories
 */

/**
 * GET /api/admin/vendor-categories
 * Get all vendor categories for the current user
 */
router.get('/vendor-categories', getVendorCategories);

/**
 * POST /api/admin/vendor-categories
 * Create a new vendor category
 * Body: { name, description? }
 */
router.post('/vendor-categories', createVendorCategory);

/**
 * GET /api/admin/vendor-categories/:id
 * Get a vendor category by ID
 */
router.get('/vendor-categories/:id', getVendorCategoryById);

/**
 * PUT /api/admin/vendor-categories/:id
 * Update a vendor category
 * Body: { name?, description? }
 */
router.put('/vendor-categories/:id', updateVendorCategory);

/**
 * DELETE /api/admin/vendor-categories/:id
 * Delete a vendor category
 */
router.delete('/vendor-categories/:id', deleteVendorCategory);

module.exports = router;
