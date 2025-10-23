// ===============================
// Payment Controller
// ===============================

const { successResponse, errorResponse } = require('../../Helper/helper');
const { prisma } = require('../../config/db');

// ===================================
// RECORD PAYMENT
// ===================================
const recordPayment = async (req, res) => {
    try {
        const {
            tenantId,
            allocationId,
            bookingId,
            hostelId,
            amount,
            paymentType,
            paymentMethod,
            paymentDate,
            forMonth,
            forPeriod,
            transactionId,
            receiptNumber,
            remarks,
            attachments
        } = req.body;

        // Validation
        if (!hostelId || !amount || !paymentType || !paymentMethod) {
            return errorResponse(
                res,
                "Hostel, amount, payment type, and payment method are required",
                400
            );
        }

        // At least one of tenantId, allocationId, or bookingId must be provided
        if (!tenantId && !allocationId && !bookingId) {
            return errorResponse(
                res,
                "At least one of tenantId, allocationId, or bookingId is required",
                400
            );
        }

        if (amount <= 0) {
            return errorResponse(res, "Amount must be greater than 0", 400);
        }

        // Check if tenant exists (if provided)
        if (tenantId) {
            const tenant = await prisma.tenant.findUnique({
                where: { id: parseInt(tenantId) }
            });

            if (!tenant) {
                return errorResponse(res, "Tenant not found", 404);
            }
        }

        // Check if booking exists (if provided)
        let booking = null;
        if (bookingId) {
            booking = await prisma.booking.findUnique({
                where: { id: parseInt(bookingId) }
            });

            if (!booking) {
                return errorResponse(res, "Booking not found", 404);
            }
        }

        // Check if receipt number already exists
        if (receiptNumber) {
            const existingReceipt = await prisma.payment.findUnique({
                where: { receiptNumber: receiptNumber }
            });

            if (existingReceipt) {
                return errorResponse(res, "Receipt number already exists", 400);
            }
        }

        // Use transaction to update tenant totals and booking status
        const payment = await prisma.$transaction(async (tx) => {
            // Create payment
            const newPayment = await tx.payment.create({
                data: {
                    tenant: tenantId ? { connect: { id: parseInt(tenantId) } } : undefined,
                    hostel: hostelId ? { connect: { id: parseInt(hostelId) } } : undefined,
                    allocation: allocationId ? { connect: { id: parseInt(allocationId) } } : undefined,
                    booking: bookingId ? { connect: { id: parseInt(bookingId) } } : undefined,
                    collector: req.userId ? { connect: { id: parseInt(req.userId) } } : undefined,
                    amount: parseFloat(amount),
                    paymentType: paymentType,
                    paymentMethod: paymentMethod,
                    paymentDate: paymentDate ? new Date(paymentDate) : new Date(),
                    forMonth: forMonth || null,
                    forPeriod: forPeriod || null,
                    transactionId: transactionId || null,
                    receiptNumber: receiptNumber || null,
                    status: 'paid',
                    remarks: remarks || null,
                    attachments: attachments || null
                }
            });

            // Automatically create transaction when payment status is 'paid'
            await tx.transaction.create({
                data: {
                    paymentId: newPayment.id,
                    tenantId: tenantId ? parseInt(tenantId) : null,
                    hostelId: hostelId ? parseInt(hostelId) : null,
                    gateway: 'manual',
                    transactionType: paymentType || 'rent',
                    amount: parseFloat(amount),
                    currency: 'PKR',
                    fee: 0,
                    gatewayRef: transactionId || null,
                    orderId: receiptNumber || null,
                    status: 'completed',
                    responseCode: '200',
                    responseMessage: 'Payment completed successfully',
                    paymentMethod: paymentMethod,
                    ipAddress: req.ip || null,
                    userAgent: req.headers['user-agent'] || null
                }
            });

            // Update tenant's totalPaid (if tenant exists)
            if (tenantId) {
                await tx.tenant.update({
                    where: { id: parseInt(tenantId) },
                    data: {
                        totalPaid: { increment: parseFloat(amount) }
                    }
                });
            }

            // Update allocation payment status (if allocation exists)
            if (allocationId) {
                await tx.allocation.update({
                    where: { id: parseInt(allocationId) },
                    data: {
                        paymentStatus: 'paid'
                    }
                });
            }

            // Update booking payment status and advance paid (if booking exists)
            if (bookingId && booking) {
                const totalPaid = (booking.advancePaid || 0) + parseFloat(amount);
                const totalAmount = booking.totalAmount || 0;
                
                let newPaymentStatus = 'pending';
                let newBookingStatus = booking.status;

                // Determine payment status
                if (totalPaid >= totalAmount) {
                    newPaymentStatus = 'paid';
                    // If booking was pending, confirm it after full payment
                    if (booking.status === 'pending') {
                        newBookingStatus = 'confirmed';
                    }
                } else if (totalPaid > 0) {
                    newPaymentStatus = 'partial';
                    // If booking was pending and partial payment is received, confirm it
                    if (booking.status === 'pending') {
                        newBookingStatus = 'confirmed';
                    }
                }

                await tx.booking.update({
                    where: { id: parseInt(bookingId) },
                    data: {
                        advancePaid: totalPaid,
                        paymentStatus: newPaymentStatus,
                        status: newBookingStatus,
                        paymentMethod: paymentMethod,
                        transactionId: transactionId || booking.transactionId
                    }
                });
            }

            // If it's a deposit payment, update securityDeposit (only if tenant exists)
            if (paymentType === 'deposit' && tenantId) {
                await tx.tenant.update({
                    where: { id: parseInt(tenantId) },
                    data: {
                        securityDeposit: { increment: parseFloat(amount) }
                    }
                });
            }

            return newPayment;
        });

        // Fetch payment with relations including transactions
        const populatedPayment = await prisma.payment.findUnique({
            where: { id: parseInt(payment.id) },
            include: {
                tenant: { select: { id: true, name: true, phone: true } },
                hostel: { select: { name: true } },
                allocation: {
                    select: {
                        bed: { select: { bedNumber: true } },
                        room: { select: { roomNumber: true } }
                    }
                },
                booking: {
                    select: {
                        id: true,
                        bookingCode: true,
                        status: true,
                        paymentStatus: true,
                        totalAmount: true,
                        advancePaid: true
                    }
                },
                collector: { select: { name: true } },
                transactions: {
                    select: {
                        id: true,
                        gateway: true,
                        transactionType: true,
                        amount: true,
                        status: true,
                        createdAt: true
                    }
                }
            }
        });

        return successResponse(res, populatedPayment, "Payment recorded successfully and transaction created automatically", 201);
    } catch (err) {
        console.error("Record Payment Error:", err);
        return errorResponse(res, err.message, 400);
    }
};

