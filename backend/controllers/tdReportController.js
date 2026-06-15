const TDBooking = require('../models/TDBooking');
const TDLog = require('../models/TDLog');
const TDFeedback = require('../models/TDFeedback');
const DemoVehicle = require('../models/DemoVehicle');
const Customer = require('../models/Customer');
const asyncHandler = require('../utils/asyncHandler');
const { syncUnlinkedTestDrives } = require('../utils/syncTestDriveBooking');
const { buildAdminReport } = require('../utils/tdReportBuilder');

exports.getAdminDashboard = asyncHandler(async (req, res) => {
  const data = await buildAdminReport({
    from: req.query.from,
    to: req.query.to,
    branchId: req.query.branchId
  });
  res.json({ success: true, data });
});

exports.getManagerDashboard = asyncHandler(async (req, res) => {
  await syncUnlinkedTestDrives().catch((err) => {
    console.error('[getManagerDashboard] TD sync backfill failed:', err.message);
  });

  const { branchId } = req.query;
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const tomorrow = new Date(today);
  tomorrow.setDate(tomorrow.getDate() + 1);

  const branchFilter = branchId ? { branchId } : {};

  const [todayBookings, upcomingBookings, missedBookings, vehicles, execPerf] = await Promise.all([
    TDBooking.find({ ...branchFilter, slotDate: { $gte: today, $lt: tomorrow } })
      .populate('customerId', 'name mobile')
      .populate('assignedExecutive', 'name')
      .populate('vehicleId', 'vehicleId model')
      .sort({ slotTime: 1 }),
    TDBooking.countDocuments({ ...branchFilter, slotDate: { $gte: tomorrow }, bookingStatus: { $in: ['PENDING', 'CONFIRMED'] } }),
    TDBooking.countDocuments({ ...branchFilter, slotDate: { $gte: today, $lt: tomorrow }, bookingStatus: 'MISSED' }),
    DemoVehicle.find(branchFilter ? { branchId } : {}).select('vehicleId model status batteryPercent'),
    TDBooking.aggregate([
      { $match: { ...branchFilter, bookingStatus: { $in: ['COMPLETED', 'CANCELLED', 'MISSED'] } } },
      { $group: { _id: '$assignedExecutive', total: { $sum: 1 }, completed: { $sum: { $cond: [{ $eq: ['$bookingStatus', 'COMPLETED'] }, 1, 0] } } } },
      { $lookup: { from: 'admins', localField: '_id', foreignField: '_id', as: 'exec' } },
      { $unwind: { path: '$exec', preserveNullAndEmptyArrays: true } },
      { $project: { name: '$exec.name', total: 1, completed: 1 } }
    ])
  ]);

  res.json({
    success: true,
    data: { todayBookings, upcomingBookings, missedBookings, vehicles, execPerf }
  });
});

exports.getExecutiveDashboard = asyncHandler(async (req, res) => {
  const execId = req.admin._id;
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const tomorrow = new Date(today);
  tomorrow.setDate(tomorrow.getDate() + 1);

  const [todayTDs, upcomingTDs, completedTotal, pendingFeedback] = await Promise.all([
    TDBooking.find({ assignedExecutive: execId, slotDate: { $gte: today, $lt: tomorrow } })
      .populate('customerId', 'name mobile')
      .populate('vehicleId', 'vehicleId model')
      .sort({ slotTime: 1 }),
    TDBooking.find({ assignedExecutive: execId, slotDate: { $gte: tomorrow }, bookingStatus: { $in: ['PENDING', 'CONFIRMED'] } })
      .populate('customerId', 'name mobile')
      .sort({ slotDate: 1 }).limit(5),
    TDBooking.countDocuments({ assignedExecutive: execId, bookingStatus: 'COMPLETED' }),
    TDBooking.countDocuments({
      assignedExecutive: execId,
      bookingStatus: 'COMPLETED',
      _id: { $nin: (await TDFeedback.distinct('bookingId')) }
    })
  ]);

  const conversionRate = completedTotal > 0 ? completedTotal : 0;

  res.json({
    success: true,
    data: { todayTDs, upcomingTDs, completedTotal, pendingFeedback, conversionRate }
  });
});
