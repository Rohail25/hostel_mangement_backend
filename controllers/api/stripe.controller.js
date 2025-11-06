/**
 * ======================================
 * STRIPE PAYMENT CONTROLLER
 * ======================================
 * 
 * Handles all Stripe payment operations for the Hostel Management System
 * 
 * FLOW:
 * 1. Frontend calls /api/stripe/create-checkout-session with booking details
 * 2. Backend creates Stripe session and returns URL
 * 3. Frontend redirects user to Stripe Checkout
 * 4. User completes payment on Stripe
 * 5. Stripe sends webhook to /api/stripe/webhook
 * 6. Backend updates Booking → Payment → Transaction → Status
 * 7. Frontend shows success page
 */

const { successResponse, errorResponse } = require('../../Helper/helper');
const { prisma } = require('../../config/db');
const {
    createCheckoutSession,
    verifyWebhookSignature,
    retrieveSession,
    retrievePaymentIntent,
    createRefund
} = require('../../Helper/stripe.helper');

/**
 * ======================================
 * CREATE STRIPE CHECKOUT SESSION
 * ======================================
 * 
 * Creates a Stripe Checkout session for a booking payment
 * 
 * POST /api/stripe/create-checkout-session
 * 
 * Body:
 * {
 *   "bookingId": 1,
 *   "paymentType": "rent" // optional, defaults to "rent"
 * }
 */
const createStripeCheckoutSession = async (req, res) => {
    try {
        const { bookingId, paymentType = 'rent' } = req.body;

        // Validation
        if (!bookingId) {
            return errorResponse(res, 'Booking ID is required', 400);
        }

        // Fetch booking details with relations
        const booking = await prisma.booking.findUnique({
            where: { id: parseInt(bookingId) },
            include: {
                tenant: {
                    select: {
                        id: true,
                        name: true,
                        email: true,
                        phone: true
                    }
                },
                hostel: {
                    select: {
                        id: true,
                        name: true,
                        address: true,
                        images: true
                    }
                },
                room: {
                    select: {
                        id: true,
                        roomNumber: true,
                        roomType: true,
                        pricePerBed: true
                    }
                },
                bed: {
                    select: {
                        id: true,
                        bedNumber: true,
                        bedType: true
                    }
                }
            }
        });

        if (!booking) {
            return errorResponse(res, 'Booking not found', 404);
        }

        // Check if booking is already paid or cancelled
        if (booking.status === 'cancelled') {
            return errorResponse(res, 'Cannot process payment for cancelled booking', 400);
        }

        if (booking.paymentStatus === 'paid') {
            return errorResponse(res, 'Booking is already fully paid', 400);
        }

        // Calculate amount to charge (remaining amount if partial payment exists)
        const remainingAmount = (booking.totalAmount || 0) - (booking.advancePaid || 0);

        if (remainingAmount <= 0) {
            return errorResponse(res, 'No payment required for this booking', 400);
        }

        // Prepare customer information
        const customerEmail = booking.customerEmail || booking.tenant?.email || 'guest@hostel.com';
        const customerName = booking.customerName || booking.tenant?.name || 'Guest';

        // Create Stripe Checkout Session
        const sessionData = await createCheckoutSession({
            bookingId: booking.id,
            bookingCode: booking.bookingCode,
            amount: remainingAmount,
            customerEmail: customerEmail,
            customerName: customerName,
            hostelDetails: booking.hostel || {},
            roomDetails: booking.room || {},
            checkInDate: booking.checkInDate,
            checkOutDate: booking.checkOutDate
        });

        // Store session ID in booking for reference (optional but recommended)
        await prisma.booking.update({
            where: { id: booking.id },
            data: {
                transactionId: sessionData.sessionId, // Store Stripe session ID
                paymentMethod: 'stripe'
            }
        });

        // Return session details to frontend
        return successResponse(res, {
            sessionId: sessionData.sessionId,
            sessionUrl: sessionData.url,
            expiresAt: sessionData.expiresAt,
            bookingCode: booking.bookingCode,
            amount: remainingAmount
        }, 'Stripe checkout session created successfully', 201);

    } catch (error) {
        console.error('Create Stripe Checkout Session Error:', error);
        return errorResponse(res, error.message, 500);
    }
};

