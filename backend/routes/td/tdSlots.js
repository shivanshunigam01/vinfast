const express    = require('express');
const controller = require('../../controllers/tdSlotController');
const { protect, authorize } = require('../../middleware/auth');

const router = express.Router();

// ── Public: check available slots ─────────────────────────────────────────────
router.get('/available', controller.getAvailableSlots);

// ── Admin protected ───────────────────────────────────────────────────────────
router.use(protect);

router.get('/',         controller.getSlotConfigs);
router.post('/',        authorize('superadmin', 'manager'), controller.createSlotConfig);
router.post('/block',   authorize('superadmin', 'manager'), controller.blockSlot);
router.put('/:id',      authorize('superadmin', 'manager'), controller.updateSlotConfig);

module.exports = router;
