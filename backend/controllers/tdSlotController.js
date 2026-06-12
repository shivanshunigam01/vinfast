const TDSlotConfig = require('../models/TDSlotConfig');
const asyncHandler = require('../utils/asyncHandler');
const ApiError     = require('../utils/ApiError');
const { getAvailableSlots } = require('../utils/slotEngine');

exports.getAvailableSlots = asyncHandler(async (req, res) => {
  const { branchId, date, slotDuration } = req.query;
  if (!branchId || !date) throw new ApiError(400, 'branchId and date are required');

  const result = await getAvailableSlots(branchId, new Date(date), parseInt(slotDuration) || 30);
  res.json({ success: true, data: result });
});

exports.getSlotConfigs = asyncHandler(async (req, res) => {
  const query = {};
  if (req.query.branchId) query.branchId = req.query.branchId;

  const configs = await TDSlotConfig.find(query)
    .populate('branchId', 'name code')
    .sort({ date: 1 });
  res.json({ success: true, data: configs });
});

exports.createSlotConfig = asyncHandler(async (req, res) => {
  const config = await TDSlotConfig.create(req.body);
  res.status(201).json({ success: true, data: config });
});

exports.updateSlotConfig = asyncHandler(async (req, res) => {
  const config = await TDSlotConfig.findByIdAndUpdate(req.params.id, req.body, { new: true, runValidators: true });
  if (!config) throw new ApiError(404, 'Slot config not found');
  res.json({ success: true, data: config });
});

exports.blockSlot = asyncHandler(async (req, res) => {
  const { branchId, date, reason } = req.body;
  if (!branchId || !date) throw new ApiError(400, 'branchId and date are required');

  const config = await TDSlotConfig.findOneAndUpdate(
    { branchId, date: new Date(date) },
    { isBlocked: true, blockedReason: reason || 'Blocked by admin', branchId, date: new Date(date) },
    { new: true, upsert: true, setDefaultsOnInsert: true }
  );
  res.json({ success: true, data: config, message: 'Slot blocked successfully' });
});
