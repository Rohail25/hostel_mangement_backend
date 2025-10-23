// ===============================
// Tenant Routes (Admin)
// ===============================

const express = require('express');
const multer = require("multer");
const router = express.Router();
const {
    createTenant,
    getAllTenants,
    getTenantById,
    updateTenant,
    deleteTenant,
    getTenantPaymentHistory,
    getTenantFinancialSummary,
    getActiveTenants
} = require('../../../controllers/api/tenant.controller');
const { authenticate, authorize } = require('../../../middleware/auth.middleware');

// const upload = multer();
// ✅ Setup Multer storage for image upload
const storage = multer.diskStorage({
    destination: (req, file, cb) => {
      cb(null, 'uploads/tenants/'); // ensure folder exists
    },
    filename: (req, file, cb) => {
      const ext = file.originalname.split('.').pop();
      cb(null, `${Date.now()}-${file.fieldname}.${ext}`);
    }
  });
  
  const upload = multer({
    storage,
    fileFilter: (req, file, cb) => {
      const allowed = ['image/jpeg', 'image/png', 'image/jpg', 'image/webp'];
      if (allowed.includes(file.mimetype)) cb(null, true);
      else cb(new Error('Invalid file type. Only JPG, PNG, WEBP allowed.'));
    }
  });
// All routes require authentication and admin/manager role

// Create new tenant (Admin & Manager only)
router.post('/tenant', upload.single('profilePhoto'), authenticate, authorize('admin', 'manager'), createTenant);

// Get all tenants with filters and pagination (Admin & Manager only)
router.get('/tenant', authenticate, authorize('admin', 'manager'), getAllTenants);

// Get active tenants (Admin & Manager only)
router.get('/tenants/active', authenticate, authorize('admin', 'manager'), getActiveTenants);

// Get tenant payment history (Admin & Manager only)
router.get('/tenant/:id/payments', authenticate, authorize('admin', 'manager'), getTenantPaymentHistory);

// Get tenant financial summary (Admin & Manager only)
router.get('/tenant/:id/financial-summary', authenticate, authorize('admin', 'manager'), getTenantFinancialSummary);

// Get tenant by ID (Admin & Manager only)
router.get('/tenant/:id', authenticate, authorize('admin', 'manager'), getTenantById);

// Update tenant (Admin & Manager only)
router.put('/tenant/:id', upload.single('profilePhoto'), authenticate, authorize('admin', 'manager'), updateTenant);

// Delete tenant (Admin only)
router.delete('/tenant/:id', authenticate, authorize('admin'), deleteTenant);

module.exports = router;

