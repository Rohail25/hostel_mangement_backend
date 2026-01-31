// ===============================
// Employee Routes (Admin)
// ===============================

const express = require('express');
const multer = require("multer");
const path = require("path");
const fs = require("fs");
const router = express.Router();

const {
    createEmployee,
    getAllEmployees,
    getEmployeeById,
    getEmployeeByUserId,
    updateEmployee,
    updateEmployeeSalary,
    updateEmployeeStatus,
    deleteEmployee,
    getEmployeeStatistics,
    getEmployeesByHostelId,
} = require('../../../controllers/api/employee.controller');

const { authenticate, authorize } = require('../../../middleware/auth.middleware');

// ===============================
// ✅ MULTER CONFIG (profile + multiple documents)
// ===============================
const uploadsDir = path.join(__dirname, '../../../uploads/employees');

// Ensure uploads directory exists
if (!fs.existsSync(uploadsDir)) {
  fs.mkdirSync(uploadsDir, { recursive: true });
}

const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    cb(null, uploadsDir);
  },
  filename: (req, file, cb) => {
    const ext = path.extname(file.originalname);
    const base = file.fieldname + '-' + Date.now() + '-' + Math.round(Math.random() * 1E9);
    cb(null, base + ext);
  }
});

const upload = multer({
  storage,
  limits: { fileSize: 10 * 1024 * 1024 }, // 10 MB
  fileFilter: (req, file, cb) => {
    const allowed = [
      'image/jpeg', 'image/png', 'image/jpg', 'image/webp',
      'application/pdf', 'image/heic', 'application/msword', 
      'application/vnd.openxmlformats-officedocument.wordprocessingml.document'
    ];
    if (allowed.includes(file.mimetype)) cb(null, true);
    else cb(new Error('Invalid file type. Allowed: JPG, PNG, WEBP, PDF, DOC, DOCX'));
  }
});

// More flexible upload that accepts any file fields
const uploadAny = multer({
  storage,
  limits: { fileSize: 10 * 1024 * 1024 }, // 10 MB
  fileFilter: (req, file, cb) => {
    const allowed = [
      'image/jpeg', 'image/png', 'image/jpg', 'image/webp',
      'application/pdf', 'image/heic', 'application/msword', 
      'application/vnd.openxmlformats-officedocument.wordprocessingml.document'
    ];
    if (allowed.includes(file.mimetype)) cb(null, true);
    else cb(new Error('Invalid file type. Allowed: JPG, PNG, WEBP, PDF, DOC, DOCX'));
  }
});

// ===============================
// ✅ ROUTES (All protected)
// ===============================

// Create new employee (allow profilePhoto + multiple documents)
// Using uploadAny to accept any file fields dynamically
router.post(
  '/employee',
  authenticate,
  authorize('admin'),
  uploadAny.any(),
  createEmployee
);

// Get all employees (paginated + filter)
router.get('/employees', authenticate, authorize('admin', 'manager'), getAllEmployees);

// Get employee statistics
router.get('/employees/statistics', authenticate, authorize('admin', 'manager'), getEmployeeStatistics);

// Get employee by User ID
router.get('/employees/user/:userId', authenticate, authorize('admin', 'manager'), getEmployeeByUserId);

// Get employees by Hostel ID (with filtering and pagination)
router.get('/employees/hostel/:hostelId', authenticate, authorize('admin', 'manager'), getEmployeesByHostelId);

// Get employee by ID
router.get('/employee/:id', authenticate, authorize('admin', 'manager'), getEmployeeById);

// Update employee (profile + documents)
// Using uploadAny to accept any file fields dynamically
router.put(
  '/employee/:id',
  authenticate,
  authorize('admin', 'manager'),
  uploadAny.any(),
  updateEmployee
);

// Update employee salary
router.patch(
  '/employees/:id/salary',
  authenticate,
  authorize('admin'), // Only admin can update salary
  updateEmployeeSalary,
);

// Update employee status (active, inactive, on_leave, terminated)
router.patch(
  '/employee/:id/status',
  authenticate,
  authorize('admin', 'manager'),
  updateEmployeeStatus
);

// Delete employee
router.delete(
  '/employee/:id',
  authenticate,
  authorize('admin'), // Only admin can delete
  deleteEmployee,
);

module.exports = router;