// ===================================
// GET ALL PAYMENTS
// ===================================
const getAllPayments = async (req, res) => {
    try {
        const {
            tenantId,
            hostelId,
            paymentType,
            allocationId,
            bookingId,
            paymentMethod,
            status,
            forMonth,
            startDate,
            endDate,
            page = 1,
            limit = 20
        } = req.query;

        // Build filter
        const where = {};
        if (tenantId) where.tenantId = parseInt(tenantId);
        if (hostelId) where.hostelId = parseInt(hostelId);
        if (allocationId) where.allocationId = parseInt(allocationId);
        if (bookingId) where.bookingId = parseInt(bookingId);
        if (paymentType) where.paymentType = paymentType;
        if (paymentMethod) where.paymentMethod = paymentMethod;
        if (status) where.status = status;
        if (forMonth) where.forMonth = forMonth;

        // Date range filter
        if (startDate || endDate) {
            where.paymentDate = {};
            if (startDate) where.paymentDate.gte = new Date(startDate);
            if (endDate) where.paymentDate.lte = new Date(endDate);
        }

        // Pagination
        const skip = (page - 1) * limit;

        const [payments, total] = await Promise.all([
            prisma.payment.findMany({
                where,
                include: {
                    tenant: { select: { id: true, name: true, phone: true } },
                    hostel: { select: { name: true } },
                    allocation: {
                        select: {
                            bed: { select: { bedNumber: true } },
                            room: { select: { roomNumber: true } }
                        }
                    },
                    booking: {
                        select: {
                            id: true,
                            bookingCode: true,
                            status: true,
                            paymentStatus: true,
                            customerName: true,
                            customerPhone: true,
                            totalAmount: true,
                            advancePaid: true
                        }
                    },
                    collector: { select: { name: true } },
                    transactions: {
                        select: {
                            id: true,
                            gateway: true,
                            transactionType: true,
                            amount: true,
                            status: true,
                            createdAt: true
                        }
                    }
                },
                orderBy: { paymentDate: 'desc' },
                take: parseInt(limit),
                skip: skip
            }),
            prisma.payment.count({ where })
        ]);

        // Calculate totals
        const totals = await prisma.payment.aggregate({
            where,
            _sum: { amount: true }
        });

        return successResponse(res, {
            payments,
            totalAmount: totals._sum.amount || 0,
            pagination: {
                total,
                page: parseInt(page),
                limit: parseInt(limit),
                pages: Math.ceil(total / limit)
            }
        }, "Payments retrieved successfully", 200);
    } catch (err) {
        console.error("Get All Payments Error:", err);
        return errorResponse(res, err.message, 400);
    }
};

