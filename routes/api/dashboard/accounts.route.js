const express = require('express');
const router = express.Router();
const { authenticate, authorize } = require('../../../middleware/auth.middleware');
const {
  getFinancialSummary,
  getPayables,
  getReceivables,
  getPayablesSummary,
} = require('../../../controllers/api/accounts/accounts.controller');

// All routes require authentication and admin/manager role
router.use(authenticate, authorize('admin', 'manager'));

/**
 * Financial Summary
 * GET /api/admin/accounts/summary
 */
router.get('/accounts/summary', getFinancialSummary);

/**
 * Payables Summary
 * GET /api/admin/accounts/payables/summary
 */
router.get('/accounts/payables/summary', getPayablesSummary);

/**
 * Payables
 * GET /api/admin/accounts/payables?type=bills|vendor|laundry
 */
router.get('/accounts/payables', getPayables);

/**
 * Receivables
 * GET /api/admin/accounts/receivables
 */
router.get('/accounts/receivables', getReceivables);

module.exports = router;

