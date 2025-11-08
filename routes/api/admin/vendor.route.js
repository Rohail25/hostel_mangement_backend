const express = require('express');
const router = express.Router();

const vendorController = require('../../../controllers/api/vendor/vendors.controller');
const { authenticate, authorize } = require('../../../middleware/auth.middleware');

router.use(authenticate);
router.use(authorize('admin', 'manager', 'staff'));

router.post('/vendor', authorize('admin', 'manager'), vendorController.createVendor);
router.get('/vendors', vendorController.listVendors);
router.get('/vendor/:id', vendorController.getVendorById);
router.put('/vendor/:id', authorize('admin', 'manager'), vendorController.updateVendor);
router.delete('/vendor/:id', authorize('admin'), vendorController.deleteVendor);
router.patch('/vendor/:id/financials', authorize('admin', 'manager'), vendorController.updateVendorFinancials);
router.post('/vendor/:id/score', authorize('admin', 'manager'), vendorController.recordVendorScore);
router.get('/vendor/:id/scores', vendorController.getVendorScores);

module.exports = router;

