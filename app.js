const express = require("express");
const dotenv = require("dotenv");
const cookieParser = require("cookie-parser");
const { dbConnection } = require("./config/db");

const userRoute = require("./routes/api/admin/user.route");
const hostelRoute = require("./routes/api/admin/hostel.route");
const userHostelRoute = require("./routes/api/user/hostel.route");
const floorRoute = require("./routes/api/admin/floor.route");
const userFloorRoute = require("./routes/api/user/floor.route");
const roomRoute = require("./routes/api/admin/room.route");
const userRoomRoute = require("./routes/api/user/room.route");
const bedRoute = require("./routes/api/admin/bed.route");
const allocationRoute = require("./routes/api/admin/allocation.route");
const tenantRoute = require("./routes/api/admin/tenant.route");
const paymentRoute = require("./routes/api/admin/payment.route");
const employeeRoute = require("./routes/api/admin/employee.route");
const transactionRoute = require("./routes/api/admin/transaction.route");
const bookingRoute = require("./routes/api/admin/booking.route");
const stripeRoute = require("./routes/api/stripe.route");
const userBedRoute = require("./routes/api/user/bed.route");
const userTransactionRoute = require("./routes/api/user/transaction.route");
const dashboardRoute = require("./routes/api/admin/dashboard.route");
const overviewRoute = require("./routes/api/admin/overview.route");
const tableRoute = require("./routes/api/admin/table.route");
const alertRoute = require("./routes/api/admin/alert.route");
const vendorRoute = require("./routes/api/admin/vendor.route");
const fpaRoute = require("./routes/api/admin/fpa.route");
const campaignRoute = require("./routes/api/admin/campaign.route");
const settingRoute = require("./routes/api/admin/setting.route");
const { set } = require("mongoose");
const peopleRoute = require("./routes/api/admin/people.route");
const accountsRoute = require("./routes/api/admin/accounts.route");

// Load environment variables
dotenv.config();

const app = express();

// ⚠️ IMPORTANT: Stripe webhook requires RAW body for signature verification
// We need to capture raw body BEFORE express.json() parses it
app.use(
  "/api/stripe/webhook",
  express.raw({ type: "application/json" }),
  (req, res, next) => {
    // Store raw body for Stripe webhook verification
    req.rawBody = req.body.toString("utf8");
    next();
  }
);

// Middleware - JSON parsing for all other routes
app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(cookieParser()); // Parse cookies

// Database connection
dbConnection();

app.use("/uploads", express.static("uploads"));

// Routes
// website routes
app.use("/api", userRoute);
app.use("/api", userHostelRoute);
app.use("/api", userFloorRoute);
app.use("/api", userRoomRoute);
app.use("/api", userBedRoute);
app.use("/api", userTransactionRoute);
// Stripe payment gateway routes
app.use("/api/stripe", stripeRoute);

// admin routes
app.use("/api/admin", dashboardRoute);
app.use("/api/admin", overviewRoute);
app.use("/api/admin", tableRoute);
app.use("/api/admin", alertRoute);
app.use("/api/admin", vendorRoute);
app.use("/api/admin", hostelRoute);
app.use("/api/admin", floorRoute);
app.use("/api/admin", roomRoute);
app.use("/api/admin", bedRoute);
app.use("/api/admin", allocationRoute);
app.use("/api/admin", tenantRoute);
app.use("/api/admin", paymentRoute);
app.use("/api/admin", employeeRoute);
app.use("/api/admin", transactionRoute);
app.use("/api/admin", bookingRoute);
app.use("/api/admin", fpaRoute);
app.use("/api/admin", campaignRoute);
app.use("/api/admin", settingRoute);
app.use("/api/admin", peopleRoute);
app.use("/api/admin", accountsRoute);

// Start server
const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`🚀 Server is running on port ${PORT}`);
});
  