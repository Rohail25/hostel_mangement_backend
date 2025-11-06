const { PrismaClient } = require('@prisma/client');
const { successResponse, errorResponse } = require('../../Helper/helper');
const prisma = new PrismaClient();

/**
 * =====================================================
 * TRANSACTION CONTROLLER - Refactored Flow
 * =====================================================
 * 
 * Transaction Types (transactionType field):
 * 
 * RECEIVABLE (Money Coming In - Positive):
 * - rent_received
 * - deposit_received
 * - advance_received
 * - dues_received
 * - other_received
 * 
 * PAYABLE (Money Going Out - Negative):
 * - salary_paid
 * - vendor_paid
 * - maintenance_paid
 * - utility_paid
 * - refund_paid
 * - other_paid
 * 
 * This ensures clear distinction between money in vs money out.
 */

// =================== HELPER FUNCTIONS ===================

/**
 * Determine if transaction is Receivable or Payable based on type
 */
const getTransactionCategory = (transactionType) => {
    const receivableTypes = [
        'rent_received', 'rent', 'deposit_received', 'deposit',
        'advance_received', 'advance', 'dues_received', 'other_received'
    ];
    const payableTypes = [
        'salary_paid', 'vendor_paid', 'maintenance_paid', 
        'utility_paid', 'refund_paid', 'other_paid', 'refund'
    ];
    
    const type = transactionType?.toLowerCase();
    
    if (receivableTypes.some(t => type?.includes(t))) {
        return 'receivable';
    } else if (payableTypes.some(t => type?.includes(t))) {
        return 'payable';
    }
    
    return 'other';
};

/**
 * Calculate signed amount based on category
 * Receivable: positive, Payable: negative
 */
const getSignedAmount = (amount, category) => {
    const absAmount = Math.abs(parseFloat(amount));
    return category === 'payable' ? -absAmount : absAmount;
};

// =================== CREATE TRANSACTION ===================
exports.createTransaction = async (req, res) => {
    try {
        const {
            paymentId,
            tenantId,
            hostelId,
            gateway,
            transactionType,
            amount,
            currency,
            fee,
            gatewayRef,
            orderId,
            merchantTxnId,
            status,
            responseCode,
            responseMessage,
            rawResponse,
            paymentMethod,
            ipAddress,
            userAgent
        } = req.body;

        // Validation
        if (!transactionType || !amount) {
            return errorResponse(res, 'Transaction type and amount are required', 400);
        }

        // Verify payment exists if paymentId provided
        if (paymentId) {
            const payment = await prisma.payment.findUnique({
                where: { id: parseInt(paymentId) }
            });

            if (!payment) {
                return errorResponse(res, 'Payment not found', 404);
            }
        }

        // Determine category (receivable/payable)
        const category = getTransactionCategory(transactionType);

        // Create transaction
        const transaction = await prisma.transaction.create({
            data: {
                paymentId: paymentId ? parseInt(paymentId) : null,
                tenantId: tenantId ? parseInt(tenantId) : null,
                hostelId: hostelId ? parseInt(hostelId) : null,
                gateway: gateway || 'manual',
                transactionType,
                amount: parseFloat(amount),
                currency: currency || 'PKR',
                fee: fee ? parseFloat(fee) : 0,
                gatewayRef,
                orderId,
                merchantTxnId,
                status: status || 'completed',
                responseCode,
                responseMessage,
                rawResponse,
                paymentMethod: paymentMethod || 'cash',
                ipAddress,
                userAgent
            },
            include: {
                payment: {
                    include: {
                        tenant: {
                            select: {
                                id: true,
                                name: true,
                                email: true,
                                phone: true
                            }
                        }
                    }
                },
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
                        name: true
                    }
                }
            }
        });

        // Add category to response
        const responseData = {
            ...transaction,
            category,
            signedAmount: getSignedAmount(transaction.amount, category)
        };

        return successResponse(res, responseData, 'Transaction created successfully', 201);

    } catch (error) {
        console.error('Create transaction error:', error);
        return errorResponse(res, 'Failed to create transaction', 500);
    }
};

