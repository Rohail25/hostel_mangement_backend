# Booking & Payment Integration Guide

## Overview
This guide explains the complete booking system and its integration with payments. When a user books a bed, they can make payments, and the booking status is automatically updated.

---

## Database Schema Changes

### Booking Model (New)
```prisma
model Booking {
  id              Int           @id @default(autoincrement())
  bookingCode     String?       @unique @db.VarChar(50)
  tenantId        Int?
  hostelId        Int?
  roomId          Int?
  bedId           Int?
  
  // Dates
  checkInDate     DateTime?
  checkOutDate    DateTime?
  bookingDate     DateTime?     @default(now())

  // Booking Info
  bookingType     BookingType?  @default(online)  // online, walkin, admin
  status          BookingStatus? @default(pending)  // pending, confirmed, checked_in, checked_out, cancelled, expired
  numberOfGuests  Int?          @default(1)
  remarks         String?       @db.Text

  // Payment Info
  totalAmount     Float?        @db.Double
  advancePaid     Float?        @default(0) @db.Double
  paymentStatus   PaymentStatus? @default(pending)  // pending, paid, partial, overdue
  paymentMethod   PaymentMethod?
  transactionId   String?       @db.VarChar(255)
  
  // Customer Info (for walk-in bookings without tenant account)
  customerName    String?       @db.VarChar(255)
  customerEmail   String?       @db.VarChar(255)
  customerPhone   String?       @db.VarChar(50)
  customerCnic    String?       @db.VarChar(20)
  
  // Relations
  tenant          Tenant?       @relation(fields: [tenantId], references: [id])
  hostel          Hostel?       @relation(fields: [hostelId], references: [id])
  room            Room?         @relation(fields: [roomId], references: [id])
  bed             Bed?          @relation(fields: [bedId], references: [id])
  creator         User?         @relation("BookingCreator", fields: [createdBy], references: [id])
  payments        Payment[]     // NEW: Link to payments
}
```

### Payment Model (Updated)
```prisma
model Payment {
  id              Int           @id @default(autoincrement())
  tenantId        Int?          // NOW NULLABLE
  allocationId    Int?
  bookingId       Int?          // NEW FIELD
  hostelId        Int
  
  // Relations
  tenant          Tenant?       // NOW NULLABLE
  allocation      Allocation?
  booking         Booking?      // NEW RELATION
  hostel          Hostel
  collector       User?
  transactions    Transaction[]
}
```

---

## Workflow: Booking → Payment → Status Update

### Step 1: Create Booking
```http
POST /api/admin/bookings
Authorization: Bearer YOUR_TOKEN

{
  "hostelId": 1,
  "bedId": 5,
  "checkInDate": "2025-10-25",
  "checkOutDate": "2025-11-25",
  "totalAmount": 15000,
  "bookingType": "online",
  "customerName": "John Doe",
  "customerPhone": "+923001234567",
  "customerEmail": "john@example.com",
  "numberOfGuests": 1
}
```

**Response:**
```json
{
  "success": true,
  "message": "Booking created successfully",
  "data": {
    "id": 1,
    "bookingCode": "BK2510001",
    "status": "pending",
    "paymentStatus": "pending",
    "totalAmount": 15000,
    "advancePaid": 0,
    ...
  }
}
```

### Step 2: Make Payment for Booking
```http
POST /api/admin/payments
Authorization: Bearer YOUR_TOKEN

{
  "bookingId": 1,
  "hostelId": 1,
  "amount": 5000,
  "paymentType": "rent",
  "paymentMethod": "card",
  "transactionId": "TXN123456"
}
```

**Response:**
```json
{
  "success": true,
  "message": "Payment recorded successfully",
  "data": {
    "id": 1,
    "bookingId": 1,
    "amount": 5000,
    "status": "paid",
    "booking": {
      "id": 1,
      "bookingCode": "BK2510001",
      "status": "confirmed",      // AUTO-UPDATED from 'pending'
      "paymentStatus": "partial",  // AUTO-UPDATED
      "totalAmount": 15000,
      "advancePaid": 5000          // AUTO-UPDATED
    }
  }
}
```

