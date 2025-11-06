const express = require('express');
const router = express.Router();
const transactionController = require('../../../controllers/api/transaction.controller');
const { authenticate, authorize } = require('../../../middleware/auth.middleware');

// =================== TRANSACTION ROUTES ===================

// All routes require authentication and admin/manager access
// Apply middleware to all routes except webhook
router.use('/transactions', authenticate);




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


