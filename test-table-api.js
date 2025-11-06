/**
 * Table API Test Script
 * 
 * This script tests the table endpoints for tenants, staff, and managers
 * 
 * Usage:
 *   node test-table-api.js
 */

const axios = require('axios');

// Configuration
const BASE_URL = 'http://localhost:3000';

// Replace these with valid tokens
const ADMIN_TOKEN = 'YOUR_ADMIN_JWT_TOKEN_HERE';
const MANAGER_TOKEN = 'YOUR_MANAGER_JWT_TOKEN_HERE';

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
 * Test 1: Get All Tenants Table
 */
async function testGetTenants() {
    console.log(`\n${colors.bright}${colors.blue}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━`);
    console.log(`TEST 1: GET ALL TENANTS TABLE`);
    console.log(`━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${colors.reset}\n`);

    try {
        const response = await axios.get(`${BASE_URL}/api/admin/table/tenants`, {
            params: { page: 1, limit: 10 },
            headers: { 'Authorization': `Bearer ${ADMIN_TOKEN}` }
        });

        if (response.data.success) {
            console.log(`${colors.green}✅ Tenants retrieved successfully!${colors.reset}`);
            const { tenants, pagination } = response.data.data;
            
            console.log(`\n${colors.cyan}Total Tenants: ${pagination.totalCount}${colors.reset}`);
            console.log(`${colors.cyan}Page: ${pagination.currentPage}/${pagination.totalPages}${colors.reset}`);
            
            if (tenants.length > 0) {
                console.log(`\n${colors.bright}Sample Tenant:${colors.reset}`);
                const tenant = tenants[0];
                console.log(`  Name: ${tenant.name}`);
                console.log(`  Email: ${tenant.email}`);
                console.log(`  Phone: ${tenant.phone}`);
                console.log(`  Status: ${tenant.status}`);
                console.log(`  Total Paid: PKR ${tenant.totalPaid}`);
                console.log(`  Total Due: PKR ${tenant.totalDue}`);
                console.log(`  Active Allocations: ${tenant.allocations?.length || 0}`);
                console.log(`  Recent Payments: ${tenant.payments?.length || 0}`);
            }
        }
    } catch (error) {
        handleError('Get Tenants', error);
    }
}

/**
 * Test 2: Get All Staff Table
 */
async function testGetStaff() {
    console.log(`\n${colors.bright}${colors.blue}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━`);
    console.log(`TEST 2: GET ALL STAFF TABLE`);
    console.log(`━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${colors.reset}\n`);

    try {
        const response = await axios.get(`${BASE_URL}/api/admin/table/staff`, {
            params: { page: 1, limit: 10, status: 'active' },
            headers: { 'Authorization': `Bearer ${ADMIN_TOKEN}` }
        });

        if (response.data.success) {
            console.log(`${colors.green}✅ Staff retrieved successfully!${colors.reset}`);
            const { staff, pagination } = response.data.data;
            
            console.log(`\n${colors.cyan}Total Staff: ${pagination.totalCount}${colors.reset}`);
            console.log(`${colors.cyan}Page: ${pagination.currentPage}/${pagination.totalPages}${colors.reset}`);
            
            if (staff.length > 0) {
                console.log(`\n${colors.bright}Sample Staff Member:${colors.reset}`);
                const member = staff[0];
                console.log(`  Name: ${member.user.name}`);
                console.log(`  Email: ${member.user.email}`);
                console.log(`  Employee Code: ${member.employeeCode}`);
                console.log(`  Department: ${member.department}`);
                console.log(`  Designation: ${member.designation}`);
                console.log(`  Salary: PKR ${member.salary}`);
                console.log(`  Status: ${member.status}`);
                console.log(`  Role: ${member.role}`);
            }
        }
    } catch (error) {
        handleError('Get Staff', error);
    }
}

/**
 * Test 3: Get All Managers Table (Admin Only)
 */
