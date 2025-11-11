/**
 * Dashboard API Test Script
 * 
 * This script tests the dashboard endpoint and displays key statistics
 * 
 * Usage:
 *   node test-dashboard-api.js
 */

const axios = require('axios');

// Configuration
const BASE_URL = 'http://localhost:3000';
const API_ENDPOINT = `${BASE_URL}/api/admin/dashboard`;

// You need to replace this with a valid admin/manager JWT token
// Login first using POST /api/login to get a token
const AUTH_TOKEN = 'YOUR_JWT_TOKEN_HERE';

// ANSI color codes for terminal output
const colors = {
    reset: '\x1b[0m',
    bright: '\x1b[1m',
    green: '\x1b[32m',
    yellow: '\x1b[33m',
    blue: '\x1b[34m',
    magenta: '\x1b[35m',
    cyan: '\x1b[36m',
    red: '\x1b[31m'
};

/**
 * Test Dashboard API
 */
async function testDashboard() {
  
    try {
        console.log(`${colors.cyan}Fetching dashboard data...${colors.reset}`);
        
        const response = await axios.get(API_ENDPOINT, {
            headers: {
                'Authorization': `Bearer ${AUTH_TOKEN}`,
                'Content-Type': 'application/json'
            }
        });

        if (response.data.success) {
            console.log(`${colors.green}✅ Dashboard data retrieved successfully!${colors.reset}\n`);
            
            const { data } = response.data;
            
            // Display Summary
            displaySummary(data.summary);
            
            // Display Tenant Statistics
            displayTenantStats(data.tenants);
            
            // Display Payment Statistics
            displayPaymentStats(data.payments);
            
            // Display Transaction Statistics
            displayTransactionStats(data.transactions);
            
            // Display Employee Statistics
            displayEmployeeStats(data.employees);
            
            // Display Room Statistics
            displayRoomStats(data.rooms);
            
            // Display Financial Summary
            displayFinancialSummary(data.financial);
            
            // Display Booking Statistics
            displayBookingStats(data.bookings);
            
            // Display Additional Stats
            displayAdditionalStats(data);
            
            console.log(`\n${colors.green}${colors.bright}✅ Test completed successfully!${colors.reset}\n`);
            
        } else {
            console.log(`${colors.red}❌ Failed to retrieve dashboard data${colors.reset}`);
            console.log(response.data);
        }

    } catch (error) {
        console.log(`\n${colors.red}❌ Error testing dashboard:${colors.reset}`);
        
        if (error.response) {
            console.log(`Status: ${error.response.status}`);
            console.log(`Message: ${error.response.data.message || 'Unknown error'}`);
            
            if (error.response.status === 401) {
                console.log(`\n${colors.yellow}⚠️  Please update AUTH_TOKEN in this script with a valid JWT token`);
                console.log(`   Login using: POST ${BASE_URL}/api/login${colors.reset}`);
            } else if (error.response.status === 403) {
                console.log(`\n${colors.yellow}⚠️  Your token doesn't have admin/manager access${colors.reset}`);
            }
        } else {
            console.log(error.message);
            console.log(`\n${colors.yellow}⚠️  Make sure the server is running on ${BASE_URL}${colors.reset}`);
        }
    }
}

/**
 * Display Summary Statistics
 */
function displaySummary(summary) {
    console.log(`${colors.bright}${colors.magenta}📈 QUICK SUMMARY${colors.reset}`);
    console.log(`${'='.repeat(50)}`);
    console.log(`${colors.cyan}Tenants:${colors.reset}          ${summary.totalTenants} total (${summary.activeTenants} active)`);
    console.log(`${colors.cyan}Employees:${colors.reset}        ${summary.totalEmployees} total (${summary.activeEmployees} active)`);
    console.log(`${colors.cyan}Rooms:${colors.reset}            ${summary.totalRooms} total (${summary.bookedRooms} booked, ${summary.freeRooms} free)`);
    console.log(`${colors.cyan}Beds:${colors.reset}             ${summary.totalBeds} total (${summary.occupiedBeds} occupied, ${summary.freeBeds} free)`);
    console.log(`${colors.cyan}Occupancy Rate:${colors.reset}   ${summary.occupancyRate}`);
    console.log(`${colors.cyan}Total Revenue:${colors.reset}    PKR ${summary.totalRevenue.toLocaleString()}`);
    console.log(`${colors.cyan}Pending Revenue:${colors.reset}  PKR ${summary.pendingRevenue.toLocaleString()}`);
    console.log();
}

