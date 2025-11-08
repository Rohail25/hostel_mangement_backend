const express = require('express');
const router = express.Router();

const vendorController = require('../../../controllers/api/vendor/vendors.controller');
const { authenticate, authorize } = require('../../../middleware/auth.middleware');

router.use(authenticate);
router.use(authorize('admin', 'manager', 'staff'));

router.post('/vendors', authorize('admin', 'manager'), vendorController.createVendor);
router.get('/vendors', vendorController.listVendors);
router.get('/vendors/:id', vendorController.getVendorById);
router.put('/vendors/:id', authorize('admin', 'manager'), vendorController.updateVendor);
router.delete('/vendors/:id', authorize('admin'), vendorController.deleteVendor);
router.patch('/vendors/:id/financials', authorize('admin', 'manager'), vendorController.updateVendorFinancials);
router.post('/vendors/:id/score', authorize('admin', 'manager'), vendorController.recordVendorScore);
router.get('/vendors/:id/scores', vendorController.getVendorScores);

module.exports = router;

