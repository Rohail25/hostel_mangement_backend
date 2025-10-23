# 🚀 Tenant & Payment System - Quick Start

## ✅ What Was Created

### **Database Tables:**
1. ✅ **Tenant** - Stores all tenant information
2. ✅ **Payment** - Tracks all payments with receipts

### **Controllers:**
1. ✅ `tenant.controller.js` - 8 tenant management functions
2. ✅ `payment.controller.js` - 7 payment tracking functions

### **Routes:**
1. ✅ `tenant.route.js` - All tenant API endpoints
2. ✅ `payment.route.js` - All payment API endpoints

### **Updated:**
1. ✅ `allocation.controller.js` - Now uses Tenant model
2. ✅ `app.js` - Routes registered
3. ✅ `prisma/schema.prisma` - New models added

---

## 🎯 Quick Test (5 Minutes)

### **Step 1: Restart Your Server**

```bash
# Stop current server (Ctrl+C in terminal)
# Then restart
npm start
```

You should see:
```
🚀 Server is running on port 5000
```

---

### **Step 2: Create a Tenant**

**Request:**
```http
POST http://localhost:5000/api/admin/tenant/create
Content-Type: application/json
Authorization: Bearer YOUR_ADMIN_TOKEN

{
  "name": "John Doe",
  "phone": "9876543210",
  "email": "john@example.com",
  "occupation": "Software Engineer",
  "notes": "Test tenant"
}
```

**Expected Response:**
```json
{
  "success": true,
  "message": "Tenant created successfully",
  "data": {
    "id": 1,  ← Remember this ID!
    "name": "John Doe",
    "phone": "9876543210",
    "status": "active",
    "totalPaid": 0,
    "totalDue": 0,
    "securityDeposit": 0
  },
  "statusCode": 201
}
```

✅ **Success!** Your first tenant is created.

---

### **Step 3: Allocate Tenant to a Bed**

**Request:**
```http
POST http://localhost:5000/api/admin/allocation/allocate
Content-Type: application/json
Authorization: Bearer YOUR_ADMIN_TOKEN

{
  "hostel": 1,
  "floor": 1,
  "room": 1,
  "bed": 1,
  "tenant": 1,  ← Use tenant ID from Step 2
  "checkInDate": "2025-10-22",
  "expectedCheckOutDate": "2026-01-22",
  "rentAmount": 5000,
  "depositAmount": 2000,
  "notes": "Test allocation"
}
```

**Expected Response:**
```json
{
  "success": true,
  "message": "Tenant allocated successfully",
  "data": {
    "id": 1,  ← Allocation ID
    "hostelId": 1,
    "bedId": 1,
    "tenantId": 1,
    "rentAmount": 5000,
    "depositAmount": 2000,
    "status": "active",
    "tenant": {
      "name": "John Doe",
      "email": "john@example.com",
      "phone": "9876543210"
    },
    "bed": {
      "bedNumber": "B1"
    }
  },
  "statusCode": 201
}
```

✅ **Success!** Tenant is now allocated to a bed.

---

### **Step 4: Record a Payment**

**Request:**
```http
POST http://localhost:5000/api/admin/payment/record
Content-Type: application/json
Authorization: Bearer YOUR_ADMIN_TOKEN

{
  "tenantId": 1,
  "hostelId": 1,
  "allocationId": 1,
  "amount": 2000,
  "paymentType": "deposit",
  "paymentMethod": "cash",
  "receiptNumber": "REC-2025-001",
  "remarks": "Security deposit"
}
```

**Expected Response:**
```json
{
  "success": true,
  "message": "Payment recorded successfully",
  "data": {
    "id": 1,
    "amount": 2000,
    "paymentType": "deposit",
    "paymentMethod": "cash",
    "receiptNumber": "REC-2025-001",
    "tenant": {
      "id": 1,
      "name": "John Doe",
      "phone": "9876543210"
    },
    "hostel": {
      "name": "Sunrise Hostel"
    }
  },
  "statusCode": 201
}
```

✅ **Success!** Payment recorded and tenant's `totalPaid` is now ₹2,000!

---

### **Step 5: Check Tenant's Financial Summary**

**Request:**
```http
GET http://localhost:5000/api/admin/tenant/1/financial-summary
Authorization: Bearer YOUR_ADMIN_TOKEN
```

**Expected Response:**
```json
{
  "success": true,
  "data": {
    "tenant": {
      "id": 1,
      "name": "John Doe",
      "totalPaid": 2000,  ← Auto-updated!
      "totalDue": 0,
      "securityDeposit": 2000  ← Auto-updated!
    },
    "paymentSummary": [
      {
        "paymentType": "deposit",
        "_sum": { "amount": 2000 },
        "_count": 1
      }
    ],
    "activeAllocation": {
      "bed": { "bedNumber": "B1" },
      "room": { "roomNumber": "101" },
      "hostel": { "name": "Sunrise Hostel" }
    }
  }
}
```

✅ **Perfect!** Financial summary shows all the data.

---

## 📱 All Available Endpoints

### **Tenant Management**

```http
# Create tenant
POST /api/admin/tenant/create

# Get all tenants
GET /api/admin/tenant/list

# Get active tenants
GET /api/admin/tenant/active

# Get tenant by ID
GET /api/admin/tenant/:id

# Update tenant
PUT /api/admin/tenant/update/:id

# Delete tenant
DELETE /api/admin/tenant/delete/:id

# Get tenant payment history
GET /api/admin/tenant/:id/payments

# Get tenant financial summary
GET /api/admin/tenant/:id/financial-summary
```