/**
 * Display Tenant Statistics
 */
function displayTenantStats(tenants) {
    console.log(`${colors.bright}${colors.magenta}👥 TENANT STATISTICS${colors.reset}`);
    console.log(`${'='.repeat(50)}`);
    console.log(`${colors.cyan}Total Tenants:${colors.reset}    ${tenants.total}`);
    console.log(`${colors.green}  ✓ Active:${colors.reset}       ${tenants.active}`);
    console.log(`${colors.yellow}  • Inactive:${colors.reset}     ${tenants.inactive}`);
    console.log(`${colors.red}  ✗ Blacklisted:${colors.reset}  ${tenants.blacklisted}`);
    console.log(`${colors.cyan}Total Paid:${colors.reset}       PKR ${tenants.totalPaid.toLocaleString()}`);
    console.log(`${colors.cyan}Total Due:${colors.reset}        PKR ${tenants.totalDue.toLocaleString()}`);
    console.log();
}

/**
 * Display Payment Statistics
 */
function displayPaymentStats(payments) {
    console.log(`${colors.bright}${colors.magenta}💰 PAYMENT STATISTICS${colors.reset}`);
    console.log(`${'='.repeat(50)}`);
    console.log(`${colors.cyan}Total Payments:${colors.reset}   ${payments.total}`);
    console.log(`${colors.green}  ✓ Paid:${colors.reset}         ${payments.paid.count} (PKR ${payments.paid.amount.toLocaleString()})`);
    console.log(`${colors.yellow}  ⏳ Pending:${colors.reset}     ${payments.pending.count} (PKR ${payments.pending.amount.toLocaleString()})`);
    console.log(`${colors.yellow}  ◐ Partial:${colors.reset}     ${payments.partial.count} (PKR ${payments.partial.amount.toLocaleString()})`);
    console.log(`${colors.red}  ⚠ Overdue:${colors.reset}      ${payments.overdue.count} (PKR ${payments.overdue.amount.toLocaleString()})`);
    console.log(`${colors.cyan}Total Collected:${colors.reset}  PKR ${payments.totalCollected.toLocaleString()}`);
    console.log(`${colors.cyan}Total Pending:${colors.reset}    PKR ${payments.totalPending.toLocaleString()}`);
    console.log();
}

/**
 * Display Transaction Statistics
 */
function displayTransactionStats(transactions) {
    console.log(`${colors.bright}${colors.magenta}💳 TRANSACTION STATISTICS${colors.reset}`);
    console.log(`${'='.repeat(50)}`);
    console.log(`${colors.cyan}Total Transactions:${colors.reset} ${transactions.total}`);
    console.log(`${colors.green}  ✓ Completed:${colors.reset}    ${transactions.completed}`);
    console.log(`${colors.yellow}  ⏳ Pending:${colors.reset}      ${transactions.pending}`);
    console.log(`${colors.blue}  ⟳ Processing:${colors.reset}   ${transactions.processing}`);
    console.log(`${colors.red}  ✗ Failed:${colors.reset}       ${transactions.failed}`);
    console.log(`${colors.yellow}  ⊗ Cancelled:${colors.reset}    ${transactions.cancelled}`);
    console.log(`${colors.magenta}  ↶ Refunded:${colors.reset}     ${transactions.refunded}`);
    console.log(`${colors.cyan}Total Amount:${colors.reset}     PKR ${transactions.totalAmount.toLocaleString()}`);
    console.log(`${colors.cyan}Total Fees:${colors.reset}       PKR ${transactions.totalFees.toLocaleString()}`);
    console.log(`\n${colors.bright}By Gateway:${colors.reset}`);
    console.log(`  Stripe:         ${transactions.byGateway.stripe}`);
    console.log(`  Cash:           ${transactions.byGateway.cash}`);
    console.log(`  Card:           ${transactions.byGateway.card}`);
    console.log(`  Bank Transfer:  ${transactions.byGateway.bank_transfer}`);
    console.log(`  UPI:            ${transactions.byGateway.upi}`);
    console.log();
}

