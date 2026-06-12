const mongoose = require('mongoose');

const DrivingLicenseSchema = new mongoose.Schema({
  customerId:          { type: mongoose.Schema.Types.ObjectId, ref: 'Customer', required: true },
  dlNumber:            { type: String, trim: true },
  dlExpiry:            { type: Date },
  frontImageUrl:       { type: String },
  backImageUrl:        { type: String },
  ocrExtractedNumber:  { type: String },
  ocrExtractedExpiry:  { type: Date },
  verificationStatus:  {
    type: String,
    enum: ['PENDING', 'VERIFIED', 'REJECTED', 'MANUAL_REVIEW'],
    default: 'PENDING'
  },
  verifiedBy:          { type: mongoose.Schema.Types.ObjectId, ref: 'Admin' },
  nameMatchStatus:     { type: String, enum: ['MATCHED', 'MISMATCH', 'PENDING'], default: 'PENDING' },
  remarks:             { type: String, trim: true }
}, { timestamps: true });

module.exports = mongoose.model('DrivingLicense', DrivingLicenseSchema);