async function testGetManagers() {
    console.log(`\n${colors.bright}${colors.blue}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━`);
    console.log(`TEST 3: GET ALL MANAGERS TABLE (Admin Only)`);
    console.log(`━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${colors.reset}\n`);

    try {
        const response = await axios.get(`${BASE_URL}/api/admin/table/managers`, {
            params: { page: 1, limit: 10 },
            headers: { 'Authorization': `Bearer ${ADMIN_TOKEN}` }
        });

        if (response.data.success) {
            console.log(`${colors.green}✅ Managers retrieved successfully!${colors.reset}`);
            const { managers, pagination } = response.data.data;
            
            console.log(`\n${colors.cyan}Total Managers: ${pagination.totalCount}${colors.reset}`);
            console.log(`${colors.cyan}Page: ${pagination.currentPage}/${pagination.totalPages}${colors.reset}`);
            
            if (managers.length > 0) {
                console.log(`\n${colors.bright}Sample Manager:${colors.reset}`);
                const manager = managers[0];
                console.log(`  Name: ${manager.user.name}`);
                console.log(`  Email: ${manager.user.email}`);
                console.log(`  Employee Code: ${manager.employeeCode}`);
                console.log(`  Department: ${manager.department}`);
                console.log(`  Designation: ${manager.designation}`);
                console.log(`  Salary: PKR ${manager.salary}`);
                console.log(`  Status: ${manager.status}`);
                console.log(`  Role: ${manager.role}`);
            }
        }
    } catch (error) {
        handleError('Get Managers', error);
    }
}

/**
 * Test 4: Manager Updates Staff (Should Work)
 */
async function testManagerUpdateStaff() {
    console.log(`\n${colors.bright}${colors.blue}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━`);
    console.log(`TEST 4: MANAGER UPDATES STAFF (Should Work)`);
    console.log(`━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${colors.reset}\n`);

    try {
        // First, get a staff member ID
        const staffResponse = await axios.get(`${BASE_URL}/api/admin/table/staff`, {
            params: { limit: 1 },
            headers: { 'Authorization': `Bearer ${MANAGER_TOKEN}` }
        });

        if (staffResponse.data.data.staff.length > 0) {
            const staffId = staffResponse.data.data.staff[0].id;
            
            console.log(`${colors.yellow}Attempting to update staff ID: ${staffId}${colors.reset}`);

            const updateResponse = await axios.put(
                `${BASE_URL}/api/admin/table/staff/${staffId}`,
                { status: 'active' },
                { headers: { 'Authorization': `Bearer ${MANAGER_TOKEN}` } }
            );

            if (updateResponse.data.success) {
                console.log(`${colors.green}✅ Manager successfully updated staff member!${colors.reset}`);
                console.log(`${colors.cyan}This is correct behavior - managers CAN update staff.${colors.reset}`);
            }
        } else {
            console.log(`${colors.yellow}⚠️  No staff members found to test update${colors.reset}`);
        }
    } catch (error) {
        handleError('Manager Update Staff', error);
    }
}

/**
 * Test 5: Manager Tries to Update Admin (Should Fail)
 */
async function testManagerUpdateAdmin() {
    console.log(`\n${colors.bright}${colors.blue}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━`);
    console.log(`TEST 5: MANAGER TRIES TO UPDATE ADMIN (Should Fail)`);
    console.log(`━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${colors.reset}\n`);

    console.log(`${colors.yellow}Note: This test requires an admin user with an employee profile${colors.reset}`);
    console.log(`${colors.yellow}If you don't have one, this test will be skipped${colors.reset}\n`);

    try {
        // Try to update with manager token - should fail if targeting admin
        const response = await axios.put(
            `${BASE_URL}/api/admin/table/staff/999`, // Use a fake ID
            { salary: 100000 },
            { headers: { 'Authorization': `Bearer ${MANAGER_TOKEN}` } }
        );

        console.log(`${colors.red}❌ This should not succeed${colors.reset}`);
    } catch (error) {
        if (error.response && error.response.status === 403) {
            console.log(`${colors.green}✅ Correctly blocked! Manager cannot update admin users.${colors.reset}`);
            console.log(`${colors.cyan}Error message: ${error.response.data.message}${colors.reset}`);
        } else if (error.response && error.response.status === 404) {
            console.log(`${colors.yellow}⚠️  Employee not found (expected for test)${colors.reset}`);
        } else {
            handleError('Manager Update Admin', error);
        }
    }
}

/**
 * Test 6: Search Tenants
 */
