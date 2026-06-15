const express = require('express');
const router = express.Router();
const ctrl = require('../../controllers/tdStaffController');
const { protect, authorize } = require('../../middleware/auth');

router.use(protect);

router.get('/assignable', ctrl.listAssignableStaff);
router.get('/', authorize('superadmin', 'manager'), ctrl.listStaff);
router.get('/:id', authorize('superadmin', 'manager'), ctrl.getStaffById);
router.post('/', authorize('superadmin', 'manager'), ctrl.createStaff);
router.put('/:id', authorize('superadmin', 'manager'), ctrl.updateStaff);
router.patch('/:id', authorize('superadmin', 'manager'), ctrl.updateStaff);

module.exports = router;
