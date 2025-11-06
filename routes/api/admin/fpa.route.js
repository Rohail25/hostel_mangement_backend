const express = require('express');
const router = express.Router();
const { generateFPASummary, printFPAReport } = require('../../../controllers/api/fpa.controller');
const { authenticate, authorize } = require('../../../middleware/auth.middleware');

// ✅ Generate Monthly Financial Summary (calculations only)
router.get(
  '/fpa/summary',
  authenticate,
  authorize('admin', 'manager'),
  generateFPASummary
);

// ✅ Generate and Download PDF Report
router.get(
  '/fpa/print',
  authenticate,
  authorize('admin', 'manager'),
  printFPAReport
);

module.exports = router;
