const mongoose = require('mongoose');

const TDNotificationSchema = new mongoose.Schema({
  recipientType: { type: String, enum: ['CUSTOMER', 'EXECUTIVE', 'MANAGER', 'ADMIN'], required: true },
  recipientId:   { type: mongoose.Schema.Types.ObjectId },
  channel:       { type: String, enum: ['WHATSAPP', 'SMS', 'EMAIL', 'IN_APP'], required: true },
  templateKey:   { type: String, required: true },
  payload:       { type: mongoose.Schema.Types.Mixed },
  status:        { type: String, enum: ['PENDING', 'SENT', 'FAILED'], default: 'PENDING' },
  bookingId:     { type: mongoose.Schema.Types.ObjectId, ref: 'TDBooking' },
  errorMessage:  { type: String },
  sentAt:        { type: Date }
}, { timestamps: true });

module.exports = mongoose.model('TDNotification', TDNotificationSchema);
