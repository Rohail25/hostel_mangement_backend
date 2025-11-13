// ===============================
// Owner Management Routes
// ===============================

const express = require('express');
const multer = require("multer");
const path = require("path");
const fs = require("fs");
const router = express.Router();

const {
  createOwner,
  listOwners,
  getOwnerById,
  getMyOwnerProfile,
  getOwnerDashboard,
  updateOwner,
  deleteOwner,
} = require('../../../controllers/api/owner.controller');
const { authenticate, authorize } = require('../../../middleware/auth.middleware');

// ===============================
// ✅ MULTER CONFIG (profile photo + documents upload)
// ===============================
const uploadsDir = path.join(__dirname, '../../../uploads/owners');
const documentsDir = path.join(__dirname, '../../../uploads/owners/documents');

// Ensure uploads directories exist
if (!fs.existsSync(uploadsDir)) {
  fs.mkdirSync(uploadsDir, { recursive: true });
}
if (!fs.existsSync(documentsDir)) {
  fs.mkdirSync(documentsDir, { recursive: true });
}

// Combined upload for both profile photo and documents
const upload = multer({
  storage: multer.diskStorage({
    destination: (req, file, cb) => {
      // Route to different directories based on field name
      if (file.fieldname === 'profilePhoto') {
        cb(null, uploadsDir);
      } else if (file.fieldname === 'documents') {
        cb(null, documentsDir);
      } else {
        cb(null, uploadsDir);
      }
    },
    filename: (req, file, cb) => {
      const ext = path.extname(file.originalname);
      const base = file.fieldname + '-' + Date.now() + '-' + Math.round(Math.random() * 1E9);
      cb(null, base + ext);
    }
  }),
  limits: { fileSize: 10 * 1024 * 1024 }, // 10 MB
  fileFilter: (req, file, cb) => {
    const allowed = [
      'image/jpeg', 'image/png', 'image/jpg', 'image/webp',
      'application/pdf', 'image/heic'
    ];
    if (allowed.includes(file.mimetype)) cb(null, true);
    else cb(new Error('Invalid file type. Allowed: JPG, PNG, WEBP, PDF, HEIC'));
  }
});

// Admin operations
router.post(
  '/owner',
  upload.fields([
    { name: 'profilePhoto', maxCount: 1 },
    { name: 'documents', maxCount: 10 }
  ]),
  createOwner
);

// ============================================
// CRITICAL: Owner self-service routes MUST be defined FIRST
// before any parameterized routes to ensure proper matching
// ============================================
router.get('/owners/me', authenticate, authorize('owner'), getMyOwnerProfile);
router.get(
  '/owners/me/dashboard',
  authenticate,
  authorize('owner'),
  (req, res) => {
    req.params.id = 'me';
    return getOwnerDashboard(req, res);
  }
);

// Admin operations - List all owners
router.get('/owners', authenticate, authorize('admin'), listOwners);

// Admin operations - Get/Update/Delete specific owner by ID
router.get('/owners/:id', authenticate, authorize('admin', 'owner'), getOwnerById);
router.put(
  '/owners/:id',
  authenticate,
  authorize('admin', 'owner'),
  upload.fields([
    { name: 'profilePhoto', maxCount: 1 },
    { name: 'documents', maxCount: 10 }
  ]),
  updateOwner
);
router.delete('/owners/:id', authenticate, authorize('admin'), deleteOwner);
router.get('/owners/:id/dashboard', authenticate, authorize('admin', 'owner'), getOwnerDashboard);

module.exports = router;

