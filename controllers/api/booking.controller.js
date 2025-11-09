const { successResponse, errorResponse } = require('../../Helper/helper');
const { prisma } = require('../../config/db');

// ===================================
// HELPER: Generate Booking Code
// ===================================
const generateBookingCode = async () => {
    const prefix = 'BK';
    const date = new Date();
    const year = date.getFullYear().toString().slice(-2);
    const month = String(date.getMonth() + 1).padStart(2, '0');
    
    // Get the count of all bookings for this month (not just today)
    const startOfMonth = new Date(date.getFullYear(), date.getMonth(), 1);
    const endOfMonth = new Date(date.getFullYear(), date.getMonth() + 1, 0, 23, 59, 59, 999);
    
    let sequence = 1;
    let bookingCode = '';
    let isUnique = false;
    
    // Loop until we find a unique code
    while (!isUnique) {
        bookingCode = `${prefix}${year}${month}${String(sequence).padStart(4, '0')}`;
        
        // Check if this code already exists
        const existingBooking = await prisma.booking.findUnique({
            where: { bookingCode: bookingCode }
        });
        
        if (!existingBooking) {
            isUnique = true;
        } else {
            sequence++;
        }
    }
    
    return bookingCode;
};

// ===================================
// CREATE BOOKING
// ===================================
const createBooking = async (req, res) => {
    try {
        const {
            tenantId,
            hostelId,
            roomId,
            bedId,
            checkInDate,
            checkOutDate,
            bookingType = 'online',
            numberOfGuests = 1,
            remarks,
            totalAmount,
            advancePaid = 0,
            paymentMethod,
            transactionId,
            customerName,
            customerEmail,
            customerPhone,
            customerCnic
        } = req.body;

        // Validation
        if (!hostelId) {
            return errorResponse(res, "Hostel ID is required", 400);
        }

        if (!checkInDate || !checkOutDate) {
            return errorResponse(res, "Check-in and check-out dates are required", 400);
        }

        // Validate dates
        const checkIn = new Date(checkInDate);
        const checkOut = new Date(checkOutDate);
        
        if (checkIn >= checkOut) {
            return errorResponse(res, "Check-out date must be after check-in date", 400);
        }

        if (checkIn < new Date()) {
            return errorResponse(res, "Check-in date cannot be in the past", 400);
        }

        // Check if hostel exists
        const hostel = await prisma.hostel.findUnique({
            where: { id: parseInt(hostelId) }
        });

        if (!hostel) {
            return errorResponse(res, "Hostel not found", 404);
        }

        // If room is specified, check if it exists
        if (roomId) {
            const room = await prisma.room.findUnique({
                where: { id: parseInt(roomId) }
            });

            if (!room) {
                return errorResponse(res, "Room not found", 404);
            }
        }

        // If bed is specified, check if it's available
        if (bedId) {
            const bed = await prisma.bed.findUnique({
                where: { id: parseInt(bedId) }
            });

            if (!bed) {
                return errorResponse(res, "Bed not found", 404);
            }

            // Check if bed is available for the dates
            const conflictingBooking = await prisma.booking.findFirst({
                where: {
                    bedId: parseInt(bedId),
                    status: {
                        in: ['pending', 'confirmed', 'checked_in']
                    },
                    OR: [
                        {
                            checkInDate: { lte: checkOut },
                            checkOutDate: { gte: checkIn }
                        }
                    ]
                }
            });

            if (conflictingBooking) {
                return errorResponse(res, "Bed is not available for the selected dates", 400);
            }
        }

        // If tenant is specified, validate
        if (tenantId) {
            const tenant = await prisma.tenant.findUnique({
                where: { id: parseInt(tenantId) }
            });

            if (!tenant) {
                return errorResponse(res, "Tenant not found", 404);
            }
        } else {
            // For walk-in bookings, customer info is required
            if (!customerName || !customerPhone) {
                return errorResponse(res, "Customer name and phone are required for walk-in bookings", 400);
            }
        }

        // Generate booking code
        const bookingCode = await generateBookingCode();

        // Determine payment status
        let paymentStatus = 'pending';
        if (totalAmount && advancePaid >= totalAmount) {
            paymentStatus = 'paid';
        } else if (advancePaid > 0) {
            paymentStatus = 'partial';
        }

        // Create booking
        const booking = await prisma.booking.create({
            data: {
                bookingCode: bookingCode || null,
                tenantId: tenantId ? parseInt(tenantId) : null,
                hostelId: parseInt(hostelId),
                roomId: roomId ? parseInt(roomId) : null,
                bedId: bedId ? parseInt(bedId) : null,
                checkInDate: new Date(checkInDate),
                checkOutDate: new Date(checkOutDate),
                bookingType,
                status: 'pending',
                numberOfGuests: parseInt(numberOfGuests),
                remarks,
                totalAmount: totalAmount ? parseFloat(totalAmount) : null,
                advancePaid: parseFloat(advancePaid),
                paymentStatus,
                paymentMethod,
                transactionId,
                customerName,
                customerEmail,
                customerPhone,
                customerCnic,
                createdBy: req.user?.id || null
            },
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
                        address: true
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
                },
                creator: {
                    select: {
                        id: true,
                        name: true,
                        role: true
                    }
                }
            }
        });

        return successResponse(res, booking, "Booking created successfully", 201);
    } catch (err) {
        console.error("Create Booking Error:", err);
        return errorResponse(res, err.message, 400);
    }
};

