const Admin     = require('../models/Admin');
const TDBooking = require('../models/TDBooking');

/**
 * Auto-assign the least-loaded available executive for a given slot.
 * Falls back to null if no executive is free (caller can do manual assignment).
 */
exports.autoAssignExecutive = async (branchId, slotDate, slotTime, slotDuration = 30) => {
  const executives = await Admin.find({ role: 'executive', active: true });
  if (!executives.length) return null;

  const startOfDay = new Date(slotDate); startOfDay.setHours(0, 0, 0, 0);
  const endOfDay   = new Date(slotDate); endOfDay.setHours(23, 59, 59, 999);

  const loads = await Promise.all(
    executives.map(async (exec) => {
      const [bookingsToday, slotConflict] = await Promise.all([
        TDBooking.countDocuments({
          assignedExecutive: exec._id,
          slotDate: { $gte: startOfDay, $lte: endOfDay },
          bookingStatus: { $in: ['CONFIRMED', 'PENDING', 'IN_PROGRESS'] }
        }),
        TDBooking.exists({
          assignedExecutive: exec._id,
          slotDate: { $gte: startOfDay, $lte: endOfDay },
          slotTime,
          bookingStatus: { $in: ['CONFIRMED', 'PENDING', 'IN_PROGRESS'] }
        })
      ]);
      return { exec, bookingsToday, hasConflict: !!slotConflict };
    })
  );

  const available = loads
    .filter(e => !e.hasConflict)
    .sort((a, b) => a.bookingsToday - b.bookingsToday);

  return available.length ? available[0].exec : null;
};
