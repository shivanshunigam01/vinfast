const mongoose = require('mongoose');

const ChargingLogSchema = new mongoose.Schema({
  vehicleId:              { type: mongoose.Schema.Types.ObjectId, ref: 'DemoVehicle', required: true },
  startTime:              { type: Date, default: Date.now },
  startBattery:           { type: Number, required: true, min: 0, max: 100 },
  targetBattery:          { type: Number, default: 100, min: 0, max: 100 },
  expectedCompletionTime: { type: Date },
  actualCompletionTime:   { type: Date },
  chargingPoint:          { type: String, trim: true },
  status:                 { type: String, enum: ['CHARGING', 'COMPLETED'], default: 'CHARGING' },
  loggedBy:               { type: mongoose.Schema.Types.ObjectId, ref: 'Admin' }
}, { timestamps: true });

module.exports = mongoose.model('ChargingLog', ChargingLogSchema);