// =================== GET ALL TRANSACTIONS WITH RECEIVABLE/PAYABLE ===================
exports.getAllTransactions = async (req, res) => {
    try {
        const {
            status,
            gateway,
            transactionType,
            category, // New: filter by receivable/payable
            paymentMethod,
            tenantId,
            hostelId,
            paymentId,
            startDate,
            endDate,
            search,
            page = 1,
            limit = 10
        } = req.query;

        const skip = (parseInt(page) - 1) * parseInt(limit);

        // Build filters
        const filters = {};

        if (status) filters.status = status;
        if (gateway) filters.gateway = gateway;
        if (transactionType) filters.transactionType = transactionType;
        if (paymentMethod) filters.paymentMethod = paymentMethod;
        if (tenantId) filters.tenantId = parseInt(tenantId);
        if (hostelId) filters.hostelId = parseInt(hostelId);
        if (paymentId) filters.paymentId = parseInt(paymentId);

        // Date range filter
        if (startDate || endDate) {
            filters.createdAt = {};
            if (startDate) filters.createdAt.gte = new Date(startDate);
            if (endDate) filters.createdAt.lte = new Date(endDate);
        }

        // Build search conditions
        const searchConditions = [];
        if (search) {
            searchConditions.push(
                { gatewayRef: { contains: search } },
                { orderId: { contains: search } },
                { merchantTxnId: { contains: search } },
                { responseCode: { contains: search } }
            );
        }

        const where = {
            ...filters,
            ...(searchConditions.length > 0 ? { OR: searchConditions } : {})
        };

        // Get transactions with related data
        const [transactions, total] = await Promise.all([
            prisma.transaction.findMany({
                where,
                include: {
                    payment: {
                        select: {
                            id: true,
                            amount: true,
                            paymentType: true,
                            paymentDate: true,
                            receiptNumber: true
                        }
                    },
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
                            name: true
                        }
                    }
                },
                skip,
                take: parseInt(limit),
                orderBy: { createdAt: 'desc' }
            }),
            prisma.transaction.count({ where })
        ]);

        // Add category and signed amount to each transaction
        const enrichedTransactions = transactions.map(t => {
            const transactionCategory = getTransactionCategory(t.transactionType);
            return {
                ...t,
                category: transactionCategory,
                signedAmount: getSignedAmount(t.amount, transactionCategory)
            };
        });

        // Filter by category if specified
        const filteredTransactions = category 
            ? enrichedTransactions.filter(t => t.category === category)
            : enrichedTransactions;

        return successResponse(res, {
            transactions: filteredTransactions,
            pagination: {
                total,
                page: parseInt(page),
                limit: parseInt(limit),
                totalPages: Math.ceil(total / parseInt(limit))
            }
        }, 'Transactions fetched successfully', 200);

    } catch (error) {
        console.error('Get transactions error:', error);
        return errorResponse(res, 'Failed to fetch transactions', 500);
    }
};

// =================== GET TRANSACTION BY ID ===================
exports.getTransactionById = async (req, res) => {
    try {
        const { id } = req.params;

        const transaction = await prisma.transaction.findUnique({
            where: { id: parseInt(id) },
            include: {
                payment: {
                    include: {
                        tenant: {
                            select: {
                                id: true,
                                name: true,
                                email: true,
                                phone: true,
                                cnicNumber: true
                            }
                        },
                        allocation: {
                            select: {
                                id: true,
                                checkInDate: true,
                                rentAmount: true
                            }
                        }
                    }
                },
                tenant: {
                    select: {
                        id: true,
                        name: true,
                        email: true,
                        phone: true,
                        cnicNumber: true
                    }
                },
                hostel: {
                    select: {
                        id: true,
                        name: true,
                        address: true,
                        contactInfo: true
                    }
                }
            }
        });

        if (!transaction) {
            return errorResponse(res, 'Transaction not found', 404);
        }

        // Add category and signed amount
        const category = getTransactionCategory(transaction.transactionType);
        const responseData = {
            ...transaction,
            category,
            signedAmount: getSignedAmount(transaction.amount, category)
        };

        return successResponse(res, responseData, 'Transaction fetched successfully', 200);

    } catch (error) {
        console.error('Get transaction error:', error);
        return errorResponse(res, 'Failed to fetch transaction', 500);
    }
};

// =================== GET TRANSACTIONS BY PAYMENT ID ===================
exports.getTransactionsByPaymentId = async (req, res) => {
    try {
        const { paymentId } = req.params;

        const transactions = await prisma.transaction.findMany({
            where: { paymentId: parseInt(paymentId) },
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
                        name: true
                    }
                }
            },
            orderBy: { createdAt: 'desc' }
        });

        // Add category to each
        const enrichedTransactions = transactions.map(t => {
            const category = getTransactionCategory(t.transactionType);
            return {
                ...t,
                category,
                signedAmount: getSignedAmount(t.amount, category)
            };
        });

        return successResponse(res, {
            transactions: enrichedTransactions,
            count: enrichedTransactions.length
        }, 'Payment transactions fetched successfully', 200);

    } catch (error) {
        console.error('Get payment transactions error:', error);
        return errorResponse(res, 'Failed to fetch payment transactions', 500);
    }
};

