# 🔄 Updated API Endpoints - Tenant & Payment

## ✅ Changes Made

### **Middleware Updates**
- ✅ Changed from `router.use(authMiddleware)` to individual route middleware
- ✅ Now using `authenticate, authorize('admin', 'manager')` pattern
- ✅ Consistent with other routes in the application

### **Endpoint Path Updates**
- ✅ Changed endpoint paths to match existing route patterns
- ✅ Removed `/create`, `/list`, `/update`, `/delete` from paths
- ✅ More RESTful endpoint structure

---

## 🔗 Updated Tenant API Endpoints

### **Base URL:** `http://localhost:5000/api/admin`

| Method | Old Endpoint | New Endpoint | Access |
|--------|-------------|--------------|---------|
| POST | `/api/admin/tenant/create` | `/api/admin/tenant` | Admin & Manager |
| GET | `/api/admin/tenant/list` | `/api/admin/tenants` | Admin & Manager |
| GET | `/api/admin/tenant/active` | `/api/admin/tenants/active` | Admin & Manager |
| GET | `/api/admin/tenant/:id` | `/api/admin/tenant/:id` | Admin & Manager |
| PUT | `/api/admin/tenant/update/:id` | `/api/admin/tenant/:id` | Admin & Manager |
| DELETE | `/api/admin/tenant/delete/:id` | `/api/admin/tenant/:id` | **Admin only** |
| GET | `/api/admin/tenant/:id/payments` | `/api/admin/tenant/:id/payments` | Admin & Manager |
| GET | `/api/admin/tenant/:id/financial-summary` | `/api/admin/tenant/:id/financial-summary` | Admin & Manager |

---

## 💰 Updated Payment API Endpoints

### **Base URL:** `http://localhost:5000/api/admin`

| Method | Old Endpoint | New Endpoint | Access |
|--------|-------------|--------------|---------|
| POST | `/api/admin/payment/record` | `/api/admin/payment` | Admin, Manager & **Staff** |
| GET | `/api/admin/payment/list` | `/api/admin/payments` | Admin & Manager |
| GET | `/api/admin/payment/summary` | `/api/admin/payments/summary` | Admin & Manager |
| GET | `/api/admin/payment/pending` | `/api/admin/payments/pending` | Admin & Manager |
| GET | `/api/admin/payment/:id` | `/api/admin/payment/:id` | Admin & Manager |
| PUT | `/api/admin/payment/update/:id` | `/api/admin/payment/:id` | Admin & Manager |
| DELETE | `/api/admin/payment/delete/:id` | `/api/admin/payment/:id` | **Admin only** |

---

## 🔐 Access Control Summary

### **Admin Only** (Most Restrictive)
- Delete tenant
- Delete payment

### **Admin & Manager**
- Create tenant
- View all tenants
- Update tenant
- View payments
- Update payment
- View reports and summaries

### **Admin, Manager & Staff** (Payment Collection)
- Record payment (Staff can collect payments)

---

## 📝 Example Requests (Updated)

### **1. Create Tenant**
```http
POST http://localhost:5000/api/admin/tenant
Authorization: Bearer YOUR_TOKEN
Content-Type: application/json

{
  "name": "John Doe",
  "phone": "9876543210",
  "email": "john@example.com"
}
```

### **2. Get All Tenants**
```http
GET http://localhost:5000/api/admin/tenants?status=active&page=1&limit=10
Authorization: Bearer YOUR_TOKEN
```

### **3. Get Active Tenants**
```http
GET http://localhost:5000/api/admin/tenants/active?hostelId=1
Authorization: Bearer YOUR_TOKEN
```

### **4. Get Tenant by ID**
```http
GET http://localhost:5000/api/admin/tenant/1
Authorization: Bearer YOUR_TOKEN
```

### **5. Update Tenant**
```http
PUT http://localhost:5000/api/admin/tenant/1
Authorization: Bearer YOUR_TOKEN
Content-Type: application/json

{
  "phone": "9999999999",
  "notes": "Updated contact number"
}
```

### **6. Delete Tenant** (Admin Only)
```http
DELETE http://localhost:5000/api/admin/tenant/1
Authorization: Bearer YOUR_ADMIN_TOKEN
```

### **7. Get Tenant Payment History**
```http
GET http://localhost:5000/api/admin/tenant/1/payments?page=1&limit=10
Authorization: Bearer YOUR_TOKEN
```

