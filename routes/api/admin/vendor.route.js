const express = require('express');
const router = express.Router();
const vendorController = require('../../../controllers/api/vendor.controller');
const { authenticate, authorize } = require('../../../middleware/auth.middleware');

// Apply auth to all vendor routes
router.use('/vendors', authenticate);
router.use('/vendors', authorize('admin', 'manager', 'staff'));

// Create vendor
router.post('/vendor', vendorController.createVendor);

// List vendors
router.get('/vendors', vendorController.getVendors);

// Get vendor by id
router.get('/vendor/:id', vendorController.getVendorById);

// Update vendor
router.put('/vendor/:id', vendorController.updateVendor);

// Update vendor financials (incremental)
router.patch('/vendor/:id/financials', vendorController.updateVendorFinancials);

// Delete vendor
router.delete('/vendor/:id', authorize('admin'), vendorController.deleteVendor);

module.exports = router;
