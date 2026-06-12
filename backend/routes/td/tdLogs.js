const express    = require('express');
const controller = require('../../controllers/tdLogController');
const { protect } = require('../../middleware/auth');

const router = express.Router();
router.use(protect);

router.get('/',                       controller.getLogs);
router.get('/booking/:bookingId',     controller.getLogByBooking);
router.post('/start',                 controller.startTestDrive);
router.put('/:logId/end',             controller.endTestDrive);
router.post('/:logId/gps',            controller.addGpsPoint);

module.exports = router;
