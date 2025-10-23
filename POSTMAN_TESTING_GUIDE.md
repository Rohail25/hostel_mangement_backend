# 🧪 Postman Testing Guide - Hotel Management API

## 🔧 Setup First

### 1. Make sure your MySQL database is running and configured in `.env`:
```env
DATABASE_URL="mysql://username:password@localhost:3306/hotel_management"
JWT_SECRET="your-secret-key"
PORT=3000
```

### 2. Run database migrations:
```bash
npx prisma db push
```

### 3. Start the server:
```bash
npm start
```

---

## 📝 Testing Authentication Flow

### Step 1: Register a New User (Public Route)

**Endpoint:** `POST http://localhost:3000/api/register`

**Headers:**
```
Content-Type: application/json
```

**Body (JSON):**
```json
{
  "name": "John Doe",
  "email": "john@example.com",
  "phone": "1234567890",
  "password": "password123"
}
```

**Expected Response:**
```json
{
  "success": true,
  "message": "User registered successfully",
  "data": {
    "id": 1,
    "name": "John Doe",
    "email": "john@example.com",
    "phone": "1234567890",
    "role": "user",
    "status": "active",
    "createdAt": "2024-01-01T00:00:00.000Z"
  }
}
```

---

### Step 2: Login (Public Route)

**Endpoint:** `POST http://localhost:3000/api/login`

**Headers:**
```
Content-Type: application/json
```

**Body (JSON):**
```json
{
  "email": "john@example.com",
  "password": "password123"
}
```

**Expected Response:**
```json
{
  "success": true,
  "message": "Login successful",
  "data": {
    "id": 1,
    "name": "John Doe",
    "email": "john@example.com",
    "phone": "1234567890",
    "role": "user",
    "status": "active",
    "createdAt": "2024-01-01T00:00:00.000Z",
    "token": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9..."
  }
}
```

**⚠️ IMPORTANT:** Copy the `token` value from the response!

---

### Step 3: Test Protected Routes

For all protected routes, you need to include the token in the Authorization header.

#### 🔑 Two Ways to Send Token in Postman:

#### **Option 1: Authorization Header (Recommended for Postman)**

In Postman:
1. Go to the **Authorization** tab
2. Select **Type:** `Bearer Token`
3. Paste your token in the **Token** field

OR manually add header:
**Headers:**
```
Authorization: Bearer YOUR_TOKEN_HERE
Content-Type: application/json
```

#### **Option 2: Cookie (Automatic if using login)**
The login route automatically sets a cookie, but Postman might not save it.

---

## 🧪 Testing Protected Routes

### Get All Users (Requires Authentication)

**Endpoint:** `GET http://localhost:3000/api/users`

**Headers:**
```
Authorization: Bearer YOUR_TOKEN_HERE
```

**Expected Response:**
```json
{
  "success": true,
  "message": "Users retrieved successfully",
  "data": [
    {
      "id": 1,
      "name": "John Doe",
      "email": "john@example.com",
      "phone": "1234567890",
      "role": "user",
      "status": "active",
      "createdAt": "2024-01-01T00:00:00.000Z",
      "updatedAt": "2024-01-01T00:00:00.000Z"
    }
  ]
}
```

---

### Get User By ID (Requires Authentication)

**Endpoint:** `GET http://localhost:3000/api/user/1`

**Headers:**
```
Authorization: Bearer YOUR_TOKEN_HERE
```

---

### Update User (Requires Authentication)

**Endpoint:** `PUT http://localhost:3000/api/user/1`

**Headers:**
```
Authorization: Bearer YOUR_TOKEN_HERE
Content-Type: application/json
```

**Body (JSON):**
```json
{
  "name": "John Updated",
  "phone": "9876543210"
}
```

---

### Delete User (Requires Admin Role)

**Endpoint:** `DELETE http://localhost:3000/api/user/1`

**Headers:**
```
Authorization: Bearer YOUR_TOKEN_HERE
```

