const Branch       = require('../models/Branch');
const asyncHandler = require('../utils/asyncHandler');
const ApiError     = require('../utils/ApiError');

exports.createBranch = asyncHandler(async (req, res) => {
  const branch = await Branch.create(req.body);
  res.status(201).json({ success: true, data: branch });
});

exports.getBranches = asyncHandler(async (req, res) => {
  const branches = await Branch.find().populate('manager', 'name email role').sort({ createdAt: -1 });
  res.json({ success: true, data: branches });
});

exports.getBranchById = asyncHandler(async (req, res) => {
  const branch = await Branch.findById(req.params.id).populate('manager', 'name email role');
  if (!branch) throw new ApiError(404, 'Branch not found');
  res.json({ success: true, data: branch });
});

exports.updateBranch = asyncHandler(async (req, res) => {
  const branch = await Branch.findByIdAndUpdate(req.params.id, req.body, { new: true, runValidators: true })
    .populate('manager', 'name email role');
  if (!branch) throw new ApiError(404, 'Branch not found');
  res.json({ success: true, data: branch });
});

exports.deleteBranch = asyncHandler(async (req, res) => {
  const branch = await Branch.findById(req.params.id);
  if (!branch) throw new ApiError(404, 'Branch not found');
  await branch.deleteOne();
  res.json({ success: true, message: 'Branch deleted successfully' });
});
