/**
 * ======================================
 * STRIPE PAYMENT ROUTES
 * ======================================
 * 
 * Endpoints for Stripe payment integration
 * 
 * PUBLIC ROUTES:
 * - POST /api/stripe/webhook - Stripe webhook handler (called by Stripe servers)
 * 
 * AUTHENTICATED ROUTES (require auth token):
 * - POST /api/stripe/create-checkout-session - Create payment session
 * - GET /api/stripe/session/:sessionId - Get session status
 * - POST /api/stripe/refund - Initiate refund (admin only)
 */

const express = require('express');
const router = express.Router();
const { authenticate, authorize } = require('../../middleware/auth.middleware');
// Import Stripe controller
const {
    createStripeCheckoutSession,
    handleStripeWebhook,
    getSessionStatus,
    initiateRefund
} = require('../../controllers/api/stripe.controller');

// Import authentication middleware (if you have one)
// const { authenticate, isAdmin } = require('../../middleware/auth.middleware');

// ======================================
// PUBLIC ROUTES
// ======================================

/**
 * STRIPE WEBHOOK
 * POST /api/stripe/webhook
 * 
 * ⚠️ IMPORTANT: This route must be registered BEFORE express.json() middleware
 * Stripe requires raw body for signature verification
 * See app.js for proper setup
 */
router.post('/webhook', handleStripeWebhook);

// ======================================
// AUTHENTICATED ROUTES
// ======================================
// Note: Uncomment authenticate middleware if you have auth setup
// For testing purposes, these are open. In production, add authentication!

/**
 * CREATE CHECKOUT SESSION
 * POST /api/stripe/create-checkout-session
 * 
 * Body:
 * {
 *   "bookingId": 1,
 *   "paymentType": "rent"  // optional
 * }
 * 
 * Response:
 * {
 *   "sessionId": "cs_test_...",
 *   "sessionUrl": "https://checkout.stripe.com/...",
 *   "bookingCode": "BK2510001",
 *   "amount": 5000
 * }
 */
router.post('/create-checkout-session',  authenticate, createStripeCheckoutSession);

/**
 * GET SESSION STATUS
 * GET /api/stripe/session/:sessionId
 * 
 * Returns current status of a Stripe checkout session
 * Useful for frontend to check if payment was successful
 */
router.get('/session/:sessionId', /* authenticate, */ getSessionStatus);

/**
 * INITIATE REFUND
 * POST /api/stripe/refund
 * 
 * Body:
 * {
 *   "bookingId": 1,
 *   "amount": 5000,  // optional, full refund if not provided
 *   "reason": "requested_by_customer"  // optional
 * }
 * 
 * ⚠️ ADMIN ONLY - Should be protected with admin middleware
 */
router.post('/refund', /* authenticate, isAdmin, */ initiateRefund);

module.exports = router;