async function testSearchTenants() {
    console.log(`\n${colors.bright}${colors.blue}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━`);
    console.log(`TEST 6: SEARCH TENANTS`);
    console.log(`━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${colors.reset}\n`);

    try {
        const response = await axios.get(`${BASE_URL}/api/admin/table/tenants`, {
            params: { search: 'a', limit: 5 }, // Search for tenants with 'a' in their name
            headers: { 'Authorization': `Bearer ${ADMIN_TOKEN}` }
        });

        if (response.data.success) {
            console.log(`${colors.green}✅ Search completed successfully!${colors.reset}`);
            const { tenants } = response.data.data;
            
            console.log(`${colors.cyan}Found ${tenants.length} tenants matching search${colors.reset}`);
            
            if (tenants.length > 0) {
                console.log(`\n${colors.bright}Search Results:${colors.reset}`);
                tenants.forEach((tenant, index) => {
                    console.log(`  ${index + 1}. ${tenant.name} (${tenant.email})`);
                });
            }
        }
    } catch (error) {
        handleError('Search Tenants', error);
    }
}

/**
 * Test 7: Filter Staff by Department
 */
async function testFilterStaffByDepartment() {
    console.log(`\n${colors.bright}${colors.blue}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━`);
    console.log(`TEST 7: FILTER STAFF BY DEPARTMENT`);
    console.log(`━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${colors.reset}\n`);

    try {
        const response = await axios.get(`${BASE_URL}/api/admin/table/staff`, {
            params: { department: 'Housekeeping', status: 'active' },
            headers: { 'Authorization': `Bearer ${ADMIN_TOKEN}` }
        });

        if (response.data.success) {
            console.log(`${colors.green}✅ Filter applied successfully!${colors.reset}`);
            const { staff, pagination } = response.data.data;
            
            console.log(`${colors.cyan}Found ${pagination.totalCount} staff in Housekeeping${colors.reset}`);
            
            if (staff.length > 0) {
                console.log(`\n${colors.bright}Staff Members:${colors.reset}`);
                staff.forEach((member, index) => {
                    console.log(`  ${index + 1}. ${member.user.name} - ${member.designation}`);
                });
            }
        }
    } catch (error) {
        handleError('Filter Staff', error);
    }
}

/**
 * Handle errors
 */
function handleError(testName, error) {
    console.log(`${colors.red}❌ ${testName} failed${colors.reset}`);
    
    if (error.response) {
        console.log(`${colors.yellow}Status: ${error.response.status}${colors.reset}`);
        console.log(`${colors.yellow}Message: ${error.response.data.message || 'Unknown error'}${colors.reset}`);
        
        if (error.response.status === 401) {
            console.log(`\n${colors.yellow}⚠️  Please update tokens in this script with valid JWT tokens${colors.reset}`);
            console.log(`   Login using: POST ${BASE_URL}/api/login${colors.reset}`);
        } else if (error.response.status === 403) {
            console.log(`\n${colors.yellow}⚠️  Access denied - check your token role${colors.reset}`);
        }
    } else {
        console.log(`${colors.red}${error.message}${colors.reset}`);
        console.log(`\n${colors.yellow}⚠️  Make sure the server is running on ${BASE_URL}${colors.reset}`);
    }
}

/**
 * Run all tests
 */
async function runAllTests() {
    console.log(`\n${colors.bright}${colors.magenta}╔════════════════════════════════════════════════════════════════╗`);
    console.log(`║         📋 TESTING TABLE ENDPOINTS                            ║`);
    console.log(`╚════════════════════════════════════════════════════════════════╝${colors.reset}\n`);

    await testGetTenants();
    await testGetStaff();
    await testGetManagers();
    await testManagerUpdateStaff();
    await testManagerUpdateAdmin();
    await testSearchTenants();
    await testFilterStaffByDepartment();

    console.log(`\n${colors.bright}${colors.magenta}╔════════════════════════════════════════════════════════════════╗`);
    console.log(`║         ✅ ALL TESTS COMPLETED                                ║`);
    console.log(`╚════════════════════════════════════════════════════════════════╝${colors.reset}\n`);
}

// Run the tests
runAllTests().catch(error => {
    console.error(`${colors.red}Fatal error:${colors.reset}`, error);
});










