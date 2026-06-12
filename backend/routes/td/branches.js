const express    = require('express');
const controller = require('../../controllers/branchController');
const { protect, authorize } = require('../../middleware/auth');

const router = express.Router();
router.use(protect);

router.get('/',     controller.getBranches);
router.get('/:id',  controller.getBranchById);
router.post('/',    authorize('superadmin', 'manager'), controller.createBranch);
router.put('/:id',  authorize('superadmin', 'manager'), controller.updateBranch);
router.delete('/:id', authorize('superadmin'),          controller.deleteBranch);

module.exports = router;
