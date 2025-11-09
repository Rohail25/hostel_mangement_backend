// ===============================
// Owner Management Routes
// ===============================

const express = require('express');
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

// Admin operations
router.post('/owners', authenticate, authorize('admin'), createOwner);
router.get('/owners', authenticate, authorize('admin'), listOwners);
router.put('/owners/:id', authenticate, authorize('admin', 'owner'), updateOwner);
router.delete('/owners/:id', authenticate, authorize('admin'), deleteOwner);

// Dashboards & self-service
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
router.get('/owners/:id', authenticate, authorize('admin', 'owner'), getOwnerById);
router.get('/owners/:id/dashboard', authenticate, authorize('admin', 'owner'), getOwnerDashboard);

module.exports = router;

