const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

/**
 * @route   GET /api/dashboard
 * @desc    Get comprehensive dashboard statistics
 * @access  Admin, Manager
 * @returns {Object} Dashboard data with all statistics
 */
const getDashboardStats = async (req, res) => {
    try {
        // =================== TENANT STATISTICS ===================
        const tenants = await prisma.tenant.findMany({
            select: {
                id: true,
                name: true,
                email: true,
                phone: true,
                gender: true,
                status: true,
                totalPaid: true,
                totalDue: true,
                securityDeposit: true,
                occupation: true,
                rating: true,
                createdAt: true,
            },
            orderBy: {
                createdAt: 'desc'
            }
        });

        const tenantStats = {
            total: tenants.length,
            active: tenants.filter(t => t.status === 'active').length,
            inactive: tenants.filter(t => t.status === 'inactive').length,
            blacklisted: tenants.filter(t => t.status === 'blacklisted').length,
            totalPaid: tenants.reduce((sum, t) => sum + (t.totalPaid || 0), 0),
            totalDue: tenants.reduce((sum, t) => sum + (t.totalDue || 0), 0),
            list: tenants
        };

        // =================== PAYMENT STATISTICS ===================
        const payments = await prisma.payment.findMany({
            include: {
                tenant: {
                    select: {
                        id: true,
                        name: true,
                        phone: true
                    }
                },
                hostel: {
                    select: {
                        id: true,
                        name: true
                    }
                },
                collector: {
                    select: {
                        id: true,
                        username: true,
                        email: true,
                        phone: true
                    }
                }
            },
            orderBy: {
                paymentDate: 'desc'
            }
        });

        const pendingPayments = payments.filter(p => p.status === 'pending');
        const paidPayments = payments.filter(p => p.status === 'paid');
        const partialPayments = payments.filter(p => p.status === 'partial');
        const overduePayments = payments.filter(p => p.status === 'overdue');

        const paymentStats = {
            total: payments.length,
            pending: {
                count: pendingPayments.length,
                amount: pendingPayments.reduce((sum, p) => sum + (p.amount || 0), 0),
                list: pendingPayments
            },
            paid: {
                count: paidPayments.length,
                amount: paidPayments.reduce((sum, p) => sum + (p.amount || 0), 0),
                list: paidPayments
            },
            partial: {
                count: partialPayments.length,
                amount: partialPayments.reduce((sum, p) => sum + (p.amount || 0), 0),
                list: partialPayments
            },
            overdue: {
                count: overduePayments.length,
                amount: overduePayments.reduce((sum, p) => sum + (p.amount || 0), 0),
                list: overduePayments
            },
            totalAmount: payments.reduce((sum, p) => sum + (p.amount || 0), 0),
            totalCollected: paidPayments.reduce((sum, p) => sum + (p.amount || 0), 0),
            totalPending: pendingPayments.reduce((sum, p) => sum + (p.amount || 0), 0) + 
                         overduePayments.reduce((sum, p) => sum + (p.amount || 0), 0)
        };

        // =================== TRANSACTION STATISTICS ===================
        const transactions = await prisma.transaction.findMany({
            include: {
                tenant: {
                    select: {
                        id: true,
                        name: true,
                        phone: true
                    }
                },
                hostel: {
                    select: {
                        id: true,
                        name: true
                    }
                },
                payment: {
                    select: {
                        id: true,
                        amount: true,
                        paymentType: true,
                        receiptNumber: true
                    }
                }
            },
            orderBy: {
                createdAt: 'desc'
            }
        });

        const transactionStats = {
            total: transactions.length,
            completed: transactions.filter(t => t.status === 'completed').length,
            pending: transactions.filter(t => t.status === 'pending').length,
            processing: transactions.filter(t => t.status === 'processing').length,
            failed: transactions.filter(t => t.status === 'failed').length,
            cancelled: transactions.filter(t => t.status === 'cancelled').length,
            refunded: transactions.filter(t => t.status === 'refunded').length,
            totalAmount: transactions.reduce((sum, t) => sum + (t.amount || 0), 0),
            totalFees: transactions.reduce((sum, t) => sum + (t.fee || 0), 0),
            byGateway: {
                stripe: transactions.filter(t => t.gateway === 'Stripe').length,
                cash: transactions.filter(t => t.paymentMethod === 'cash').length,
                card: transactions.filter(t => t.paymentMethod === 'card').length,
                bank_transfer: transactions.filter(t => t.paymentMethod === 'bank_transfer').length,
                upi: transactions.filter(t => t.paymentMethod === 'upi').length,
                other: transactions.filter(t => !['Stripe', 'cash', 'card', 'bank_transfer', 'upi'].includes(t.gateway || t.paymentMethod)).length
            },
            list: transactions
        };

        // =================== EMPLOYEE STATISTICS ===================
        const employees = await prisma.employee.findMany({
            include: {
                user: {
                    select: {
                        id: true,
                        username: true,
                        email: true,
                        phone: true,
                        role: true
                    }
                }
            },
            orderBy: {
                createdAt: 'desc'
            }
        });

        const employeeStats = {
            total: employees.length,
            active: employees.filter(e => e.status === 'active').length,
            inactive: employees.filter(e => e.status === 'inactive').length,
            on_leave: employees.filter(e => e.status === 'on_leave').length,
            terminated: employees.filter(e => e.status === 'terminated').length,
            byRole: {
                staff: employees.filter(e => e.role === 'staff').length,
                manager: employees.filter(e => e.role === 'manager').length
            },
            totalSalary: employees
                .filter(e => e.status === 'active')
                .reduce((sum, e) => sum + (e.salary || 0), 0),
            list: employees
        };

        // =================== ROOM STATISTICS ===================
        const rooms = await prisma.room.findMany({
            include: {
                hostel: {
                    select: {
                        id: true,
                        name: true
                    }
                },
                floor: {
                    select: {
                        id: true,
                        floorNumber: true,
                        floorName: true
                    }
                },
                beds: {
                    select: {
                        id: true,
                        bedNumber: true,
                        status: true,
                        currentTenant: {
                            select: {
                                id: true,
                                username: true,
                                email: true,
                                phone: true
                            }
                        }
                    }
                }
            }
        });

        const totalRooms = rooms.length;
        const totalBeds = rooms.reduce((sum, r) => sum + r.totalBeds, 0);
        const occupiedBeds = rooms.reduce((sum, r) => sum + r.occupiedBeds, 0);
        const freeBeds = totalBeds - occupiedBeds;

        // Room status breakdown
        const roomsByStatus = {
            vacant: rooms.filter(r => r.status === 'vacant').length,
            occupied: rooms.filter(r => r.status === 'occupied').length,
            under_maintenance: rooms.filter(r => r.status === 'under_maintenance').length,
            reserved: rooms.filter(r => r.status === 'reserved').length
        };

        // Bed status breakdown
        const allBeds = rooms.flatMap(r => r.beds);
        const bedsByStatus = {
            available: allBeds.filter(b => b.status === 'available').length,
            occupied: allBeds.filter(b => b.status === 'occupied').length,
            reserved: allBeds.filter(b => b.status === 'reserved').length,
            under_maintenance: allBeds.filter(b => b.status === 'under_maintenance').length
        };

        const roomStats = {
            totalRooms,
            roomsByStatus,
            totalBeds,
            occupiedBeds,
            freeBeds,
            availableBeds: bedsByStatus.available,
            reservedBeds: bedsByStatus.reserved,
            maintenanceBeds: bedsByStatus.under_maintenance,
            occupancyRate: totalBeds > 0 ? ((occupiedBeds / totalBeds) * 100).toFixed(2) : 0,
            bedsByStatus,
            byRoomType: {
                single: rooms.filter(r => r.roomType === 'single').length,
                double: rooms.filter(r => r.roomType === 'double').length,
                triple: rooms.filter(r => r.roomType === 'triple').length,
                quad: rooms.filter(r => r.roomType === 'quad').length,
                dormitory: rooms.filter(r => r.roomType === 'dormitory').length,
                suite: rooms.filter(r => r.roomType === 'suite').length
            },
            list: rooms.map(r => ({
                id: r.id,
                roomNumber: r.roomNumber,
                roomType: r.roomType,
                totalBeds: r.totalBeds,
                occupiedBeds: r.occupiedBeds,
                freeBeds: r.totalBeds - r.occupiedBeds,
                status: r.status,
                pricePerBed: r.pricePerBed,
                hostel: r.hostel,
                floor: r.floor,
                hasAttachedBathroom: r.hasAttachedBathroom,
                furnishing: r.furnishing
            }))
        };

        // =================== BOOKING STATISTICS ===================
        const bookings = await prisma.booking.findMany({
            include: {
                tenant: {
                    select: {
                        id: true,
                        name: true,
                        phone: true
                    }
                },
                hostel: {
                    select: {
                        id: true,
                        name: true
                    }
                },
                room: {
                    select: {
                        id: true,
                        roomNumber: true
                    }
                }
            },
            orderBy: {
                bookingDate: 'desc'
            }
        });

        const bookingStats = {
            total: bookings.length,
            pending: bookings.filter(b => b.status === 'pending').length,
            confirmed: bookings.filter(b => b.status === 'confirmed').length,
            checked_in: bookings.filter(b => b.status === 'checked_in').length,
            checked_out: bookings.filter(b => b.status === 'checked_out').length,
            cancelled: bookings.filter(b => b.status === 'cancelled').length,
            expired: bookings.filter(b => b.status === 'expired').length,
            totalRevenue: bookings
                .filter(b => b.status !== 'cancelled')
                .reduce((sum, b) => sum + (b.totalAmount || 0), 0),
            totalAdvance: bookings.reduce((sum, b) => sum + (b.advancePaid || 0), 0)
        };

        // =================== HOSTEL STATISTICS ===================
        const hostels = await prisma.hostel.findMany({
            select: {
                id: true,
                name: true,
                totalFloors: true,
                totalRooms: true,
                totalBeds: true,
                occupiedBeds: true,
                status: true
            }
        });

        const hostelStats = {
            total: hostels.length,
            active: hostels.filter(h => h.status === 'active').length,
            inactive: hostels.filter(h => h.status === 'inactive').length,
            under_maintenance: hostels.filter(h => h.status === 'under_maintenance').length,
            list: hostels
        };

        // =================== ALLOCATION STATISTICS ===================
        const allocations = await prisma.allocation.findMany({
            select: {
                id: true,
                status: true,
                paymentStatus: true,
                rentAmount: true,
                depositAmount: true
            }
        });

        const allocationStats = {
            total: allocations.length,
            active: allocations.filter(a => a.status === 'active').length,
            checked_out: allocations.filter(a => a.status === 'checked_out').length,
            transferred: allocations.filter(a => a.status === 'transferred').length,
            cancelled: allocations.filter(a => a.status === 'cancelled').length
        };

        // =================== FINANCIAL SUMMARY ===================
        const financialSummary = {
            totalRevenue: paymentStats.totalCollected,
            pendingRevenue: paymentStats.totalPending,
            totalDeposits: tenants.reduce((sum, t) => sum + (t.securityDeposit || 0), 0),
            totalDue: tenantStats.totalDue,
            transactionFees: transactionStats.totalFees,
            monthlySalaryExpense: employeeStats.totalSalary
        };

        // =================== RESPONSE ===================
        return res.status(200).json({
            success: true,
            message: 'Dashboard statistics retrieved successfully',
            data: {
                tenants: tenantStats,
                payments: paymentStats,
                transactions: transactionStats,
                employees: employeeStats,
                rooms: roomStats,
                bookings: bookingStats,
                hostels: hostelStats,
                allocations: allocationStats,
                financial: financialSummary,
                summary: {
                    totalTenants: tenantStats.total,
                    activeTenants: tenantStats.active,
                    totalEmployees: employeeStats.total,
                    activeEmployees: employeeStats.active,
                    totalRooms: totalRooms,
                    bookedRooms: roomsByStatus.occupied + roomsByStatus.reserved,
                    freeRooms: roomsByStatus.vacant,
                    totalBeds: totalBeds,
                    occupiedBeds: occupiedBeds,
                    freeBeds: freeBeds,
                    occupancyRate: roomStats.occupancyRate + '%',
                    totalPayments: paymentStats.total,
                    pendingPayments: paymentStats.pending.count,
                    overduePayments: paymentStats.overdue.count,
                    totalTransactions: transactionStats.total,
                    completedTransactions: transactionStats.completed,
                    pendingTransactions: transactionStats.pending,
                    totalRevenue: financialSummary.totalRevenue,
                    pendingRevenue: financialSummary.pendingRevenue
                }
            },
            timestamp: new Date().toISOString()
        });

    } catch (error) {
        console.error('❌ Get dashboard stats error:', error);
        return res.status(500).json({
            success: false,
            message: 'Failed to retrieve dashboard statistics',
            error: error.message
        });
    }
};

module.exports = {
    getDashboardStats
};

