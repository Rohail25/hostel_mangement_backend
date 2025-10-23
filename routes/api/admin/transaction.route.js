const express = require('express');
const router = express.Router();
const transactionController = require('../../../controllers/api/transaction.controller');
const { authenticate, authorize } = require('../../../middleware/auth.middleware');

// =================== TRANSACTION ROUTES ===================

// All routes require authentication and admin/manager access
// Apply middleware to all routes except webhook
router.use('/transactions', authenticate);
router.use('/transactions', authorize('admin', 'manager', 'staff'));

/**
 * @route   POST /api/admin/transactions
 * @desc    Create new transaction
 * @access  Admin, Manager, Staff
 * @body    { paymentId, tenantId, hostelId, gateway, transactionType, amount, paymentMethod, ... }
 */
router.post('/transactions', transactionController.createTransaction);

/**
 * @route   GET /api/admin/transactions
 * @desc    Get all transactions with filters and pagination
 * @access  Admin, Manager, Staff
 * @query   status, gateway, transactionType, paymentMethod, tenantId, hostelId, paymentId, startDate, endDate, search, page, limit
 */
router.get('/transactions', transactionController.getAllTransactions);

/**
 * @route   GET /api/admin/transactions/statistics
 * @desc    Get transaction statistics
 * @access  Admin, Manager
 * @query   startDate, endDate, hostelId
 */
router.get('/transactions/statistics', 
    authorize('admin', 'manager'),
    transactionController.getTransactionStatistics
);

/**
 * @route   GET /api/admin/transactions/:id
 * @desc    Get transaction by ID
 * @access  Admin, Manager, Staff
 * @params  id - Transaction ID
 */
router.get('/transactions/:id', transactionController.getTransactionById);

/**
 * @route   GET /api/admin/transactions/payment/:paymentId
 * @desc    Get all transactions for a specific payment
 * @access  Admin, Manager, Staff
 * @params  paymentId - Payment ID
 */
router.get('/transactions/payment/:paymentId', transactionController.getTransactionsByPaymentId);

/**
 * @route   GET /api/admin/transactions/tenant/:tenantId
 * @desc    Get all transactions for a specific tenant
 * @access  Admin, Manager, Staff
 * @params  tenantId - Tenant ID
 * @query   page, limit
 */
router.get('/transactions/tenant/:tenantId', transactionController.getTransactionsByTenantId);

/**
 * @route   PUT /api/admin/transactions/:id
 * @desc    Update transaction details
 * @access  Admin, Manager
 * @params  id - Transaction ID
 * @body    { status, gatewayRef, orderId, merchantTxnId, responseCode, responseMessage, rawResponse, fee }
 */
router.put('/transactions/:id',
    authorize('admin', 'manager'),
    transactionController.updateTransaction
);

/**
 * @route   PATCH /api/admin/transactions/:id/status
 * @desc    Update transaction status
 * @access  Admin, Manager, Staff
 * @params  id - Transaction ID
 * @body    { status, responseCode, responseMessage, rawResponse, gatewayRef }
 */
router.patch('/transactions/:id/status', transactionController.updateTransactionStatus);

/**
 * @route   DELETE /api/admin/transactions/:id
 * @desc    Delete transaction
 * @access  Admin
 * @params  id - Transaction ID
 */
router.delete('/transactions/:id',
    authorize('admin'), // Only admin can delete
    transactionController.deleteTransaction
);

// =================== WEBHOOK ROUTE (NO AUTH) ===================

/**
 * @route   POST /api/admin/transactions/webhook
 * @desc    Handle payment gateway webhook callbacks
 * @access  Public (No authentication required)
 * @body    { gateway, gatewayRef, orderId, status, amount, responseCode, responseMessage, rawResponse }
 * @note    This endpoint is called by payment gateways (Stripe, JazzCash, etc.)
 */
router.post('/transactions/webhook', transactionController.handleWebhook);

module.exports = router;


