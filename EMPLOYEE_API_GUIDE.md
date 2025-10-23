# Employee Management API Documentation

## Overview
This guide covers the complete Employee Management System that manages employees, their salaries, roles (staff/manager), and links them to User accounts.

## Database Schema

### Employee Model
```prisma
model Employee {
  id              Int            @id @default(autoincrement())
  userId          Int            @unique // Link to User account
  employeeCode    String?        @unique
  role            EmployeeRole   @default(staff)
  department      String?
  designation     String?
  salary          Float
  salaryType      String?        @default("monthly")
  joinDate        DateTime
  terminationDate DateTime?
  status          EmployeeStatus @default(active)
  workingHours    Json?
  hostelAssigned  Int?
  bankDetails     Json?
  address         Json?
  documents       Json?
  profilePhoto    String?
  emergencyContact Json?
  qualifications   Json?
  notes            String?
  createdAt       DateTime       @default(now())
  updatedAt       DateTime       @updatedAt
}
```

### Enums
```prisma
enum EmployeeStatus {
  active
  inactive
  on_leave
  terminated
}

enum EmployeeRole {
  staff
  manager
  supervisor
  receptionist
  maintenance
  accountant
}
```

## API Endpoints

### 1. Create Employee
**POST** `/api/admin/employees`

Creates a new employee account (User + Employee profile).

**Authentication:** Required (Admin/Manager)

**Request Body:**
```json
{
  // User Information
  "name": "John Doe",
  "email": "john.doe@example.com",
  "phone": "+1234567890",
  "password": "securePassword123",
  "role": "staff", // User role: admin, manager, staff, user
  
  // Employee Information
  "employeeCode": "EMP001", // Optional, auto-generated if not provided
  "role": "staff", // Employee role: staff, manager, supervisor, receptionist, maintenance, accountant
  "department": "Housekeeping",
  "designation": "Room Cleaner",
  "salary": 25000.00,
  "salaryType": "monthly", // monthly, hourly, daily
  "joinDate": "2025-01-01",
  
  // Optional Fields
  "hostelAssigned": 1,
  "workingHours": {
    "startTime": "09:00",
    "endTime": "18:00",
    "workingDays": ["monday", "tuesday", "wednesday", "thursday", "friday", "saturday"]
  },
  "bankDetails": {
    "bankName": "ABC Bank",
    "accountNumber": "1234567890",
    "ifscCode": "ABCD0123456",
    "branch": "Main Branch"
  },
  "address": {
    "street": "123 Main St",
    "city": "New York",
    "state": "NY",
    "country": "USA",
    "pincode": "10001"
  },
  "emergencyContact": {
    "name": "Jane Doe",
    "relationship": "Spouse",
    "phone": "+1234567891",
    "address": "123 Main St, New York"
  },
  "qualifications": [
    {
      "degree": "Bachelor's",
      "institution": "ABC University",
      "year": "2020"
    }
  ],
  "profilePhoto": "path/to/photo.jpg",
  "documents": [
    {
      "type": "ID Card",
      "number": "ID123456",
      "url": "path/to/id.pdf",
      "uploadedAt": "2025-01-01T00:00:00Z"
    }
  ],
  "notes": "Excellent performance"
}
```

**Response:**
```json
{
  "success": true,
  "message": "Employee created successfully",
  "data": {
    "user": {
      "id": 1,
      "name": "John Doe",
      "email": "john.doe@example.com",
      "phone": "+1234567890",
      "role": "staff"
    },
    "employee": {
      "id": 1,
      "userId": 1,
      "employeeCode": "EMP00001",
      "role": "staff",
      "department": "Housekeeping",
      "designation": "Room Cleaner",
      "salary": 25000.00,
      "salaryType": "monthly",
      "joinDate": "2025-01-01T00:00:00.000Z",
      "status": "active",
      "createdAt": "2025-10-22T11:30:00.000Z",
      "updatedAt": "2025-10-22T11:30:00.000Z"
    }
  }
}
```

---

### 2. Get All Employees
**GET** `/api/admin/employees`

Get all employees with filtering, search, and pagination.

**Authentication:** Required (Admin/Manager)

