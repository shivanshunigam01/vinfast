const DemoVehicle = require('../models/DemoVehicle');
const VehicleStatusLog = require('../models/VehicleStatusLog');
const ChargingLog = require('../models/ChargingLog');
const RepairLog = require('../models/RepairLog');
const asyncHandler = require('../utils/asyncHandler');
const ApiError = require('../utils/ApiError');
const { getPagination, buildPaginatedResponse } = require('../utils/pagination');

exports.createVehicle = asyncHandler(async (req, res) => {
  const vehicle = await DemoVehicle.create(req.body);
  res.status(201).json({ success: true, data: vehicle });
});

exports.getVehicles = asyncHandler(async (req, res) => {
  const { page, limit, skip } = getPagination(req);
  const query = {};
  if (req.query.branchId) query.branchId = req.query.branchId;
  if (req.query.status) query.status = req.query.status;
  if (req.query.model) query.model = req.query.model;
  if (req.query.active !== undefined) query.active = req.query.active === 'true';

  const [docs, total] = await Promise.all([
    DemoVehicle.find(query).populate('branchId', 'name code').sort({ createdAt: -1 }).skip(skip).limit(limit),
    DemoVehicle.countDocuments(query)
  ]);

  res.json({ success: true, ...buildPaginatedResponse({ docs, total, page, limit }) });
});

exports.getAvailableVehicles = asyncHandler(async (req, res) => {
  const { branchId, model, slotDate } = req.query;
  const now = new Date();

  const query = {
    active: true,
    status: 'AVAILABLE',
    $or: [{ isLocked: false }, { lockExpiresAt: { $lt: now } }]
  };

  if (branchId) query.branchId = branchId;
  if (model) query.model = model;

  const docs = await DemoVehicle.find(query).populate('branchId', 'name code').sort({ batteryPercent: -1 });
  res.json({ success: true, data: docs });
});

exports.getVehicleById = asyncHandler(async (req, res) => {
  const vehicle = await DemoVehicle.findById(req.params.id).populate('branchId', 'name code city');
  if (!vehicle) throw new ApiError(404, 'Vehicle not found');

  const [statusLogs, chargingLogs, repairLogs] = await Promise.all([
    VehicleStatusLog.find({ vehicleId: vehicle._id }).sort({ createdAt: -1 }).limit(10),
    ChargingLog.find({ vehicleId: vehicle._id }).sort({ createdAt: -1 }).limit(5),
    RepairLog.find({ vehicleId: vehicle._id }).sort({ createdAt: -1 }).limit(5)
  ]);

  res.json({ success: true, data: { ...vehicle.toObject(), statusLogs, chargingLogs, repairLogs } });
});

exports.updateVehicle = asyncHandler(async (req, res) => {
  const vehicle = await DemoVehicle.findByIdAndUpdate(req.params.id, req.body, { new: true, runValidators: true })
    .populate('branchId', 'name code');
  if (!vehicle) throw new ApiError(404, 'Vehicle not found');
  res.json({ success: true, data: vehicle });
});

exports.updateVehicleStatus = asyncHandler(async (req, res) => {
  const { status, reason, battery, odometer, availableAgainAt } = req.body;
  const vehicle = await DemoVehicle.findById(req.params.id);
  if (!vehicle) throw new ApiError(404, 'Vehicle not found');

  const prevStatus = vehicle.status;
  vehicle.status = status;
  if (battery !== undefined) vehicle.batteryPercent = battery;
  if (odometer !== undefined) vehicle.currentOdometer = odometer;

  if (status === 'AVAILABLE') {
    vehicle.availableAgainAt = undefined;
  } else if (availableAgainAt !== undefined) {
    vehicle.availableAgainAt = availableAgainAt ? new Date(availableAgainAt) : undefined;
  }

  await vehicle.save();

  await VehicleStatusLog.create({
    vehicleId: vehicle._id,
    fromStatus: prevStatus,
    toStatus: status,
    changedBy: req.admin._id,
    reason
  });

  if (status === 'CHARGING') {
    await ChargingLog.create({
      vehicleId: vehicle._id,
      startBattery: vehicle.batteryPercent,
      loggedBy: req.admin._id
    });
  }

  if (status === 'REPAIR' && reason) {
    await RepairLog.create({
      vehicleId: vehicle._id,
      complaint: reason,
      loggedBy: req.admin._id
    });
  }

  res.json({ success: true, data: vehicle, message: `Vehicle status updated to ${status}` });
});

exports.deleteVehicle = asyncHandler(async (req, res) => {
  const vehicle = await DemoVehicle.findById(req.params.id);
  if (!vehicle) throw new ApiError(404, 'Vehicle not found');
  await vehicle.deleteOne();
  res.json({ success: true, message: 'Vehicle deleted' });
});
