const express    = require('express');
const controller = require('../../controllers/tdFeedbackController');
const { protect, authorize } = require('../../middleware/auth');
const { protectCustomer }    = require('../../middleware/customerAuth');

const router = express.Router();

// ── Customer submits feedback ─────────────────────────────────────────────────
router.post('/', protectCustomer, controller.submitFeedback);

// ── Admin views feedback ──────────────────────────────────────────────────────
router.get('/',                   protect, controller.getFeedbacks);
router.get('/booking/:bookingId', protect, controller.getFeedbackByBooking);

module.exports = router;
