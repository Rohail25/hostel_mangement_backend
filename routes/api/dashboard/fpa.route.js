const express = require('express');
const router = express.Router();

const {
  getFpaSummary,
  getFpaSummaryCards,
  getFpaRevenueExpense,
  getFpaCategoryBreakdown,
  getFpaCashFlow,
  getFpaPerformance,
  getFpaYearOverYear,
} = require('../../../controllers/api/fpa/fpa.controller');
const { authenticate, authorize } = require('../../../middleware/auth.middleware');

router.use(authenticate);
router.use(authorize('admin', 'manager', 'staff'));

router.get('/fpa', getFpaSummary);
router.get('/fpa/summary', getFpaSummaryCards);
router.get('/fpa/revenue-expense', getFpaRevenueExpense);
router.get('/fpa/categories', getFpaCategoryBreakdown);
router.get('/fpa/cash-flow', getFpaCashFlow);
router.get('/fpa/performance', getFpaPerformance);
router.get('/fpa/year-over-year', getFpaYearOverYear);

module.exports = router;

