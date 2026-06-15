const express = require('express');
const controller = require('../controllers/homepageController');
const { protect, authorize } = require('../middleware/auth');

const router = express.Router();
router.use(protect);

router.get('/dealer', controller.getAdminDealerSettings);
router.put('/dealer', authorize('superadmin', 'manager'), controller.updateDealerSettings);

module.exports = router;