// ===================================
// GET ALL BOOKINGS
// ===================================
const getAllBookings = async (req, res) => {
    try {
        const {
            status,
            hostelId,
            tenantId,
            bookingType,
            paymentStatus,
            startDate,
            endDate,
            search,
            page = 1,
            limit = 10
        } = req.query;

        const skip = (parseInt(page) - 1) * parseInt(limit);
        
        // Build where clause
        const where = {};

        if (status) {
            where.status = status;
        }

        if (hostelId) {
            where.hostelId = parseInt(hostelId);
        }

        if (tenantId) {
            where.tenantId = parseInt(tenantId);
        }

        if (bookingType) {
            where.bookingType = bookingType;
        }

        if (paymentStatus) {
            where.paymentStatus = paymentStatus;
        }

        if (startDate && endDate) {
            where.checkInDate = {
                gte: new Date(startDate),
                lte: new Date(endDate)
            };
        }

        if (search) {
            where.OR = [
                { bookingCode: { contains: search } },
                { customerName: { contains: search } },
                { customerPhone: { contains: search } },
                { customerEmail: { contains: search } }
            ];
        }

        // Get bookings with pagination
        const [bookings, total] = await Promise.all([
            prisma.booking.findMany({
                where,
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
                            address: true
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
                    },
                    payments: {
                        select: {
                            id: true,
                            amount: true,
                            paymentType: true,
                            paymentMethod: true,
                            paymentDate: true,
                            status: true,
                            transactions: {
                                select: {
                                    id: true,
                                    gateway: true,
                                    status: true,
                                    createdAt: true
                                }
                            }
                        }
                    }
                },
                orderBy: { createdAt: 'desc' },
                skip,
                take: parseInt(limit)
            }),
            prisma.booking.count({ where })
        ]);

        return successResponse(res, {
            bookings,
            pagination: {
                total,
                page: parseInt(page),
                limit: parseInt(limit),
                totalPages: Math.ceil(total / parseInt(limit))
            }
        }, "Bookings retrieved successfully", 200);
    } catch (err) {
        console.error("Get All Bookings Error:", err);
        return errorResponse(res, err.message, 400);
    }
};

// ===================================
// GET BOOKING BY ID
// ===================================
const getBookingById = async (req, res) => {
    try {
        const { id } = req.params;

        const bookingId = parseInt(id);
        if (isNaN(bookingId)) {
            return errorResponse(res, "Invalid booking ID", 400);
        }

        const booking = await prisma.booking.findUnique({
            where: { id: bookingId },
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
                hostel: {
                    select: {
                        id: true,
                        name: true,
                        address: true,
                        contactInfo: true
                    }
                },
                room: {
                    select: {
                        id: true,
                        roomNumber: true,
                        roomType: true,
                        pricePerBed: true,
                        amenities: true
                    }
                },
                bed: {
                    select: {
                        id: true,
                        bedNumber: true,
                        bedType: true,
                        status: true
                    }
                },
                creator: {
                    select: {
                        id: true,
                        name: true,
                        email: true,
                        role: true
                    }
                },
                payments: {
                    include: {
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
                }
            }
        });

        if (!booking) {
            return errorResponse(res, "Booking not found", 404);
        }

        return successResponse(res, booking, "Booking retrieved successfully", 200);
    } catch (err) {
        console.error("Get Booking By ID Error:", err);
        return errorResponse(res, err.message, 400);
    }
};

