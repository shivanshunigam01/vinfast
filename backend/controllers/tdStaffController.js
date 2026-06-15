const Admin = require('../models/Admin');
const asyncHandler = require('../utils/asyncHandler');
const ApiError = require('../utils/ApiError');
const { getPagination } = require('../utils/pagination');
const {
  STAFF_DESIGNATIONS,
  designationLabel,
  authRoleForDesignation,
  compareByDesignation
} = require('../utils/staffRoles');

const staffSelect = 'name email role designation active createdAt updatedAt';

function toStaffDto(doc) {
  const row = doc.toObject ? doc.toObject() : doc;
  return {
    ...row,
    designationLabel: designationLabel(row.designation)
  };
}

async function fetchAssignableStaff() {
  const staff = await Admin.find({
    designation: { $in: STAFF_DESIGNATIONS },
    active: true
  })
    .select('name email role designation')
    .lean();

  const legacy = await Admin.find({
    designation: { $exists: false },
    role: { $in: ['executive', 'manager'] },
    active: true
  })
    .select('name email role designation')
    .lean();

  const merged = [...staff, ...legacy.map((u) => ({
    ...u,
    designation: u.role === 'manager' ? 'sales_manager' : 'sales_executive',
    designationLabel: u.role === 'manager' ? 'Sales Manager' : 'Sales Executive'
  }))];

  merged.sort(compareByDesignation);

  return merged.map((row) => ({
    ...row,
    designationLabel: row.designationLabel || designationLabel(row.designation)
  }));
}

exports.listStaff = asyncHandler(async (req, res) => {
  const { page, limit, skip } = getPagination(req);
  const query = { designation: { $in: STAFF_DESIGNATIONS } };

  if (req.query.active === 'true') query.active = true;
  if (req.query.active === 'false') query.active = false;
  if (req.query.designation && STAFF_DESIGNATIONS.includes(req.query.designation)) {
    query.designation = req.query.designation;
  }

  const [docs, total] = await Promise.all([
    Admin.find(query).select(staffSelect).sort({ designation: 1, name: 1 }).skip(skip).limit(limit),
    Admin.countDocuments(query)
  ]);

  res.json({
    success: true,
    data: docs.map(toStaffDto),
    pagination: { page, limit, total, pages: Math.ceil(total / limit) }
  });
});

exports.getStaffById = asyncHandler(async (req, res) => {
  const doc = await Admin.findById(req.params.id).select(staffSelect);
  if (!doc || !doc.designation) throw new ApiError(404, 'Staff user not found');
  res.json({ success: true, data: toStaffDto(doc) });
});

exports.createStaff = asyncHandler(async (req, res) => {
  const { name, email, password, designation, active = true } = req.body;

  if (!STAFF_DESIGNATIONS.includes(designation)) {
    throw new ApiError(400, 'Invalid designation');
  }

  const exists = await Admin.findOne({ email: email.toLowerCase().trim() });
  if (exists) throw new ApiError(409, 'Email already registered');

  const admin = await Admin.create({
    name: name.trim(),
    email: email.toLowerCase().trim(),
    password,
    designation,
    role: authRoleForDesignation(designation),
    active: Boolean(active)
  });

  const created = await Admin.findById(admin._id).select(staffSelect);
  res.status(201).json({ success: true, data: toStaffDto(created), message: 'User created' });
});

exports.updateStaff = asyncHandler(async (req, res) => {
  const admin = await Admin.findById(req.params.id);
  if (!admin || !admin.designation) throw new ApiError(404, 'Staff user not found');

  const { name, email, password, designation, active } = req.body;

  if (name !== undefined) admin.name = name.trim();
  if (email !== undefined) {
    const normalized = email.toLowerCase().trim();
    const dup = await Admin.findOne({ email: normalized, _id: { $ne: admin._id } });
    if (dup) throw new ApiError(409, 'Email already registered');
    admin.email = normalized;
  }
  if (password) admin.password = password;
  if (designation !== undefined) {
    if (!STAFF_DESIGNATIONS.includes(designation)) throw new ApiError(400, 'Invalid designation');
    admin.designation = designation;
    admin.role = authRoleForDesignation(designation);
  }
  if (active !== undefined) admin.active = Boolean(active);

  await admin.save();
  const updated = await Admin.findById(admin._id).select(staffSelect);
  res.json({ success: true, data: toStaffDto(updated), message: 'User updated' });
});

exports.listAssignableStaff = asyncHandler(async (_req, res) => {
  const data = await fetchAssignableStaff();
  res.json({ success: true, data });
});

exports.fetchAssignableStaff = fetchAssignableStaff;
