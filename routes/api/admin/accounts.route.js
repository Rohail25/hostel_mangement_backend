const express = require('express');
const router = express.Router();
const { authenticate, authorize } = require('../../../middleware/auth.middleware');
const {
  getFinancialSummary,
  getPayables,
  getReceivables,
  getPayablesSummary,
} = require('../../../controllers/api/accounts.controller');

// All routes require authentication and admin/manager role
router.use(authenticate, authorize('admin', 'manager'));

/**
 * =====================================================
 * ACCOUNTS ROUTES - Financial Dashboard
 * =====================================================
 * 
 * Base path: /api/admin/accounts
 */

/**
 * Financial Summary
 * GET /api/admin/accounts/summary
 * 
 * Query Parameters:
 * - hostelId (optional): Filter by hostel ID
 * - startDate (optional): Start date for date range filter (ISO format)
 * - endDate (optional): End date for date range filter (ISO format)
 * 
 * Returns: Total Income, Expenses, Profit/Loss, Capital Invested, Receivables Breakdown
 */
router.get('/accounts/summary', getFinancialSummary);

/**
 * Payables Summary
 * GET /api/admin/accounts/payables/summary
 * 
 * Query Parameters:
 * - hostelId (optional): Filter by hostel ID
 * - search (optional): Search term for filtering
 * - type (optional): Type filter - 'bills' | 'vendor' | 'laundry' | 'all'
 * 
 * Returns: Summary of payables by type (bills, vendor, laundry)
 */
router.get('/accounts/payables/summary', getPayablesSummary);

// =====================================================
// PAYABLE ROUTES - Specific paths matching UI
// =====================================================

/**
 * Payables - All
 * GET /api/admin/accounts/payable/all
 * GET /api/admin/accounts/payable
 * 
 * Query Parameters:
 * - hostelId (optional): Filter by hostel ID
 * - search (optional): Search by reference, tenant, or description
 * - page (optional): Page number for pagination (default: 1)
 * - limit (optional): Items per page (default: 20)
 * 
 * Returns: List of all payables (bills + laundry) with pagination and summary
 */
router.get('/accounts/payable/all', (req, res, next) => {
  req.query.type = 'all';
  next();
}, getPayables);

router.get('/accounts/payable', (req, res, next) => {
  req.query.type = 'all';
  next();
}, getPayables);

/**
 * Payables - Bills
 * GET /api/admin/accounts/payable/bills
 * 
 * Query Parameters:
 * - hostelId (optional): Filter by hostel ID
 * - search (optional): Search by reference, tenant, or description
 * - page (optional): Page number for pagination (default: 1)
 * - limit (optional): Items per page (default: 20)
 * 
 * Returns: List of bills (excluding laundry) with pagination and summary
 */
router.get('/accounts/payable/bills', (req, res, next) => {
  req.query.type = 'bills';
  next();
}, getPayables);

/**
 * Payables - Vendor
 * GET /api/admin/accounts/payable/vendor
 * 
 * Query Parameters:
 * - hostelId (optional): Filter by hostel ID
 * - search (optional): Search by reference, tenant, or description
 * - page (optional): Page number for pagination (default: 1)
 * - limit (optional): Items per page (default: 20)
 * 
 * Returns: List of vendor payables with pagination and summary
 */
router.get('/accounts/payable/vendor', (req, res, next) => {
  req.query.type = 'vendor';
  next();
}, getPayables);

/**
 * Payables - Laundry
 * GET /api/admin/accounts/payable/laundry
 * 
 * Query Parameters:
 * - hostelId (optional): Filter by hostel ID
 * - search (optional): Search by reference, tenant, or description
 * - page (optional): Page number for pagination (default: 1)
 * - limit (optional): Items per page (default: 20)
 * 
 * Returns: List of laundry expenses with pagination and summary
 */
router.get('/accounts/payable/laundry', (req, res, next) => {
  req.query.type = 'laundry';
  next();
}, getPayables);

/**
 * Payables List (Legacy - Query Parameter Based)
 * GET /api/admin/accounts/payables
 * 
 * Query Parameters:
 * - type (optional): Type of payables - 'bills' | 'vendor' | 'laundry' | 'all' (default: 'bills')
 * - hostelId (optional): Filter by hostel ID
 * - search (optional): Search by reference, tenant, or description
 * - page (optional): Page number for pagination (default: 1)
 * - limit (optional): Items per page (default: 20)
 * 
 * Returns: List of payables with pagination and summary
 */
router.get('/accounts/payables', getPayables);

// =====================================================
// RECEIVABLE ROUTES - Specific paths matching UI
// =====================================================

/**
 * Receivables - All
 * GET /api/admin/accounts/receivable/all
 * GET /api/admin/accounts/receivable
 * 
 * Query Parameters:
 * - hostelId (optional): Filter by hostel ID
 * - search (optional): Search by reference, tenant, or description
 * - page (optional): Page number for pagination (default: 1)
 * - limit (optional): Items per page (default: 20)
 * - startDate (optional): Start date for date range filter (ISO format)
 * - endDate (optional): End date for date range filter (ISO format)
 * - category (optional): Filter by payment type/category
 * - type (optional): Alias for category parameter
 * 
 * Returns: List of all receivables (pending + paid) with pagination and summary
 */
router.get('/accounts/receivable/all', (req, res, next) => {
  req.query.view = 'all';
  next();
}, getReceivables);

router.get('/accounts/receivable', (req, res, next) => {
  req.query.view = 'all';
  next();
}, getReceivables);

/**
 * Receivables - Received
 * GET /api/admin/accounts/receivable/received
 * 
 * Query Parameters:
 * - hostelId (optional): Filter by hostel ID
 * - search (optional): Search by reference, tenant, or description
 * - page (optional): Page number for pagination (default: 1)
 * - limit (optional): Items per page (default: 20)
 * - startDate (optional): Start date for date range filter (ISO format)
 * - endDate (optional): End date for date range filter (ISO format)
 * - category (optional): Filter by payment type/category
 * - type (optional): Alias for category parameter
 * 
 * Returns: List of received (paid) payments with pagination and summary
 */
router.get('/accounts/receivable/received', (req, res, next) => {
  req.query.view = 'received';
  next();
}, getReceivables);

/**
 * Receivables List (Legacy - Query Parameter Based)
 * GET /api/admin/accounts/receivables
 * 
 * Query Parameters:
 * - hostelId (optional): Filter by hostel ID
 * - search (optional): Search by reference, tenant, or description
 * - page (optional): Page number for pagination (default: 1)
 * - limit (optional): Items per page (default: 20)
 * - startDate (optional): Start date for date range filter (ISO format)
 * - endDate (optional): End date for date range filter (ISO format)
 * - status (optional): Filter by status - 'pending' | 'overdue' | 'partial' | 'paid'
 * - view (optional): View filter - 'all' | 'pending' | 'overdue' | 'partial' | 'received' | 'paid' | 'everything' (default: 'all')
 * - category (optional): Filter by payment type/category
 * - type (optional): Alias for category parameter
 * 
 * Returns: List of receivables with pagination and summary breakdown
 */
router.get('/accounts/receivables', getReceivables);

module.exports = router;