/**
 * ======================================
 * STRIPE WEBHOOK HANDLER
 * ======================================
 * 
 * Handles webhook events from Stripe
 * This endpoint is called by Stripe when payment events occur
 * 
 * POST /api/stripe/webhook
 * 
 * IMPORTANT: This route requires RAW body (not JSON parsed)
 * See app.js for special handling
 */
const handleStripeWebhook = async (req, res) => {
    try {
        const signature = req.headers['stripe-signature'];
        const payload = req.rawBody; // Raw body from middleware

        if (!signature) {
            console.error('No Stripe signature found in headers');
            return res.status(400).send('No signature');
        }

        if (!payload) {
            console.error('No raw body found in request');
            return res.status(400).send('No payload');
        }

        // Verify webhook signature
        let event;
        try {
            event = verifyWebhookSignature(payload, signature);
        } catch (err) {
            console.error('Webhook signature verification failed:', err.message);
            return res.status(400).send(`Webhook Error: ${err.message}`);
        }

        console.log('✅ Stripe webhook received:', event.type);

        // Handle different event types
        switch (event.type) {
            case 'checkout.session.completed':
                await handleCheckoutSessionCompleted(event.data.object);
                break;

            case 'checkout.session.expired':
                await handleCheckoutSessionExpired(event.data.object);
                break;

            case 'payment_intent.succeeded':
                await handlePaymentIntentSucceeded(event.data.object);
                break;

            case 'payment_intent.payment_failed':
                await handlePaymentIntentFailed(event.data.object);
                break;

            case 'charge.refunded':
                await handleChargeRefunded(event.data.object);
                break;

            default:
                console.log(`Unhandled event type: ${event.type}`);
        }

        // Return 200 to acknowledge receipt
        res.status(200).json({ received: true });

    } catch (error) {
        console.error('Webhook Handler Error:', error);
        res.status(500).send(`Webhook Error: ${error.message}`);
    }
};

/**
 * ======================================
 * HANDLE CHECKOUT SESSION COMPLETED
 * ======================================
 * Triggered when user successfully completes payment on Stripe Checkout
 */
const handleCheckoutSessionCompleted = async (session) => {
    try {
        console.log('💰 Processing checkout.session.completed');
        console.log('Session ID:', session.id);
        console.log('Payment Status:', session.payment_status);

        const metadata = session.metadata;
        const bookingId = parseInt(metadata.bookingId);

        if (!bookingId) {
            console.error('No booking ID in session metadata');
            return;
        }

        // Fetch current booking
        const booking = await prisma.booking.findUnique({
            where: { id: bookingId },
            include: {
                tenant: true
            }
        });

        if (!booking) {
            console.error(`Booking ${bookingId} not found`);
            return;
        }

        // Calculate amounts
        const amountPaid = session.amount_total / 100; // Convert from paisa to PKR
        const totalPaid = (booking.advancePaid || 0) + amountPaid;
        const totalAmount = booking.totalAmount || 0;

        // Determine payment status
        let paymentStatus = 'pending';
        if (totalPaid >= totalAmount) {
            paymentStatus = 'paid';
        } else if (totalPaid > 0) {
            paymentStatus = 'partial';
        }

        // Use Prisma transaction to ensure data consistency
        await prisma.$transaction(async (tx) => {
            // 1. Create Payment record
            const payment = await tx.payment.create({
                data: {
                    tenantId: booking.tenantId,
                    bookingId: booking.id,
                    hostelId: booking.hostelId,
                    amount: amountPaid,
                    paymentType: metadata.paymentType || 'rent',
                    paymentMethod: 'stripe',
                    paymentDate: new Date(),
                    transactionId: session.payment_intent,
                    receiptNumber: `STRIPE-${session.id.slice(-10).toUpperCase()}`,
                    status: 'paid',
                    remarks: `Stripe payment - Session: ${session.id}`
                }
            });

            console.log('✅ Payment record created:', payment.id);

            // Map payment type to transaction type (all payments are RECEIVABLE - money coming in)
            const transactionTypeMapping = {
                'rent': 'rent_received',
                'deposit': 'deposit_received',
                'maintenance': 'maintenance_received',
                'electricity': 'dues_received',
                'water': 'dues_received',
                'other': 'other_received'
            };
            
            const paymentType = metadata.paymentType || 'rent';
            const transactionType = transactionTypeMapping[paymentType] || 'other_received';

            // 2. Create Transaction record (audit log)
            const transaction = await tx.transaction.create({
                data: {
                    paymentId: payment.id,
                    tenantId: booking.tenantId,
                    hostelId: booking.hostelId,
                    gateway: 'Stripe',
                    transactionType: transactionType,  // Use mapped receivable type
                    amount: amountPaid,
                    currency: session.currency.toUpperCase(),
                    fee: 0, // Stripe fees can be added if needed
                    gatewayRef: session.payment_intent,
                    orderId: session.id,
                    status: 'completed',
                    responseCode: '200',
                    responseMessage: `Stripe payment received: ${paymentType}`,
                    rawResponse: session,
                    paymentMethod: 'stripe',
                    ipAddress: session.customer_details?.ip || null,
                    userAgent: session.customer_details?.user_agent || null
                }
            });

            console.log('✅ Transaction record created:', transaction.id);

            // 3. Update Booking status
            const newBookingStatus = booking.status === 'pending' ? 'confirmed' : booking.status;
            
            await tx.booking.update({
                where: { id: booking.id },
                data: {
                    advancePaid: totalPaid,
                    paymentStatus: paymentStatus,
                    status: newBookingStatus,
                    paymentMethod: 'stripe',
                    transactionId: session.payment_intent
                }
            });

            console.log(`✅ Booking ${booking.bookingCode} updated: ${booking.status} → ${newBookingStatus}`);

            // 4. Update Tenant totals (if tenant exists)
            if (booking.tenantId) {
                await tx.tenant.update({
                    where: { id: booking.tenantId },
                    data: {
                        totalPaid: { increment: amountPaid }
                    }
                });

                console.log('✅ Tenant totalPaid updated');
            }

            // 5. If payment type is deposit, update tenant's security deposit
            if (metadata.paymentType === 'deposit' && booking.tenantId) {
                await tx.tenant.update({
                    where: { id: booking.tenantId },
                    data: {
                        securityDeposit: { increment: amountPaid }
                    }
                });

                console.log('✅ Tenant securityDeposit updated');
            }
        });

        console.log('✅ Checkout session completed successfully');

    } catch (error) {
        console.error('Handle Checkout Session Completed Error:', error);
        throw error;
    }
};