// ===================================
// GET PAYMENT BY ID
// ===================================
const getPaymentById = async (req, res) => {
    try {
        const { id } = req.params;

        const payment = await prisma.payment.findUnique({
            where: { id: parseInt(id) },
            include: {
                tenant: {
                    select: {
                        id: true,
                        name: true,
                        email: true,
                        phone: true,
                        address: true
                    }
                },
                hostel: { select: { name: true, address: true } },
                allocation: {
                    select: {
                        bed: { select: { bedNumber: true } },
                        room: { select: { roomNumber: true } },
                        floor: { select: { floorNumber: true } }
                    }
                },
                booking: {
                    select: {
                        id: true,
                        bookingCode: true,
                        status: true,
                        paymentStatus: true,
                        totalAmount: true,
                        advancePaid: true,
                        customerName: true,
                        customerPhone: true,
                        customerEmail: true,
                        checkInDate: true,
                        checkOutDate: true
                    }
                },
                collector: { select: { name: true, email: true } },
                transactions: {
                    select: {
                        id: true,
                        gateway: true,
                        transactionType: true,
                        amount: true,
                        currency: true,
                        fee: true,
                        status: true,
                        responseCode: true,
                        responseMessage: true,
                        createdAt: true
                    }
                }
            }
        });

        if (!payment) {
            return errorResponse(res, "Payment not found", 404);
        }

        return successResponse(res, payment, "Payment retrieved successfully", 200);
    } catch (err) {
        console.error("Get Payment Error:", err);
        return errorResponse(res, err.message, 400);
    }
};

// ===================================
// UPDATE PAYMENT
// ===================================
const updatePayment = async (req, res) => {
    try {
        const { id } = req.params;
        const updates = req.body;

        // Fields that can be updated
        const updateData = {};
        if (updates.paymentDate !== undefined) updateData.paymentDate = new Date(updates.paymentDate);
        if (updates.forMonth !== undefined) updateData.forMonth = updates.forMonth;
        if (updates.forPeriod !== undefined) updateData.forPeriod = updates.forPeriod;
        if (updates.transactionId !== undefined) updateData.transactionId = updates.transactionId;
        if (updates.receiptNumber !== undefined) updateData.receiptNumber = updates.receiptNumber;
        if (updates.status !== undefined) updateData.status = updates.status;
        if (updates.remarks !== undefined) updateData.remarks = updates.remarks;
        if (updates.attachments !== undefined) updateData.attachments = updates.attachments;

        const payment = await prisma.payment.update({
            where: { id: parseInt(id) },
            data: updateData,
            include: {
                tenant: { select: { name: true } },
                hostel: { select: { name: true } }
            }
        });

        return successResponse(res, payment, "Payment updated successfully", 200);
    } catch (err) {
        if (err.code === 'P2025') {
            return errorResponse(res, "Payment not found", 404);
        }
        console.error("Update Payment Error:", err);
        return errorResponse(res, err.message, 400);
    }
};

// ===================================
// DELETE PAYMENT
// ===================================
const deletePayment = async (req, res) => {
    try {
        const { id } = req.params;

        // Get payment details first
        const payment = await prisma.payment.findUnique({
            where: { id: parseInt(id) }
        });

        if (!payment) {
            return errorResponse(res, "Payment not found", 404);
        }

        // Use transaction to update tenant totals
        await prisma.$transaction(async (tx) => {
            // Delete payment
            await tx.payment.delete({
                where: { id: parseInt(id) }
            });

            // Update tenant's totalPaid
            await tx.tenant.update({
                where: { id: payment.tenantId },
                data: {
                    totalPaid: { decrement: payment.amount }
                }
            });

            // If it was a deposit payment, update securityDeposit
            if (payment.paymentType === 'deposit') {
                await tx.tenant.update({
                    where: { id: payment.tenantId },
                    data: {
                        securityDeposit: { decrement: payment.amount }
                    }
                });
            }
        });

        return successResponse(res, null, "Payment deleted successfully", 200);
    } catch (err) {
        console.error("Delete Payment Error:", err);
        return errorResponse(res, err.message, 400);
    }
};

