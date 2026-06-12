const mongoose = require('mongoose');

const GPSPointSchema = new mongoose.Schema({
  lat:       { type: Number },
  lng:       { type: Number },
  timestamp: { type: Date }
}, { _id: false });

const TDLogSchema = new mongoose.Schema({
  bookingId:            { type: mongoose.Schema.Types.ObjectId, ref: 'TDBooking', required: true, unique: true },
  executiveId:          { type: mongoose.Schema.Types.ObjectId, ref: 'Admin' },
  customerId:           { type: mongoose.Schema.Types.ObjectId, ref: 'Customer' },
  vehicleId:            { type: mongoose.Schema.Types.ObjectId, ref: 'DemoVehicle' },
  openingOdometer:      { type: Number },
  closingOdometer:      { type: Number },
  totalKM:              { type: Number },
  openingBattery:       { type: Number },
  closingBattery:       { type: Number },
  batteryUsed:          { type: Number },
  startTime:            { type: Date },
  endTime:              { type: Date },
  durationMinutes:      { type: Number },
  startPhotoUrl:        { type: String },
  endPhotoUrl:          { type: String },
  damageNotes:          { type: String, trim: true },
  executiveRemarks:     { type: String, trim: true },
  customerSignatureUrl: { type: String },
  gpsRoute:             [GPSPointSchema],
  customerOtpVerified:  { type: Boolean, default: false },
  status:               { type: String, enum: ['STARTED', 'COMPLETED'], default: 'STARTED' }
}, { timestamps: true });

module.exports = mongoose.model('TDLog', TDLogSchema);
