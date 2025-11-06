const express = require("express");
const router = express.Router();
const {
  authenticate,
  authorize,
} = require("../../../middleware/auth.middleware");
const ctrl = require("../../../controllers/api/campaign.controller");

// Protected admin routes
router.post(
  "/campaign",
  authenticate,
  authorize("admin", "manager"),
  ctrl.createCampaign
);
router.get(
  "/campaign",
  authenticate,
  authorize("admin", "manager"),
  ctrl.listCampaigns
);
router.post(
  "/campaign/send/:id",
  authenticate,
  authorize("admin", "manager"),
  ctrl.sendCampaign
);
router.get(
  "/campaign/logs/:id",
  authenticate,
  authorize("admin", "manager"),
  ctrl.getLogs
);

// Public webhooks (no auth)
router.post(
  "/webhooks/twilio/whatsapp-status",
  express.urlencoded({ extended: false }),
  ctrl.twilioStatusWebhook
);
router.post(
  "/webhooks/twilio/whatsapp-inbound",
  express.urlencoded({ extended: false }),
  ctrl.twilioInboundWebhook
);

module.exports = router;
