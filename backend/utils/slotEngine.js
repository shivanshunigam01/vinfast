const TDBooking = require('../models/TDBooking');
const TestDrive = require('../models/TestDrive');
const DemoVehicle = require('../models/DemoVehicle');
const Branch = require('../models/Branch');
const { normalizeTimeTo24h, calendarDateBounds, localTodayDateStr, toCalendarDateStr } = require('./timeFormat');
const { resolveConfiguredSlotTimes, toMinutes } = require('./slotSchedule');

function getAdminDisabledTimes(config, dateStr) {
  const raw = config?.disabledSlotsByDate;
  if (!raw || !dateStr) return [];
  if (raw instanceof Map) return raw.get(dateStr) || [];
  if (typeof raw === 'object') return raw[dateStr] || [];
  return [];
}

async function countAvailableFleet(branchId, model) {
  const now = new Date();
  const query = {
    active: true,
    branchId,
    status: 'AVAILABLE',
    $or: [{ isLocked: false }, { lockExpiresAt: { $lt: now } }]
  };
  if (model) query.model = model;
  return DemoVehicle.countDocuments(query);
}

async function buildSlotOccupancy(branchId, dateInput, branchName) {
  const bounds = calendarDateBounds(dateInput);
  if (!bounds) return {};
  const { startOfDay, endOfDay } = bounds;
  const occupancy = {};

  const tdBookings = await TDBooking.find({
    branchId,
    slotDate: { $gte: startOfDay, $lte: endOfDay },
    bookingStatus: { $nin: ['CANCELLED', 'MISSED'] }
  }).select('slotTime');

  for (const b of tdBookings) {
    const key = normalizeTimeTo24h(b.slotTime) || b.slotTime;
    occupancy[key] = (occupancy[key] || 0) + 1;
  }

  const testDriveQuery = {
    preferredDate: { $gte: startOfDay, $lte: endOfDay },
    status: { $nin: ['Cancelled'] }
  };
  if (branchName) testDriveQuery.branch = branchName;

  const testDrives = await TestDrive.find(testDriveQuery).select('preferredTime tdBookingId');
  for (const td of testDrives) {
    if (td.tdBookingId) continue;
    const key = normalizeTimeTo24h(td.preferredTime) || td.preferredTime;
    occupancy[key] = (occupancy[key] || 0) + 1;
  }

  return occupancy;
}

/**
 * Returns admin-configured slot times with live availability (bookings + fleet).
 */
async function getAvailableSlots(branchId, dateInput, config, options = {}) {
  const { maxConcurrentBookings = 2 } = config;
  const { model, excludePastForToday = true } = options;

  const bounds = calendarDateBounds(dateInput);
  if (!bounds) return [];
  const { dateStr } = bounds;

  const branch = await Branch.findById(branchId).select('name');
  const branchName = branch?.name;

  const fleetAvailable = await countAvailableFleet(branchId, model);
  const effectiveMax =
    fleetAvailable === 0 ? 0 : Math.min(maxConcurrentBookings, fleetAvailable);

  const slotOccupancy = await buildSlotOccupancy(branchId, dateStr, branchName);
  const timeKeys = resolveConfiguredSlotTimes(config);

  const now = new Date();
  const todayStr = localTodayDateStr();
  const isToday = dateStr === todayStr;
  const nowMinutes = now.getHours() * 60 + now.getMinutes();
  const forceOff = Boolean(options.forceUnavailable);

  const adminDisabled = getAdminDisabledTimes(config, dateStr);

  return timeKeys.map((timeKey) => {
    const booked = slotOccupancy[timeKey] || 0;
    const minute = toMinutes(timeKey);
    const pastSlot = isToday && excludePastForToday && minute <= nowMinutes;
    const adminOff = adminDisabled.includes(timeKey);
    const capacityFull = booked >= effectiveMax;

    return {
      time: timeKey,
      available: !forceOff && !pastSlot && !adminOff && effectiveMax > 0 && !capacityFull,
      bookings: booked,
      maxBookings: effectiveMax,
      fleetAvailable,
      past: pastSlot,
      bookable: true,
      reason: forceOff
        ? (options.unavailableReason || 'blocked')
        : adminOff
          ? 'blocked'
          : pastSlot
            ? 'past'
            : fleetAvailable === 0
              ? 'no_fleet'
              : capacityFull
                ? 'full'
                : null
    };
  });
}

