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

/** Vehicles physically ready right now (for live vehicle picker). */
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

/**
 * Demo cars that can serve test drives on a given date (per model).
 * Uses fleet size — not today's RUNNING/BOOKED status — so future dates stay bookable.
 */
async function countFleetCapacity(branchId, model, dateInput) {
  const query = { active: true, branchId };
  if (model) query.model = model;

  const vehicles = await DemoVehicle.find(query).select('status availableAgainAt');
  if (!vehicles.length) return 0;

  const bounds = calendarDateBounds(dateInput);
  const endOfDay = bounds?.endOfDay;

  let count = 0;
  for (const v of vehicles) {
    if (endOfDay && v.availableAgainAt && new Date(v.availableAgainAt) > endOfDay) {
      continue;
    }
    count += 1;
  }
  return count;
}

async function buildSlotOccupancy(branchId, dateInput, branchName, model) {
  const bounds = calendarDateBounds(dateInput);
  if (!bounds) return {};
  const { startOfDay, endOfDay } = bounds;
  const occupancy = {};

  const tdQuery = {
    branchId,
    slotDate: { $gte: startOfDay, $lte: endOfDay },
    bookingStatus: { $nin: ['CANCELLED', 'MISSED'] }
  };
  if (model) tdQuery.preferredModel = model;

  const tdBookings = await TDBooking.find(tdQuery).select('slotTime preferredModel');

  for (const b of tdBookings) {
    const key = normalizeTimeTo24h(b.slotTime) || b.slotTime;
    occupancy[key] = (occupancy[key] || 0) + 1;
  }

  const testDriveQuery = {
    preferredDate: { $gte: startOfDay, $lte: endOfDay },
    status: { $nin: ['Cancelled'] },
    tdBookingId: { $exists: false }
  };
  if (branchName) testDriveQuery.branch = branchName;
  if (model) testDriveQuery.model = model;

  const testDrives = await TestDrive.find(testDriveQuery).select('preferredTime model');
  for (const td of testDrives) {
    const key = normalizeTimeTo24h(td.preferredTime) || td.preferredTime;
    occupancy[key] = (occupancy[key] || 0) + 1;
  }

  return occupancy;
}

function resolveEffectiveMax(maxConcurrentBookings, fleetCapacity) {
  if (!fleetCapacity || fleetCapacity <= 0) return 0;
  return Math.min(maxConcurrentBookings || 1, fleetCapacity);
}

/**
 * Returns admin-configured slot times with live availability (bookings + fleet per model).
 */
async function getAvailableSlots(branchId, dateInput, config, options = {}) {
  const { maxConcurrentBookings = 1 } = config;
  const { model, excludePastForToday = true } = options;

  const bounds = calendarDateBounds(dateInput);
  if (!bounds) return [];
  const { dateStr } = bounds;

  const branch = await Branch.findById(branchId).select('name');
  const branchName = branch?.name;

  const fleetCapacity = await countFleetCapacity(branchId, model, dateStr);
  const effectiveMax = resolveEffectiveMax(maxConcurrentBookings, fleetCapacity);

  const slotOccupancy = await buildSlotOccupancy(branchId, dateStr, branchName, model);
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
    const capacityFull = effectiveMax > 0 && booked >= effectiveMax;

    return {
      time: timeKey,
      available: !forceOff && !pastSlot && !adminOff && effectiveMax > 0 && !capacityFull,
      bookings: booked,
      maxBookings: effectiveMax,
      fleetCapacity,
      fleetAvailable: fleetCapacity,
      past: pastSlot,
      bookable: true,
      reason: forceOff
        ? (options.unavailableReason || 'blocked')
        : adminOff
          ? 'blocked'
          : pastSlot
            ? 'past'
            : fleetCapacity === 0
              ? 'no_fleet'
              : capacityFull
                ? 'full'
                : null
    };
  });
}

async function isSlotAvailable(branchId, slotDate, slotTime, maxConcurrentBookings = 1, excludeBookingId = null, model = null) {
  const bounds = calendarDateBounds(slotDate);
  if (!bounds) return false;
  const { dateStr } = bounds;
  const normalizedTime = normalizeTimeTo24h(slotTime);
  if (!normalizedTime) return false;

  const fleetCapacity = await countFleetCapacity(branchId, model, dateStr);
  const effectiveMax = resolveEffectiveMax(maxConcurrentBookings, fleetCapacity);
  if (effectiveMax === 0) return false;

  const branch = await Branch.findById(branchId).select('name');
  const occupancy = await buildSlotOccupancy(branchId, dateStr, branch?.name, model);
  let count = occupancy[normalizedTime] || 0;

  if (excludeBookingId) {
    const excluded = await TDBooking.findById(excludeBookingId).select('slotTime preferredModel');
    if (excluded) {
      const exKey = normalizeTimeTo24h(excluded.slotTime) || excluded.slotTime;
      if (exKey === normalizedTime && (!model || excluded.preferredModel === model)) {
        count = Math.max(0, count - 1);
      }
    }
  }

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
          ? 'This time slot is fully booked for the selected model. Please choose another slot or model.'
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
  countFleetCapacity,
  getAdminDisabledTimes
};
