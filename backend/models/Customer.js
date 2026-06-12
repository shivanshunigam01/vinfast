const mongoose = require('mongoose');

const CustomerSchema = new mongoose.Schema({
  customerId:       { type: String, unique: true, sparse: true },
  name:             { type: String, required: true, trim: true },
  mobile:           { type: String, required: true, trim: true, unique: true },
  email:            { type: String, lowercase: true, trim: true },
  address:          { type: String, trim: true },
  city:             { type: String, trim: true },
  pinCode:          { type: String, trim: true },
  dlNumber:         { type: String, trim: true },
  dlExpiry:         { type: Date },
  preferredVehicle: { type: String, enum: ['VF 6', 'VF 7'] },
  leadId:           { type: mongoose.Schema.Types.ObjectId, ref: 'Lead' },
  branchId:         { type: mongoose.Schema.Types.ObjectId, ref: 'Branch' },
  otp:              { type: String, select: false },
  otpExpiry:        { type: Date, select: false },
  active:           { type: Boolean, default: true }
}, { timestamps: true });

// Auto-generate customerId: VIN-TD-{BRANCH}-{YEAR}-{RUNNING_NO}
CustomerSchema.pre('save', async function (next) {
  if (this.customerId) return next();

  let branchCode = 'GEN';
  if (this.branchId) {
    const branch = await mongoose.model('Branch').findById(this.branchId).lean();
    if (branch) branchCode = branch.code;
  }

  const year = new Date().getFullYear();
  const prefix = `VIN-TD-${branchCode}-${year}-`;
  const count = await mongoose.model('Customer').countDocuments({ customerId: { $regex: `^${prefix}` } });
  this.customerId = `${prefix}${String(count + 1).padStart(6, '0')}`;
  next();
});

module.exports = mongoose.model('Customer', CustomerSchema);
