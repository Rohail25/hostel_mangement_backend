# Transaction Management API Documentation

## Overview
Complete Transaction Management System that stores payment gateway transactions and links them to **Payment** and **Tenant** IDs. This system tracks all financial transactions from various payment gateways (Stripe, JazzCash, PayFast, etc.).

## Database Schema

### Transaction Model
```prisma
model Transaction {
  id               Int               @id @default(autoincrement())
  paymentId        Int               // Link to Payment
  tenantId         Int?
  hostelId         Int?
  
  // Gateway Info
  gateway          String            // e.g. "Stripe", "JazzCash", "PayFast"
  transactionType  String            // e.g. "rent", "deposit", "refund"
  
  // Amounts
  amount           Float
  currency         String?           @default("PKR")
  fee              Float?            @default(0)  // Platform or gateway fee
  
  // IDs from Payment Gateway
  gatewayRef       String?           // e.g. Stripe session/payment_intent id
  orderId          String?
  merchantTxnId    String?
  
  // Status & Response
  status           TransactionStatus @default(pending)
  responseCode     String?
  responseMessage  String?
  rawResponse      Json?             // Full response from gateway for debugging
  
  // Payment Method
  paymentMethod    PaymentMethod
  
  // IP & Device Info (optional for audit)
  ipAddress        String?
  userAgent        String?
  
  // Timestamps
  createdAt        DateTime          @default(now())
  updatedAt        DateTime          @updatedAt

  // Relations
  payment          Payment           @relation(fields: [paymentId], references: [id], onDelete: Cascade)
  tenant           Tenant?           @relation(fields: [tenantId], references: [id], onDelete: SetNull)
  hostel           Hostel?           @relation(fields: [hostelId], references: [id], onDelete: SetNull)
}
```

### Enums
```prisma
enum TransactionStatus {
  pending
  processing
  completed
  failed
  cancelled
  refunded
}

enum PaymentMethod {
  cash
  card
  bank_transfer
  upi
  cheque
  online
}
```

## API Endpoints

### 1. Create Transaction
**POST** `/api/admin/transactions`

Creates a new transaction record for payment gateway processing.

**Authentication:** Required (Admin/Manager/Staff)

**Request Body:**
```json
{
  // Required Fields
  "paymentId": 1,
  "gateway": "Stripe",
  "transactionType": "rent",
  "amount": 5000.00,
  "paymentMethod": "card",
  
  // Optional Fields
  "tenantId": 1,
  "hostelId": 1,
  "currency": "PKR",
  "fee": 150.00,
  "gatewayRef": "pi_3OGH9E2eZvKYlo2C0xXYZ123",
  "orderId": "ORD-2025-001",
  "merchantTxnId": "MERCH-TXN-123",
  "status": "pending",
  "responseCode": "200",
  "responseMessage": "Transaction initiated successfully",
  "rawResponse": {
    "id": "pi_3OGH9E2eZvKYlo2C0xXYZ123",
    "status": "pending",
    "currency": "pkr",
    "amount": 500000
  },
  "ipAddress": "192.168.1.1",
  "userAgent": "Mozilla/5.0..."
}
```

**Response:**
```json
{
  "success": true,
  "message": "Transaction created successfully",
  "data": {
    "id": 1,
    "paymentId": 1,
    "tenantId": 1,
    "hostelId": 1,
    "gateway": "Stripe",
    "transactionType": "rent",
    "amount": 5000.00,
    "currency": "PKR",
    "fee": 150.00,
    "gatewayRef": "pi_3OGH9E2eZvKYlo2C0xXYZ123",
    "status": "pending",
    "paymentMethod": "card",
    "createdAt": "2025-10-22T12:20:00.000Z",
    "payment": {
      "id": 1,
      "amount": 5000.00,
      "paymentType": "rent",
      "tenant": {
        "id": 1,
        "name": "John Doe",
        "email": "john@example.com"
      }
    },
    "tenant": {
      "id": 1,
      "name": "John Doe",
      "email": "john@example.com"
    },
    "hostel": {
      "id": 1,
      "name": "Grand Hostel"
    }
  }
}
```

---

### 2. Get All Transactions
**GET** `/api/admin/transactions`

Get all transactions with comprehensive filtering and pagination.

**Authentication:** Required (Admin/Manager/Staff)

**Query Parameters:**
- `status` - Filter by status (pending, processing, completed, failed, cancelled, refunded)
- `gateway` - Filter by gateway name (Stripe, JazzCash, PayFast, etc.)
- `transactionType` - Filter by type (rent, deposit, refund, etc.)
- `paymentMethod` - Filter by payment method (cash, card, bank_transfer, etc.)
- `tenantId` - Filter by tenant ID
- `hostelId` - Filter by hostel ID
- `paymentId` - Filter by payment ID
- `startDate` - Filter by start date (ISO 8601 format)
- `endDate` - Filter by end date (ISO 8601 format)
- `search` - Search by gatewayRef, orderId, merchantTxnId, or responseCode
- `page` - Page number (default: 1)
- `limit` - Items per page (default: 10)

