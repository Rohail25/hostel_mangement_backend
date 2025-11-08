const express = require('express');
const router = express.Router();

const settingsController = require('../../../controllers/api/setting/settings.controller');
const { authenticate, authorize } = require('../../../middleware/auth.middleware');

router.use(authenticate);
router.use(authorize('admin', 'manager', 'staff'));

router.get('/settings/dashboard', settingsController.getSettingsDashboard);
router.put('/settings/profile', settingsController.updateProfile);
router.put('/settings/notifications', settingsController.updateNotificationPreferences);
router.put('/settings/permissions', authorize('admin'), settingsController.updateManagerPermissions);
router.get('/settings/activity', settingsController.listActivityLogs);

router.get('/settings', authorize('admin', 'manager'), settingsController.getSettings);
router.put('/settings', authorize('admin'), settingsController.upsertSettings);

router.post('/settings/manager', authorize('admin'), settingsController.addManager);
router.get('/settings/manager', authorize('admin', 'manager'), settingsController.listManagers);
router.put('/settings/manager/:id', authorize('admin'), settingsController.updateManager);
router.delete('/settings/manager/:id', authorize('admin'), settingsController.deleteManager);

router.post('/settings/scorecard', authorize('admin', 'manager'), settingsController.addScoreCard);
router.get('/settings/scorecard', authorize('admin', 'manager'), settingsController.getScoreCards);
router.get('/settings/scorecard/summary', authorize('admin', 'manager'), settingsController.scoreSummary);

module.exports = router;

