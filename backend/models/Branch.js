const mongoose = require('mongoose');

const BranchSchema = new mongoose.Schema({
  name:    { type: String, required: true, trim: true },
  code:    { type: String, required: true, uppercase: true, trim: true, unique: true },
  address: { type: String, trim: true },
  city:    { type: String, trim: true },
  phone:   { type: String, trim: true },
  manager: { type: mongoose.Schema.Types.ObjectId, ref: 'Admin' },
  active:  { type: Boolean, default: true }
}, { timestamps: true });

module.exports = mongoose.model('Branch', BranchSchema);