async function isSlotAvailable(branchId, slotDate, slotTime, maxConcurrentBookings = 2, excludeBookingId = null, model = null) {
  const bounds = calendarDateBounds(slotDate);
  if (!bounds) return false;
  const { startOfDay, endOfDay } = bounds;
  const normalizedTime = normalizeTimeTo24h(slotTime);
  if (!normalizedTime) return false;

  const branch = await Branch.findById(branchId).select('name');
  const fleetAvailable = await countAvailableFleet(branchId, model);
  const effectiveMax =
    fleetAvailable === 0 ? 0 : Math.min(maxConcurrentBookings, fleetAvailable);
  if (effectiveMax === 0) return false;

  const tdQuery = {
    branchId,
    slotDate: { $gte: startOfDay, $lte: endOfDay },
    bookingStatus: { $nin: ['CANCELLED', 'MISSED'] }
  };
  if (excludeBookingId) tdQuery._id = { $ne: excludeBookingId };

  const tdBookings = await TDBooking.find(tdQuery).select('slotTime');
  let count = tdBookings.filter((b) => (normalizeTimeTo24h(b.slotTime) || b.slotTime) === normalizedTime).length;

  const testDriveQuery = {
    preferredDate: { $gte: startOfDay, $lte: endOfDay },
    status: { $nin: ['Cancelled'] },
    tdBookingId: { $exists: false }
  };
  if (branch?.name) testDriveQuery.branch = branch.name;

  const testDrives = await TestDrive.find(testDriveQuery).select('preferredTime');
  count += testDrives.filter((td) => (normalizeTimeTo24h(td.preferredTime) || td.preferredTime) === normalizedTime).length;

  return count < effectiveMax;
}

async function assertSlotBookable({ branchId, slotDate, slotTime, model, config }) {
  const dateStr = toCalendarDateStr(slotDate);
  if (!dateStr) {
    const err = new Error('Invalid preferred date');
    err.statusCode = 400;
    throw err;
  }
  const normalizedTime = normalizeTimeTo24h(slotTime);
  if (!normalizedTime) {
    const err = new Error('Invalid preferred time format');
    err.statusCode = 400;
    throw err;
  }

  if (config?.blockedDates?.includes(dateStr)) {
    const err = new Error('This date is not available for test drives');
    err.statusCode = 400;
    throw err;
  }

  const allowedTimes = resolveConfiguredSlotTimes(config);
  if (!allowedTimes.includes(normalizedTime)) {
    const err = new Error('This time is not offered for test drives. Please choose a listed slot.');
    err.statusCode = 400;
    throw err;
  }

  const slots = await getAvailableSlots(branchId, dateStr, config, { model });
  const slot = slots.find((s) => s.time === normalizedTime);
  if (!slot?.available) {
    const msg =
      slot?.reason === 'no_fleet'
        ? `No demo ${model || 'vehicle'} is available at the showroom for this date. Please pick another date or model.`
        : slot?.reason === 'full'
          ? 'This time slot is fully booked. Please choose another slot.'
          : slot?.reason === 'past'
            ? 'This time slot has already passed. Please choose a later slot.'
            : 'This time slot is not available. Please choose another slot.';
    const err = new Error(msg);
    err.statusCode = 409;
    throw err;
  }

  return normalizedTime;
}

module.exports = {
  getAvailableSlots,
  isSlotAvailable,
  assertSlotBookable,
  countAvailableFleet,
  getAdminDisabledTimes
};