// =================== GET TRANSACTIONS BY TENANT ID ===================
exports.getTransactionsByTenantId = async (req, res) => {
    try {
        const { tenantId } = req.params;
        const { page = 1, limit = 10 } = req.query;

        const skip = (parseInt(page) - 1) * parseInt(limit);

        const [transactions, total] = await Promise.all([
            prisma.transaction.findMany({
                where: { tenantId: parseInt(tenantId) },
                include: {
                    payment: {
                        select: {
                            id: true,
                            amount: true,
                            paymentType: true,
                            paymentDate: true,
                            receiptNumber: true
                        }
                    },
                    hostel: {
                        select: {
                            id: true,
                            name: true
                        }
                    }
                },
                skip,
                take: parseInt(limit),
                orderBy: { createdAt: 'desc' }
            }),
            prisma.transaction.count({ where: { tenantId: parseInt(tenantId) } })
        ]);

        // Add category to each
        const enrichedTransactions = transactions.map(t => {
            const category = getTransactionCategory(t.transactionType);
            return {
                ...t,
                category,
                signedAmount: getSignedAmount(t.amount, category)
            };
        });

        return successResponse(res, {
            transactions: enrichedTransactions,
            pagination: {
                total,
                page: parseInt(page),
                limit: parseInt(limit),
                totalPages: Math.ceil(total / parseInt(limit))
            }
        }, 'Tenant transactions fetched successfully', 200);

    } catch (error) {
        console.error('Get tenant transactions error:', error);
        return errorResponse(res, 'Failed to fetch tenant transactions', 500);
    }
};

// =================== UPDATE TRANSACTION STATUS ===================
exports.updateTransactionStatus = async (req, res) => {
    try {
        const { id } = req.params;
        const {
            status,
            responseCode,
            responseMessage,
            rawResponse,
            gatewayRef
        } = req.body;

        if (!status) {
            return errorResponse(res, 'Status is required', 400);
        }

        // Check if transaction exists
        const existingTransaction = await prisma.transaction.findUnique({
            where: { id: parseInt(id) }
        });

        if (!existingTransaction) {
            return errorResponse(res, 'Transaction not found', 404);
        }

        // Update transaction
        const updateData = { status };
        if (responseCode !== undefined) updateData.responseCode = responseCode;
        if (responseMessage !== undefined) updateData.responseMessage = responseMessage;
        if (rawResponse !== undefined) updateData.rawResponse = rawResponse;
        if (gatewayRef !== undefined) updateData.gatewayRef = gatewayRef;

        const transaction = await prisma.transaction.update({
            where: { id: parseInt(id) },
            data: updateData,
            include: {
                payment: {
                    select: {
                        id: true,
                        amount: true,
                        paymentType: true
                    }
                },
                tenant: {
                    select: {
                        id: true,
                        name: true,
                        email: true
                    }
                }
            }
        });

        // Add category
        const category = getTransactionCategory(transaction.transactionType);
        const responseData = {
            ...transaction,
            category,
            signedAmount: getSignedAmount(transaction.amount, category)
        };

        return successResponse(res, responseData, 'Transaction status updated successfully', 200);

    } catch (error) {
        console.error('Update transaction status error:', error);
        return errorResponse(res, 'Failed to update transaction status', 500);
    }
};

// =================== UPDATE TRANSACTION ===================
exports.updateTransaction = async (req, res) => {
    try {
        const { id } = req.params;
        const {
            status,
            gatewayRef,
            orderId,
            merchantTxnId,
            responseCode,
            responseMessage,
            rawResponse,
            fee
        } = req.body;

        // Check if transaction exists
        const existingTransaction = await prisma.transaction.findUnique({
            where: { id: parseInt(id) }
        });

        if (!existingTransaction) {
            return errorResponse(res, 'Transaction not found', 404);
        }

        // Build update data
        const updateData = {};
        if (status !== undefined) updateData.status = status;
        if (gatewayRef !== undefined) updateData.gatewayRef = gatewayRef;
        if (orderId !== undefined) updateData.orderId = orderId;
        if (merchantTxnId !== undefined) updateData.merchantTxnId = merchantTxnId;
        if (responseCode !== undefined) updateData.responseCode = responseCode;
        if (responseMessage !== undefined) updateData.responseMessage = responseMessage;
        if (rawResponse !== undefined) updateData.rawResponse = rawResponse;
        if (fee !== undefined) updateData.fee = parseFloat(fee);

        const transaction = await prisma.transaction.update({
            where: { id: parseInt(id) },
            data: updateData,
            include: {
                payment: true,
                tenant: {
                    select: {
                        id: true,
                        name: true,
                        email: true
                    }
                },
                hostel: {
                    select: {
                        id: true,
                        name: true
                    }
                }
            }
        });

        // Add category
        const category = getTransactionCategory(transaction.transactionType);
        const responseData = {
            ...transaction,
            category,
            signedAmount: getSignedAmount(transaction.amount, category)
        };

        return successResponse(res, responseData, 'Transaction updated successfully', 200);

    } catch (error) {
        console.error('Update transaction error:', error);
        return errorResponse(res, 'Failed to update transaction', 500);
    }
};