**Query Parameters:**
- `status` - Filter by status (active, inactive, on_leave, terminated)
- `role` - Filter by role (staff, manager, supervisor, receptionist, maintenance, accountant)
- `department` - Filter by department name
- `hostelAssigned` - Filter by hostel ID
- `search` - Search by name, email, phone, employee code, or designation
- `page` - Page number (default: 1)
- `limit` - Items per page (default: 10)

**Example Request:**
```
GET /api/admin/employees?status=active&role=staff&page=1&limit=10
```

**Response:**
```json
{
  "success": true,
  "message": "Employees fetched successfully",
  "data": [
    {
      "id": 1,
      "userId": 1,
      "employeeCode": "EMP00001",
      "role": "staff",
      "department": "Housekeeping",
      "designation": "Room Cleaner",
      "salary": 25000.00,
      "salaryType": "monthly",
      "status": "active",
      "user": {
        "id": 1,
        "name": "John Doe",
        "email": "john.doe@example.com",
        "phone": "+1234567890",
        "role": "staff",
        "status": "active"
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

### 3. Get Employee by ID
**GET** `/api/admin/employees/:id`

Get detailed information about a specific employee.

**Authentication:** Required (Admin/Manager)

**Response:**
```json
{
  "success": true,
  "message": "Employee fetched successfully",
  "data": {
    "id": 1,
    "userId": 1,
    "employeeCode": "EMP00001",
    "role": "staff",
    "department": "Housekeeping",
    "designation": "Room Cleaner",
    "salary": 25000.00,
    "salaryType": "monthly",
    "joinDate": "2025-01-01T00:00:00.000Z",
    "status": "active",
    "workingHours": { ... },
    "bankDetails": { ... },
    "address": { ... },
    "user": {
      "id": 1,
      "name": "John Doe",
      "email": "john.doe@example.com",
      "phone": "+1234567890",
      "role": "staff",
      "status": "active",
      "createdAt": "2025-01-01T00:00:00.000Z"
    }
  }
}
```

---

### 4. Get Employee by User ID
**GET** `/api/admin/employees/user/:userId`

Get employee information using User ID.

**Authentication:** Required (Admin/Manager)

**Response:** Same as Get Employee by ID

---

### 5. Update Employee
**PUT** `/api/admin/employees/:id`

Update employee details (both User and Employee data).

**Authentication:** Required (Admin/Manager)

**Request Body:** (All fields optional)
```json
{
  // User Information
  "name": "John Updated",
  "email": "john.updated@example.com",
  "phone": "+1234567899",
  "role": "manager",
  
  // Employee Information
  "employeeCode": "EMP002",
  "role": "manager",
  "department": "Management",
  "designation": "Floor Manager",
  "salary": 35000.00,
  "salaryType": "monthly",
  "status": "active",
  "workingHours": { ... },
  "hostelAssigned": 2,
  "bankDetails": { ... },
  "address": { ... },
  "notes": "Promoted to manager"
}
```

**Response:**
```json
{
  "success": true,
  "message": "Employee updated successfully",
  "data": {
    "user": { ... },
    "employee": { ... }
  }
}
```

---

### 6. Update Employee Salary
**PATCH** `/api/admin/employees/:id/salary`

Update employee salary (Admin only).

**Authentication:** Required (Admin only)

**Request Body:**
```json
{
  "salary": 30000.00,
  "salaryType": "monthly",
  "effectiveDate": "2025-02-01",
  "notes": "Annual increment"
}
```

**Response:**
```json
{
  "success": true,
  "message": "Employee salary updated successfully",
  "data": {
    "id": 1,
    "salary": 30000.00,
    "salaryType": "monthly",
    "user": { ... }
  }
}
```

---

### 7. Update Employee Status
**PATCH** `/api/admin/employees/:id/status`

Update employee status (active, inactive, on_leave, terminated).

**Authentication:** Required (Admin/Manager)

**Request Body:**
```json
{
  "status": "terminated",
  "terminationDate": "2025-12-31",
  "notes": "Voluntary resignation"
}
```

**Response:**
```json
{
  "success": true,
  "message": "Employee status updated successfully",
  "data": {
    "id": 1,
    "status": "terminated",
    "terminationDate": "2025-12-31T00:00:00.000Z",
    "user": { ... }
  }
}
```

---

### 8. Delete Employee
**DELETE** `/api/admin/employees/:id`

Delete employee and associated user account (Admin only).

**Authentication:** Required (Admin only)

**Response:**
```json
{
  "success": true,
  "message": "Employee deleted successfully"
}
```

---

### 9. Get Employee Statistics
**GET** `/api/admin/employees/statistics`

Get comprehensive employee statistics.

**Authentication:** Required (Admin/Manager)

**Response:**
```json
{
  "success": true,
  "message": "Employee statistics fetched successfully",
  "data": {
    "totalEmployees": 50,
    "statusBreakdown": {
      "active": 45,
      "inactive": 2,
      "on_leave": 3,
      "terminated": 0
    },
    "employeesByRole": [
      {
        "role": "staff",
        "_count": 30
      },
      {
        "role": "manager",
        "_count": 10
      },
      {
        "role": "receptionist",
        "_count": 5
      }
    ],
    "employeesByDepartment": [
      {
        "department": "Housekeeping",
        "_count": 20
      },
      {
        "department": "Management",
        "_count": 10
      }
    ],
    "salaryStatistics": {
      "totalMonthlySalaryExpense": 1250000.00,
      "averageSalary": 25000.00
    }
  }
}
```

---

## Authentication & Authorization

All employee endpoints require:
1. **Authentication:** Valid JWT token in cookies or Authorization header
2. **Authorization:** User must have `admin` or `manager` role

Special restrictions:
- **Update Salary:** Admin only
- **Delete Employee:** Admin only

---

## Complete Usage Example

### Step 1: Create Employee
```bash
curl -X POST http://localhost:3000/api/admin/employees \
  -H "Content-Type: application/json" \
  -H "Cookie: token=YOUR_JWT_TOKEN" \
  -d '{
    "name": "John Doe",
    "email": "john.doe@hotel.com",
    "phone": "+1234567890",
    "password": "password123",
    "role": "staff",
    "employeeCode": "EMP001",
    "role": "staff",
    "department": "Housekeeping",
    "designation": "Room Cleaner",
    "salary": 25000,
    "salaryType": "monthly",
    "joinDate": "2025-01-01",
    "hostelAssigned": 1
  }'