// ===================================
// GET BOOKING BY CODE
// ===================================
const getBookingByCode = async (req, res) => {
    try {
        const { bookingCode } = req.params;

        const booking = await prisma.booking.findUnique({
            where: { bookingCode },
            include: {
                tenant: true,
                hostel: true,
                room: true,
                bed: true,
                creator: {
                    select: {
                        id: true,
                        name: true,
                        role: true
                    }
                },
                payments: {
                    include: {
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
                }
            }
        });

        if (!booking) {
            return errorResponse(res, "Booking not found", 404);
        }

        return successResponse(res, booking, "Booking retrieved successfully", 200);
    } catch (err) {
        console.error("Get Booking By Code Error:", err);
        return errorResponse(res, err.message, 400);
    }
};

// ===================================
// UPDATE BOOKING
// ===================================
const updateBooking = async (req, res) => {
    try {
        const { id } = req.params;
        const {
            checkInDate,
            checkOutDate,
            numberOfGuests,
            remarks,
            totalAmount,
            advancePaid,
            paymentMethod,
            transactionId,
            customerName,
            customerEmail,
            customerPhone,
            customerCnic
        } = req.body;

        const bookingId = parseInt(id);
        if (isNaN(bookingId)) {
            return errorResponse(res, "Invalid booking ID", 400);
        }

        // Check if booking exists
        const existingBooking = await prisma.booking.findUnique({
            where: { id: bookingId }
        });

        if (!existingBooking) {
            return errorResponse(res, "Booking not found", 404);
        }

        // Cannot update checked-in or checked-out bookings
        if (['checked_in', 'checked_out'].includes(existingBooking.status)) {
            return errorResponse(res, "Cannot update booking in checked-in or checked-out status", 400);
        }

        // Prepare update data
        const updateData = {};

        if (checkInDate) {
            updateData.checkInDate = new Date(checkInDate);
        }

        if (checkOutDate) {
            updateData.checkOutDate = new Date(checkOutDate);
        }

        // Validate dates if both are provided or being updated
        const finalCheckIn = checkInDate ? new Date(checkInDate) : existingBooking.checkInDate;
        const finalCheckOut = checkOutDate ? new Date(checkOutDate) : existingBooking.checkOutDate;

        if (finalCheckIn >= finalCheckOut) {
            return errorResponse(res, "Check-out date must be after check-in date", 400);
        }

        if (numberOfGuests !== undefined) {
            updateData.numberOfGuests = parseInt(numberOfGuests);
        }

        if (remarks !== undefined) {
            updateData.remarks = remarks;
        }

        if (totalAmount !== undefined) {
            updateData.totalAmount = parseFloat(totalAmount);
        }

        if (advancePaid !== undefined) {
            updateData.advancePaid = parseFloat(advancePaid);
            
            // Update payment status
            const finalTotal = totalAmount !== undefined ? parseFloat(totalAmount) : existingBooking.totalAmount;
            const finalAdvance = parseFloat(advancePaid);
            
            if (finalTotal && finalAdvance >= finalTotal) {
                updateData.paymentStatus = 'paid';
            } else if (finalAdvance > 0) {
                updateData.paymentStatus = 'partial';
            } else {
                updateData.paymentStatus = 'pending';
            }
        }

        if (paymentMethod) {
            updateData.paymentMethod = paymentMethod;
        }

        if (transactionId) {
            updateData.transactionId = transactionId;
        }

        if (customerName) {
            updateData.customerName = customerName;
        }

        if (customerEmail) {
            updateData.customerEmail = customerEmail;
        }

        if (customerPhone) {
            updateData.customerPhone = customerPhone;
        }

        if (customerCnic) {
            updateData.customerCnic = customerCnic;
        }

        // Update booking
        const updatedBooking = await prisma.booking.update({
            where: { id: bookingId },
            data: updateData,
            include: {
                tenant: true,
                hostel: true,
                room: true,
                bed: true
            }
        });

        return successResponse(res, updatedBooking, "Booking updated successfully", 200);
    } catch (err) {
        console.error("Update Booking Error:", err);
        return errorResponse(res, err.message, 400);
    }
};

// ===================================
// UPDATE BOOKING STATUS
// ===================================
const updateBookingStatus = async (req, res) => {
    try {
        const { id } = req.params;
        const { status } = req.body;

        const bookingId = parseInt(id);
        if (isNaN(bookingId)) {
            return errorResponse(res, "Invalid booking ID", 400);
        }

        if (!status) {
            return errorResponse(res, "Status is required", 400);
        }

        const validStatuses = ['pending', 'confirmed', 'checked_in', 'checked_out', 'cancelled', 'expired'];
        if (!validStatuses.includes(status)) {
            return errorResponse(res, `Invalid status. Must be one of: ${validStatuses.join(', ')}`, 400);
        }

        // Check if booking exists
        const existingBooking = await prisma.booking.findUnique({
            where: { id: bookingId },
            include: {
                bed: true
            }
        });

        if (!existingBooking) {
            return errorResponse(res, "Booking not found", 404);
        }

        // Status transition validation
        if (existingBooking.status === 'cancelled' || existingBooking.status === 'expired') {
            return errorResponse(res, "Cannot update cancelled or expired bookings", 400);
        }

        // If checking in, update bed status to occupied
        if (status === 'checked_in' && existingBooking.bedId) {
            await prisma.bed.update({
                where: { id: existingBooking.bedId },
                data: { status: 'occupied' }
            });
        }

        // If checking out, update bed status to available
        if (status === 'checked_out' && existingBooking.bedId) {
            await prisma.bed.update({
                where: { id: existingBooking.bedId },
                data: { 
                    status: 'available',
                    currentUserId: null
                }
            });
        }

        // Update booking status
        const updatedBooking = await prisma.booking.update({
            where: { id: bookingId },
            data: { 
                status,
                ...(status === 'checked_in' && { checkInDate: new Date() })
            },
            include: {
                tenant: true,
                hostel: true,
                room: true,
                bed: true
            }
        });

        return successResponse(res, updatedBooking, `Booking ${status} successfully`, 200);
    } catch (err) {
        console.error("Update Booking Status Error:", err);
        return errorResponse(res, err.message, 400);
    }
};

// ===================================
// CANCEL BOOKING
// ===================================
const cancelBooking = async (req, res) => {
    try {
        const { id } = req.params;
        const { reason } = req.body;

        const bookingId = parseInt(id);
        if (isNaN(bookingId)) {
            return errorResponse(res, "Invalid booking ID", 400);
        }

        // Check if booking exists
        const existingBooking = await prisma.booking.findUnique({
            where: { id: bookingId }
        });

        if (!existingBooking) {
            return errorResponse(res, "Booking not found", 404);
        }

        // Cannot cancel already checked-in or checked-out bookings
        if (['checked_in', 'checked_out'].includes(existingBooking.status)) {
            return errorResponse(res, "Cannot cancel checked-in or checked-out bookings", 400);
        }

        // If already cancelled
        if (existingBooking.status === 'cancelled') {
            return errorResponse(res, "Booking is already cancelled", 400);
        }

        // If bed was reserved, make it available
        if (existingBooking.bedId) {
            await prisma.bed.update({
                where: { id: existingBooking.bedId },
                data: { 
                    status: 'available',
                    reservedById: null,
                    reservationExpiry: null
                }
            });
        }

        // Cancel booking
        const cancelledBooking = await prisma.booking.update({
            where: { id: bookingId },
            data: { 
                status: 'cancelled',
                remarks: reason ? `Cancelled: ${reason}` : 'Cancelled'
            },
            include: {
                tenant: true,
                hostel: true,
                room: true,
                bed: true
            }
        });

        return successResponse(res, cancelledBooking, "Booking cancelled successfully", 200);
    } catch (err) {
        console.error("Cancel Booking Error:", err);
        return errorResponse(res, err.message, 400);
    }
};

// ===================================
// DELETE BOOKING
// ===================================
const deleteBooking = async (req, res) => {
    try {
        const { id } = req.params;

        const bookingId = parseInt(id);
        if (isNaN(bookingId)) {
            return errorResponse(res, "Invalid booking ID", 400);
        }

        // Check if booking exists
        const existingBooking = await prisma.booking.findUnique({
            where: { id: bookingId }
        });

        if (!existingBooking) {
            return errorResponse(res, "Booking not found", 404);
        }

        // Only allow deletion of cancelled or expired bookings
        if (!['cancelled', 'expired'].includes(existingBooking.status)) {
            return errorResponse(res, "Can only delete cancelled or expired bookings", 400);
        }

        // Delete booking
        await prisma.booking.delete({
            where: { id: bookingId }
        });

        return successResponse(res, { id: bookingId }, "Booking deleted successfully", 200);
    } catch (err) {
        console.error("Delete Booking Error:", err);
        return errorResponse(res, err.message, 400);
    }
};

// ===================================
// GET BOOKING STATISTICS
// ===================================
const getBookingStatistics = async (req, res) => {
    try {
        const { hostelId, startDate, endDate } = req.query;

        const where = {};

        if (hostelId) {
            where.hostelId = parseInt(hostelId);
        }

        if (startDate && endDate) {
            where.bookingDate = {
                gte: new Date(startDate),
                lte: new Date(endDate)
            };
        }

        // Get statistics
        const [
            totalBookings,
            pendingBookings,
            confirmedBookings,
            checkedInBookings,
            checkedOutBookings,
            cancelledBookings,
            totalRevenue,
            totalAdvancePaid
        ] = await Promise.all([
            prisma.booking.count({ where }),
            prisma.booking.count({ where: { ...where, status: 'pending' } }),
            prisma.booking.count({ where: { ...where, status: 'confirmed' } }),
            prisma.booking.count({ where: { ...where, status: 'checked_in' } }),
            prisma.booking.count({ where: { ...where, status: 'checked_out' } }),
            prisma.booking.count({ where: { ...where, status: 'cancelled' } }),
            prisma.booking.aggregate({
                where: { ...where, status: { not: 'cancelled' } },
                _sum: { totalAmount: true }
            }),
            prisma.booking.aggregate({
                where,
                _sum: { advancePaid: true }
            })
        ]);

        // Get bookings by type
        const bookingsByType = await prisma.booking.groupBy({
            by: ['bookingType'],
            where,
            _count: true
        });

        const statistics = {
            totalBookings,
            bookingsByStatus: {
                pending: pendingBookings,
                confirmed: confirmedBookings,
                checkedIn: checkedInBookings,
                checkedOut: checkedOutBookings,
                cancelled: cancelledBookings
            },
            bookingsByType: bookingsByType.reduce((acc, item) => {
                acc[item.bookingType] = item._count;
                return acc;
            }, {}),
            revenue: {
                total: totalRevenue._sum.totalAmount || 0,
                advancePaid: totalAdvancePaid._sum.advancePaid || 0,
                pending: (totalRevenue._sum.totalAmount || 0) - (totalAdvancePaid._sum.advancePaid || 0)
            }
        };

        return successResponse(res, statistics, "Booking statistics retrieved successfully", 200);
    } catch (err) {
        console.error("Get Booking Statistics Error:", err);
        return errorResponse(res, err.message, 400);
    }
};

// ===================================
// GET AVAILABLE BEDS FOR DATES
// ===================================
const getAvailableBeds = async (req, res) => {
    try {
        const { hostelId, roomId, checkInDate, checkOutDate } = req.query;

        if (!checkInDate || !checkOutDate) {
            return errorResponse(res, "Check-in and check-out dates are required", 400);
        }

        const checkIn = new Date(checkInDate);
        const checkOut = new Date(checkOutDate);

        const where = {
            status: 'available'
        };

        if (roomId) {
            where.roomId = parseInt(roomId);
        } else if (hostelId) {
            where.room = {
                hostelId: parseInt(hostelId)
            };
        }

        // Get all available beds
        const beds = await prisma.bed.findMany({
            where,
            include: {
                room: {
                    include: {
                        hostel: {
                            select: {
                                id: true,
                                name: true
                            }
                        }
                    }
                }
            }
        });

        // Filter beds that have no conflicting bookings
        const availableBeds = [];

        for (const bed of beds) {
            const conflictingBooking = await prisma.booking.findFirst({
                where: {
                    bedId: bed.id,
                    status: {
                        in: ['pending', 'confirmed', 'checked_in']
                    },
                    OR: [
                        {
                            checkInDate: { lte: checkOut },
                            checkOutDate: { gte: checkIn }
                        }
                    ]
                }
            });

            if (!conflictingBooking) {
                availableBeds.push(bed);
            }
        }

        return successResponse(res, availableBeds, "Available beds retrieved successfully", 200);
    } catch (err) {
        console.error("Get Available Beds Error:", err);
        return errorResponse(res, err.message, 400);
    }
};

module.exports = {
    createBooking,
    getAllBookings,
    getBookingById,
    getBookingByCode,
    updateBooking,
    updateBookingStatus,
    cancelBooking,
    deleteBooking,
    getBookingStatistics,
    getAvailableBeds
};

