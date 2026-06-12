const mongoose = require('mongoose');

const TDBookingSchema = new mongoose.Schema({
  bookingId:          { type: String, unique: true, sparse: true },
  customerId:         { type: mongoose.Schema.Types.ObjectId, ref: 'Customer', required: true },
  vehicleId:          { type: mongoose.Schema.Types.ObjectId, ref: 'DemoVehicle', required: true },
  branchId:           { type: mongoose.Schema.Types.ObjectId, ref: 'Branch', required: true },
  assignedExecutive:  { type: mongoose.Schema.Types.ObjectId, ref: 'Admin' },
  slotDate:           { type: Date, required: true },
  slotTime:           { type: String, required: true },
  slotDuration:       { type: Number, enum: [30, 45, 60], default: 30 },
  bookingStatus: {
    type: String,
    enum: ['PENDING', 'CONFIRMED', 'IN_PROGRESS', 'COMPLETED', 'CANCELLED', 'RESCHEDULED', 'MISSED'],
    default: 'PENDING'
  },
  dlVerified:         { type: Boolean, default: false },
  confirmationSentAt: { type: Date },
  reminderSentAt:     { type: Date },
  rescheduleCount:    { type: Number, default: 0 },
  cancelReason:       { type: String, trim: true },
  remarks:            { type: String, trim: true }
}, { timestamps: true });

// Auto-generate bookingId: TDB-{YEAR}-{RUNNING_NO}
TDBookingSchema.pre('save', async function (next) {
  if (this.bookingId) return next();
  const year = new Date().getFullYear();
  const count = await mongoose.model('TDBooking').countDocuments();
  this.bookingId = `TDB-${year}-${String(count + 1).padStart(5, '0')}`;
  next();
});

module.exports = mongoose.model('TDBooking', TDBookingSchema);
