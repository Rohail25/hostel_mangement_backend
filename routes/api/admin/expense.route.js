const express = require('express');
const router = express.Router();
const { authenticate, authorize } = require('../../../middleware/auth.middleware');
const {
  createExpense,
  getExpenses,
  getExpenseById,
  updateExpense,
  deleteExpense,
  updateExpenseStatus,
} = require('../../../controllers/api/expense.controller');

// All routes require authentication and admin/manager role
router.use(authenticate, authorize('admin', 'manager'));

/**
 * =====================================================
 * EXPENSE ROUTES - Bills/Expenses Management
 * =====================================================
 * 
 * Base path: /api/admin/expenses
 */

/**
 * POST /api/admin/expenses
 * Create a new expense/bill
 * Body: { title, category, amount, type, date, hostelId }
 */
router.post('/expenses', createExpense);

/**
 * GET /api/admin/expenses
 * Get all expenses with filters
 * Query: hostelId, search, category, startDate, endDate, page, limit
 */
router.get('/expenses', getExpenses);

/**
 * GET /api/admin/expenses/:id
 * Get expense by ID
 */
router.get('/expenses/:id', getExpenseById);

/**
 * PUT /api/admin/expenses/:id
 * Update an expense
 * Body: { title?, category?, amount?, type?, date?, hostelId? }
 */
router.put('/expenses/:id', updateExpense);

/**
 * DELETE /api/admin/expenses/:id
 * Delete an expense
 */
router.delete('/expenses/:id', deleteExpense);

/**
 * PUT /api/admin/expenses/:id/status
 * Update expense status (for bills)
 * Body: { status: 'Pending' | 'Paid' | 'Overdue' }
 */
router.put('/expenses/:id/status', updateExpenseStatus);

module.exports = router;