// ===================================
// GET PAYMENT SUMMARY
// ===================================
const getPaymentSummary = async (req, res) => {
    try {
        const { hostelId, startDate, endDate, groupBy = 'month' } = req.query;

        const where = {};
        if (hostelId) where.hostelId = parseInt(hostelId);

        // Date range filter
        if (startDate || endDate) {
            where.paymentDate = {};
            if (startDate) where.paymentDate.gte = new Date(startDate);
            if (endDate) where.paymentDate.lte = new Date(endDate);
        }

        // Summary by payment type
        const byType = await prisma.payment.groupBy({
            by: ['paymentType'],
            where,
            _sum: { amount: true },
            _count: true
        });

        // Summary by payment method
        const byMethod = await prisma.payment.groupBy({
            by: ['paymentMethod'],
            where,
            _sum: { amount: true },
            _count: true
        });

        // Summary by status
        const byStatus = await prisma.payment.groupBy({
            by: ['status'],
            where,
            _sum: { amount: true },
            _count: true
        });

        // Total summary
        const total = await prisma.payment.aggregate({
            where,
            _sum: { amount: true },
            _count: true
        });

        // Recent payments
        const recentPayments = await prisma.payment.findMany({
            where,
            include: {
                tenant: { select: { name: true } },
                hostel: { select: { name: true } }
            },
            orderBy: { paymentDate: 'desc' },
            take: 10
        });

        return successResponse(res, {
            total: {
                amount: total._sum.amount || 0,
                count: total._count
            },
            byType,
            byMethod,
            byStatus,
            recentPayments
        }, "Payment summary retrieved successfully", 200);
    } catch (err) {
        console.error("Get Payment Summary Error:", err);
        return errorResponse(res, err.message, 400);
    }
};

// ===================================
// GET PENDING PAYMENTS (DUE PAYMENTS)
// ===================================
const getPendingPayments = async (req, res) => {
    try {
        const { hostelId } = req.query;

        // Get all active allocations
        const where = { status: 'active' };
        if (hostelId) where.hostelId = parseInt(hostelId);

        const activeAllocations = await prisma.allocation.findMany({
            where,
            include: {
                tenant: {
                    select: {
                        id: true,
                        name: true,
                        phone: true,
                        totalPaid: true,
                        totalDue: true
                    }
                },
                bed: { select: { bedNumber: true } },
                room: { select: { roomNumber: true } },
                hostel: { select: { name: true } },
                payments: {
                    select: {
                        amount: true,
                        paymentDate: true,
                        paymentType: true
                    },
                    orderBy: { paymentDate: 'desc' }
                }
            }
        });

        // Calculate pending amounts
        const pendingPayments = activeAllocations.map(allocation => {
            const totalRent = allocation.rentAmount;
            const totalDeposit = allocation.depositAmount;
            const totalExpected = totalRent + totalDeposit;

            const rentPaid = allocation.payments
                .filter(p => p.paymentType === 'rent')
                .reduce((sum, p) => sum + p.amount, 0);

            const depositPaid = allocation.payments
                .filter(p => p.paymentType === 'deposit')
                .reduce((sum, p) => sum + p.amount, 0);

            const totalPaid = rentPaid + depositPaid;
            const pendingAmount = totalExpected - totalPaid;

            return {
                allocation: {
                    id: allocation.id,
                    bed: allocation.bed.bedNumber,
                    room: allocation.room.roomNumber,
                    hostel: allocation.hostel.name,
                    checkInDate: allocation.checkInDate,
                    rentAmount: allocation.rentAmount
                },
                tenant: allocation.tenant,
                financial: {
                    expectedRent: totalRent,
                    expectedDeposit: totalDeposit,
                    rentPaid,
                    depositPaid,
                    totalPaid,
                    pendingAmount,
                    lastPaymentDate: allocation.payments[0]?.paymentDate || null
                },
                status: pendingAmount > 0 ? 'pending' : 'paid'
            };
        });

        // Filter only pending
        const pending = pendingPayments.filter(p => p.status === 'pending');

        return successResponse(res, {
            pendingPayments: pending,
            totalPending: pending.reduce((sum, p) => sum + p.financial.pendingAmount, 0),
            count: pending.length
        }, "Pending payments retrieved successfully", 200);
    } catch (err) {
        console.error("Get Pending Payments Error:", err);
        return errorResponse(res, err.message, 400);
    }
};

module.exports = {
    recordPayment,
    getAllPayments,
    getPaymentById,
    updatePayment,
    deletePayment,
    getPaymentSummary,
    getPendingPayments
};

