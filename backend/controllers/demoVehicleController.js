const DemoVehicle  = require('../models/DemoVehicle');
const asyncHandler = require('../utils/asyncHandler');
const ApiError     = require('../utils/ApiError');
const { getPagination, buildPaginatedResponse } = require('../utils/pagination');
const { updateVehicleStatus } = require('../utils/vehicleLock');

exports.createVehicle = asyncHandler(async (req, res) => {
  const vehicle = await DemoVehicle.create(req.body);
  res.status(201).json({ success: true, data: vehicle });
});

exports.getVehicles = asyncHandler(async (req, res) => {
  const { page, limit, skip } = getPagination(req);
  const query = {};

  if (req.query.status)   query.status   = req.query.status;
  if (req.query.branchId) query.branchId = req.query.branchId;
  if (req.query.model)    query.model    = req.query.model;
  if (req.query.active !== undefined) query.active = req.query.active === 'true';

  const [docs, total] = await Promise.all([
    DemoVehicle.find(query).populate('branchId', 'name code city').sort({ createdAt: -1 }).skip(skip).limit(limit),
    DemoVehicle.countDocuments(query)
  ]);

  res.json({ success: true, ...buildPaginatedResponse({ docs, total, page, limit }) });
});

exports.getAvailableVehicles = asyncHandler(async (req, res) => {
  const query = { status: 'AVAILABLE', isLocked: false, active: true };
  if (req.query.branchId) query.branchId = req.query.branchId;
  if (req.query.model)    query.model    = req.query.model;

  const vehicles = await DemoVehicle.find(query)
    .populate('branchId', 'name code city')
    .sort({ batteryPercent: -1 });

  res.json({ success: true, data: vehicles });
});

exports.getVehicleById = asyncHandler(async (req, res) => {
  const vehicle = await DemoVehicle.findById(req.params.id).populate('branchId', 'name code city');
  if (!vehicle) throw new ApiError(404, 'Vehicle not found');
  res.json({ success: true, data: vehicle });
});

exports.updateVehicle = asyncHandler(async (req, res) => {
  const vehicle = await DemoVehicle.findByIdAndUpdate(req.params.id, req.body, { new: true, runValidators: true })
    .populate('branchId', 'name code city');
  if (!vehicle) throw new ApiError(404, 'Vehicle not found');
  res.json({ success: true, data: vehicle });
});

exports.updateStatus = asyncHandler(async (req, res) => {
  const { status, reason } = req.body;
  if (!status) throw new ApiError(400, 'status is required');

  const vehicle = await updateVehicleStatus(req.params.id, status, req.admin._id, reason || 'Manual status update');
  if (!vehicle) throw new ApiError(404, 'Vehicle not found');

  res.json({ success: true, data: vehicle, message: `Vehicle status updated to ${status}` });
});

exports.deleteVehicle = asyncHandler(async (req, res) => {
  const vehicle = await DemoVehicle.findById(req.params.id);
  if (!vehicle) throw new ApiError(404, 'Vehicle not found');
  await vehicle.deleteOne();
  res.json({ success: true, message: 'Vehicle deleted successfully' });
});