/**
 * Display Employee Statistics
 */
function displayEmployeeStats(employees) {
    console.log(`${colors.bright}${colors.magenta}👔 EMPLOYEE STATISTICS${colors.reset}`);
    console.log(`${'='.repeat(50)}`);
    console.log(`${colors.cyan}Total Employees:${colors.reset}  ${employees.total}`);
    console.log(`${colors.green}  ✓ Active:${colors.reset}       ${employees.active}`);
    console.log(`${colors.yellow}  • Inactive:${colors.reset}     ${employees.inactive}`);
    console.log(`${colors.blue}  ⌛ On Leave:${colors.reset}     ${employees.on_leave}`);
    console.log(`${colors.red}  ✗ Terminated:${colors.reset}   ${employees.terminated}`);
    console.log(`\n${colors.bright}By Role:${colors.reset}`);
    console.log(`  Staff:          ${employees.byRole.staff}`);
    console.log(`  Manager:        ${employees.byRole.manager}`);
    console.log(`${colors.cyan}Total Monthly Salary:${colors.reset} PKR ${employees.totalSalary.toLocaleString()}`);
    console.log();
}

/**
 * Display Room Statistics
 */
function displayRoomStats(rooms) {
    console.log(`${colors.bright}${colors.magenta}🏠 ROOM & BED STATISTICS${colors.reset}`);
    console.log(`${'='.repeat(50)}`);
    console.log(`${colors.cyan}Total Rooms:${colors.reset}      ${rooms.totalRooms}`);
    console.log(`${colors.green}  ✓ Vacant:${colors.reset}       ${rooms.roomsByStatus.vacant}`);
    console.log(`${colors.yellow}  • Occupied:${colors.reset}     ${rooms.roomsByStatus.occupied}`);
    console.log(`${colors.blue}  ⚙ Maintenance:${colors.reset}  ${rooms.roomsByStatus.under_maintenance}`);
    console.log(`${colors.magenta}  ◉ Reserved:${colors.reset}     ${rooms.roomsByStatus.reserved}`);
    console.log(`\n${colors.cyan}Total Beds:${colors.reset}       ${rooms.totalBeds}`);
    console.log(`${colors.green}  ✓ Available:${colors.reset}    ${rooms.availableBeds}`);
    console.log(`${colors.yellow}  • Occupied:${colors.reset}     ${rooms.occupiedBeds}`);
    console.log(`${colors.magenta}  ◉ Reserved:${colors.reset}     ${rooms.reservedBeds}`);
    console.log(`${colors.blue}  ⚙ Maintenance:${colors.reset}  ${rooms.maintenanceBeds}`);
    console.log(`${colors.cyan}Free Beds:${colors.reset}        ${rooms.freeBeds}`);
    console.log(`${colors.cyan}Occupancy Rate:${colors.reset}   ${rooms.occupancyRate}%`);
    console.log(`\n${colors.bright}By Room Type:${colors.reset}`);
    console.log(`  Single:         ${rooms.byRoomType.single}`);
    console.log(`  Double:         ${rooms.byRoomType.double}`);
    console.log(`  Triple:         ${rooms.byRoomType.triple}`);
    console.log(`  Quad:           ${rooms.byRoomType.quad}`);
    console.log(`  Dormitory:      ${rooms.byRoomType.dormitory}`);
    console.log(`  Suite:          ${rooms.byRoomType.suite}`);
    console.log();
}

/**
 * Display Financial Summary
 */
