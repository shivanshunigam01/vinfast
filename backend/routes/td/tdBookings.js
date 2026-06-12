const express    = require('express');
const controller = require('../../controllers/tdBookingController');
const { protect, authorize } = require('../../middleware/auth');
const { protectCustomer }    = require('../../middleware/customerAuth');

const router = express.Router();

// ── Customer portal ───────────────────────────────────────────────────────────
router.get('/my',          protectCustomer, controller.getMyBookings);
router.put('/cancel/:id',  protectCustomer, controller.cancelBooking);

// ── Admin / Executive protected ───────────────────────────────────────────────
router.use(protect);

router.get('/',                controller.getBookings);
router.get('/:id',             controller.getBookingById);
router.post('/',               controller.createBooking);
router.put('/:id/confirm',     authorize('superadmin', 'manager'), controller.confirmBooking);
router.put('/:id/reschedule',  controller.rescheduleBooking);
router.put('/:id/cancel',      controller.cancelBooking);

module.exports = router;
