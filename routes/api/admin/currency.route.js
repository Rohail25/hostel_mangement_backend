/**
 * Currency Routes
 */

const express = require("express");
const router = express.Router();
const { authenticate, authorize } = require("../../../middleware/auth.middleware");
const currencyController = require("../../../controllers/api/currency.controller");

/**
 * Get user's currency
 * GET /api/admin/currency
 */
router.get("/currency", authenticate, currencyController.getUserCurrency);

/**
 * Create or update user's currency (one per user)
 * POST /api/admin/currency
 * Body: { symbol, code?, name? }
 */
router.post(
  "/currency",
  authenticate,
  currencyController.createOrUpdateCurrency
);

/**
 * Delete user's currency
 * DELETE /api/admin/currency
 */
router.delete("/currency", authenticate, currencyController.deleteCurrency);

module.exports = router;
