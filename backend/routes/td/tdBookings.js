const express = require('express');
const router = express.Router();
const ctrl = require('../../controllers/tdBookingController');
const { protect, authorize } = require('../../middleware/auth');

// Protected routes for all admin/executive roles
router.use(protect);

router.get('/executives/list', ctrl.listExecutives);
router.get('/my', ctrl.getMyBookings);
router.get('/', ctrl.getBookings);
router.get('/:id', ctrl.getBookingById);

router.post('/', ctrl.createBooking);
router.put('/:id', authorize('superadmin', 'manager'), ctrl.updateBooking);
router.patch('/:id', ctrl.updateBooking);
router.patch('/:id/cancel', ctrl.cancelBooking);
router.patch('/:id/reschedule', ctrl.rescheduleBooking);
router.patch('/:id/assign-executive', authorize('superadmin', 'manager'), ctrl.assignExecutive);

module.exports = router;
