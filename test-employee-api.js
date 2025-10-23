/**
 * Employee API Testing Script
 * 
 * Before running this script:
 * 1. Make sure the server is running (node app.js)
 * 2. Update the AUTH_TOKEN with a valid admin/manager token
 * 3. Run: node test-employee-api.js
 */

const axios = require('axios');

const BASE_URL = 'http://localhost:3000/api/admin';
const AUTH_TOKEN = 'YOUR_JWT_TOKEN_HERE'; // Replace with actual token

const api = axios.create({
    baseURL: BASE_URL,
    headers: {
        'Content-Type': 'application/json',
        'Cookie': `token=${AUTH_TOKEN}`
    }
});

// Test data
const testEmployee = {
    // User Information
    name: "Test Employee",
    email: `test.employee${Date.now()}@hotel.com`, // Unique email
    phone: "+1234567890",
    password: "password123",
    role: "staff", // User role
    
    // Employee Information
    role: "staff", // Employee role
    department: "Housekeeping",
    designation: "Room Cleaner",
    salary: 25000.00,
    salaryType: "monthly",
    joinDate: "2025-01-01",
    
    // Optional fields
    workingHours: {
        startTime: "09:00",
        endTime: "18:00",
        workingDays: ["monday", "tuesday", "wednesday", "thursday", "friday", "saturday"]
    },
    bankDetails: {
        bankName: "ABC Bank",
        accountNumber: "1234567890",
        ifscCode: "ABCD0123456",
        branch: "Main Branch"
    },
    address: {
        street: "123 Main St",
        city: "New York",
        state: "NY",
        country: "USA",
        pincode: "10001"
    },
    emergencyContact: {
        name: "Emergency Contact",
        relationship: "Spouse",
        phone: "+1234567891",
        address: "123 Main St, New York"
    },
    qualifications: [
        {
            degree: "Bachelor's",
            institution: "ABC University",
            year: "2020"
        }
    ],
    notes: "Test employee created via API"
};

async function runTests() {
    console.log('🚀 Starting Employee API Tests...\n');
    
    let createdEmployeeId = null;

    try {
        // Test 1: Create Employee
        console.log('1️⃣ Testing: CREATE EMPLOYEE');
        const createResponse = await api.post('/employees', testEmployee);
        console.log('✅ Employee Created:', {
            id: createResponse.data.data.employee.id,
            name: createResponse.data.data.user.name,
            email: createResponse.data.data.user.email,
            employeeCode: createResponse.data.data.employee.employeeCode,
            salary: createResponse.data.data.employee.salary
        });
        createdEmployeeId = createResponse.data.data.employee.id;
        console.log('');

        // Test 2: Get All Employees
        console.log('2️⃣ Testing: GET ALL EMPLOYEES');
        const allEmployees = await api.get('/employees?page=1&limit=5');
        console.log('✅ Employees Fetched:', {
            total: allEmployees.data.pagination.total,
            page: allEmployees.data.pagination.page,
            count: allEmployees.data.data.length
        });
        console.log('');

        // Test 3: Get Employee by ID
        console.log('3️⃣ Testing: GET EMPLOYEE BY ID');
        const employeeById = await api.get(`/employees/${createdEmployeeId}`);
        console.log('✅ Employee Details:', {
            id: employeeById.data.data.id,
            name: employeeById.data.data.user.name,
            department: employeeById.data.data.department,
            salary: employeeById.data.data.salary
        });
        console.log('');

        // Test 4: Update Employee
        console.log('4️⃣ Testing: UPDATE EMPLOYEE');
        const updateResponse = await api.put(`/employees/${createdEmployeeId}`, {
            designation: "Senior Room Cleaner",
            department: "Housekeeping Premium",
            notes: "Updated via API test"
        });
        console.log('✅ Employee Updated:', {
            id: updateResponse.data.data.employee.id,
            designation: updateResponse.data.data.employee.designation,
            department: updateResponse.data.data.employee.department
        });
        console.log('');

        // Test 5: Update Salary
        console.log('5️⃣ Testing: UPDATE EMPLOYEE SALARY');
        const salaryResponse = await api.patch(`/employees/${createdEmployeeId}/salary`, {
            salary: 30000.00,
            notes: "Annual increment via API test"
        });
        console.log('✅ Salary Updated:', {
            id: salaryResponse.data.data.id,
            oldSalary: 25000.00,
            newSalary: salaryResponse.data.data.salary
        });
        console.log('');

        // Test 6: Get Statistics
        console.log('6️⃣ Testing: GET EMPLOYEE STATISTICS');
        const stats = await api.get('/employees/statistics');
        console.log('✅ Statistics:', {
            totalEmployees: stats.data.data.totalEmployees,
            active: stats.data.data.statusBreakdown.active,
            totalMonthlySalaryExpense: stats.data.data.salaryStatistics.totalMonthlySalaryExpense,
            averageSalary: stats.data.data.salaryStatistics.averageSalary
        });
        console.log('');

        // Test 7: Search Employees
        console.log('7️⃣ Testing: SEARCH EMPLOYEES');
        const searchResponse = await api.get('/employees?search=Room&status=active');
        console.log('✅ Search Results:', {
            count: searchResponse.data.data.length,
            query: 'Room, status=active'
        });
        console.log('');

        // Test 8: Update Status
        console.log('8️⃣ Testing: UPDATE EMPLOYEE STATUS');
        const statusResponse = await api.patch(`/employees/${createdEmployeeId}/status`, {
            status: "on_leave",
            notes: "On leave for testing"
        });
        console.log('✅ Status Updated:', {
            id: statusResponse.data.data.id,
            status: statusResponse.data.data.status
        });
        console.log('');

        // Test 9: Filter by Role
        console.log('9️⃣ Testing: FILTER BY ROLE');
        const roleFilter = await api.get('/employees?role=staff&page=1&limit=5');
        console.log('✅ Filtered by Role (staff):', {
            count: roleFilter.data.data.length,
            total: roleFilter.data.pagination.total
        });
        console.log('');

        // Optional: Delete Employee (uncomment to test)
        // console.log('🗑️ Testing: DELETE EMPLOYEE');
        // await api.delete(`/employees/${createdEmployeeId}`);
        // console.log('✅ Employee Deleted:', { id: createdEmployeeId });
        // console.log('');

        console.log('✨ All tests completed successfully!\n');
        console.log(`📝 Created Employee ID: ${createdEmployeeId}`);
        console.log('📝 You can manually delete this test employee if needed.');

    } catch (error) {
        console.error('❌ Test Failed:', {
            message: error.response?.data?.message || error.message,
            status: error.response?.status,
            error: error.response?.data?.error
        });
        console.log('\n💡 Tips:');
        console.log('1. Make sure the server is running');
        console.log('2. Update AUTH_TOKEN with a valid admin/manager token');
        console.log('3. Check if the user has proper permissions\n');
    }
}

// Run tests
console.log('═══════════════════════════════════════════════');
console.log('       EMPLOYEE API TESTING SCRIPT');
console.log('═══════════════════════════════════════════════\n');

if (AUTH_TOKEN === 'YOUR_JWT_TOKEN_HERE') {
    console.log('⚠️  Please update AUTH_TOKEN in the script before running tests!\n');
    console.log('How to get a token:');
    console.log('1. Login as admin/manager using POST /api/login');
    console.log('2. Copy the token from the response cookies');
    console.log('3. Replace YOUR_JWT_TOKEN_HERE with the actual token\n');
    process.exit(1);
} else {
    runTests();
}