```

### Step 2: Get All Employees
```bash
curl -X GET "http://localhost:3000/api/admin/employees?status=active&page=1&limit=10" \
  -H "Cookie: token=YOUR_JWT_TOKEN"
```

### Step 3: Update Employee Salary
```bash
curl -X PATCH http://localhost:3000/api/admin/employees/1/salary \
  -H "Content-Type: application/json" \
  -H "Cookie: token=YOUR_JWT_TOKEN" \
  -d '{
    "salary": 30000,
    "notes": "Annual increment"
  }'
```

### Step 4: Get Statistics
```bash
curl -X GET http://localhost:3000/api/admin/employees/statistics \
  -H "Cookie: token=YOUR_JWT_TOKEN"
```

---

## Features Summary

✅ Complete CRUD operations for employees
✅ Link employees to User accounts (userId)
✅ Store salary information (salary, salaryType)
✅ Multiple employee roles (staff, manager, supervisor, receptionist, maintenance, accountant)
✅ Employee status management (active, inactive, on_leave, terminated)
✅ Department and designation tracking
✅ Bank details and address storage
✅ Emergency contacts and qualifications
✅ Document management
✅ Working hours configuration
✅ Hostel assignment
✅ Advanced filtering and search
✅ Salary update endpoint (Admin only)
✅ Status update endpoint
✅ Comprehensive statistics
✅ Pagination support
✅ Role-based access control

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

## Notes

1. When creating an employee, both User and Employee records are created in a transaction
2. Employee code is auto-generated if not provided (format: EMP00001)
3. Deleting an employee also deletes the associated user account
4. Terminating an employee automatically sets the user status to inactive
5. Salary updates and deletions require admin privileges
6. All monetary values are stored as Float (Double precision)
7. Employee role is separate from User role for better access control


