const DemoVehicle      = require('../models/DemoVehicle');
const VehicleStatusLog = require('../models/VehicleStatusLog');
const { sendNotification } = require('./notifications');

const KM_THRESHOLD        = 5000;
const BATTERY_LOW_THRESH  = 20;
const IDLE_DAYS_THRESHOLD = 7;

/**
 * Run post-test-drive depletion checks and fire alerts as needed.
 * Called automatically from tdLogController after every endTestDrive.
 */
exports.checkDepletionAlerts = async (vehicleId, adminId = null) => {
  const vehicle = await DemoVehicle.findById(vehicleId);
  if (!vehicle) return [];

  const alerts = [];

  // 1. Total KM threshold
  if (vehicle.totalTestDriveKM >= KM_THRESHOLD) {
    alerts.push({ type: 'KM_THRESHOLD', vehicle: vehicle.vehicleId, km: vehicle.totalTestDriveKM });
    await sendNotification({
      recipientType: 'ADMIN',
      channel: 'IN_APP',
      templateKey: 'VEHICLE_BATTERY_LOW',
      payload: { vehicleId: vehicle.vehicleId, batteryPercent: vehicle.batteryPercent, message: `Total KM (${vehicle.totalTestDriveKM}) exceeded threshold of ${KM_THRESHOLD} km` }
    });
  }

  // 2. Battery too low
  if (vehicle.batteryPercent <= BATTERY_LOW_THRESH && vehicle.status === 'AVAILABLE') {
    alerts.push({ type: 'BATTERY_LOW', vehicle: vehicle.vehicleId, battery: vehicle.batteryPercent });

    await VehicleStatusLog.create({
      vehicleId,
      fromStatus: 'AVAILABLE',
      toStatus:   'BATTERY_LOW',
      changedBy:  adminId,
      reason:     `Auto: battery at ${vehicle.batteryPercent}% (threshold ${BATTERY_LOW_THRESH}%)`
    });

    vehicle.status = 'BATTERY_LOW';
    await vehicle.save();

    await sendNotification({
      recipientType: 'ADMIN',
      channel: 'IN_APP',
      templateKey: 'VEHICLE_BATTERY_LOW',
      payload: { vehicleId: vehicle.vehicleId, batteryPercent: vehicle.batteryPercent }
    });
  }

  // 3. Vehicle idle too long (check updatedAt)
  const idleDays = Math.floor((Date.now() - new Date(vehicle.updatedAt).getTime()) / 86400000);
  if (idleDays >= IDLE_DAYS_THRESHOLD) {
    alerts.push({ type: 'IDLE', vehicle: vehicle.vehicleId, idleDays });
    await sendNotification({
      recipientType: 'MANAGER',
      channel: 'IN_APP',
      templateKey: 'VEHICLE_IDLE_ALERT',
      payload: { vehicleId: vehicle.vehicleId, idleDays }
    });
  }

  return alerts;
};
