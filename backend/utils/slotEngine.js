const TDBooking    = require('../models/TDBooking');
const TDSlotConfig = require('../models/TDSlotConfig');

const timeToMins = (str) => { const [h, m] = str.split(':').map(Number); return h * 60 + m; };
const minsToTime = (m)   => `${String(Math.floor(m / 60)).padStart(2, '0')}:${String(m % 60).padStart(2, '0')}`;

/**
 * Return available time slots for a given branch + date.
 * @param {string} branchId
 * @param {Date}   date
 * @param {number} slotDuration  in minutes (30 / 45 / 60)
 */
exports.getAvailableSlots = async (branchId, date, slotDuration = 30) => {
  const startOfDay = new Date(date); startOfDay.setHours(0, 0, 0, 0);
  const endOfDay   = new Date(date); endOfDay.setHours(23, 59, 59, 999);

  // Look for a custom config for this branch+day; fall back to defaults
  const config = await TDSlotConfig.findOne({
    branchId,
    date: { $gte: startOfDay, $lte: endOfDay }
  });

  if (config && config.isBlocked) {
    return { available: [], all: [], blocked: true, reason: config.blockedReason || 'Branch closed for this day' };
  }

  const dayStart   = timeToMins(config ? config.startTime : '09:00');
  const dayEnd     = timeToMins(config ? config.endTime   : '18:00');
  const duration   = config ? config.slotDuration  : slotDuration;
  const buffer     = config ? config.bufferTime     : 15;

  // Fetch already booked slots for this branch + day
  const existingBookings = await TDBooking.find({
    branchId,
    slotDate:      { $gte: startOfDay, $lte: endOfDay },
    bookingStatus: { $in: ['PENDING', 'CONFIRMED', 'IN_PROGRESS'] }
  }).select('slotTime slotDuration');

  const bookedMins = existingBookings.map(b => timeToMins(b.slotTime));

  const all = [];
  let cur = dayStart;

  while (cur + duration <= dayEnd) {
    const slotTime = minsToTime(cur);
    const isBooked = bookedMins.some(bm => Math.abs(cur - bm) < duration + buffer);
    all.push({ time: slotTime, available: !isBooked, duration });
    cur += duration + buffer;
  }

  return { available: all.filter(s => s.available), all, blocked: false };
};
