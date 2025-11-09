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

// Record new payment (Admin, Manager, Owner & Staff only)
router.post('/payment', authenticate, authorize('admin', 'manager', 'owner', 'staff'), recordPayment);

// Get payment summary (Admin, Manager & Owner)
router.get('/payments/summary', authenticate, authorize('admin', 'manager', 'owner'), getPaymentSummary);

// Get pending payments (Admin, Manager & Owner)
router.get('/payments/pending', authenticate, authorize('admin', 'manager', 'owner'), getPendingPayments);

// Get all payments with filters and pagination (Admin, Manager & Owner)
router.get('/payments', authenticate, authorize('admin', 'manager', 'owner'), getAllPayments);

// Get payment by ID (Admin, Manager & Owner)
router.get('/payment/:id', authenticate, authorize('admin', 'manager', 'owner'), getPaymentById);

// Update payment (Admin, Manager & Owner)
router.put('/payment/:id', authenticate, authorize('admin', 'manager', 'owner'), updatePayment);

// Delete payment (Admin & Owner)
router.delete('/payment/:id', authenticate, authorize('admin', 'owner'), deletePayment);

module.exports = router;