/**
 * ======================================
 * HANDLE CHECKOUT SESSION EXPIRED
 * ======================================
 * Triggered when checkout session expires without payment
 */
const handleCheckoutSessionExpired = async (session) => {
    try {
        console.log('⏱️ Processing checkout.session.expired');

        const metadata = session.metadata;
        const bookingId = parseInt(metadata.bookingId);

        if (!bookingId) {
            console.error('No booking ID in session metadata');
            return;
        }

        // Optionally mark booking as expired or send notification
        // For now, we'll just log it
        console.log(`Checkout session expired for booking ${bookingId}`);

        // You can implement auto-expiry logic here if needed
        // await prisma.booking.update({
        //     where: { id: bookingId },
        //     data: { status: 'expired' }
        // });

    } catch (error) {
        console.error('Handle Checkout Session Expired Error:', error);
    }
};

/**
 * ======================================
 * HANDLE PAYMENT INTENT SUCCEEDED
 * ======================================
 * Additional confirmation that payment was processed
 */
const handlePaymentIntentSucceeded = async (paymentIntent) => {
    try {
        console.log('✅ Payment intent succeeded:', paymentIntent.id);
        // This is mainly for logging and additional verification
        // The main logic is handled in checkout.session.completed
    } catch (error) {
        console.error('Handle Payment Intent Succeeded Error:', error);
    }
};

/**
 * ======================================
 * HANDLE PAYMENT INTENT FAILED
 * ======================================
 * Triggered when payment fails
 */
const handlePaymentIntentFailed = async (paymentIntent) => {
    try {
        console.log('❌ Payment intent failed:', paymentIntent.id);
        
        // Find associated transaction and update status
        const transaction = await prisma.transaction.findFirst({
            where: { gatewayRef: paymentIntent.id }
        });

        if (transaction) {
            await prisma.transaction.update({
                where: { id: transaction.id },
                data: {
                    status: 'failed',
                    responseCode: paymentIntent.last_payment_error?.code || 'failed',
                    responseMessage: paymentIntent.last_payment_error?.message || 'Payment failed'
                }
            });

            console.log('✅ Transaction marked as failed');
        }

    } catch (error) {
        console.error('Handle Payment Intent Failed Error:', error);
    }
};

/**
 * ======================================
 * HANDLE CHARGE REFUNDED
 * ======================================
 * Triggered when a refund is processed
 */
