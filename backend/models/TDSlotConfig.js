const mongoose = require('mongoose');

const TDSlotConfigSchema = new mongoose.Schema({
  branchId:           { type: mongoose.Schema.Types.ObjectId, ref: 'Branch', required: true },
  date:               { type: Date, required: true },
  startTime:          { type: String, default: '09:00' },
  endTime:            { type: String, default: '18:00' },
  slotDuration:       { type: Number, enum: [30, 45, 60], default: 30 },
  bufferTime:         { type: Number, default: 15 },
  maxBookingsPerSlot: { type: Number, default: 1 },
  isBlocked:          { type: Boolean, default: false },
  blockedReason:      { type: String, trim: true }
}, { timestamps: true });

module.exports = mongoose.model('TDSlotConfig', TDSlotConfigSchema);
