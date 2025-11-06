const express = require("express");
const router = express.Router();
const ctrl = require("../../../controllers/api/setting.controller");
const {
  authenticate,
  authorize,
} = require("../../../middleware/auth.middleware");

// ----- PROFILE (self) -----
router.put(
  "/settings/profile/name-email",
  authenticate,
  authorize("admin", "manager"),
  ctrl.updateNameEmail
);
router.put(
  "/settings/profile/password",
  authenticate,
  authorize("admin", "manager"),
  ctrl.changePassword
);

// ----- KEY–VALUE SETTINGS -----
router.get(
  "/settings",
  authenticate,
  authorize("admin", "manager"),
  ctrl.getSettings
);
router.put("/settings", authenticate, authorize("admin"), ctrl.upsertSettings);

// ----- MANAGERS -----
router.post(
  "/settings/manager",
  authenticate,
  authorize("admin"),
  ctrl.addManager
);
router.get(
  "/settings/manager",
  authenticate,
  authorize("admin", "manager"),
  ctrl.listManagers
);
router.put(
  "/settings/manager/:id",
  authenticate,
  authorize("admin"),
  ctrl.updateManager
);
router.delete(
  "/settings/manager/:id",
  authenticate,
  authorize("admin"),
  ctrl.deleteManager
);

// ----- ACTIVITY LOGS -----
router.get(
  "/settings/logs",
  authenticate,
  authorize("admin", "manager"),
  ctrl.listActivityLogs
);

// ----- SCORE CARDS -----
router.post(
  "/settings/scorecard",
  authenticate,
  authorize("admin", "manager"),
  ctrl.addScoreCard
);
router.get(
  "/settings/scorecard",
  authenticate,
  authorize("admin", "manager"),
  ctrl.getScoreCards
);
router.get(
  "/settings/scorecard/summary",
  authenticate,
  authorize("admin", "manager"),
  ctrl.scoreSummary
);

module.exports = router;
