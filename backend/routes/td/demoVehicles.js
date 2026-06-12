const express    = require('express');
const controller = require('../../controllers/demoVehicleController');
const { protect, authorize } = require('../../middleware/auth');

const router = express.Router();

// ── Public (no auth) ──────────────────────────────────────────────────────────
router.get('/available', controller.getAvailableVehicles);

// ── Admin protected ───────────────────────────────────────────────────────────
router.use(protect);

router.get('/',              controller.getVehicles);
router.get('/:id',           controller.getVehicleById);
router.post('/',             authorize('superadmin', 'manager'), controller.createVehicle);
router.put('/:id/status',    controller.updateStatus);
router.put('/:id',           authorize('superadmin', 'manager'), controller.updateVehicle);
router.delete('/:id',        authorize('superadmin'),            controller.deleteVehicle);

module.exports = router;
