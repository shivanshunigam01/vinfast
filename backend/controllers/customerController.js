const jwt          = require('jsonwebtoken');
const Customer     = require('../models/Customer');
const asyncHandler = require('../utils/asyncHandler');
const ApiError     = require('../utils/ApiError');
const { getPagination, buildPaginatedResponse } = require('../utils/pagination');

const generateOTP = () => String(Math.floor(100000 + Math.random() * 900000));

exports.registerCustomer = asyncHandler(async (req, res) => {
  const existing = await Customer.findOne({ mobile: req.body.mobile });
  if (existing) throw new ApiError(409, 'A customer with this mobile number already exists');

  const customer = await Customer.create(req.body);
  res.status(201).json({
    success: true,
    message: 'Customer registered successfully',
    data: { _id: customer._id, customerId: customer.customerId, name: customer.name, mobile: customer.mobile }
  });
});

exports.loginCustomer = asyncHandler(async (req, res) => {
  const { mobile } = req.body;
  if (!mobile) throw new ApiError(400, 'Mobile number is required');

  let customer = await Customer.findOne({ mobile, active: true }).select('+otp +otpExpiry');
  if (!customer) {
    // Minimal auto-create so the customer can start a journey
    customer = await Customer.create({ name: `User-${mobile.slice(-4)}`, mobile });
    customer = await Customer.findById(customer._id).select('+otp +otpExpiry');
  }

  const otp = generateOTP();
  customer.otp       = otp;
  customer.otpExpiry = new Date(Date.now() + 10 * 60 * 1000); // 10 min
  await customer.save();

  // TODO: send OTP via SMS / WhatsApp
  console.log(`[OTP] ${mobile} → ${otp}`);

  res.json({
    success: true,
    message: 'OTP sent to your mobile number',
    ...(process.env.NODE_ENV !== 'production' && { otp }) // expose in dev/test only
  });
});

exports.verifyOtp = asyncHandler(async (req, res) => {
  const { mobile, otp } = req.body;
  if (!mobile || !otp) throw new ApiError(400, 'Mobile and OTP are required');

  const customer = await Customer.findOne({ mobile, active: true }).select('+otp +otpExpiry');
  if (!customer)             throw new ApiError(404, 'Customer not found');
  if (customer.otp !== otp)  throw new ApiError(400, 'Invalid OTP');
  if (customer.otpExpiry < new Date()) throw new ApiError(400, 'OTP has expired. Please request a new one.');

  customer.otp       = undefined;
  customer.otpExpiry = undefined;
  await customer.save();

  const token = jwt.sign({ id: customer._id, type: 'customer' }, process.env.JWT_SECRET, { expiresIn: '30d' });

  res.json({
    success: true,
    message: 'OTP verified successfully',
    token,
    customer: { _id: customer._id, customerId: customer.customerId, name: customer.name, mobile: customer.mobile }
  });
});

exports.getCustomers = asyncHandler(async (req, res) => {
  const { page, limit, skip } = getPagination(req);
  const query = {};

  if (req.query.search) {
    const rx = new RegExp(req.query.search.trim(), 'i');
    query.$or = [{ name: rx }, { mobile: rx }, { email: rx }, { customerId: rx }];
  }
  if (req.query.branchId) query.branchId = req.query.branchId;

  const [docs, total] = await Promise.all([
    Customer.find(query).populate('branchId', 'name code').sort({ createdAt: -1 }).skip(skip).limit(limit),
    Customer.countDocuments(query)
  ]);

  res.json({ success: true, ...buildPaginatedResponse({ docs, total, page, limit }) });
});

exports.getCustomerById = asyncHandler(async (req, res) => {
  const customer = await Customer.findById(req.params.id)
    .populate('branchId', 'name code')
    .populate('leadId', 'name mobile status');
  if (!customer) throw new ApiError(404, 'Customer not found');
  res.json({ success: true, data: customer });
});

exports.updateCustomer = asyncHandler(async (req, res) => {
  const customer = await Customer.findByIdAndUpdate(req.params.id, req.body, { new: true, runValidators: true })
    .populate('branchId', 'name code');
  if (!customer) throw new ApiError(404, 'Customer not found');
  res.json({ success: true, data: customer });
});

exports.getMyProfile = asyncHandler(async (req, res) => {
  const customer = await Customer.findById(req.customer._id).populate('branchId', 'name code');
  if (!customer) throw new ApiError(404, 'Customer not found');
  res.json({ success: true, data: customer });
});
