const mongoose = require('mongoose');

const RepairLogSchema = new mongoose.Schema({
  vehicleId:            { type: mongoose.Schema.Types.ObjectId, ref: 'DemoVehicle', required: true },
  complaint:            { type: String, required: true, trim: true },
  repairStatus:         { type: String, enum: ['UNDER_REPAIR', 'READY', 'CLOSED'], default: 'UNDER_REPAIR' },
  workshop:             { type: String, trim: true },
  estimatedCompletion:  { type: Date },
  actualCompletion:     { type: Date },
  remarks:              { type: String, trim: true },
  loggedBy:             { type: mongoose.Schema.Types.ObjectId, ref: 'Admin' }
}, { timestamps: true });

module.exports = mongoose.model('RepairLog', RepairLogSchema);
