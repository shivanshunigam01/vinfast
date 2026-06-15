const express = require('express');
const router = express.Router();
const ctrl = require('../../controllers/tdSlotController');
const { protect, authorize } = require('../../middleware/auth');

// Public: check available slots for a branch + date
router.get('/available', ctrl.getAvailableSlotsForDate);

router.use(protect);

router.get('/', ctrl.getAllConfigs);
router.get('/config', ctrl.getSlotConfig);
router.post('/config', authorize('superadmin', 'manager'), ctrl.upsertSlotConfig);
router.post('/block-date', authorize('superadmin', 'manager'), ctrl.blockDate);
router.post('/unblock-date', authorize('superadmin', 'manager'), ctrl.unblockDate);
router.post('/date-overrides', authorize('superadmin', 'manager'), ctrl.setDateSlotOverrides);

module.exports = router;
