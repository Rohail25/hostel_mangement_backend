# Quick Test Guide: Auto Transaction Feature

## Prerequisites
1. Stop your development server if running
2. Run: `npx prisma generate` (to regenerate Prisma client)
3. Restart your server

## Test 1: Create Payment with Auto Transaction

### Request
```http
POST http://localhost:3000/api/admin/payment/record
Content-Type: application/json
Authorization: Bearer YOUR_TOKEN

{
  "tenantId": 1,
  "hostelId": 1,
  "amount": 5000,
  "paymentType": "rent",
  "paymentMethod": "cash",
  "receiptNumber": "RCP001"
}
```

### Expected Response
```json
{
  "success": true,
  "message": "Payment recorded successfully and transaction created automatically",
  "data": {
    "id": 1,
    "amount": 5000,
    "paymentType": "rent",
    "status": "paid",
    "transactions": [
      {
        "id": 1,
        "gateway": "manual",
        "transactionType": "rent",
        "amount": 5000,
        "status": "completed"
      }
    ]
  }
}
```

✅ Transaction should be automatically created

## Test 2: Payment with Booking

### Request
```http
POST http://localhost:3000/api/admin/payment/record
Content-Type: application/json
Authorization: Bearer YOUR_TOKEN

{
  "bookingId": 1,
  "hostelId": 1,
  "amount": 3000,
  "paymentType": "rent",
  "paymentMethod": "online"
}
```

### Then Get Booking
```http
GET http://localhost:3000/api/admin/booking/1
Authorization: Bearer YOUR_TOKEN
```

### Expected Response
```json
{
  "success": true,
  "data": {
    "id": 1,
    "bookingCode": "BK2510001",
    "payments": [
      {
        "amount": 3000,
        "transactions": [
          {
            "id": 2,
            "gateway": "manual",
            "status": "completed"
          }
        ]
      }
    ]
  }
}
```

✅ Booking should show payment with transaction

## Test 3: Get Payment Details

### Request
```http
GET http://localhost:3000/api/admin/payment/1
Authorization: Bearer YOUR_TOKEN
```

### Expected Response
Should include:
- Payment details
- Booking information (if linked)
- All transactions array
- Tenant information
- Hostel information

## Test 4: Get All Payments

### Request
```http
GET http://localhost:3000/api/admin/payment/all?page=1&limit=10
Authorization: Bearer YOUR_TOKEN
```

### Expected Response
Each payment should include:
- `transactions` array with transaction details
- `booking` object (if payment linked to booking)

## Test 5: Get Transactions by Payment ID

### Request
```http
GET http://localhost:3000/api/admin/transaction/payment/1
Authorization: Bearer YOUR_TOKEN
```

### Expected Response
```json
{
  "success": true,
  "message": "Payment transactions fetched successfully",
  "data": [
    {
      "id": 1,
      "gateway": "manual",
      "transactionType": "rent",
      "amount": 5000,
      "status": "completed"
    }
  ]
}
```

## Verification Checklist

- [ ] Payment creates transaction automatically
- [ ] Transaction status is 'completed'
- [ ] Transaction gateway is 'manual'
- [ ] Payment response includes transactions array
- [ ] Booking response includes payments with transactions
- [ ] No manual transaction creation needed
- [ ] All relations (payment-booking-transaction) working properly

## Common Issues

### Issue: Prisma Generate Fails (EPERM)
**Solution:**
1. Close all terminals
2. Stop server
3. Delete `node_modules/.prisma` folder
4. Run `npx prisma generate` again

### Issue: Transaction Not Created
**Check:**
1. Payment status is 'paid'
2. No errors in server logs
3. Database transaction committed successfully

### Issue: Schema Not Updated
**Solution:**
1. Run `npx prisma migrate deploy`
2. Run `npx prisma generate`
3. Restart server

## Key Points

✅ **Transactions are automatically created** when payment status is 'paid'
✅ **No need to call create transaction API** for regular payments
✅ **All relations work bidirectionally** - fetch payment from booking or booking from payment
✅ **Nullable fields allow flexible data entry** but core validation remains
✅ **Complete audit trail** with IP, user agent, timestamps

## Success Criteria

You know everything works when:
1. Creating a payment automatically creates a transaction
2. Response message says "transaction created automatically"
3. Payment includes `transactions` array in response
4. Booking endpoint returns payment and transaction details
5. No errors in server logs

