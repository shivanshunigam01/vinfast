const mongoose = require('mongoose');

const DemoVehicleSchema = new mongoose.Schema({
  vehicleId: { type: String, unique: true, trim: true },
  model: { type: String, enum: ['VF 6', 'VF 7'], required: true },
  variant: { type: String, trim: true },
  registrationNo: { type: String, trim: true, uppercase: true },
  vinNo: { type: String, trim: true, uppercase: true },
  color: { type: String, trim: true },
  batteryPercent: { type: Number, min: 0, max: 100, default: 100 },
  currentOdometer: { type: Number, default: 0 },
  branchId: { type: mongoose.Schema.Types.ObjectId, ref: 'Branch', required: true },
  status: {
    type: String,
    enum: ['AVAILABLE', 'BOOKED', 'RUNNING', 'CHARGING', 'REPAIR', 'BATTERY_LOW', 'SERVICE_DUE'],
    default: 'AVAILABLE'
  },
  insuranceValidity: { type: Date },
  serviceDueDate: { type: Date },
  /** When the vehicle is expected back in service (repair, charging, etc.) */
  availableAgainAt: { type: Date },
  isLocked: { type: Boolean, default: false },
  lockExpiresAt: { type: Date },
  totalTestDriveKM: { type: Number, default: 0 },
  totalTestDrives: { type: Number, default: 0 },
  active: { type: Boolean, default: true }
}, { timestamps: true });

DemoVehicleSchema.pre('save', async function (next) {
  if (this.vehicleId) return next();
  const count = await mongoose.model('DemoVehicle').countDocuments();
  this.vehicleId = `VEH-${String(count + 1).padStart(4, '0')}`;
  next();
});

module.exports = mongoose.model('DemoVehicle', DemoVehicleSchema);
