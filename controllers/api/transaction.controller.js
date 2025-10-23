const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

// =================== CREATE TRANSACTION ===================
// NOTE: Transactions are automatically created when payments are recorded with status 'paid'
// This endpoint is mainly for creating transactions for external payment gateways or special cases
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
        if (!paymentId || !gateway || !transactionType || !amount || !paymentMethod) {
            return res.status(400).json({
                success: false,
                message: 'Payment ID, gateway, transaction type, amount, and payment method are required'
            });
        }

        // Verify payment exists
        const payment = await prisma.payment.findUnique({
            where: { id: parseInt(paymentId) }
        });

        if (!payment) {
            return res.status(404).json({
                success: false,
                message: 'Payment not found'
            });
        }

        // Create transaction
        const transaction = await prisma.transaction.create({
            data: {
                paymentId: parseInt(paymentId),
                tenantId: tenantId ? parseInt(tenantId) : payment.tenantId,
                hostelId: hostelId ? parseInt(hostelId) : payment.hostelId,
                gateway,
                transactionType,
                amount: parseFloat(amount),
                currency: currency || 'PKR',
                fee: fee ? parseFloat(fee) : 0,
                gatewayRef,
                orderId,
                merchantTxnId,
                status: status || 'pending',
                responseCode,
                responseMessage,
                rawResponse,
                paymentMethod,
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

        res.status(201).json({
            success: true,
            message: 'Transaction created successfully',
            data: transaction
        });

    } catch (error) {
        console.error('Create transaction error:', error);
        res.status(500).json({
            success: false,
            message: 'Failed to create transaction',
            error: error.message
        });
    }
};

// =================== GET ALL TRANSACTIONS ===================
exports.getAllTransactions = async (req, res) => {
    try {
        const {
            status,
            gateway,
            transactionType,
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

        res.status(200).json({
            success: true,
            message: 'Transactions fetched successfully',
            data: transactions,
            pagination: {
                total,
                page: parseInt(page),
                limit: parseInt(limit),
                totalPages: Math.ceil(total / parseInt(limit))
            }
        });

    } catch (error) {
        console.error('Get transactions error:', error);
        res.status(500).json({
            success: false,
            message: 'Failed to fetch transactions',
            error: error.message
        });
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
            return res.status(404).json({
                success: false,
                message: 'Transaction not found'
            });
        }

        res.status(200).json({
            success: true,
            message: 'Transaction fetched successfully',
            data: transaction
        });

    } catch (error) {
        console.error('Get transaction error:', error);
        res.status(500).json({
            success: false,
            message: 'Failed to fetch transaction',
            error: error.message
        });
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

        res.status(200).json({
            success: true,
            message: 'Payment transactions fetched successfully',
            data: transactions,
            count: transactions.length
        });

    } catch (error) {
        console.error('Get payment transactions error:', error);
        res.status(500).json({
            success: false,
            message: 'Failed to fetch payment transactions',
            error: error.message
        });
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

        res.status(200).json({
            success: true,
            message: 'Tenant transactions fetched successfully',
            data: transactions,
            pagination: {
                total,
                page: parseInt(page),
                limit: parseInt(limit),
                totalPages: Math.ceil(total / parseInt(limit))
            }
        });

    } catch (error) {
        console.error('Get tenant transactions error:', error);
        res.status(500).json({
            success: false,
            message: 'Failed to fetch tenant transactions',
            error: error.message
        });
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
            return res.status(400).json({
                success: false,
                message: 'Status is required'
            });
        }

        // Check if transaction exists
        const existingTransaction = await prisma.transaction.findUnique({
            where: { id: parseInt(id) }
        });

        if (!existingTransaction) {
            return res.status(404).json({
                success: false,
                message: 'Transaction not found'
            });
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

        res.status(200).json({
            success: true,
            message: 'Transaction status updated successfully',
            data: transaction
        });

    } catch (error) {
        console.error('Update transaction status error:', error);
        res.status(500).json({
            success: false,
            message: 'Failed to update transaction status',
            error: error.message
        });
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
            return res.status(404).json({
                success: false,
                message: 'Transaction not found'
            });
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

        res.status(200).json({
            success: true,
            message: 'Transaction updated successfully',
            data: transaction
        });

    } catch (error) {
        console.error('Update transaction error:', error);
        res.status(500).json({
            success: false,
            message: 'Failed to update transaction',
            error: error.message
        });
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
            return res.status(404).json({
                success: false,
                message: 'Transaction not found'
            });
        }

        // Delete transaction
        await prisma.transaction.delete({
            where: { id: parseInt(id) }
        });

        res.status(200).json({
            success: true,
            message: 'Transaction deleted successfully'
        });

    } catch (error) {
        console.error('Delete transaction error:', error);
        res.status(500).json({
            success: false,
            message: 'Failed to delete transaction',
            error: error.message
        });
    }
};

// =================== GET TRANSACTION STATISTICS ===================
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
            amountData
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
            })
        ]);

        res.status(200).json({
            success: true,
            message: 'Transaction statistics fetched successfully',
            data: {
                totalTransactions,
                statusBreakdown: {
                    completed: completedTransactions,
                    pending: pendingTransactions,
                    failed: failedTransactions
                },
                transactionsByGateway,
                transactionsByType,
                transactionsByStatus,
                amountStatistics: {
                    totalAmount: amountData._sum.amount || 0,
                    totalFees: amountData._sum.fee || 0,
                    averageAmount: amountData._avg.amount || 0,
                    netAmount: (amountData._sum.amount || 0) - (amountData._sum.fee || 0)
                }
            }
        });

    } catch (error) {
        console.error('Get statistics error:', error);
        res.status(500).json({
            success: false,
            message: 'Failed to fetch statistics',
            error: error.message
        });
    }
};

// =================== WEBHOOK HANDLER (for payment gateway callbacks) ===================
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
            return res.status(404).json({
                success: false,
                message: 'Transaction not found'
            });
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

        res.status(200).json({
            success: true,
            message: 'Webhook processed successfully',
            data: updatedTransaction
        });

    } catch (error) {
        console.error('Webhook handler error:', error);
        res.status(500).json({
            success: false,
            message: 'Failed to process webhook',
            error: error.message
        });
    }
};


