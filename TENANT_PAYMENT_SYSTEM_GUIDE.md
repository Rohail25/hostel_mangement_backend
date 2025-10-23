# 🏨 Complete Tenant & Payment Management System

## 📋 Table of Contents
1. [System Overview](#system-overview)
2. [Database Schema](#database-schema)
3. [Tenant Management](#tenant-management)
4. [Payment Tracking](#payment-tracking)
5. [API Endpoints](#api-endpoints)
6. [Complete Example Workflow](#complete-example-workflow)
7. [Payment Reports](#payment-reports)

---

## 🎯 System Overview

This system provides comprehensive tenant and payment management for hostels/hotels with:

### **Key Features:**
- ✅ **Complete Tenant Profiles** - Store all tenant information
- ✅ **Payment Tracking** - Track all payments with receipts
- ✅ **Financial Summary** - Know who paid what and when
- ✅ **Due Payment Alerts** - Track pending payments
- ✅ **Payment History** - Complete payment audit trail
- ✅ **Multiple Payment Types** - Rent, deposit, utilities, etc.
- ✅ **Automatic Calculations** - Total paid, total due, security deposit

---

## 🗄️ Database Schema

### **1. Tenant Table**

Stores all tenant information:

```prisma
model Tenant {
  // Basic Info
  id                  Int          @id @default(autoincrement())
  name                String       // Required
  email               String?      @unique
  phone               String       // Required
  alternatePhone      String?
  gender              Gender?      // male, female, other
  dateOfBirth         DateTime?
  
  // Identity
  aadharNumber        String?      @unique
  documents           Json?        // ID proofs, photos, etc.
  profilePhoto        String?
  
  // Address
  address             Json?        // Current address
  permanentAddress    Json?        // Permanent address
  
  // Emergency Contact
  emergencyContact    Json?        // { name, relationship, phone, address }
  
  // Professional Info
  occupation          String?
  companyName         String?
  designation         String?
  monthlyIncome       Float?
  
  // Financial (Auto-calculated)
  totalPaid           Float        @default(0)      // Auto-updated
  totalDue            Float        @default(0)      // Manual update
  securityDeposit     Float        @default(0)      // Auto-updated
  
  // Status & Rating
  status              TenantStatus @default(active) // active, inactive, blacklisted
  rating              Int?         @default(0)      // 0-5 stars
  notes               String?
  
  // Relations
  allocations         Allocation[] // All bed allocations
  payments            Payment[]    // All payments
}
```

**Key Fields Explained:**

| Field | Type | Description | Example |
|-------|------|-------------|---------|
| `totalPaid` | Float | **Auto-calculated** - Sum of all payments | `₹45,000` |
| `totalDue` | Float | **Manually set** - Expected total (rent+deposit) | `₹50,000` |
| `securityDeposit` | Float | **Auto-calculated** - Sum of deposit payments | `₹10,000` |
| `status` | Enum | active, inactive, or blacklisted | `active` |
| `documents` | JSON | Array of document objects | `[{type: "aadhar", url: "..."}]` |
| `emergencyContact` | JSON | Emergency contact details | `{name: "John", phone: "..."}` |

---

### **2. Payment Table**

Tracks all financial transactions:

```prisma
model Payment {
  id              Int           @id @default(autoincrement())
  tenantId        Int           // Required
  allocationId    Int?          // Optional (for allocation-specific payments)
  hostelId        Int           // Required
  
  // Payment Details
  amount          Float         // Required
  paymentType     PaymentType   // rent, deposit, maintenance, electricity, water, other
  paymentMethod   PaymentMethod // cash, card, bank_transfer, upi, cheque, online
  paymentDate     DateTime      @default(now())
  
  // Period Info
  forMonth        String?       // "2025-10" for October 2025
  forPeriod       Json?         // { startDate, endDate }
  
  // Transaction Details
  transactionId   String?       // Bank/UPI transaction ID
  receiptNumber   String?       @unique // Unique receipt number
  
  // Status
  status          PaymentStatus // pending, paid, partial, overdue
  
  // Additional
  remarks         String?
  collectedBy     Int?          // Staff who collected payment
  attachments     Json?         // Payment proofs, receipts
  
  // Relations
  tenant          Tenant
  allocation      Allocation?
  hostel          Hostel
  collector       User?
}
```

**Payment Types:**
- `rent` - Monthly/periodic rent
- `deposit` - Security deposit
- `maintenance` - Maintenance charges
- `electricity` - Electricity bills
- `water` - Water bills
- `other` - Other charges

**Payment Methods:**
- `cash` - Cash payment
- `card` - Credit/Debit card
- `bank_transfer` - Bank transfer
- `upi` - UPI payment
- `cheque` - Cheque
- `online` - Online payment gateway

---

## 👤 Tenant Management

### **Creating a Tenant**

**Endpoint:** `POST /api/admin/tenant/create`

**Required Fields:**
- `name` - Tenant's full name
- `phone` - Contact number

**Optional Fields:**
- `email` - Email address
- `alternatePhone` - Alternate contact
- `gender` - male, female, other
- `dateOfBirth` - Date of birth
- `aadharNumber` - Aadhar card number
- `address` - Current address (JSON)
- `permanentAddress` - Permanent address (JSON)
- `emergencyContact` - Emergency contact (JSON)
- `occupation` - Occupation
- `companyName` - Company name
- `designation` - Job designation
- `monthlyIncome` - Monthly income
- `documents` - Array of documents (JSON)
- `profilePhoto` - Profile photo URL
- `notes` - Additional notes

**Example Request:**

```json
POST /api/admin/tenant/create
Authorization: Bearer YOUR_TOKEN

{
  "name": "Rajesh Kumar",
  "email": "rajesh@example.com",
  "phone": "9876543210",
  "alternatePhone": "9876543211",
  "gender": "male",
  "dateOfBirth": "1995-05-15",
  "aadharNumber": "1234-5678-9012",
  "address": {
    "street": "123 MG Road",
    "city": "Bangalore",
    "state": "Karnataka",
    "country": "India",
    "pincode": "560001"
  },
  "permanentAddress": {
    "street": "456 Park Street",
    "city": "Delhi",
    "state": "Delhi",
    "country": "India",
    "pincode": "110001"
  },
  "emergencyContact": {
    "name": "Sunita Kumar",
    "relationship": "Mother",
    "phone": "9876543212",
    "address": "456 Park Street, Delhi"
  },
  "occupation": "Software Engineer",
  "companyName": "Tech Solutions Pvt Ltd",
  "designation": "Senior Developer",
  "monthlyIncome": 75000,
  "documents": [
    {
      "type": "aadhar",
      "number": "1234-5678-9012",
      "url": "https://example.com/aadhar.pdf",
      "uploadedAt": "2025-10-21"
    },
    {
      "type": "photo",
      "url": "https://example.com/photo.jpg",
      "uploadedAt": "2025-10-21"
    }
  ],
  "profilePhoto": "https://example.com/profile.jpg",
  "notes": "Preferred non-smoking room"
}
```

**Success Response:**

```json
{
  "success": true,
  "message": "Tenant created successfully",
  "data": {
    "id": 1,
    "name": "Rajesh Kumar",
    "email": "rajesh@example.com",
    "phone": "9876543210",
    "status": "active",
    "totalPaid": 0,
    "totalDue": 0,
    "securityDeposit": 0,
    "createdAt": "2025-10-21T10:30:00.000Z"
  },
  "statusCode": 201
}
```

---

### **Get All Tenants**

**Endpoint:** `GET /api/admin/tenant/list`

**Query Parameters:**
- `status` - Filter by status (active, inactive, blacklisted)
- `search` - Search by name, email, phone, aadhar
- `page` - Page number (default: 1)
- `limit` - Items per page (default: 20)

**Example:**

```bash
GET /api/admin/tenant/list?status=active&page=1&limit=10
```

---

### **Get Tenant by ID**

**Endpoint:** `GET /api/admin/tenant/:id`

**Returns:**
- Complete tenant details
- All allocations (past and present)
- Recent 10 payments
- Payment count

---

### **Update Tenant**

**Endpoint:** `PUT /api/admin/tenant/update/:id`

**Example:**

```json
PUT /api/admin/tenant/update/1

{
  "phone": "9999999999",
  "occupation": "Senior Software Engineer",
  "notes": "Now in Room 201"
}
```

---

### **Delete Tenant**

**Endpoint:** `DELETE /api/admin/tenant/delete/:id`

⚠️ **Note:** Cannot delete tenant with active allocations. Checkout first!

---

## 💰 Payment Tracking

### **Recording a Payment**

**Endpoint:** `POST /api/admin/payment/record`

**Required Fields:**
- `tenantId` - Tenant ID
- `hostelId` - Hostel ID
- `amount` - Payment amount
- `paymentType` - rent, deposit, maintenance, etc.
- `paymentMethod` - cash, card, upi, etc.

**Optional Fields:**
- `allocationId` - Link to specific allocation
- `paymentDate` - Date of payment (default: today)
- `forMonth` - Month for rent payment (e.g., "2025-10")
- `forPeriod` - Period object { startDate, endDate }
- `transactionId` - Bank/UPI transaction ID
- `receiptNumber` - Receipt number
- `remarks` - Additional notes
- `attachments` - Payment proofs

**Example Request:**

```json
POST /api/admin/payment/record
Authorization: Bearer YOUR_TOKEN

{
  "tenantId": 1,
  "hostelId": 1,
  "allocationId": 5,
  "amount": 5000,
  "paymentType": "rent",
  "paymentMethod": "upi",
  "paymentDate": "2025-10-21",
  "forMonth": "2025-10",
  "transactionId": "UPI123456789",
  "receiptNumber": "REC-2025-001",
  "remarks": "October rent payment"
}
```

**What Happens:**
1. ✅ Payment record created
2. ✅ `tenant.totalPaid` automatically incremented by ₹5,000
3. ✅ If `paymentType` is "deposit", `tenant.securityDeposit` also incremented
4. ✅ Receipt generated with unique number

**Success Response:**

```json
{
  "success": true,
  "message": "Payment recorded successfully",
  "data": {
    "id": 1,
    "amount": 5000,
    "paymentType": "rent",
    "paymentMethod": "upi",
    "paymentDate": "2025-10-21T00:00:00.000Z",
    "receiptNumber": "REC-2025-001",
    "tenant": {
      "id": 1,
      "name": "Rajesh Kumar",
      "phone": "9876543210"
    },
    "hostel": {
      "name": "Sunrise Hostel"
    },
    "collector": {
      "name": "Admin User"
    }
  },
  "statusCode": 201
}
```

---

### **Get All Payments**

**Endpoint:** `GET /api/admin/payment/list`

**Query Parameters:**
- `tenantId` - Filter by tenant
- `hostelId` - Filter by hostel
- `paymentType` - Filter by type (rent, deposit, etc.)
- `paymentMethod` - Filter by method (cash, upi, etc.)
- `status` - Filter by status
- `forMonth` - Filter by month (e.g., "2025-10")
- `startDate` - Date range start
- `endDate` - Date range end
- `page` - Page number
- `limit` - Items per page

**Example:**

```bash
GET /api/admin/payment/list?tenantId=1&paymentType=rent&forMonth=2025-10
```

---

### **Get Payment Summary**

**Endpoint:** `GET /api/admin/payment/summary`

**Returns:**
- Total amount collected
- Summary by payment type
- Summary by payment method
- Summary by status
- Recent 10 payments

**Example:**

```bash
GET /api/admin/payment/summary?hostelId=1&startDate=2025-10-01&endDate=2025-10-31
```

**Response:**

```json
{
  "success": true,
  "data": {
    "total": {
      "amount": 150000,
      "count": 30
    },
    "byType": [
      { "paymentType": "rent", "_sum": { "amount": 100000 }, "_count": 20 },
      { "paymentType": "deposit", "_sum": { "amount": 40000 }, "_count": 8 },
      { "paymentType": "electricity", "_sum": { "amount": 10000 }, "_count": 2 }
    ],
    "byMethod": [
      { "paymentMethod": "upi", "_sum": { "amount": 80000 }, "_count": 15 },
      { "paymentMethod": "cash", "_sum": { "amount": 70000 }, "_count": 15 }
    ],
    "recentPayments": [...]
  }
}
```

---

### **Get Pending Payments**

**Endpoint:** `GET /api/admin/payment/pending`

**Returns:**
- All active allocations
- Expected amounts (rent + deposit)
- Paid amounts
- Pending amounts
- Last payment date

**Example:**

```bash
GET /api/admin/payment/pending?hostelId=1
```

**Response:**

```json
{
  "success": true,
  "data": {
    "pendingPayments": [
      {
        "allocation": {
          "id": 5,
          "bed": "B1",
          "room": "101",
          "hostel": "Sunrise Hostel",
          "checkInDate": "2025-09-01",
          "rentAmount": 5000
        },
        "tenant": {
          "id": 1,
          "name": "Rajesh Kumar",
          "phone": "9876543210"
        },
        "financial": {
          "expectedRent": 5000,
          "expectedDeposit": 2000,
          "rentPaid": 3000,
          "depositPaid": 2000,
          "totalPaid": 5000,
          "pendingAmount": 2000,
          "lastPaymentDate": "2025-10-15"
        },
        "status": "pending"
      }
    ],
    "totalPending": 2000,
    "count": 1
  }
}
```

---

## 🔗 Complete API Endpoints

### **Tenant Endpoints**

| Method | Endpoint | Description |
|--------|----------|-------------|
| POST | `/api/admin/tenant/create` | Create new tenant |
| GET | `/api/admin/tenant/list` | Get all tenants |
| GET | `/api/admin/tenant/active` | Get active tenants |
| GET | `/api/admin/tenant/:id` | Get tenant by ID |
| PUT | `/api/admin/tenant/update/:id` | Update tenant |
| DELETE | `/api/admin/tenant/delete/:id` | Delete tenant |
| GET | `/api/admin/tenant/:id/payments` | Get tenant payment history |
| GET | `/api/admin/tenant/:id/financial-summary` | Get tenant financial summary |

### **Payment Endpoints**

| Method | Endpoint | Description |
|--------|----------|-------------|
| POST | `/api/admin/payment/record` | Record new payment |
| GET | `/api/admin/payment/list` | Get all payments |
| GET | `/api/admin/payment/summary` | Get payment summary |
| GET | `/api/admin/payment/pending` | Get pending payments |
| GET | `/api/admin/payment/:id` | Get payment by ID |
| PUT | `/api/admin/payment/update/:id` | Update payment |
| DELETE | `/api/admin/payment/delete/:id` | Delete payment |

---

## 🎬 Complete Example Workflow

### **Scenario: New Tenant Move-In**

#### **Step 1: Create Tenant**

```json
POST /api/admin/tenant/create

{
  "name": "Priya Sharma",
  "email": "priya@example.com",
  "phone": "9123456789",
  "gender": "female",
  "occupation": "Student",
  "emergencyContact": {
    "name": "Mrs. Sharma",
    "relationship": "Mother",
    "phone": "9123456790"
  }
}

// Response: { "id": 10, "name": "Priya Sharma", ... }
```

#### **Step 2: Allocate to Bed**

```json
POST /api/admin/allocation/allocate

{
  "hostel": 1,
  "floor": 1,
  "room": 1,
  "bed": 1,
  "tenant": 10,  // ← Tenant ID from Step 1
  "checkInDate": "2025-10-22",
  "expectedCheckOutDate": "2026-01-22",
  "rentAmount": 5000,
  "depositAmount": 2000,
  "notes": "First semester student"
}

// Response: { "id": 25, ... } ← Allocation ID
```

#### **Step 3: Record Deposit Payment**

```json
POST /api/admin/payment/record

{
  "tenantId": 10,
  "hostelId": 1,
  "allocationId": 25,
  "amount": 2000,
  "paymentType": "deposit",
  "paymentMethod": "upi",
  "transactionId": "UPI987654321",
  "receiptNumber": "REC-2025-100"
}

// Auto-updates:
// - tenant.totalPaid = 2000
// - tenant.securityDeposit = 2000
```

#### **Step 4: Record First Month Rent**

```json
POST /api/admin/payment/record

{
  "tenantId": 10,
  "hostelId": 1,
  "allocationId": 25,
  "amount": 5000,
  "paymentType": "rent",
  "paymentMethod": "cash",
  "forMonth": "2025-10",
  "receiptNumber": "REC-2025-101"
}

// Auto-updates:
// - tenant.totalPaid = 7000 (2000 + 5000)
```

#### **Step 5: Record Next Month Rent**

```json
POST /api/admin/payment/record

{
  "tenantId": 10,
  "hostelId": 1,
  "allocationId": 25,
  "amount": 5000,
  "paymentType": "rent",
  "paymentMethod": "upi",
  "forMonth": "2025-11",
  "receiptNumber": "REC-2025-150"
}

// Auto-updates:
// - tenant.totalPaid = 12000
```

#### **Step 6: Check Financial Summary**

```bash
GET /api/admin/tenant/10/financial-summary

Response:
{
  "tenant": {
    "id": 10,
    "name": "Priya Sharma",
    "totalPaid": 12000,
    "totalDue": 0,
    "securityDeposit": 2000
  },
  "paymentSummary": [
    { "paymentType": "deposit", "_sum": { "amount": 2000 }, "_count": 1 },
    { "paymentType": "rent", "_sum": { "amount": 10000 }, "_count": 2 }
  ],
  "activeAllocation": {
    "bed": { "bedNumber": "B1" },
    "room": { "roomNumber": "101" },
    "hostel": { "name": "Sunrise Hostel" }
  }
}
```

---

## 📊 Payment Reports

### **1. Monthly Collection Report**

```bash
GET /api/admin/payment/list?forMonth=2025-10&hostelId=1

# Returns all payments for October 2025
```

### **2. Tenant Payment History**

```bash
GET /api/admin/tenant/10/payments

# Returns all payments by tenant #10
```

### **3. Overdue Payments**

```bash
GET /api/admin/payment/pending?hostelId=1

# Shows who hasn't paid full amount
```

### **4. Payment Type Summary**

```bash
GET /api/admin/payment/summary?startDate=2025-10-01&endDate=2025-10-31

# Shows breakdown by type, method, etc.
```

---

## 💡 Key Benefits

### **1. Automatic Financial Tracking**
- ✅ `totalPaid` automatically updates when payment is recorded
- ✅ `securityDeposit` automatically tracks deposit payments
- ✅ No manual calculation needed

### **2. Complete Audit Trail**
- ✅ Every payment has a receipt number
- ✅ Know who collected payment (`collectedBy`)
- ✅ Transaction IDs for bank payments
- ✅ Payment proofs attached

### **3. Comprehensive Reporting**
- ✅ Who paid how much and when
- ✅ Payment method breakdown
- ✅ Pending payment alerts
- ✅ Monthly collection reports

### **4. Tenant Lifecycle Management**
- ✅ Complete tenant profile
- ✅ Emergency contacts
- ✅ Document storage
- ✅ Allocation history

### **5. Integration with Allocations**
- ✅ Payments linked to allocations
- ✅ Automatic bed status updates
- ✅ Check-in/check-out tracking

---

## 🚀 Getting Started

### **1. Restart Your Server**

```bash
# Stop current server (Ctrl+C)
# Then restart
npm start
```

### **2. Test Tenant Creation**

```bash
POST http://localhost:5000/api/admin/tenant/create
Authorization: Bearer YOUR_TOKEN

{
  "name": "Test User",
  "phone": "1234567890"
}
```

### **3. Test Payment Recording**

```bash
POST http://localhost:5000/api/admin/payment/record
Authorization: Bearer YOUR_TOKEN

{
  "tenantId": 1,
  "hostelId": 1,
  "amount": 1000,
  "paymentType": "rent",
  "paymentMethod": "cash"
}
```

---

## 📝 Best Practices

### **1. Always Use Receipt Numbers**
```json
{
  "receiptNumber": "REC-2025-001"  // Unique receipt for every payment
}
```

### **2. Link Payments to Allocations**
```json
{
  "allocationId": 25  // Links payment to specific bed allocation
}
```

### **3. Use forMonth for Rent Payments**
```json
{
  "paymentType": "rent",
  "forMonth": "2025-10"  // Makes reporting easier
}
```

### **4. Store Transaction IDs**
```json
{
  "paymentMethod": "upi",
  "transactionId": "UPI123456789"  // For verification
}
```

### **5. Set Total Due for Tenants**
```json
PUT /api/admin/tenant/update/1
{
  "totalDue": 15000  // Expected total (3 months rent + deposit)
}
```

---

## 🎉 Summary

You now have a complete tenant and payment management system with:

- ✅ **Tenant Table** - Complete tenant profiles
- ✅ **Payment Table** - All financial transactions
- ✅ **Automatic Calculations** - totalPaid, securityDeposit
- ✅ **Complete API** - CRUD operations for tenants and payments
- ✅ **Reports** - Payment summaries, pending payments, history
- ✅ **Integration** - Works seamlessly with allocations

**Your hostel management system is now production-ready!** 🚀


