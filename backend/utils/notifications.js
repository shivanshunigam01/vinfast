const TDNotification = require('../models/TDNotification');

const TEMPLATES = {
  BOOKING_CONFIRMED:   (d) => `Dear ${d.customerName}, your VinFast test drive is confirmed for ${d.slotDate} at ${d.slotTime}. Booking ID: ${d.bookingId}.`,
  EXECUTIVE_ASSIGNED:  (d) => `Hi ${d.executiveName}, you have a new test drive assignment. Booking ID: ${d.bookingId} at ${d.slotTime}.`,
  TD_REMINDER:         (d) => `Reminder: Your VinFast test drive is tomorrow at ${d.slotTime}. Booking: ${d.bookingId}.`,
  FEEDBACK_REQUEST:    (d) => `Hi ${d.customerName}, thank you for your VinFast test drive! Share your feedback to help us improve.`,
  VEHICLE_BATTERY_LOW: (d) => `Alert: Vehicle ${d.vehicleId} battery is at ${d.batteryPercent}%. Please arrange charging immediately.`,
  VEHICLE_IDLE_ALERT:  (d) => `Alert: Vehicle ${d.vehicleId} has been idle for ${d.idleDays} days. Please review.`,
  MISSED_BOOKING:      (d) => `Alert: Booking ${d.bookingId} was missed. Executive: ${d.executiveName}. Please follow up.`,
  TD_COMPLETED:        (d) => `Test drive for Booking ${d.bookingId} completed. CRM stage updated. Follow-up scheduled.`,
  DL_EXPIRY_WARNING:   (d) => `Warning: Customer ${d.customerName} DL expires in ${d.daysLeft} days. Please request renewal.`,
};

/**
 * Send a notification (stub — logs to console and saves to DB).
 * Wire real channels here: WhatsApp (Interakt/Twilio), SMS (MSG91), Email (Nodemailer).
 */
exports.sendNotification = async ({
  recipientType,
  recipientId = null,
  channel = 'IN_APP',
  templateKey,
  payload = {},
  bookingId = null
}) => {
  try {
    const message = TEMPLATES[templateKey]
      ? TEMPLATES[templateKey](payload)
      : `[${templateKey}] ${JSON.stringify(payload)}`;

    const notification = await TDNotification.create({
      recipientType,
      recipientId,
      channel,
      templateKey,
      payload: { ...payload, message },
      status: 'SENT',
      bookingId,
      sentAt: new Date()
    });

    console.log(`[NOTIFY] ${channel} → ${recipientType} | ${templateKey}: ${message}`);
    return notification;
  } catch (err) {
    // Non-fatal — never crash the main flow because of a notification failure
    console.error('[NOTIFY ERROR]', err.message);
    return null;
  }
};
