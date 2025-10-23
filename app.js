const express = require('express');
const dotenv = require('dotenv');
const cookieParser = require('cookie-parser');
const { dbConnection } = require('./config/db');
const userRoute = require('./routes/api/admin/user.route');
const hostelRoute = require('./routes/api/admin/hostel.route');
const userHostelRoute = require('./routes/api/user/hostel.route');
const floorRoute = require('./routes/api/admin/floor.route');
const userFloorRoute = require('./routes/api/user/floor.route');
const roomRoute = require('./routes/api/admin/room.route');
const userRoomRoute = require('./routes/api/user/room.route');
const bedRoute = require('./routes/api/admin/bed.route');
const allocationRoute = require('./routes/api/admin/allocation.route');
const tenantRoute = require('./routes/api/admin/tenant.route');
const paymentRoute = require('./routes/api/admin/payment.route');
const employeeRoute = require('./routes/api/admin/employee.route');
const transactionRoute = require('./routes/api/admin/transaction.route');
const bookingRoute = require('./routes/api/admin/booking.route');
// Load environment variables
dotenv.config();

const app = express();

// Middleware
app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(cookieParser()); // Parse cookies

// Database connection
dbConnection();

app.use('/uploads', express.static('uploads'));

// Routes
// website routes
app.use('/api', userRoute);
app.use('/api', userHostelRoute);
app.use('/api', userFloorRoute);
app.use('/api', userRoomRoute);



// admin routes
app.use('/api/admin', hostelRoute);
app.use('/api/admin', floorRoute);
app.use('/api/admin', roomRoute);
app.use('/api/admin', bedRoute);
app.use('/api/admin', allocationRoute);
app.use('/api/admin', tenantRoute);
app.use('/api/admin', paymentRoute);
app.use('/api/admin', employeeRoute);
app.use('/api/admin', transactionRoute);
app.use('/api/admin', bookingRoute);

// Start server
const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
    console.log(`🚀 Server is running on port ${PORT}`);
});