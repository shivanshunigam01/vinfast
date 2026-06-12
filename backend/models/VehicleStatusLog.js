const mongoose = require('mongoose');

const VehicleStatusLogSchema = new mongoose.Schema({
  vehicleId:  { type: mongoose.Schema.Types.ObjectId, ref: 'DemoVehicle', required: true },
  fromStatus: { type: String, trim: true },
  toStatus:   { type: String, required: true, trim: true },
  changedBy:  { type: mongoose.Schema.Types.ObjectId, ref: 'Admin' },
  reason:     { type: String, trim: true },
  bookingId:  { type: mongoose.Schema.Types.ObjectId, ref: 'TDBooking' }
}, { timestamps: true });

module.exports = mongoose.model('VehicleStatusLog', VehicleStatusLogSchema);