### **Payment Management**

```http
# Record payment
POST /api/admin/payment/record

# Get all payments
GET /api/admin/payment/list

# Get payment summary
GET /api/admin/payment/summary

# Get pending payments
GET /api/admin/payment/pending

# Get payment by ID
GET /api/admin/payment/:id

# Update payment
PUT /api/admin/payment/update/:id

# Delete payment
DELETE /api/admin/payment/delete/:id
```

---

## 🎨 Tenant Fields Reference

### **Required Fields**
```json
{
  "name": "Required",
  "phone": "Required"
}
```

### **Full Tenant Object**
```json
{
  // Basic Info
  "name": "John Doe",
  "email": "john@example.com",
  "phone": "9876543210",
  "alternatePhone": "9876543211",
  "gender": "male",
  "dateOfBirth": "1995-05-15",
  
  // Identity
  "aadharNumber": "1234-5678-9012",
  "documents": [
    {
      "type": "aadhar",
      "number": "1234-5678-9012",
      "url": "https://example.com/aadhar.pdf"
    }
  ],
  "profilePhoto": "https://example.com/photo.jpg",
  
  // Address
  "address": {
    "street": "123 MG Road",
    "city": "Bangalore",
    "state": "Karnataka",
    "pincode": "560001"
  },
  "permanentAddress": {
    "street": "456 Park Street",
    "city": "Delhi",
    "state": "Delhi",
    "pincode": "110001"
  },
  
  // Emergency Contact
  "emergencyContact": {
    "name": "Jane Doe",
    "relationship": "Mother",
    "phone": "9876543212"
  },
  
  // Professional Info
  "occupation": "Software Engineer",
  "companyName": "Tech Corp",
  "designation": "Senior Developer",
  "monthlyIncome": 75000,
  
  // Other
  "notes": "Preferred ground floor"
}
```

---

## 💰 Payment Fields Reference

### **Required Fields**
```json
{
  "tenantId": 1,
  "hostelId": 1,
  "amount": 5000,
  "paymentType": "rent",
  "paymentMethod": "cash"
}
```

### **Full Payment Object**
```json
{
  "tenantId": 1,
  "hostelId": 1,
  "allocationId": 1,
  "amount": 5000,
  "paymentType": "rent",  // rent, deposit, maintenance, electricity, water, other
  "paymentMethod": "upi",  // cash, card, bank_transfer, upi, cheque, online
  "paymentDate": "2025-10-21",
  "forMonth": "2025-10",
  "transactionId": "UPI123456789",
  "receiptNumber": "REC-2025-001",
  "remarks": "October rent payment",
  "attachments": [
    {
      "name": "receipt.pdf",
      "url": "https://example.com/receipt.pdf"
    }
  ]
}
```

---

## 🔍 Query Examples

### **Search Tenants**
```http
GET /api/admin/tenant/list?search=john&status=active&page=1&limit=10
```

### **Filter Payments**
```http
GET /api/admin/payment/list?tenantId=1&paymentType=rent&forMonth=2025-10
```

### **Get Payment Summary**
```http
GET /api/admin/payment/summary?hostelId=1&startDate=2025-10-01&endDate=2025-10-31
```

### **Check Pending Payments**
```http
GET /api/admin/payment/pending?hostelId=1
```

---

## 🎯 Common Use Cases

### **1. New Tenant Check-In**
```
1. POST /api/admin/tenant/create → Create tenant
2. POST /api/admin/allocation/allocate → Allocate bed
3. POST /api/admin/payment/record → Record deposit
4. POST /api/admin/payment/record → Record first month rent
```

### **2. Monthly Rent Collection**
```
1. GET /api/admin/payment/pending → See who hasn't paid
2. POST /api/admin/payment/record → Record each payment
3. GET /api/admin/payment/summary → Check total collected
```

### **3. Tenant Check-Out**
```
1. POST /api/admin/allocation/checkout/:id → Checkout allocation
2. GET /api/admin/tenant/:id/financial-summary → Check if any dues
3. Refund security deposit if no dues
```

### **4. Monthly Reports**
```
1. GET /api/admin/payment/summary?forMonth=2025-10 → Monthly collection
2. GET /api/admin/tenant/list?status=active → Active tenants
3. GET /api/admin/payment/pending → Pending payments
```

---

## ❗ Important Notes

### **1. Auto-Calculated Fields**
These fields update automatically, don't set them manually:
- `tenant.totalPaid` - Auto-updated when payment is recorded
- `tenant.securityDeposit` - Auto-updated for deposit payments

### **2. Unique Constraints**
These must be unique:
- `tenant.email`
- `tenant.aadharNumber`
- `payment.receiptNumber`

### **3. Cannot Delete**
- Cannot delete tenant with active allocations
- Must checkout first, then delete

### **4. Status Values**
- Tenant status: `active`, `inactive`, `blacklisted`
- Payment status: `pending`, `paid`, `partial`, `overdue`
- Payment type: `rent`, `deposit`, `maintenance`, `electricity`, `water`, `other`
- Payment method: `cash`, `card`, `bank_transfer`, `upi`, `cheque`, `online`

---

## 🎉 You're All Set!

Your tenant and payment system is ready to use! 

📖 **For detailed documentation, see:** `TENANT_PAYMENT_SYSTEM_GUIDE.md`

🚀 **Start managing your hostel efficiently!**


