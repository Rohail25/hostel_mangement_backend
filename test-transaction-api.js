/**
 * Transaction API Testing Script
 * 
 * Before running this script:
 * 1. Make sure the server is running (node app.js)
 * 2. Make sure you have at least one Payment record in the database
 * 3. Update the AUTH_TOKEN with a valid admin/manager/staff token
 * 4. Update PAYMENT_ID with an actual payment ID from your database
 * 5. Run: node test-transaction-api.js
 */

const axios = require('axios');

const BASE_URL = 'http://localhost:3000/api/admin';
const AUTH_TOKEN = 'YOUR_JWT_TOKEN_HERE'; // Replace with actual token
const PAYMENT_ID = 1; // Replace with actual payment ID from your database
const TENANT_ID = 1; // Replace with actual tenant ID
const HOSTEL_ID = 1; // Replace with actual hostel ID

const api = axios.create({
    baseURL: BASE_URL,
    headers: {
        'Content-Type': 'application/json',
        'Cookie': `token=${AUTH_TOKEN}`
    }
});

// Test data
const testTransaction = {
    // Required fields
    paymentId: PAYMENT_ID,
    gateway: "Stripe",
    transactionType: "rent",
    amount: 5000.00,
    paymentMethod: "card",
    
    // Optional fields
    tenantId: TENANT_ID,
    hostelId: HOSTEL_ID,
    currency: "PKR",
    fee: 150.00,
    gatewayRef: `stripe_${Date.now()}`,
    orderId: `ORD-${Date.now()}`,
    merchantTxnId: `MERCH-${Date.now()}`,
    status: "pending",
    responseCode: "100",
    responseMessage: "Transaction initiated",
    rawResponse: {
        event_type: "payment.initiated",
        timestamp: new Date().toISOString()
    },
    ipAddress: "192.168.1.100",
    userAgent: "Test Agent / Node.js"
};

