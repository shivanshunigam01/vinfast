const express    = require('express');
const controller = require('../../controllers/tdReportController');
const { protect, authorize } = require('../../middleware/auth');

const router = express.Router();
router.use(protect);

router.get('/admin',    authorize('superadmin'),            controller.getAdminDashboard);
router.get('/manager',  authorize('superadmin', 'manager'), controller.getManagerDashboard);
router.get('/executive',                                    controller.getExecutiveDashboard);
router.get('/vehicles', authorize('superadmin', 'manager'), controller.getVehicleReport);

module.exports = router;
