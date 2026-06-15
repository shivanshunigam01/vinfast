const ApiError = require('./ApiError');

const MANAGER_ROLES = ['superadmin', 'manager'];

function isManagerRole(admin) {
  return MANAGER_ROLES.includes(admin?.role);
}

function isAssignedToAdmin(booking, admin) {
  if (!booking?.assignedExecutive || !admin?._id) return false;
  const assignedId = booking.assignedExecutive._id || booking.assignedExecutive;
  return String(assignedId) === String(admin._id);
}

function assertBookingAccess(booking, admin) {
  if (!booking) throw new ApiError(404, 'Booking not found');
  if (isManagerRole(admin)) return;
  if (isAssignedToAdmin(booking, admin)) return;
  throw new ApiError(403, 'Access denied. This booking is not assigned to you.');
}

const STAFF_ALLOWED_UPDATES = ['bookingStatus', 'dlVerified'];

function pickStaffBookingUpdates(body) {
  const updates = {};
  for (const key of STAFF_ALLOWED_UPDATES) {
    if (body[key] !== undefined) updates[key] = body[key];
  }
  return updates;
}

module.exports = {
  MANAGER_ROLES,
  isManagerRole,
  isAssignedToAdmin,
  assertBookingAccess,
  STAFF_ALLOWED_UPDATES,
  pickStaffBookingUpdates
};
