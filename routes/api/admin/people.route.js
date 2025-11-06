const express = require('express');
const router = express.Router();
const { authenticate, authorize } = require('../../../middleware/auth.middleware');
const ctrl = require('../../../controllers/api/people/people.controller');

// All People endpoints are protected (admin/manager)
router.use(authenticate, authorize('admin', 'manager'));

/**
 * LISTING (cards)
 */
router.get('/people/tenants', ctrl.listTenants);
router.get('/people/employees', ctrl.listEmployees);

/**
 * DETAILS (modal → Details tab)
 */
router.get('/people/tenant/:id', ctrl.tenantDetails);
router.get('/people/employee/:id', ctrl.employeeDetails);

/**
 * SCORE CARD
 * - current (for the header panel)
 * - history (table)
 * - upsert (Add / Update Score)
 */
router.get('/people/tenant/:id/score', ctrl.getTenantCurrentScore);
router.get('/people/tenant/:id/scores', ctrl.getTenantScoreHistory);
router.post('/people/tenant/:id/score', ctrl.upsertTenantScore);

router.get('/people/employee/:id/score', ctrl.getEmployeeCurrentScore);
router.get('/people/employee/:id/scores', ctrl.getEmployeeScoreHistory);
router.post('/people/employee/:id/score', ctrl.upsertEmployeeScore);

module.exports = router;