const handleChargeRefunded = async (charge) => {
    try {
        console.log('💸 Processing charge.refunded:', charge.id);

        const refundAmount = charge.amount_refunded / 100; // Convert to PKR

        // Find the original transaction
        const transaction = await prisma.transaction.findFirst({
            where: { gatewayRef: charge.payment_intent },
            include: { payment: true }
        });

        if (transaction && transaction.payment) {
            await prisma.$transaction(async (tx) => {
                // Update transaction status
                await tx.transaction.update({
                    where: { id: transaction.id },
                    data: {
                        status: 'refunded',
                        responseMessage: 'Payment refunded'
                    }
                });

                // Update payment status
                await tx.payment.update({
                    where: { id: transaction.payment.id },
                    data: {
                        status: 'pending',
                        remarks: `Refund processed: ${refundAmount} PKR`
                    }
                });

                // Update booking if exists
                if (transaction.payment.bookingId) {
                    const booking = await tx.booking.findUnique({
                        where: { id: transaction.payment.bookingId }
                    });

                    if (booking) {
                        await tx.booking.update({
                            where: { id: booking.id },
                            data: {
                                advancePaid: Math.max(0, (booking.advancePaid || 0) - refundAmount),
                                paymentStatus: 'pending'
                            }
                        });
                    }
                }

                // Update tenant totals
                if (transaction.tenantId) {
                    await tx.tenant.update({
                        where: { id: transaction.tenantId },
                        data: {
                            totalPaid: { decrement: refundAmount }
                        }
                    });
                }
            });

            console.log('✅ Refund processed successfully');
        }

    } catch (error) {
        console.error('Handle Charge Refunded Error:', error);
    }
};

/**
 * ======================================
 * GET SESSION STATUS
 * ======================================
 * Frontend can call this to check session/payment status
 * 
 * GET /api/stripe/session/:sessionId
 */
const getSessionStatus = async (req, res) => {
    try {
        const { sessionId } = req.params;

        if (!sessionId) {
            return errorResponse(res, 'Session ID is required', 400);
        }

        // Retrieve session from Stripe
        const session = await retrieveSession(sessionId);

        return successResponse(res, {
            sessionId: session.id,
            paymentStatus: session.payment_status,
            customerEmail: session.customer_details?.email,
            amountTotal: session.amount_total / 100,
            currency: session.currency,
            metadata: session.metadata
        }, 'Session retrieved successfully', 200);

    } catch (error) {
        console.error('Get Session Status Error:', error);
        return errorResponse(res, error.message, 400);
    }
};

/**
 * ======================================
 * CREATE REFUND
 * ======================================
 * Admin can initiate refund for a booking
 * 
 * POST /api/stripe/refund
 * Body: { "bookingId": 1, "amount": 5000, "reason": "requested_by_customer" }
 */
const initiateRefund = async (req, res) => {
    try {
        const { bookingId, amount, reason = 'requested_by_customer' } = req.body;

        if (!bookingId) {
            return errorResponse(res, 'Booking ID is required', 400);
        }

        // Find booking with payment details
        const booking = await prisma.booking.findUnique({
            where: { id: parseInt(bookingId) },
            include: {
                payments: {
                    where: {
                        paymentMethod: 'stripe',
                        status: 'paid'
                    },
                    orderBy: { createdAt: 'desc' },
                    take: 1
                }
            }
        });

        if (!booking) {
            return errorResponse(res, 'Booking not found', 404);
        }

        if (!booking.payments || booking.payments.length === 0) {
            return errorResponse(res, 'No Stripe payment found for this booking', 404);
        }

        const payment = booking.payments[0];

        // Get payment intent ID
        const paymentIntentId = payment.transactionId || booking.transactionId;

        if (!paymentIntentId) {
            return errorResponse(res, 'Payment intent ID not found', 404);
        }

        // Create refund via Stripe
        const refund = await createRefund(paymentIntentId, amount, reason);

        return successResponse(res, {
            refundId: refund.id,
            amount: refund.amount / 100,
            status: refund.status,
            reason: refund.reason
        }, 'Refund initiated successfully', 200);

    } catch (error) {
        console.error('Initiate Refund Error:', error);
        return errorResponse(res, error.message, 400);
    }
};

module.exports = {
    createStripeCheckoutSession,
    handleStripeWebhook,
    getSessionStatus,
    initiateRefund
};

