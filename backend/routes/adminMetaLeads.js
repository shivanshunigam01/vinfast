const express = require('express');
const controller = require('../controllers/metaLeadController');
const validate = require('../middleware/validate');
const { protect } = require('../middleware/auth');
const { metaLeadCreateValidation, metaLeadUpdateValidation, metaLeadIdParam, metaLeadBulkValidation } = require('../utils/validators');

const router = express.Router();
router.use(protect);

router.post('/', validate(metaLeadCreateValidation), controller.createMetaLead);
router.post('/bulk', validate(metaLeadBulkValidation), controller.bulkCreateMetaLeads);
router.put('/:id', validate(metaLeadUpdateValidation), controller.updateMetaLead);
router.delete('/:id', validate([metaLeadIdParam()]), controller.deleteMetaLead);

module.exports = router;
