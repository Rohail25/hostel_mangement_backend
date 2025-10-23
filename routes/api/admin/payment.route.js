// ===============================
// Payment Routes (Admin)
// ===============================

const express = require('express');
const router = express.Router();
const {
    recordPayment,
    getAllPayments,
    getPaymentById,
    updatePayment,
    deletePayment,
    getPaymentSummary,
    getPendingPayments
} = require('../../../controllers/api/payment.controller');
const { authenticate, authorize } = require('../../../middleware/auth.middleware');

// All routes require authentication and admin/manager/staff role

// Record new payment (Admin, Manager & Staff only)
router.post('/payment', authenticate, authorize('admin', 'manager', 'staff'), recordPayment);

// Get payment summary (Admin & Manager only)
router.get('/payments/summary', authenticate, authorize('admin', 'manager'), getPaymentSummary);

// Get pending payments (Admin & Manager only)
router.get('/payments/pending', authenticate, authorize('admin', 'manager'), getPendingPayments);

// Get all payments with filters and pagination (Admin & Manager only)
router.get('/payments', authenticate, authorize('admin', 'manager'), getAllPayments);

// Get payment by ID (Admin & Manager only)
router.get('/payment/:id', authenticate, authorize('admin', 'manager'), getPaymentById);

// Update payment (Admin & Manager only)
router.put('/payment/:id', authenticate, authorize('admin', 'manager'), updatePayment);

// Delete payment (Admin only)
router.delete('/payment/:id', authenticate, authorize('admin'), deletePayment);

module.exports = router;