**Example Request:**
```
GET /api/admin/transactions?status=completed&gateway=Stripe&page=1&limit=10
```

**Response:**
```json
{
  "success": true,
  "message": "Transactions fetched successfully",
  "data": [
    {
      "id": 1,
      "paymentId": 1,
      "tenantId": 1,
      "gateway": "Stripe",
      "transactionType": "rent",
      "amount": 5000.00,
      "status": "completed",
      "payment": {
        "id": 1,
        "amount": 5000.00,
        "paymentType": "rent",
        "receiptNumber": "RCP-001"
      },
      "tenant": {
        "id": 1,
        "name": "John Doe",
        "email": "john@example.com"
      }
    }
  ],
  "pagination": {
    "total": 50,
    "page": 1,
    "limit": 10,
    "totalPages": 5
  }
}
```

---

### 3. Get Transaction by ID
**GET** `/api/admin/transactions/:id`

Get detailed information about a specific transaction.

**Authentication:** Required (Admin/Manager/Staff)

**Response:**
```json
{
  "success": true,
  "message": "Transaction fetched successfully",
  "data": {
    "id": 1,
    "paymentId": 1,
    "tenantId": 1,
    "hostelId": 1,
    "gateway": "Stripe",
    "transactionType": "rent",
    "amount": 5000.00,
    "currency": "PKR",
    "fee": 150.00,
    "gatewayRef": "pi_3OGH9E2eZvKYlo2C0xXYZ123",
    "orderId": "ORD-2025-001",
    "status": "completed",
    "responseCode": "200",
    "responseMessage": "Payment successful",
    "rawResponse": { ... },
    "paymentMethod": "card",
    "ipAddress": "192.168.1.1",
    "createdAt": "2025-10-22T12:20:00.000Z",
    "payment": {
      "id": 1,
      "amount": 5000.00,
      "paymentType": "rent",
      "tenant": {
        "id": 1,
        "name": "John Doe",
        "email": "john@example.com",
        "cnicNumber": "12345-1234567-1"
      },
      "allocation": {
        "id": 1,
        "checkInDate": "2025-01-01T00:00:00.000Z",
        "rentAmount": 5000.00
      }
    },
    "tenant": { ... },
    "hostel": { ... }
  }
}
```

---

### 4. Get Transactions by Payment ID
**GET** `/api/admin/transactions/payment/:paymentId`

Get all transactions associated with a specific payment.

**Authentication:** Required (Admin/Manager/Staff)

**Response:**
```json
{
  "success": true,
  "message": "Payment transactions fetched successfully",
  "data": [
    {
      "id": 1,
      "paymentId": 1,
      "gateway": "Stripe",
      "amount": 5000.00,
      "status": "completed",
      "tenant": { ... },
      "hostel": { ... }
    }
  ],
  "count": 1
}
```

---

### 5. Get Transactions by Tenant ID
**GET** `/api/admin/transactions/tenant/:tenantId`

Get all transactions for a specific tenant with pagination.

**Authentication:** Required (Admin/Manager/Staff)

**Query Parameters:**
- `page` - Page number (default: 1)
- `limit` - Items per page (default: 10)

**Response:**
```json
{
  "success": true,
  "message": "Tenant transactions fetched successfully",
  "data": [
    {
      "id": 1,
      "paymentId": 1,
      "gateway": "Stripe",
      "amount": 5000.00,
      "status": "completed",
      "payment": {
        "id": 1,
        "amount": 5000.00,
        "paymentType": "rent",
        "receiptNumber": "RCP-001"
      },
      "hostel": {
        "id": 1,
        "name": "Grand Hostel"
      }
    }
  ],
  "pagination": {
    "total": 20,
    "page": 1,
    "limit": 10,
    "totalPages": 2
  }
}
```

---

### 6. Update Transaction
**PUT** `/api/admin/transactions/:id`

Update transaction details (Admin/Manager only).

**Authentication:** Required (Admin/Manager)

**Request Body:** (All fields optional)
```json
{
  "status": "completed",
  "gatewayRef": "pi_3OGH9E2eZvKYlo2C0xXYZ123",
  "orderId": "ORD-2025-001",
  "merchantTxnId": "MERCH-TXN-123",
  "responseCode": "200",
  "responseMessage": "Payment successful",
  "rawResponse": { ... },
  "fee": 150.00
}
```

**Response:**
```json
{
  "success": true,
  "message": "Transaction updated successfully",
  "data": {
    "id": 1,
    "status": "completed",
    "gatewayRef": "pi_3OGH9E2eZvKYlo2C0xXYZ123",
    "payment": { ... },
    "tenant": { ... }
  }
}
```

