// ===============================
// Tenant Routes (Admin)
// ===============================

const express = require('express');
const multer = require("multer");
const path = require("path");
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

// ===============================
// ✅ MULTER CONFIG (profile + multiple documents)
// ===============================
const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    cb(null, path.join(__dirname, '../../../../uploads/tenants')); // ensure folder exists
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
      'application/pdf', 'image/heic'
    ];
    if (allowed.includes(file.mimetype)) cb(null, true);
    else cb(new Error('Invalid file type. Allowed: JPG, PNG, WEBP, PDF'));
  }
});

// ===============================
// ✅ ROUTES (All protected)
// ===============================

// Create new tenant (allow profilePhoto + multiple documents)
router.post(
  '/tenant',
  authenticate,
  authorize('admin', 'manager'),
  upload.fields([
    { name: 'profilePhoto', maxCount: 1 },
    { name: 'documents', maxCount: 10 }
  ]),
  createTenant
);

// Get all tenants (paginated + filter)
router.get('/tenant', authenticate, authorize('admin', 'manager'), getAllTenants);

// Get active tenants
router.get('/tenants/active', authenticate, authorize('admin', 'manager'), getActiveTenants);

// Get tenant payment history
router.get('/tenant/:id/payments', authenticate, authorize('admin', 'manager'), getTenantPaymentHistory);

// Get tenant financial summary
router.get('/tenant/:id/financial-summary', authenticate, authorize('admin', 'manager'), getTenantFinancialSummary);

// Get tenant by ID
router.get('/tenant/:id', authenticate, authorize('admin', 'manager'), getTenantById);

// Update tenant (profile + documents)
router.put(
  '/tenant/:id',
  authenticate,
  authorize('admin', 'manager'),
  upload.fields([
    { name: 'profilePhoto', maxCount: 1 },
    { name: 'documents', maxCount: 10 }
  ]),
  updateTenant
);

// Delete tenant
router.delete('/tenant/:id', authenticate, authorize('admin'), deleteTenant);

module.exports = router;
