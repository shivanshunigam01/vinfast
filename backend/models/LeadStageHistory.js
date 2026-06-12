const mongoose = require('mongoose');

const LeadStageHistorySchema = new mongoose.Schema({
  leadId:    { type: mongoose.Schema.Types.ObjectId, ref: 'Lead', required: true },
  bookingId: { type: mongoose.Schema.Types.ObjectId, ref: 'TDBooking' },
  fromStage: { type: String, trim: true },
  toStage:   { type: String, required: true, trim: true },
  changedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'Admin' },
  reason:    { type: String, trim: true }
}, { timestamps: true });

module.exports = mongoose.model('LeadStageHistory', LeadStageHistorySchema);