---

### 7. Update Transaction Status
**PATCH** `/api/admin/transactions/:id/status`

Update only the transaction status.

**Authentication:** Required (Admin/Manager/Staff)

**Request Body:**
```json
{
  "status": "completed",
  "responseCode": "200",
  "responseMessage": "Payment successful",
  "rawResponse": { ... },
  "gatewayRef": "pi_3OGH9E2eZvKYlo2C0xXYZ123"
}
```

**Response:**
```json
{
  "success": true,
  "message": "Transaction status updated successfully",
  "data": {
    "id": 1,
    "status": "completed",
    "responseCode": "200",
    "payment": { ... },
    "tenant": { ... }
  }
}
```

---

### 8. Delete Transaction
**DELETE** `/api/admin/transactions/:id`

Delete a transaction record (Admin only).

**Authentication:** Required (Admin only)

**Response:**
```json
{
  "success": true,
  "message": "Transaction deleted successfully"
}
```

---

### 9. Get Transaction Statistics
**GET** `/api/admin/transactions/statistics`

Get comprehensive transaction statistics and analytics.

**Authentication:** Required (Admin/Manager)

**Query Parameters:**
- `startDate` - Start date for statistics (ISO 8601 format)
- `endDate` - End date for statistics (ISO 8601 format)
- `hostelId` - Filter by hostel ID

**Response:**
```json
{
  "success": true,
  "message": "Transaction statistics fetched successfully",
  "data": {
    "totalTransactions": 150,
    "statusBreakdown": {
      "completed": 120,
      "pending": 20,
      "failed": 10
    },
    "transactionsByGateway": [
      {
        "gateway": "Stripe",
        "_count": 80,
        "_sum": {
          "amount": 400000
        }
      },
      {
        "gateway": "JazzCash",
        "_count": 70,
        "_sum": {
          "amount": 350000
        }
      }
    ],
    "transactionsByType": [
      {
        "transactionType": "rent",
        "_count": 100,
        "_sum": {
          "amount": 500000
        }
      },
      {
        "transactionType": "deposit",
        "_count": 50,
        "_sum": {
          "amount": 250000
        }
      }
    ],
    "transactionsByStatus": [
      {
        "status": "completed",
        "_count": 120,
        "_sum": {
          "amount": 600000
        }
      }
    ],
    "amountStatistics": {
      "totalAmount": 750000,
      "totalFees": 22500,
      "averageAmount": 5000,
      "netAmount": 727500
    }
  }
}
```

---

### 10. Webhook Handler
**POST** `/api/admin/transactions/webhook`

Handle payment gateway webhook callbacks (No authentication required).

**Authentication:** None (Public endpoint for payment gateways)

**Request Body:**
```json
{
  "gateway": "Stripe",
  "gatewayRef": "pi_3OGH9E2eZvKYlo2C0xXYZ123",
  "orderId": "ORD-2025-001",
  "status": "completed",
  "amount": 5000,
  "responseCode": "200",
  "responseMessage": "Payment successful",
  "rawResponse": {
    "event_type": "payment.succeeded",
    "payment_id": "pi_3OGH9E2eZvKYlo2C0xXYZ123"
  }
}
```

**Response:**
```json
{
  "success": true,
  "message": "Webhook processed successfully",
  "data": {
    "id": 1,
    "status": "completed",
    "responseCode": "200",
    "responseMessage": "Payment successful"
  }
}
```

---

## Complete Usage Example

### Scenario: Processing a Stripe Payment

#### Step 1: Create Payment Record
```bash
curl -X POST http://localhost:3000/api/admin/payments \
  -H "Content-Type: application/json" \
  -H "Cookie: token=YOUR_JWT_TOKEN" \
  -d '{
    "tenantId": 1,
    "hostelId": 1,
    "amount": 5000,
    "paymentType": "rent",
    "paymentMethod": "card",
    "forMonth": "2025-10"
  }'
```

#### Step 2: Create Transaction Record
```bash
curl -X POST http://localhost:3000/api/admin/transactions \
  -H "Content-Type: application/json" \
  -H "Cookie: token=YOUR_JWT_TOKEN" \
  -d '{
    "paymentId": 1,
    "tenantId": 1,
    "hostelId": 1,
    "gateway": "Stripe",
    "transactionType": "rent",
    "amount": 5000,
    "currency": "PKR",
    "fee": 150,
    "paymentMethod": "card",
    "status": "pending"
  }'
```

#### Step 3: Stripe Processes Payment (sends webhook)
```bash
# This is called by Stripe automatically
curl -X POST http://localhost:3000/api/admin/transactions/webhook \
  -H "Content-Type: application/json" \
  -d '{
    "gateway": "Stripe",
    "gatewayRef": "pi_3OGH9E2eZvKYlo2C0xXYZ123",
    "status": "completed",
    "amount": 5000,
    "responseCode": "200",
    "responseMessage": "Payment successful"
  }'
```

