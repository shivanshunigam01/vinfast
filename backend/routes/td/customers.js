const express    = require('express');
const controller = require('../../controllers/customerController');
const { protect, authorize }    = require('../../middleware/auth');
const { protectCustomer }       = require('../../middleware/customerAuth');

const router = express.Router();

// ── Public / Customer auth (no JWT required) ──────────────────────────────────
router.post('/register',   controller.registerCustomer);
router.post('/login',      controller.loginCustomer);
router.post('/verify-otp', controller.verifyOtp);

// ── Customer protected ────────────────────────────────────────────────────────
router.get('/me', protectCustomer, controller.getMyProfile);

// ── Admin protected ───────────────────────────────────────────────────────────
router.get('/',    protect, authorize('superadmin', 'manager', 'executive'), controller.getCustomers);
router.get('/:id', protect, authorize('superadmin', 'manager', 'executive'), controller.getCustomerById);
router.put('/:id', protect, authorize('superadmin', 'manager'),              controller.updateCustomer);

module.exports = { router };