### Step 3: Complete Payment
```http
POST /api/admin/payments
Authorization: Bearer YOUR_TOKEN

{
  "bookingId": 1,
  "hostelId": 1,
  "amount": 10000,
  "paymentType": "rent",
  "paymentMethod": "cash"
}
```

**Booking Status After Full Payment:**
```json
{
  "booking": {
    "status": "confirmed",
    "paymentStatus": "paid",       // AUTO-UPDATED from 'partial'
    "totalAmount": 15000,
    "advancePaid": 15000           // AUTO-UPDATED (5000 + 10000)
  }
}
```

---

## Automatic Status Updates

### Payment Status Logic

| Total Paid | Total Amount | Payment Status | Booking Status Change |
|------------|--------------|----------------|----------------------|
| 0 | Any | `pending` | No change |
| < Total | Any | `partial` | `pending` → `confirmed` |
| >= Total | Any | `paid` | `pending` → `confirmed` |

### Booking Status Flow

```
pending → confirmed → checked_in → checked_out
   ↓
cancelled / expired
```

**When Payment is Made:**
- If booking is `pending` and any payment is received → Status changes to `confirmed`
- Payment status automatically updates based on amount paid
- `advancePaid` field is incremented with each payment

---

## API Endpoints

### Booking Endpoints

| Method | Endpoint | Description | Access |
|--------|----------|-------------|--------|
| POST | `/api/admin/bookings` | Create new booking | Admin, Manager, Staff, User |
| GET | `/api/admin/bookings` | Get all bookings | Admin, Manager, Staff |
| GET | `/api/admin/bookings/:id` | Get booking by ID | Admin, Manager, Staff |
| GET | `/api/admin/bookings/code/:bookingCode` | Get booking by code | Admin, Manager, Staff |
| GET | `/api/admin/bookings/available-beds` | Get available beds for dates | Admin, Manager, Staff |
| GET | `/api/admin/bookings/statistics` | Get booking statistics | Admin, Manager |
| PUT | `/api/admin/bookings/:id` | Update booking | Admin, Manager, Staff |
| PATCH | `/api/admin/bookings/:id/status` | Update booking status | Admin, Manager, Staff |
| PATCH | `/api/admin/bookings/:id/cancel` | Cancel booking | Admin, Manager |
| DELETE | `/api/admin/bookings/:id` | Delete booking | Admin |

### Payment Endpoints (Updated)

| Method | Endpoint | Description | Access |
|--------|----------|-------------|--------|
| POST | `/api/admin/payments` | Record payment (now supports bookingId) | Admin, Manager, Staff |
| GET | `/api/admin/payments` | Get all payments (now filterable by bookingId) | Admin, Manager, Staff |
| GET | `/api/admin/payments/:id` | Get payment by ID (includes booking info) | Admin, Manager, Staff |
| GET | `/api/admin/payments/tenant/:tenantId` | Get payments by tenant | Admin, Manager, Staff |
| PUT | `/api/admin/payments/:id` | Update payment | Admin, Manager |
| DELETE | `/api/admin/payments/:id` | Delete payment | Admin |

---

## Example Use Cases

### Use Case 1: Online Booking with Advance Payment

1. User creates booking online (status: `pending`, paymentStatus: `pending`)
2. User pays 30% advance (status: `confirmed`, paymentStatus: `partial`)
3. User pays remaining 70% at check-in (status: `confirmed`, paymentStatus: `paid`)
4. Staff marks booking as `checked_in`

### Use Case 2: Walk-in Booking with Full Payment

1. Staff creates walk-in booking with customer details
2. Customer pays full amount immediately
3. Booking auto-confirms (status: `confirmed`, paymentStatus: `paid`)
4. Staff marks as `checked_in`

### Use Case 3: Booking for Existing Tenant

