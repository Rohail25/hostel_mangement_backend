const express = require('express');
const router = express.Router();

const communicationController = require('../../../controllers/api/communication/communication.controller');
const { authenticate, authorize } = require('../../../middleware/auth.middleware');

router.use(authenticate);
router.use(authorize('admin', 'manager', 'staff'));

router.get('/communication/tenants', communicationController.tenantContacts);
router.get('/communication/tenants/:id', communicationController.tenantContactDetails);

router.get('/communication/employees', communicationController.employeeContacts);
router.get('/communication/employees/:id', communicationController.employeeContactDetails);

router.get('/communication/vendors', communicationController.vendorContacts);
router.get('/communication/vendors/:id', communicationController.vendorContactDetails);

module.exports = router;

