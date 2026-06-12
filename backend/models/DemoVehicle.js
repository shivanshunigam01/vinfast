const mongoose = require('mongoose');

const DemoVehicleSchema = new mongoose.Schema({
  vehicleId:          { type: String, unique: true, sparse: true },
  model:              { type: String, enum: ['VF 6', 'VF 7'], required: true },
  variant:            { type: String, trim: true },
  registrationNo:     { type: String, required: true, trim: true, unique: true },
  vinNo:              { type: String, trim: true },
  batteryPercent:     { type: Number, min: 0, max: 100, default: 100 },
  currentOdometer:    { type: Number, default: 0 },
  branchId:           { type: mongoose.Schema.Types.ObjectId, ref: 'Branch', required: true },
  status: {
    type: String,
    enum: ['AVAILABLE', 'BOOKED', 'RUNNING', 'CHARGING', 'REPAIR', 'BATTERY_LOW', 'SERVICE_DUE', 'TEMP_LOCK'],
    default: 'AVAILABLE'
  },
  color:              { type: String, trim: true },
  insuranceValidity:  { type: Date },
  serviceDueDate:     { type: Date },
  totalTestDriveKM:   { type: Number, default: 0 },
  totalTestDrives:    { type: Number, default: 0 },
  isLocked:           { type: Boolean, default: false },
  lockExpiresAt:      { type: Date },
  active:             { type: Boolean, default: true }
}, { timestamps: true });

// Auto-generate vehicleId
DemoVehicleSchema.pre('save', async function (next) {
  if (this.vehicleId) return next();
  const count = await mongoose.model('DemoVehicle').countDocuments();
  this.vehicleId = `VEH-${String(count + 1).padStart(4, '0')}`;
  next();
});

module.exports = mongoose.model('DemoVehicle', DemoVehicleSchema);
