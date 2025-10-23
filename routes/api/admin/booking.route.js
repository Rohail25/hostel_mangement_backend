const express = require('express');
const router = express.Router();
const bookingController = require('../../../controllers/api/booking.controller');
const { authenticate, authorize } = require('../../../middleware/auth.middleware');

// =================== BOOKING ROUTES ===================

// All routes require authentication
router.use(authenticate);

/**
 * @route   POST /api/admin/bookings
 * @desc    Create new booking
 * @access  Admin, Manager, Staff
 * @body    { tenantId?, hostelId, roomId?, bedId?, checkInDate, checkOutDate, bookingType?, numberOfGuests?, totalAmount?, advancePaid?, paymentMethod?, customerName?, customerEmail?, customerPhone?, customerCnic?, remarks? }
 */
router.post('/bookings', 
    authorize('admin', 'manager', 'staff', 'user'), authenticate,
    bookingController.createBooking
);

/**
 * @route   GET /api/admin/bookings
 * @desc    Get all bookings with filters and pagination
 * @access  Admin, Manager, Staff
 * @query   status, hostelId, tenantId, bookingType, paymentStatus, startDate, endDate, search, page, limit
 */
router.get('/bookings',
    authorize('admin', 'manager', 'staff'),
    bookingController.getAllBookings
);

/**
 * @route   GET /api/admin/bookings/statistics
 * @desc    Get booking statistics
 * @access  Admin, Manager
 * @query   hostelId?, startDate?, endDate?
 */
router.get('/bookings/statistics',
    authorize('admin', 'manager'),
    bookingController.getBookingStatistics
);

/**
 * @route   GET /api/admin/bookings/available-beds
 * @desc    Get available beds for specific dates
 * @access  Admin, Manager, Staff
 * @query   hostelId?, roomId?, checkInDate, checkOutDate
 */
router.get('/bookings/available-beds',
    authorize('admin', 'manager', 'staff'),
    bookingController.getAvailableBeds
);

/**
 * @route   GET /api/admin/bookings/code/:bookingCode
 * @desc    Get booking by booking code
 * @access  Admin, Manager, Staff
 * @params  bookingCode - Booking code (e.g., BK2510001)
 */
router.get('/bookings/code/:bookingCode',
    authorize('admin', 'manager', 'staff'),
    bookingController.getBookingByCode
);

/**
 * @route   GET /api/admin/bookings/:id
 * @desc    Get booking by ID
 * @access  Admin, Manager, Staff
 * @params  id - Booking ID
 */
router.get('/bookings/:id',
    authorize('admin', 'manager', 'staff'),
    bookingController.getBookingById
);

/**
 * @route   PUT /api/admin/bookings/:id
 * @desc    Update booking details
 * @access  Admin, Manager, Staff
 * @params  id - Booking ID
 * @body    { checkInDate?, checkOutDate?, numberOfGuests?, remarks?, totalAmount?, advancePaid?, paymentMethod?, transactionId?, customerName?, customerEmail?, customerPhone?, customerCnic? }
 */
router.put('/bookings/:id',
    authorize('admin', 'manager', 'staff'),
    bookingController.updateBooking
);

/**
 * @route   PATCH /api/admin/bookings/:id/status
 * @desc    Update booking status
 * @access  Admin, Manager, Staff
 * @params  id - Booking ID
 * @body    { status } - Status: pending, confirmed, checked_in, checked_out, cancelled, expired
 */
router.patch('/bookings/:id/status',
    authorize('admin', 'manager', 'staff'),
    bookingController.updateBookingStatus
);

/**
 * @route   PATCH /api/admin/bookings/:id/cancel
 * @desc    Cancel booking
 * @access  Admin, Manager
 * @params  id - Booking ID
 * @body    { reason? }
 */
router.patch('/bookings/:id/cancel',
    authorize('admin', 'manager'),
    bookingController.cancelBooking
);

/**
 * @route   DELETE /api/admin/bookings/:id
 * @desc    Delete booking (only cancelled or expired)
 * @access  Admin
 * @params  id - Booking ID
 */
router.delete('/bookings/:id',
    authorize('admin'),
    bookingController.deleteBooking
);

module.exports = router;

