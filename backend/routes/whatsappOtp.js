const express = require('express');
const router = express.Router();
const { body } = require('express-validator');
const validate = require('../middleware/validate');
const ctrl = require('../controllers/whatsappOtpController');

const sendValidation = [
  body('mobile').trim().matches(/^[6-9]\d{9}$/).withMessage('Enter a valid 10-digit mobile number'),
  body('name').optional().trim(),
];

const verifyValidation = [
  body('mobile').trim().notEmpty().withMessage('Mobile is required'),
  body('code').trim().notEmpty().withMessage('OTP code is required'),
];

router.post('/send',   validate(sendValidation),   ctrl.sendOtp);
router.post('/verify', validate(verifyValidation), ctrl.verifyOtp);

module.exports = router;
