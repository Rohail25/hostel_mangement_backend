/**
 * ======================================
 * STRIPE PAYMENT GATEWAY HELPER
 * ======================================
 * 
 * This helper provides integration with Stripe payment gateway for the Hostel Management System.
 * 
 * 🧪 STRIPE TEST MODE (Sandbox)
 * ============================
 * For local development and testing, Stripe provides a test mode:
 * 
 * 1. Create a Stripe account at https://stripe.com
 * 2. Get your API keys from Dashboard > Developers > API keys
 *    - Publishable key (starts with pk_test_...)
 *    - Secret key (starts with sk_test_...)
 * 
 * 3. Use Stripe Test Cards for testing payments:
 *    ✅ Success: 4242 4242 4242 4242 (any future expiry, any CVC)
 *    ❌ Declined: 4000 0000 0000 0002
 *    🔐 Requires Auth: 4000 0025 0000 3155
 *    More test cards: https://stripe.com/docs/testing
 * 
 * 4. All payments in test mode are simulated - no real money is charged
 * 5. Webhooks can be tested locally using Stripe CLI:
 *    - Install: https://stripe.com/docs/stripe-cli
 *    - Run: stripe listen --forward-to localhost:3000/api/stripe/webhook
 * 
 * 🔄 WEBHOOK FLOW
 * ===============
 * 1. User completes payment on Stripe Checkout
 * 2. Stripe sends webhook event to our server
 * 3. We verify the webhook signature
 * 4. We update booking, payment, and transaction status
 * 5. Booking is confirmed automatically
 * 
 * 📝 ENVIRONMENT VARIABLES REQUIRED
 * =================================
 * STRIPE_SECRET_KEY=sk_test_... (or sk_live_... for production)
 * STRIPE_WEBHOOK_SECRET=whsec_... (get this from Stripe dashboard or CLI)
 * FRONTEND_URL=http://localhost:5173 (your frontend URL)
 */

const Stripe = require('stripe');

// Initialize Stripe with secret key from environment
const stripe = new Stripe(process.env.STRIPE_SECRET_KEY, {
    apiVersion: '2024-10-28.acacia', // Use latest stable API version
});

/**
 * CREATE STRIPE CHECKOUT SESSION
 * ================================
 * Creates a Stripe Checkout Session for booking payment
 * 
 * @param {Object} bookingData - Booking details
 * @param {Number} bookingData.bookingId - Booking ID
 * @param {String} bookingData.bookingCode - Booking code (e.g., BK2510001)
 * @param {Number} bookingData.amount - Amount to charge in PKR
 * @param {String} bookingData.customerEmail - Customer email
 * @param {String} bookingData.customerName - Customer name
 * @param {Object} bookingData.hostelDetails - Hostel information
 * @param {Object} bookingData.roomDetails - Room information
 * @returns {Object} { sessionId, url } - Stripe session details
 */
const createCheckoutSession = async (bookingData) => {
    try {
        const {
            bookingId,
            bookingCode,
            amount,
            customerEmail,
            customerName,
            hostelDetails = {},
            roomDetails = {},
            checkInDate,
            checkOutDate
        } = bookingData;

        // Validate required fields
        if (!bookingId || !bookingCode || !amount) {
            throw new Error('Booking ID, booking code, and amount are required');
        }

        // Calculate amount in cents/paisa (Stripe requires smallest currency unit)
        // For PKR, 1 PKR = 100 paisa
        const amountInPaisa = Math.round(amount * 100);

        // Create product description
        const description = `Hostel Booking - ${hostelDetails.name || 'Hostel'} - Room ${roomDetails.roomNumber || 'N/A'}`;
        
        // Format dates for display
        const checkIn = checkInDate ? new Date(checkInDate).toLocaleDateString() : 'N/A';
        const checkOut = checkOutDate ? new Date(checkOutDate).toLocaleDateString() : 'N/A';

        // Create Stripe Checkout Session
        const session = await stripe.checkout.sessions.create({
            payment_method_types: ['card'], // Accept card payments
            line_items: [
                {
                    price_data: {
                        currency: 'pkr', // Pakistani Rupee
                        product_data: {
                            name: `Hostel Booking - ${bookingCode}`,
                            description: description,
                            images: hostelDetails.images?.[0]?.url ? [hostelDetails.images[0].url] : [],
                            metadata: {
                                hostel: hostelDetails.name || 'N/A',
                                room: roomDetails.roomNumber || 'N/A',
                                checkIn: checkIn,
                                checkOut: checkOut
                            }
                        },
                        unit_amount: amountInPaisa,
                    },
                    quantity: 1,
                },
            ],
            mode: 'payment', // One-time payment (not subscription)
            
            // Customer information
            customer_email: customerEmail,
            
            // Metadata (will be sent back in webhook)
            metadata: {
                bookingId: bookingId.toString(),
                bookingCode: bookingCode,
                customerName: customerName || 'Guest',
                hostelId: hostelDetails.id?.toString() || '',
                hostelName: hostelDetails.name || '',
                roomId: roomDetails.id?.toString() || '',
                roomNumber: roomDetails.roomNumber || '',
                amount: amount.toString(),
                paymentType: 'rent',
                source: 'hostel_management_system'
            },

            // Success and Cancel URLs
            success_url: `${process.env.FRONTEND_URL}/booking/success?session_id={CHECKOUT_SESSION_ID}&booking_code=${bookingCode}`,
            cancel_url: `${process.env.FRONTEND_URL}/booking/cancel?booking_code=${bookingCode}`,

            // Payment intent data
            payment_intent_data: {
                metadata: {
                    bookingId: bookingId.toString(),
                    bookingCode: bookingCode
                },
                description: `Payment for booking ${bookingCode}`,
                receipt_email: customerEmail
            },

            // Expiration (session expires after 30 minutes)
            expires_at: Math.floor(Date.now() / 1000) + (30 * 60),

            // Phone number collection (optional but useful for hostels)
            phone_number_collection: {
                enabled: true
            },

            // Billing address collection
            billing_address_collection: 'auto'
        });

        return {
            sessionId: session.id,
            url: session.url,
            expiresAt: new Date(session.expires_at * 1000)
        };

    } catch (error) {
        console.error('Stripe Checkout Session Error:', error);
        throw new Error(`Failed to create Stripe session: ${error.message}`);
    }
};