async function runTests() {
    console.log('🚀 Starting Transaction API Tests...\n');
    
    let createdTransactionId = null;

    try {
        // Test 1: Create Transaction
        console.log('1️⃣ Testing: CREATE TRANSACTION');
        const createResponse = await api.post('/transactions', testTransaction);
        console.log('✅ Transaction Created:', {
            id: createResponse.data.data.id,
            paymentId: createResponse.data.data.paymentId,
            gateway: createResponse.data.data.gateway,
            amount: createResponse.data.data.amount,
            status: createResponse.data.data.status,
            gatewayRef: createResponse.data.data.gatewayRef
        });
        createdTransactionId = createResponse.data.data.id;
        console.log('');

        // Test 2: Get All Transactions
        console.log('2️⃣ Testing: GET ALL TRANSACTIONS');
        const allTransactions = await api.get('/transactions?page=1&limit=5');
        console.log('✅ Transactions Fetched:', {
            total: allTransactions.data.pagination.total,
            page: allTransactions.data.pagination.page,
            count: allTransactions.data.data.length
        });
        console.log('');

        // Test 3: Get Transaction by ID
        console.log('3️⃣ Testing: GET TRANSACTION BY ID');
        const transactionById = await api.get(`/transactions/${createdTransactionId}`);
        console.log('✅ Transaction Details:', {
            id: transactionById.data.data.id,
            gateway: transactionById.data.data.gateway,
            amount: transactionById.data.data.amount,
            status: transactionById.data.data.status,
            fee: transactionById.data.data.fee
        });
        console.log('');

        // Test 4: Get Transactions by Payment ID
        console.log('4️⃣ Testing: GET TRANSACTIONS BY PAYMENT ID');
        const paymentTransactions = await api.get(`/transactions/payment/${PAYMENT_ID}`);
        console.log('✅ Payment Transactions:', {
            paymentId: PAYMENT_ID,
            count: paymentTransactions.data.count,
            transactions: paymentTransactions.data.data.length
        });
        console.log('');

        // Test 5: Get Transactions by Tenant ID
        console.log('5️⃣ Testing: GET TRANSACTIONS BY TENANT ID');
        const tenantTransactions = await api.get(`/transactions/tenant/${TENANT_ID}?page=1&limit=5`);
        console.log('✅ Tenant Transactions:', {
            tenantId: TENANT_ID,
            total: tenantTransactions.data.pagination.total,
            count: tenantTransactions.data.data.length
        });
        console.log('');

        // Test 6: Update Transaction Status
        console.log('6️⃣ Testing: UPDATE TRANSACTION STATUS');
        const statusResponse = await api.patch(`/transactions/${createdTransactionId}/status`, {
            status: "processing",
            responseCode: "200",
            responseMessage: "Payment processing"
        });
        console.log('✅ Status Updated:', {
            id: statusResponse.data.data.id,
            oldStatus: "pending",
            newStatus: statusResponse.data.data.status,
            responseCode: statusResponse.data.data.responseCode
        });
        console.log('');

        // Test 7: Update Transaction (Full Update)
        console.log('7️⃣ Testing: UPDATE TRANSACTION');
        const updateResponse = await api.put(`/transactions/${createdTransactionId}`, {
            status: "completed",
            responseCode: "200",
            responseMessage: "Payment successful",
            rawResponse: {
                event_type: "payment.succeeded",
                timestamp: new Date().toISOString(),
                payment_id: testTransaction.gatewayRef
            }
        });
        console.log('✅ Transaction Updated:', {
            id: updateResponse.data.data.id,
            status: updateResponse.data.data.status,
            responseMessage: updateResponse.data.data.responseMessage
        });
        console.log('');

        // Test 8: Get Statistics
        console.log('8️⃣ Testing: GET TRANSACTION STATISTICS');
        const stats = await api.get('/transactions/statistics');
        console.log('✅ Statistics:', {
            totalTransactions: stats.data.data.totalTransactions,
            completed: stats.data.data.statusBreakdown.completed,
            pending: stats.data.data.statusBreakdown.pending,
            failed: stats.data.data.statusBreakdown.failed,
            totalAmount: stats.data.data.amountStatistics.totalAmount,
            totalFees: stats.data.data.amountStatistics.totalFees,
            netAmount: stats.data.data.amountStatistics.netAmount
        });
        console.log('');

        // Test 9: Filter by Gateway
        console.log('9️⃣ Testing: FILTER BY GATEWAY');
        const gatewayFilter = await api.get('/transactions?gateway=Stripe&status=completed&page=1&limit=5');
        console.log('✅ Filtered by Gateway (Stripe, completed):', {
            count: gatewayFilter.data.data.length,
            total: gatewayFilter.data.pagination.total
        });
        console.log('');

        // Test 10: Search Transactions
        console.log('🔟 Testing: SEARCH TRANSACTIONS');
        const searchResponse = await api.get(`/transactions?search=${testTransaction.orderId}`);
        console.log('✅ Search Results:', {
            query: testTransaction.orderId,
            found: searchResponse.data.data.length > 0,
            count: searchResponse.data.data.length
        });
        console.log('');

        // Test 11: Test Webhook Handler
        console.log('1️⃣1️⃣ Testing: WEBHOOK HANDLER');
        const webhookData = {
            gateway: "Stripe",
            gatewayRef: testTransaction.gatewayRef,
            orderId: testTransaction.orderId,
            status: "completed",
            amount: 5000,
            responseCode: "200",
            responseMessage: "Payment completed via webhook",
            rawResponse: {
                event: "payment.succeeded",
                object: "payment_intent",
                id: testTransaction.gatewayRef
            }
        };
        
        // Webhook endpoint doesn't require auth
        const webhookResponse = await axios.post(
            `${BASE_URL}/transactions/webhook`,
            webhookData,
            { headers: { 'Content-Type': 'application/json' } }
        );
        console.log('✅ Webhook Processed:', {
            success: webhookResponse.data.success,
            message: webhookResponse.data.message,
            transactionId: webhookResponse.data.data.id,
            status: webhookResponse.data.data.status
        });
        console.log('');

        // Optional: Delete Transaction (uncomment to test)
        // console.log('🗑️ Testing: DELETE TRANSACTION');
        // await api.delete(`/transactions/${createdTransactionId}`);
        // console.log('✅ Transaction Deleted:', { id: createdTransactionId });
        // console.log('');

        console.log('✨ All tests completed successfully!\n');
        console.log(`📝 Created Transaction ID: ${createdTransactionId}`);
        console.log(`📝 Gateway Reference: ${testTransaction.gatewayRef}`);
        console.log('📝 You can manually delete this test transaction if needed.');

    } catch (error) {
        console.error('❌ Test Failed:', {
            message: error.response?.data?.message || error.message,
            status: error.response?.status,
            error: error.response?.data?.error
        });
        console.log('\n💡 Tips:');
        console.log('1. Make sure the server is running');
        console.log('2. Update AUTH_TOKEN with a valid admin/manager/staff token');
        console.log('3. Update PAYMENT_ID with an actual payment ID from your database');
        console.log('4. Make sure the payment exists before creating transaction');
        console.log('5. Check if the user has proper permissions\n');
    }
}

// Helper: Create a test payment first (if needed)
async function createTestPayment() {
    try {
        console.log('📦 Creating test payment first...\n');
        
        const paymentData = {
            tenantId: TENANT_ID,
            hostelId: HOSTEL_ID,
            amount: 5000,
            paymentType: "rent",
            paymentMethod: "card",
            forMonth: "2025-10",
            status: "paid",
            collectedBy: 1
        };

        const response = await api.post('/payments', paymentData);
        console.log('✅ Test Payment Created:', {
            id: response.data.data.id,
            amount: response.data.data.amount,
            paymentType: response.data.data.paymentType
        });
        console.log('Update PAYMENT_ID to:', response.data.data.id);
        console.log('');
        return response.data.data.id;
    } catch (error) {
        console.error('❌ Failed to create test payment:', error.response?.data || error.message);
        return null;
    }
}

// Run tests
console.log('═══════════════════════════════════════════════');
console.log('      TRANSACTION API TESTING SCRIPT');
console.log('═══════════════════════════════════════════════\n');

if (AUTH_TOKEN === 'YOUR_JWT_TOKEN_HERE') {
    console.log('⚠️  Please update AUTH_TOKEN in the script before running tests!\n');
    console.log('How to get a token:');
    console.log('1. Login as admin/manager/staff using POST /api/login');
    console.log('2. Copy the token from the response cookies');
    console.log('3. Replace YOUR_JWT_TOKEN_HERE with the actual token\n');
    process.exit(1);
} else {
    // Optional: Uncomment to create a test payment first
    // createTestPayment().then(paymentId => {
    //     if (paymentId) {
    //         PAYMENT_ID = paymentId;
    //         runTests();
    //     }
    // });
    
    // Run tests with existing payment ID
    runTests();
}


