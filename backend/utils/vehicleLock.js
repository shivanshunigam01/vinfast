const DemoVehicle    = require('../models/DemoVehicle');
const VehicleStatusLog = require('../models/VehicleStatusLog');

const LOCK_DURATION_MS = 5 * 60 * 1000; // 5 minutes

/** Temporarily lock a vehicle while a booking is being confirmed. */
exports.lockVehicle = async (vehicleId, adminId = null) => {
  const vehicle = await DemoVehicle.findById(vehicleId);
  if (!vehicle) throw new Error(`Vehicle ${vehicleId} not found`);

  const prevStatus = vehicle.status;
  vehicle.isLocked    = true;
  vehicle.lockExpiresAt = new Date(Date.now() + LOCK_DURATION_MS);
  vehicle.status      = 'TEMP_LOCK';
  await vehicle.save();

  await VehicleStatusLog.create({
    vehicleId,
    fromStatus: prevStatus,
    toStatus:   'TEMP_LOCK',
    changedBy:  adminId,
    reason:     'Temporary lock during booking creation'
  });

  // Auto-release after lock window expires
  setTimeout(async () => {
    try {
      const v = await DemoVehicle.findById(vehicleId);
      if (v && v.isLocked && v.status === 'TEMP_LOCK') {
        await exports.releaseLock(vehicleId, null, 'Auto-released: lock expired without confirmed booking');
      }
    } catch (e) {
      console.error('[LOCK AUTO-RELEASE ERROR]', e.message);
    }
  }, LOCK_DURATION_MS);
};

/** Release a vehicle lock and mark it AVAILABLE. */
exports.releaseLock = async (vehicleId, adminId = null, reason = 'Lock released') => {
  const vehicle = await DemoVehicle.findById(vehicleId);
  if (!vehicle) return;

  const prevStatus = vehicle.status;
  vehicle.isLocked    = false;
  vehicle.lockExpiresAt = null;
  vehicle.status      = 'AVAILABLE';
  await vehicle.save();

  await VehicleStatusLog.create({
    vehicleId,
    fromStatus: prevStatus,
    toStatus:   'AVAILABLE',
    changedBy:  adminId,
    reason
  });
};

/** Generic helper to transition a vehicle to any status and log it. */
exports.updateVehicleStatus = async (vehicleId, toStatus, adminId = null, reason = '', bookingId = null) => {
  const vehicle = await DemoVehicle.findById(vehicleId);
  if (!vehicle) return null;

  const fromStatus = vehicle.status;
  vehicle.status = toStatus;

  if (!['TEMP_LOCK', 'BOOKED', 'RUNNING'].includes(toStatus)) {
    vehicle.isLocked    = false;
    vehicle.lockExpiresAt = null;
  }

  await vehicle.save();

  await VehicleStatusLog.create({ vehicleId, fromStatus, toStatus, changedBy: adminId, reason, bookingId });

  return vehicle;
};