/**
 * VERIFY STRIPE WEBHOOK SIGNATURE
 * =================================
 * Verifies that the webhook request actually came from Stripe
 * 
 * @param {String} payload - Raw request body
 * @param {String} signature - Stripe-Signature header value
 * @returns {Object} Verified event object
 */
const verifyWebhookSignature = (payload, signature) => {
    try {
        const webhookSecret = process.env.STRIPE_WEBHOOK_SECRET;
        
        if (!webhookSecret) {
            throw new Error('STRIPE_WEBHOOK_SECRET is not set in environment variables');
        }

        // Verify signature and construct event
        const event = stripe.webhooks.constructEvent(
            payload,
            signature,
            webhookSecret
        );

        return event;
    } catch (error) {
        console.error('Webhook Signature Verification Failed:', error);
        throw new Error(`Webhook verification failed: ${error.message}`);
    }
};

/**
 * RETRIEVE CHECKOUT SESSION
 * ==========================
 * Gets detailed information about a Stripe Checkout Session
 * 
 * @param {String} sessionId - Stripe session ID
 * @returns {Object} Session details
 */
const retrieveSession = async (sessionId) => {
    try {
        const session = await stripe.checkout.sessions.retrieve(sessionId, {
            expand: ['payment_intent', 'customer'] // Include related data
        });

        return session;
    } catch (error) {
        console.error('Retrieve Session Error:', error);
        throw new Error(`Failed to retrieve session: ${error.message}`);
    }
};

/**
 * RETRIEVE PAYMENT INTENT
 * ========================
 * Gets payment intent details (useful for refunds and tracking)
 * 
 * @param {String} paymentIntentId - Stripe payment intent ID
 * @returns {Object} Payment intent details
 */
const retrievePaymentIntent = async (paymentIntentId) => {
    try {
        const paymentIntent = await stripe.paymentIntents.retrieve(paymentIntentId);
        return paymentIntent;
    } catch (error) {
        console.error('Retrieve Payment Intent Error:', error);
        throw new Error(`Failed to retrieve payment intent: ${error.message}`);
    }
};

/**
 * CREATE REFUND
 * ==============
 * Creates a refund for a payment (useful for cancellations)
 * 
 * @param {String} paymentIntentId - Stripe payment intent ID
 * @param {Number} amount - Amount to refund (optional, full refund if not specified)
 * @param {String} reason - Refund reason
 * @returns {Object} Refund details
 */
const createRefund = async (paymentIntentId, amount = null, reason = 'requested_by_customer') => {
    try {
        const refundData = {
            payment_intent: paymentIntentId,
            reason: reason // 'duplicate', 'fraudulent', 'requested_by_customer'
        };

        // If specific amount is provided, include it
        if (amount) {
            refundData.amount = Math.round(amount * 100); // Convert to paisa
        }

        const refund = await stripe.refunds.create(refundData);
        return refund;
    } catch (error) {
        console.error('Create Refund Error:', error);
        throw new Error(`Failed to create refund: ${error.message}`);
    }
};

/**
 * LIST ALL PAYMENT INTENTS
 * =========================
 * Lists payment intents (useful for reconciliation and reports)
 * 
 * @param {Object} filters - Query filters
 * @returns {Array} List of payment intents
 */
const listPaymentIntents = async (filters = {}) => {
    try {
        const { limit = 10, starting_after = null } = filters;
        
        const paymentIntents = await stripe.paymentIntents.list({
            limit,
            ...(starting_after && { starting_after })
        });

        return paymentIntents.data;
    } catch (error) {
        console.error('List Payment Intents Error:', error);
        throw new Error(`Failed to list payment intents: ${error.message}`);
    }
};

module.exports = {
    stripe,
    createCheckoutSession,
    verifyWebhookSignature,
    retrieveSession,
    retrievePaymentIntent,
    createRefund,
    listPaymentIntents
};