**Note:** This requires `admin` role. You'll get 403 error if user role is not admin.

---

### Soft Delete/Deactivate User (Requires Admin or Manager Role)

**Endpoint:** `PATCH http://localhost:3000/api/user/1/deactivate`

**Headers:**
```
Authorization: Bearer YOUR_TOKEN_HERE
```

---

### Logout (Requires Authentication)

**Endpoint:** `POST http://localhost:3000/api/logout`

**Headers:**
```
Authorization: Bearer YOUR_TOKEN_HERE
```

---

## ❌ Common Errors and Solutions

### Error 1: "Authentication required. Please login."
**Cause:** No token provided or invalid token format

**Solution:**
- Make sure you copied the token from login response
- Add `Bearer ` prefix (with space) before token
- Use the Authorization tab in Postman and select "Bearer Token"

---

### Error 2: "Invalid or expired token. Please login again."
**Cause:** Token is expired or malformed

**Solution:**
- Login again to get a new token
- Tokens expire after 7 days by default

---

### Error 3: "User not found. Please login again."
**Cause:** User ID in token doesn't exist in database

**Solution:**
- Login again to get a valid token
- Check if user was deleted from database

---

### Error 4: "Access denied. This action requires admin role."
**Cause:** User doesn't have required role

**Solution:**
- This route requires admin role
- Update user role in database manually or use an admin account

---

## 🎯 Quick Postman Setup

### Setting Up Environment Variables in Postman:

1. Click the **Environment** button (gear icon)
2. Create a new environment called "Hotel API"
3. Add these variables:
   - `base_url`: `http://localhost:3000`
   - `token`: (leave empty, will be set automatically)

4. In your requests, use:
   - URL: `{{base_url}}/api/login`
   - Authorization: `Bearer {{token}}`

5. After login, in the **Tests** tab of login request, add:
```javascript
if (pm.response.code === 200) {
    var jsonData = pm.response.json();
    pm.environment.set("token", jsonData.data.token);
}
```

This automatically saves the token for use in other requests!

---

## 📊 Testing Role-Based Access

### To Test Admin-Only Routes:

1. **Manually update user role in database:**
```sql
UPDATE User SET role = 'admin' WHERE id = 1;
```

2. **Login again** to get new token with admin role

3. **Test admin routes** like delete user

---

## 🔍 Debugging Tips

### Check if server is running:
```bash
# Should see: 🚀 Server is running on port 3000
# And: ✅ Connected to MySQL via Prisma
```

### Check request in terminal:
- If you see errors in the terminal, read them carefully
- Common issues: Database connection, JWT_SECRET not set

### Test with curl:
```bash
# Register
curl -X POST http://localhost:3000/api/register \
  -H "Content-Type: application/json" \
  -d '{"name":"Test","email":"test@test.com","phone":"123","password":"pass123"}'

# Login
curl -X POST http://localhost:3000/api/login \
  -H "Content-Type: application/json" \
  -d '{"email":"test@test.com","password":"pass123"}'

# Get users (replace TOKEN with your actual token)
curl -X GET http://localhost:3000/api/users \
  -H "Authorization: Bearer TOKEN"
```

---

## ✅ Checklist

Before testing:
- [ ] MySQL database is running
- [ ] `.env` file is configured
- [ ] Database migrations are run (`npx prisma db push`)
- [ ] Server is running (`npm start`)
- [ ] You see connection success messages in terminal

For each protected route test:
- [ ] User is registered
- [ ] User is logged in
- [ ] Token is copied from login response
- [ ] Token is added to Authorization header with `Bearer ` prefix
- [ ] Content-Type header is set to `application/json` for POST/PUT requests

---

## 🎉 Success!

If everything works:
- ✅ Register returns 201 status
- ✅ Login returns 200 status with token
- ✅ Protected routes return 200 status with data
- ✅ Routes without token return 401 status
- ✅ Routes without proper role return 403 status

Happy Testing! 🚀






