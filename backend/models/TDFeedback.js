const mongoose = require('mongoose');

const TDFeedbackSchema = new mongoose.Schema({
  bookingId:          { type: mongoose.Schema.Types.ObjectId, ref: 'TDBooking', required: true, unique: true },
  customerId:         { type: mongoose.Schema.Types.ObjectId, ref: 'Customer', required: true },
  drivingExperience:  { type: Number, min: 1, max: 5 },
  vehicleComfort:     { type: Number, min: 1, max: 5 },
  batteryConfidence:  { type: Number, min: 1, max: 5 },
  executiveBehaviour: { type: Number, min: 1, max: 5 },
  purchaseIntention:  { type: Number, min: 1, max: 5 },
  preferredVariant:   { type: String, trim: true },
  remarks:            { type: String, trim: true },
  overallRating:      { type: Number }
}, { timestamps: true });

// Auto-compute overall rating
TDFeedbackSchema.pre('save', function (next) {
  const ratingFields = ['drivingExperience', 'vehicleComfort', 'batteryConfidence', 'executiveBehaviour', 'purchaseIntention'];
  const values = ratingFields.map(f => this[f]).filter(v => v != null);
  if (values.length) {
    this.overallRating = Math.round((values.reduce((a, b) => a + b, 0) / values.length) * 10) / 10;
  }
  next();
});

module.exports = mongoose.model('TDFeedback', TDFeedbackSchema);
