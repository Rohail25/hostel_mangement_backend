const express = require('express');
const router = express.Router();
const employeeController = require('../../../controllers/api/employee.controller');
const { authenticate, authorize } = require('../../../middleware/auth.middleware');

// =================== EMPLOYEE ROUTES ===================

// All routes require authentication and admin/manager access
// Apply middleware to all routes
router.use(authenticate);
router.use(authorize('admin', 'manager'));

/**
 * @route   POST /api/admin/employees
 * @desc    Create new employee
 * @access  Admin, Manager
 * @body    { name, email, phone, password, role, employeeCode, department, designation, salary, salaryType, joinDate, ... }
 */
router.post('/employee',authenticate, authorize('admin'),  employeeController.createEmployee);

/**
 * @route   GET /api/admin/employees
 * @desc    Get all employees with filters and pagination
 * @access  Admin, Manager
 * @query   status, role, department, hostelAssigned, search, page, limit
 */
router.get('/employees', employeeController.getAllEmployees);

/**
 * @route   GET /api/admin/employees/statistics
 * @desc    Get employee statistics
 * @access  Admin, Manager
 */
router.get('/employees/statistics', employeeController.getEmployeeStatistics);

/**
 * @route   GET /api/admin/employees/:id
 * @desc    Get employee by ID
 * @access  Admin, Manager
 * @params  id - Employee ID
 */
router.get('/employee/:id', employeeController.getEmployeeById);

/**
 * @route   GET /api/admin/employees/user/:userId
 * @desc    Get employee by User ID
 * @access  Admin, Manager
 * @params  userId - User ID
 */
router.get('/employees/user/:userId', employeeController.getEmployeeByUserId);

/**
 * @route   PUT /api/admin/employees/:id
 * @desc    Update employee details
 * @access  Admin, Manager
 * @params  id - Employee ID
 * @body    { name, email, phone, role, department, designation, salary, ... }
 */
router.put('/employee/:id', employeeController.updateEmployee);

/**
 * @route   PATCH /api/admin/employees/:id/salary
 * @desc    Update employee salary
 * @access  Admin
 * @params  id - Employee ID
 * @body    { salary, salaryType, effectiveDate, notes }
 */
router.patch('/employees/:id/salary', 
    authorize('admin'), // Only admin can update salary
    employeeController.updateEmployeeSalary
);

/**
 * @route   PATCH /api/admin/employees/:id/status
 * @desc    Update employee status (active, inactive, on_leave, terminated)
 * @access  Admin, Manager
 * @params  id - Employee ID
 * @body    { status, terminationDate, notes }
 */
router.patch('/employee/:id/status', employeeController.updateEmployeeStatus);

/**
 * @route   DELETE /api/admin/employees/:id
 * @desc    Delete employee (and associated user)
 * @access  Admin
 * @params  id - Employee ID
 */
router.delete('/employee/:id',
    authorize('admin'), // Only admin can delete
    employeeController.deleteEmployee
);

module.exports = router;

