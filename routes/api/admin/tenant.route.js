// ===============================
// Tenant Routes (Admin)
// ===============================

const express = require('express');
const multer = require("multer");
const path = require("path");
const fs = require("fs");
const router = express.Router();

const {
    createTenant,
    getAllTenants,
    getTenantById,
    updateTenant,
    deleteTenant,
    getTenantPaymentHistory,
    getTenantFinancialSummary,
    getActiveTenants,
    listTenants,
    tenantDetails,
    getTenantCurrentScore,
    getTenantScoreHistory,
    upsertTenantScore,
    getTenantsByHostelId
} = require('../../../controllers/api/tenant.controller');

const { authenticate, authorize } = require('../../../middleware/auth.middleware');

// ===============================
// ✅ MULTER CONFIG (profile + multiple documents)
// ===============================
const uploadsDir = path.join(__dirname, '../../../uploads/tenants');

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

// Create new tenant (allow profilePhoto + multiple documents)
// Using uploadAny to accept any file fields dynamically
router.post(
  '/tenant',
  authenticate,
  authorize('admin', 'manager', 'owner'),
  uploadAny.any(),
  createTenant
);

// Get all tenants (paginated + filter)
router.get('/tenant', authenticate, authorize('admin', 'manager', 'owner'), getAllTenants);

// List tenants (alternative endpoint)
router.get('/tenants', authenticate, authorize('admin', 'manager', 'owner'), listTenants);

// Get active tenants
router.get('/tenants/active', authenticate, authorize('admin', 'manager', 'owner'), getActiveTenants);

// Get tenants by hostel ID
router.get('/tenants/hostel/:hostelId', authenticate, authorize('admin', 'owner'), getTenantsByHostelId);

// Get tenant payment history
router.get('/tenant/:id/payments', authenticate, authorize('admin', 'manager', 'owner'), getTenantPaymentHistory);

// Get tenant financial summary
router.get('/tenant/:id/financial-summary', authenticate, authorize('admin', 'manager', 'owner'), getTenantFinancialSummary);

// Get tenant current score
router.get('/tenant/:id/score', authenticate, authorize('admin', 'manager', 'owner'), getTenantCurrentScore);

// Get tenant score history
router.get('/tenant/:id/score/history', authenticate, authorize('admin', 'manager', 'owner'), getTenantScoreHistory);

// Get tenant details (alternative endpoint)
router.get('/tenant/:id/details', authenticate, authorize('admin', 'manager', 'owner'), tenantDetails);

// Get tenant by ID
router.get('/tenant/:id', authenticate, authorize('admin', 'manager', 'owner'), getTenantById);

// Update tenant (profile + documents)
// Using uploadAny to accept any file fields dynamically
router.put(
  '/tenant/:id',
  authenticate,
  authorize('admin', 'manager', 'owner'),
  uploadAny.any(),
  updateTenant
);

// Upsert tenant score
router.post('/tenant/:id/score', authenticate, authorize('admin', 'manager', 'owner'), upsertTenantScore);

// Delete tenant
router.delete('/tenant/:id', authenticate, authorize('admin', 'owner'), deleteTenant);

module.exports = router;
