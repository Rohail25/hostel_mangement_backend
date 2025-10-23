# 📸 Tenant Profile Photo Upload Guide

## ✅ What Was Updated

### **1. Tenant Controller** (`controllers/api/tenant.controller.js`)
✅ **createTenant** - Now handles profile photo upload
✅ **updateTenant** - Now handles profile photo upload
✅ **Search** - Updated to use `cnicNumber` instead of `aadharNumber`
✅ All field validations updated to use `cnicNumber`

### **2. Tenant Routes** (`routes/api/admin/tenant.route.js`)
✅ Added Multer configuration for file uploads
✅ File upload middleware on POST `/tenant`
✅ File upload middleware on PUT `/tenant/:id`
✅ File type validation (JPG, PNG, WEBP only)
✅ Automatic filename generation with timestamp

### **3. Prisma Schema** (`prisma/schema.prisma`)
✅ Changed `aadharNumber` to `cnicNumber`
✅ Updated indexes

### **4. App Configuration** (`app.js`)
✅ Added static file serving for `/uploads` directory

---

## 📁 File Upload Configuration

### **Storage Setup**
```javascript
const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    cb(null, 'uploads/tenants/'); // Files saved here
  },
  filename: (req, file, cb) => {
    const ext = file.originalname.split('.').pop();
    cb(null, `${Date.now()}-${file.fieldname}.${ext}`);
    // Example: 1729527600000-profilePhoto.jpg
  }
});
```

### **File Type Validation**
```javascript
const upload = multer({
  storage,
  fileFilter: (req, file, cb) => {
    const allowed = ['image/jpeg', 'image/png', 'image/jpg', 'image/webp'];
    if (allowed.includes(file.mimetype)) cb(null, true);
    else cb(new Error('Invalid file type. Only JPG, PNG, WEBP allowed.'));
  }
});
```

### **Allowed File Types**
- ✅ JPG / JPEG
- ✅ PNG
- ✅ WEBP
- ❌ GIF, BMP, SVG (not allowed)

---

## 🚀 How to Use

### **1. Create Tenant with Profile Photo**

**Using Postman:**
1. Select **POST** method
2. URL: `http://localhost:5000/api/admin/tenant`
3. Select **Body** tab
4. Select **form-data** (NOT raw or x-www-form-urlencoded)
5. Add fields:

| Key | Type | Value |
|-----|------|-------|
| `name` | Text | John Doe |
| `phone` | Text | 9876543210 |
| `email` | Text | john@example.com |
| `gender` | Text | male |
| `cnicNumber` | Text | 12345-6789012-3 |
| `occupation` | Text | Software Engineer |
| `profilePhoto` | **File** | [Select image file] |
| `address` | Text | `{"street":"123 Main St","city":"Karachi"}` |
| `emergencyContact` | Text | `{"name":"Jane Doe","phone":"9876543211"}` |

6. Add Authorization header:
   - Key: `Authorization`
   - Value: `Bearer YOUR_TOKEN`

7. Click **Send**

**Expected Response:**
```json
{
  "success": true,
  "message": "Tenant created successfully",
  "data": {
    "id": 1,
    "name": "John Doe",
    "email": "john@example.com",
    "phone": "9876543210",
    "profilePhoto": "/uploads/tenants/1729527600000-profilePhoto.jpg",
    "cnicNumber": "12345-6789012-3",
    "status": "active",
    "totalPaid": 0,
    "totalDue": 0,
    "createdAt": "2025-10-21T..."
  },
  "statusCode": 201
}
```

---

### **2. Update Tenant with New Profile Photo**

**Using Postman:**
1. Select **PUT** method
2. URL: `http://localhost:5000/api/admin/tenant/1`
3. Select **Body** tab
4. Select **form-data**
5. Add fields:

| Key | Type | Value |
|-----|------|-------|
| `phone` | Text | 9999999999 |
| `occupation` | Text | Senior Developer |
| `profilePhoto` | **File** | [Select new image file] |

6. Add Authorization header
7. Click **Send**

**Expected Response:**
```json
{
  "success": true,
  "message": "Tenant updated successfully",
  "data": {
    "id": 1,
    "name": "John Doe",
    "phone": "9999999999",
    "profilePhoto": "/uploads/tenants/1729528000000-profilePhoto.jpg",
    "occupation": "Senior Developer",
    ...
  },
  "statusCode": 200
}
```

---

### **3. Access Uploaded Photos**

Once uploaded, profile photos are accessible via:

```
http://localhost:5000/uploads/tenants/1729527600000-profilePhoto.jpg
```

**In HTML:**
```html
<img src="http://localhost:5000/uploads/tenants/1729527600000-profilePhoto.jpg" alt="Profile" />
```