### **8. Get Tenant Financial Summary**
```http
GET http://localhost:5000/api/admin/tenant/1/financial-summary
Authorization: Bearer YOUR_TOKEN
```

---

### **9. Record Payment** (Staff can also do this)
```http
POST http://localhost:5000/api/admin/payment
Authorization: Bearer YOUR_TOKEN
Content-Type: application/json

{
  "tenantId": 1,
  "hostelId": 1,
  "amount": 5000,
  "paymentType": "rent",
  "paymentMethod": "cash",
  "receiptNumber": "REC-2025-001"
}
```

### **10. Get All Payments**
```http
GET http://localhost:5000/api/admin/payments?tenantId=1&page=1&limit=20
Authorization: Bearer YOUR_TOKEN
```

### **11. Get Payment Summary**
```http
GET http://localhost:5000/api/admin/payments/summary?hostelId=1&startDate=2025-10-01&endDate=2025-10-31
Authorization: Bearer YOUR_TOKEN
```

### **12. Get Pending Payments**
```http
GET http://localhost:5000/api/admin/payments/pending?hostelId=1
Authorization: Bearer YOUR_TOKEN
```

### **13. Get Payment by ID**
```http
GET http://localhost:5000/api/admin/payment/1
Authorization: Bearer YOUR_TOKEN
```

### **14. Update Payment**
```http
PUT http://localhost:5000/api/admin/payment/1
Authorization: Bearer YOUR_TOKEN
Content-Type: application/json

{
  "remarks": "Updated payment details",
  "status": "paid"
}
```

### **15. Delete Payment** (Admin Only)
```http
DELETE http://localhost:5000/api/admin/payment/1
Authorization: Bearer YOUR_ADMIN_TOKEN
```

---

## 🎯 Key Improvements

### **1. RESTful Design**
- ✅ `POST /tenant` instead of `POST /tenant/create`
- ✅ `GET /tenants` instead of `GET /tenant/list`
- ✅ `PUT /tenant/:id` instead of `PUT /tenant/update/:id`
- ✅ `DELETE /tenant/:id` instead of `DELETE /tenant/delete/:id`

### **2. Consistent Middleware**
- ✅ All routes now use the same middleware pattern
- ✅ Individual middleware per route (better control)
- ✅ Proper role-based access control

### **3. Better Access Control**
- ✅ Delete operations restricted to Admin only
- ✅ Payment recording allowed for Staff (for collection)
- ✅ View/Update operations for Admin & Manager
- ✅ Clear role separation

### **4. Route Ordering**
- ✅ More specific routes first (e.g., `/tenants/active` before `/tenant/:id`)
- ✅ Prevents route matching conflicts

---

## 🔄 Migration Guide

If you were using the old endpoints, update them as follows:

### **Tenant Endpoints**
```diff
- POST /api/admin/tenant/create
+ POST /api/admin/tenant

- GET /api/admin/tenant/list
+ GET /api/admin/tenants

- GET /api/admin/tenant/active
+ GET /api/admin/tenants/active

- PUT /api/admin/tenant/update/:id
+ PUT /api/admin/tenant/:id

- DELETE /api/admin/tenant/delete/:id
+ DELETE /api/admin/tenant/:id
```

### **Payment Endpoints**
```diff
- POST /api/admin/payment/record
+ POST /api/admin/payment

- GET /api/admin/payment/list
+ GET /api/admin/payments

- GET /api/admin/payment/summary
+ GET /api/admin/payments/summary

- GET /api/admin/payment/pending
+ GET /api/admin/payments/pending

- PUT /api/admin/payment/update/:id
+ PUT /api/admin/payment/:id

- DELETE /api/admin/payment/delete/:id
+ DELETE /api/admin/payment/:id
```

---

## ✅ Testing Checklist

- [ ] Test tenant creation with Manager role
- [ ] Test tenant creation with Staff role (should fail)
- [ ] Test tenant deletion with Manager role (should fail)
- [ ] Test tenant deletion with Admin role (should succeed)
- [ ] Test payment recording with Staff role (should succeed)
- [ ] Test payment recording with User role (should fail)
- [ ] Test all GET endpoints with Manager role
- [ ] Test delete operations with Admin role

---

## 🎉 Summary

**Changes:**
- ✅ Updated middleware to match existing routes
- ✅ RESTful endpoint paths
- ✅ Better access control
- ✅ Staff can now record payments
- ✅ Only Admin can delete records

**Your tenant and payment routes are now consistent with the rest of your application!** 🚀