#### Step 4: Check Transaction Status
```bash
curl -X GET http://localhost:3000/api/admin/transactions/1 \
  -H "Cookie: token=YOUR_JWT_TOKEN"
```

#### Step 5: Get Statistics
```bash
curl -X GET "http://localhost:3000/api/admin/transactions/statistics?startDate=2025-10-01&endDate=2025-10-31" \
  -H "Cookie: token=YOUR_JWT_TOKEN"
```

---

## Integration with Payment Gateways

### Stripe Integration Example
```javascript
// Create Stripe payment intent
const paymentIntent = await stripe.paymentIntents.create({
  amount: 500000, // Amount in smallest currency unit (paisas)
  currency: 'pkr',
  payment_method: paymentMethodId,
  confirm: true,
  metadata: {
    paymentId: 1,
    tenantId: 1,
    hostelId: 1
  }
});

// Create transaction record
await axios.post('/api/admin/transactions', {
  paymentId: 1,
  gateway: 'Stripe',
  transactionType: 'rent',
  amount: 5000,
  gatewayRef: paymentIntent.id,
  status: 'pending',
  paymentMethod: 'card'
});
```

### JazzCash Integration Example
```javascript
// Create JazzCash payment
const jazzCashResponse = await jazzCash.createPayment({
  amount: 5000,
  billReference: 'BILL-001',
  description: 'Rent payment'
});

// Create transaction record
await axios.post('/api/admin/transactions', {
  paymentId: 1,
  gateway: 'JazzCash',
  transactionType: 'rent',
  amount: 5000,
  orderId: jazzCashResponse.orderNumber,
  merchantTxnId: jazzCashResponse.transactionId,
  status: 'pending',
  paymentMethod: 'online'
});
```

---

## Features Summary

✅ Complete CRUD operations for transactions
✅ Link transactions to Payment and Tenant IDs
✅ Support multiple payment gateways (Stripe, JazzCash, PayFast, etc.)
✅ Store gateway reference IDs (gatewayRef, orderId, merchantTxnId)
✅ Track transaction status (pending, processing, completed, failed, cancelled, refunded)
✅ Store gateway fees and calculate net amounts
✅ Full gateway response storage (rawResponse) for debugging
✅ IP address and user agent tracking for security
✅ Webhook handler for payment gateway callbacks
✅ Advanced filtering (status, gateway, type, date range)
✅ Search by gateway references and order IDs
✅ Comprehensive statistics and analytics
✅ Transaction history by payment and tenant
✅ Pagination support
✅ Role-based access control

---

## Transaction Flow

```
1. Payment Created → Payment Record in Database
2. Transaction Initiated → Transaction Record (status: pending)
3. Gateway Processing → Update Transaction (status: processing)
4. Gateway Response → Webhook Handler Updates Transaction
5. Success → Transaction status: completed
6. Failure → Transaction status: failed
7. Refund → New Transaction (transactionType: refund, status: completed)
```

---

## Error Handling

All endpoints return consistent error responses:

```json
{
  "success": false,
  "message": "Error description",
  "error": "Detailed error message"
}
```

Common HTTP status codes:
- `200` - Success
- `201` - Created
- `400` - Bad Request
- `401` - Unauthorized
- `403` - Forbidden
- `404` - Not Found
- `500` - Internal Server Error

---

## Security Notes

1. **Webhook Endpoint:** The webhook endpoint (`/transactions/webhook`) is public to allow payment gateways to send callbacks
2. **Gateway Verification:** Implement signature verification for webhook requests in production
3. **IP Whitelisting:** Consider whitelisting payment gateway IP addresses
4. **HTTPS Required:** Always use HTTPS in production for secure data transmission
5. **Token Storage:** Never store sensitive payment tokens in the database
6. **PCI Compliance:** Follow PCI DSS guidelines when handling card information

---

## Best Practices

1. Always create a transaction record before initiating payment
2. Store complete gateway responses for debugging
3. Use idempotency keys to prevent duplicate transactions
4. Implement retry logic for failed webhook deliveries
5. Monitor transaction failures and send alerts
6. Regularly reconcile transactions with payment gateway reports
7. Archive old transaction records after a certain period
8. Implement rate limiting on webhook endpoints

---

## Notes

- Transaction records are created when initiating payment with a gateway
- Each payment can have multiple transactions (e.g., initial payment + refund)
- Gateway fees are stored separately for accurate financial reporting
- Raw responses are stored as JSON for debugging and audit trails
- Webhook endpoint is public but should be secured with signature verification
- All monetary values are stored as Float (Double precision)
- Currency defaults to PKR but can be customized