**In React:**
```jsx
<img src={`http://localhost:5000${tenant.profilePhoto}`} alt={tenant.name} />
```

---

## 📋 Field Name Changes

### **Updated Field: `aadharNumber` → `cnicNumber`**

| Old Field | New Field | Description |
|-----------|-----------|-------------|
| `aadharNumber` | `cnicNumber` | National ID number (Pakistan CNIC) |

**Example CNIC Format:**
```
12345-6789012-3
```

**In Requests:**
```json
{
  "name": "John Doe",
  "phone": "9876543210",
  "cnicNumber": "12345-6789012-3"  // ← Use this
}
```

---

## 🎯 Complete Example with All Fields

### **Create Tenant Request (Form Data)**

```
POST http://localhost:5000/api/admin/tenant
Authorization: Bearer YOUR_TOKEN
Content-Type: multipart/form-data

Fields:
------
name: Muhammad Ali
email: ali@example.com
phone: 03001234567
alternatePhone: 03009876543
gender: male
dateOfBirth: 1990-05-15
cnicNumber: 12345-6789012-3
occupation: Software Engineer
companyName: Tech Solutions Ltd
designation: Senior Developer
monthlyIncome: 150000
notes: Preferred tenant
profilePhoto: [image file]

address (JSON):
{
  "street": "123 Main Road",
  "city": "Karachi",
  "state": "Sindh",
  "country": "Pakistan",
  "pincode": "75500"
}

permanentAddress (JSON):
{
  "street": "456 Home Street",
  "city": "Lahore",
  "state": "Punjab",
  "country": "Pakistan",
  "pincode": "54000"
}

emergencyContact (JSON):
{
  "name": "Fatima Ali",
  "relationship": "Sister",
  "phone": "03001111111",
  "address": "456 Home Street, Lahore"
}

documents (JSON):
[
  {
    "type": "cnic",
    "number": "12345-6789012-3",
    "url": "https://example.com/cnic.pdf",
    "uploadedAt": "2025-10-21"
  }
]
```

---

## 🔐 File Security

### **1. File Type Validation**
- Only image files allowed (JPG, PNG, WEBP)
- Server rejects other file types

### **2. Unique Filenames**
- Files are renamed with timestamp
- Prevents file overwriting
- Format: `{timestamp}-profilePhoto.{ext}`

### **3. Organized Storage**
```
backend/
  uploads/
    tenants/
      1729527600000-profilePhoto.jpg
      1729528000000-profilePhoto.png
      1729529000000-profilePhoto.webp
```

---

## ⚠️ Important Notes

### **1. Form Data is Required for File Upload**
```javascript
// ❌ WRONG - Will not work for file upload
Content-Type: application/json
{
  "name": "John",
  "profilePhoto": "file.jpg"  // Can't send file as JSON
}

// ✅ CORRECT - Use multipart/form-data
Content-Type: multipart/form-data
name: John
profilePhoto: [file]
```

### **2. JSON Fields in Form Data**
For complex fields like `address`, send as JSON string:
```
address: {"street":"123 Main St","city":"Karachi"}
```

### **3. File Upload is Optional**
You can create/update tenant without uploading photo:
```
POST /api/admin/tenant
{
  "name": "John Doe",
  "phone": "9876543210"
  // No profilePhoto - that's OK!
}
```

### **4. Updating Without Changing Photo**
If you update tenant without sending `profilePhoto` file, the old photo remains:
```
PUT /api/admin/tenant/1
{
  "phone": "9999999999"
  // profilePhoto not sent - old photo kept
}
```

---

## 🛠️ Troubleshooting

### **Error: "Invalid file type"**
**Cause:** Trying to upload unsupported file type
**Solution:** Only use JPG, PNG, or WEBP images

### **Error: "No such file or directory"**
**Cause:** `uploads/tenants/` folder doesn't exist
**Solution:** Create folder manually or server should auto-create

### **File not accessible**
**Cause:** Static file serving not configured
**Solution:** Verify `app.use('/uploads', express.static('uploads'))` in app.js

### **Large file upload fails**
**Cause:** File size limit exceeded
**Solution:** Add size limit to multer config:
```javascript
const upload = multer({
  storage,
  limits: { fileSize: 5 * 1024 * 1024 }, // 5MB limit
  fileFilter: ...
});
```

---

## 📊 Testing Checklist

- [ ] Create tenant without photo (text-only fields)
- [ ] Create tenant with JPG photo
- [ ] Create tenant with PNG photo
- [ ] Create tenant with WEBP photo
- [ ] Try to upload invalid file type (should fail)
- [ ] Update tenant without changing photo
- [ ] Update tenant with new photo
- [ ] Access uploaded photo via browser
- [ ] Verify photo URL in tenant response
- [ ] Check photo stored in `uploads/tenants/` folder

---

## 🎉 Summary

**What Works Now:**
1. ✅ Upload profile photo when creating tenant
2. ✅ Upload new profile photo when updating tenant
3. ✅ File type validation (JPG, PNG, WEBP only)
4. ✅ Unique filename generation
5. ✅ Photo accessible via URL
6. ✅ Field name changed: `cnicNumber` (from `aadharNumber`)
7. ✅ All validation and search updated
8. ✅ Static file serving configured

**Updated Functions:**
- ✅ `createTenant` - Handles file upload
- ✅ `updateTenant` - Handles file upload
- ✅ `getAllTenants` - Search by cnicNumber
- ✅ Field validations use cnicNumber

**Your tenant management now supports profile photo uploads!** 📸