// =================== DELETE TRANSACTION ===================
exports.deleteTransaction = async (req, res) => {
    try {
        const { id } = req.params;

        // Check if transaction exists
        const transaction = await prisma.transaction.findUnique({
            where: { id: parseInt(id) }
        });

        if (!transaction) {
            return errorResponse(res, 'Transaction not found', 404);
        }

        // Delete transaction
        await prisma.transaction.delete({
            where: { id: parseInt(id) }
        });

        return successResponse(res, null, 'Transaction deleted successfully', 200);

    } catch (error) {
        console.error('Delete transaction error:', error);
        return errorResponse(res, 'Failed to delete transaction', 500);
    }
};

// =================== GET TRANSACTION STATISTICS WITH RECEIVABLE/PAYABLE ===================
exports.getTransactionStatistics = async (req, res) => {
    try {
        const { startDate, endDate, hostelId } = req.query;

        // Build filters
        const filters = {};
        if (startDate || endDate) {
            filters.createdAt = {};
            if (startDate) filters.createdAt.gte = new Date(startDate);
            if (endDate) filters.createdAt.lte = new Date(endDate);
        }
        if (hostelId) filters.hostelId = parseInt(hostelId);

        const [
            totalTransactions,
            completedTransactions,
            pendingTransactions,
            failedTransactions,
            transactionsByGateway,
            transactionsByType,
            transactionsByStatus,
            amountData,
            allTransactions
        ] = await Promise.all([
            prisma.transaction.count({ where: filters }),
            prisma.transaction.count({ where: { ...filters, status: 'completed' } }),
            prisma.transaction.count({ where: { ...filters, status: 'pending' } }),
            prisma.transaction.count({ where: { ...filters, status: 'failed' } }),
            prisma.transaction.groupBy({
                by: ['gateway'],
                where: filters,
                _count: true,
                _sum: { amount: true }
            }),
            prisma.transaction.groupBy({
                by: ['transactionType'],
                where: filters,
                _count: true,
                _sum: { amount: true }
            }),
            prisma.transaction.groupBy({
                by: ['status'],
                where: filters,
                _count: true,
                _sum: { amount: true }
            }),
            prisma.transaction.aggregate({
                where: { ...filters, status: 'completed' },
                _sum: { amount: true, fee: true },
                _avg: { amount: true }
            }),
            // Get all transactions to calculate receivable/payable
            prisma.transaction.findMany({
                where: { ...filters, status: 'completed' },
                select: {
                    amount: true,
                    transactionType: true,
                    fee: true
                }
            })
        ]);

        // Calculate Receivable and Payable
        let totalReceivable = 0;
        let totalPayable = 0;
        let receivableCount = 0;
        let payableCount = 0;

        allTransactions.forEach(t => {
            const category = getTransactionCategory(t.transactionType);
            if (category === 'receivable') {
                totalReceivable += t.amount || 0;
                receivableCount++;
            } else if (category === 'payable') {
                totalPayable += t.amount || 0;
                payableCount++;
            }
        });

        // Net balance (receivable - payable)
        const netBalance = totalReceivable - totalPayable;

        return successResponse(res, {
            summary: {
                totalTransactions,
                completed: completedTransactions,
                pending: pendingTransactions,
                failed: failedTransactions
            },
            financials: {
                totalReceivable: totalReceivable,
                totalPayable: totalPayable,
                netBalance: netBalance,
                totalFees: amountData._sum.fee || 0,
                averageTransactionAmount: amountData._avg.amount || 0
            },
            breakdown: {
                receivable: {
                    count: receivableCount,
                    amount: totalReceivable
                },
                payable: {
                    count: payableCount,
                    amount: totalPayable
                }
            },
            transactionsByGateway,
            transactionsByType: transactionsByType.map(item => ({
                ...item,
                category: getTransactionCategory(item.transactionType)
            })),
            transactionsByStatus
        }, 'Transaction statistics fetched successfully', 200);

    } catch (error) {
        console.error('Get statistics error:', error);
        return errorResponse(res, 'Failed to fetch statistics', 500);
    }
};