function displayFinancialSummary(financial) {
    console.log(`${colors.bright}${colors.magenta}💵 FINANCIAL SUMMARY${colors.reset}`);
    console.log(`${'='.repeat(50)}`);
    console.log(`${colors.green}Total Revenue:${colors.reset}        PKR ${financial.totalRevenue.toLocaleString()}`);
    console.log(`${colors.yellow}Pending Revenue:${colors.reset}      PKR ${financial.pendingRevenue.toLocaleString()}`);
    console.log(`${colors.cyan}Total Deposits:${colors.reset}       PKR ${financial.totalDeposits.toLocaleString()}`);
    console.log(`${colors.red}Total Due:${colors.reset}            PKR ${financial.totalDue.toLocaleString()}`);
    console.log(`${colors.magenta}Transaction Fees:${colors.reset}     PKR ${financial.transactionFees.toLocaleString()}`);
    console.log(`${colors.blue}Monthly Salary:${colors.reset}       PKR ${financial.monthlySalaryExpense.toLocaleString()}`);
    
    const netRevenue = financial.totalRevenue - financial.transactionFees - financial.monthlySalaryExpense;
    const profitColor = netRevenue >= 0 ? colors.green : colors.red;
    console.log(`${colors.bright}${profitColor}Net Revenue:${colors.reset}          PKR ${netRevenue.toLocaleString()}`);
    console.log();
}

/**
 * Display Booking Statistics
 */
function displayBookingStats(bookings) {
    console.log(`${colors.bright}${colors.magenta}📅 BOOKING STATISTICS${colors.reset}`);
    console.log(`${'='.repeat(50)}`);
    console.log(`${colors.cyan}Total Bookings:${colors.reset}   ${bookings.total}`);
    console.log(`${colors.yellow}  ⏳ Pending:${colors.reset}      ${bookings.pending}`);
    console.log(`${colors.green}  ✓ Confirmed:${colors.reset}    ${bookings.confirmed}`);
    console.log(`${colors.blue}  ➜ Checked In:${colors.reset}   ${bookings.checked_in}`);
    console.log(`${colors.magenta}  ← Checked Out:${colors.reset}  ${bookings.checked_out}`);
    console.log(`${colors.red}  ✗ Cancelled:${colors.reset}    ${bookings.cancelled}`);
    console.log(`${colors.yellow}  ⌛ Expired:${colors.reset}      ${bookings.expired}`);
    console.log(`${colors.cyan}Total Revenue:${colors.reset}    PKR ${bookings.totalRevenue.toLocaleString()}`);
    console.log(`${colors.cyan}Total Advance:${colors.reset}    PKR ${bookings.totalAdvance.toLocaleString()}`);
    console.log();
}

/**
 * Display Additional Statistics
 */
function displayAdditionalStats(data) {
    console.log(`${colors.bright}${colors.magenta}🏢 HOSTEL & ALLOCATION STATISTICS${colors.reset}`);
    console.log(`${'='.repeat(50)}`);
    console.log(`${colors.cyan}Total Hostels:${colors.reset}    ${data.hostels.total}`);
    console.log(`${colors.green}  ✓ Active:${colors.reset}       ${data.hostels.active}`);
    console.log(`${colors.yellow}  • Inactive:${colors.reset}     ${data.hostels.inactive}`);
    console.log(`${colors.blue}  ⚙ Maintenance:${colors.reset}  ${data.hostels.under_maintenance}`);
    console.log(`\n${colors.cyan}Total Allocations:${colors.reset} ${data.allocations.total}`);
    console.log(`${colors.green}  ✓ Active:${colors.reset}       ${data.allocations.active}`);
    console.log(`${colors.magenta}  ← Checked Out:${colors.reset}  ${data.allocations.checked_out}`);
    console.log(`${colors.blue}  ⟳ Transferred:${colors.reset}  ${data.allocations.transferred}`);
    console.log(`${colors.red}  ✗ Cancelled:${colors.reset}    ${data.allocations.cancelled}`);
    console.log();
}

// Run the test
testDashboard();

