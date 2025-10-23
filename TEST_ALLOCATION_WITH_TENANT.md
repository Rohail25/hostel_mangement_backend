# 🧪 Test Allocation API with Tenant

## Quick Test Steps

### **Step 1: Create a Tenant User**

```bash
POST http://localhost:5000/api/admin/user/register
Content-Type: application/json
Authorization: Bearer YOUR_ADMIN_TOKEN

{
  "name": "John Doe",
  "email": "john.tenant@example.com",
  "phone": "1234567890",
  "password": "password123",
  "role": "user"
}
```

**Expected Response:**
```json
{
  "success": true,
  "data": {
    "id": 5,  ← Remember this ID!
    "name": "John Doe",
    "email": "john.tenant@example.com",
    "role": "user"
  }
}
```

---

### **Step 2: Create Hostel (if not exists)**

```bash
POST http://localhost:5000/api/admin/hostel/create
Content-Type: application/json
Authorization: Bearer YOUR_ADMIN_TOKEN

{
  "name": "Sunrise Hostel",
  "address": {
    "street": "123 Main St",
    "city": "New York",
    "state": "NY",
    "country": "USA",
    "zipCode": "10001"
  },
  "totalFloors": 3,
  "totalRooms": 30,
  "totalBeds": 120
}
```

---

### **Step 3: Create Floor, Room, and Bed**

*Skip if you already have these*

**Create Floor:**
```bash
POST http://localhost:5000/api/admin/floor/create
Content-Type: application/json
Authorization: Bearer YOUR_ADMIN_TOKEN

{
  "hostelId": 1,
  "floorNumber": 1,
  "floorName": "Ground Floor",
  "totalRooms": 10,
  "totalBeds": 40
}
```

**Create Room:**
```bash
POST http://localhost:5000/api/admin/room/create
Content-Type: application/json
Authorization: Bearer YOUR_ADMIN_TOKEN

{
  "hostelId": 1,
  "floorId": 1,
  "roomNumber": "101",
  "roomType": "quad",
  "totalBeds": 4,
  "pricePerBed": 5000
}
```

**Create Bed:**
```bash
POST http://localhost:5000/api/admin/bed/create
Content-Type: application/json
Authorization: Bearer YOUR_ADMIN_TOKEN

{
  "roomId": 1,
  "bedNumber": "B1",
  "bedType": "single",
  "status": "available"
}
```

---

### **Step 4: Allocate Tenant to Bed** ✅

```bash
POST http://localhost:5000/api/admin/allocation/allocate
Content-Type: application/json
Authorization: Bearer YOUR_ADMIN_TOKEN

{
  "hostel": 1,
  "floor": 1,
  "room": 1,
  "bed": 1,
  "tenant": 5,  ← Use the tenant ID from Step 1
  "checkInDate": "2025-10-22",
  "expectedCheckOutDate": "2026-01-22",
  "rentAmount": 5000,
  "depositAmount": 2000,
  "notes": "First semester student, prefers ground floor"
}
```

**Expected Success Response:**
```json
{
  "success": true,
  "message": "Tenant allocated successfully",
  "data": {
    "id": 1,
    "hostelId": 1,
    "floorId": 1,
    "roomId": 1,
    "bedId": 1,
    "tenantId": 5,  ← ✅ Tenant linked!
    "allocatedById": 1,
    "checkInDate": "2025-10-22T00:00:00.000Z",
    "expectedCheckOutDate": "2026-01-22T00:00:00.000Z",
    "rentAmount": 5000,
    "depositAmount": 2000,
    "status": "active",
    "paymentStatus": "pending",
    "hostel": {
      "name": "Sunrise Hostel"
    },
    "floor": {
      "floorNumber": 1
    },
    "room": {
      "roomNumber": "101"
    },
    "bed": {
      "bedNumber": "B1",
      "currentTenant": {
        "name": "John Doe",
        "email": "john.tenant@example.com",
        "phone": "1234567890"
      }
    },
    "allocatedBy": {
      "name": "Admin User",
      "email": "admin@example.com"
    }
  },
  "statusCode": 201
}
```

---

### **Step 5: Verify Allocation**

```bash
GET http://localhost:5000/api/admin/allocation/list
Authorization: Bearer YOUR_ADMIN_TOKEN
```

**Should show your new allocation with tenant details!**

---

## ❌ Common Errors and Solutions

### Error 1: "Argument `hostel` is missing"
**Cause:** Old Prisma client cached  
**Solution:** Restart your Node.js server

### Error 2: "Tenant not found"
**Cause:** Tenant ID doesn't exist  
**Solution:** Create a user first (Step 1) and use the correct ID

### Error 3: "Bed is occupied, cannot allocate"
**Cause:** Bed is already occupied  
**Solution:** Use a different bed or checkout the current tenant first

### Error 4: "Tenant already has an active allocation"
**Cause:** Tenant is already allocated to another bed  
**Solution:** Checkout the tenant from the current bed first

### Error 5: "Cannot allocate bed to admin or manager users"
**Cause:** Trying to allocate a bed to an admin/manager user  
**Solution:** Create a user with role "user" for tenants

---

## 🎯 Testing Checklist

- [ ] Create a tenant user (role: "user")
- [ ] Create hostel, floor, room, bed (if needed)
- [ ] Allocate tenant to bed
- [ ] Verify tenant details appear in allocation
- [ ] Check that bed status changed to "occupied"
- [ ] Try to allocate same tenant again (should fail)
- [ ] Checkout tenant
- [ ] Allocate same tenant to different bed (should work)

---

## 🔍 Quick Debug Tips

1. **Check if tenant exists:**
```bash
GET http://localhost:5000/api/admin/user/list
```

2. **Check bed status:**
```bash
GET http://localhost:5000/api/user/bed/room/1
```

3. **Check active allocations:**
```bash
GET http://localhost:5000/api/admin/allocation/list?status=active
```

---

## ✅ Success Indicators

You'll know it's working when:
1. ✅ No error about "Argument `hostel` is missing"
2. ✅ Allocation created with `tenantId` field
3. ✅ Bed status changes to "occupied"
4. ✅ `bed.currentTenant` shows tenant details
5. ✅ Can query allocations by tenant

---

Good luck! 🚀