// =================== GET RECEIVABLES SUMMARY ===================
exports.getReceivablesSummary = async (req, res) => {
    try {
        const { hostelId, startDate, endDate } = req.query;

        const filters = { status: 'completed' };
        if (hostelId) filters.hostelId = parseInt(hostelId);
        if (startDate || endDate) {
            filters.createdAt = {};
            if (startDate) filters.createdAt.gte = new Date(startDate);
            if (endDate) filters.createdAt.lte = new Date(endDate);
        }

        const transactions = await prisma.transaction.findMany({
            where: filters,
            select: {
                id: true,
                amount: true,
                transactionType: true,
                createdAt: true,
                tenant: {
                    select: {
                        id: true,
                        name: true
                    }
                }
            }
        });

        // Filter only receivables
        const receivables = transactions.filter(t => 
            getTransactionCategory(t.transactionType) === 'receivable'
        );

        const totalReceivable = receivables.reduce((sum, t) => sum + (t.amount || 0), 0);

        // Group by type
        const byType = {};
        receivables.forEach(t => {
            if (!byType[t.transactionType]) {
                byType[t.transactionType] = {
                    count: 0,
                    amount: 0
                };
            }
            byType[t.transactionType].count++;
            byType[t.transactionType].amount += t.amount || 0;
        });

        return successResponse(res, {
            total: totalReceivable,
            count: receivables.length,
            byType,
            recentTransactions: receivables.slice(0, 10)
        }, 'Receivables summary fetched successfully', 200);

    } catch (error) {
        console.error('Get receivables error:', error);
        return errorResponse(res, 'Failed to fetch receivables summary', 500);
    }
};

// =================== GET PAYABLES SUMMARY ===================
exports.getPayablesSummary = async (req, res) => {
    try {
        const { hostelId, startDate, endDate } = req.query;

        const filters = { status: 'completed' };
        if (hostelId) filters.hostelId = parseInt(hostelId);
        if (startDate || endDate) {
            filters.createdAt = {};
            if (startDate) filters.createdAt.gte = new Date(startDate);
            if (endDate) filters.createdAt.lte = new Date(endDate);
        }

        const transactions = await prisma.transaction.findMany({
            where: filters,
            select: {
                id: true,
                amount: true,
                transactionType: true,
                createdAt: true,
                tenant: {
                    select: {
                        id: true,
                        name: true
                    }
                }
            }
        });

        // Filter only payables
        const payables = transactions.filter(t => 
            getTransactionCategory(t.transactionType) === 'payable'
        );

        const totalPayable = payables.reduce((sum, t) => sum + (t.amount || 0), 0);

        // Group by type
        const byType = {};
        payables.forEach(t => {
            if (!byType[t.transactionType]) {
                byType[t.transactionType] = {
                    count: 0,
                    amount: 0
                };
            }
            byType[t.transactionType].count++;
            byType[t.transactionType].amount += t.amount || 0;
        });

        return successResponse(res, {
            total: totalPayable,
            count: payables.length,
            byType,
            recentTransactions: payables.slice(0, 10)
        }, 'Payables summary fetched successfully', 200);

    } catch (error) {
        console.error('Get payables error:', error);
        return errorResponse(res, 'Failed to fetch payables summary', 500);
    }
};

// =================== WEBHOOK HANDLER ===================
exports.handleWebhook = async (req, res) => {
    try {
        const {
            gateway,
            gatewayRef,
            orderId,
            status,
            amount,
            responseCode,
            responseMessage,
            rawResponse
        } = req.body;

        // Find transaction by gateway reference or order ID
        let transaction = null;
        
        if (gatewayRef) {
            transaction = await prisma.transaction.findFirst({
                where: { gatewayRef }
            });
        } else if (orderId) {
            transaction = await prisma.transaction.findFirst({
                where: { orderId }
            });
        }

        if (!transaction) {
            return errorResponse(res, 'Transaction not found', 404);
        }

        // Update transaction status
        const updatedTransaction = await prisma.transaction.update({
            where: { id: transaction.id },
            data: {
                status: status || 'completed',
                responseCode,
                responseMessage,
                rawResponse: rawResponse || req.body
            }
        });

        return successResponse(res, updatedTransaction, 'Webhook processed successfully', 200);

    } catch (error) {
        console.error('Webhook handler error:', error);
        return errorResponse(res, 'Failed to process webhook', 500);
    }
};