1. Admin creates booking and links to existing tenant (`tenantId` provided)
2. Payment is recorded with both `bookingId` and `tenantId`
3. Tenant's `totalPaid` is also updated
4. Booking status updates automatically

### Use Case 4: Cancel Booking

```http
PATCH /api/admin/bookings/1/cancel
{
  "reason": "Customer request"
}
```

- Booking status changes to `cancelled`
- Bed becomes available
- Reserved bed is released

---

## Query Examples

### Get Available Beds for Specific Dates
```http
GET /api/admin/bookings/available-beds?hostelId=1&checkInDate=2025-10-25&checkOutDate=2025-11-25
```

### Get All Bookings for a Hostel
```http
GET /api/admin/bookings?hostelId=1&status=confirmed
```

### Get All Payments for a Booking
```http
GET /api/admin/payments?bookingId=1
```

### Get Booking Statistics
```http
GET /api/admin/bookings/statistics?hostelId=1&startDate=2025-10-01&endDate=2025-10-31
```

**Response:**
```json
{
  "success": true,
  "data": {
    "totalBookings": 45,
    "bookingsByStatus": {
      "pending": 5,
      "confirmed": 20,
      "checkedIn": 15,
      "checkedOut": 3,
      "cancelled": 2
    },
    "bookingsByType": {
      "online": 30,
      "walkin": 10,
      "admin": 5
    },
    "revenue": {
      "total": 675000,
      "advancePaid": 500000,
      "pending": 175000
    }
  }
}
```

---

## Important Notes

### Field Nullability

All major fields in the Booking model are **nullable** to support different booking scenarios:
- Walk-in bookings without tenant accounts
- Partial bookings (only room, no specific bed)
- Flexible booking creation

### Payment Requirements

When creating a payment:
- `hostelId` is **required**
- At least ONE of `tenantId`, `allocationId`, or `bookingId` must be provided
- `amount`, `paymentType`, and `paymentMethod` are **required**

### Booking Code Generation

Format: `BK{YY}{MM}{NNNN}`
- Example: `BK2510001` (First booking in October 2025)
- Automatically generated and unique

### Status Transitions

Valid booking status transitions:
- `pending` → `confirmed`, `cancelled`
- `confirmed` → `checked_in`, `cancelled`
- `checked_in` → `checked_out`
- `cancelled`, `expired` → No further changes allowed

---

## Testing the Integration

### Test Scenario 1: Create Booking and Make Partial Payment

```bash
# 1. Create booking
curl -X POST http://localhost:3000/api/admin/bookings \
  -H "Authorization: Bearer YOUR_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "hostelId": 1,
    "bedId": 5,
    "checkInDate": "2025-10-25",
    "checkOutDate": "2025-11-25",
    "totalAmount": 15000,
    "customerName": "John Doe",
    "customerPhone": "+923001234567"
  }'

# 2. Make payment
curl -X POST http://localhost:3000/api/admin/payments \
  -H "Authorization: Bearer YOUR_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "bookingId": 1,
    "hostelId": 1,
    "amount": 5000,
    "paymentType": "rent",
    "paymentMethod": "card"
  }'

# 3. Check booking status
curl -X GET http://localhost:3000/api/admin/bookings/1 \
  -H "Authorization: Bearer YOUR_TOKEN"
```

---

## Migration Commands

```bash
# Generate Prisma Client
npx prisma generate

# View database
npx prisma studio
```

---

## Summary

✅ **Booking system fully implemented** with all CRUD operations
✅ **Payment integration complete** with automatic status updates
✅ **All fields are nullable** as requested
✅ **Booking status automatically updates** after payment
✅ **Database schema updated** with proper relations
✅ **Migration completed** successfully
✅ **All routes registered** in app.js
✅ **Authentication and authorization** properly configured

The system now supports:
- Online bookings with advance payments
- Walk-in bookings
- Tenant-linked bookings
- Partial and full payments
- Automatic status management
- Booking statistics and reporting
- Available bed queries for date ranges

**Start your server and test the endpoints!** 🚀


