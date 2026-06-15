const TDBooking = require('../models/TDBooking');
const TDLog = require('../models/TDLog');
const TDFeedback = require('../models/TDFeedback');
const DemoVehicle = require('../models/DemoVehicle');
const Customer = require('../models/Customer');
const asyncHandler = require('../utils/asyncHandler');
const { syncUnlinkedTestDrives } = require('../utils/syncTestDriveBooking');

exports.getAdminDashboard = asyncHandler(async (req, res) => {
  const { from, to, branchId } = req.query;
  const dateFilter = {};
  if (from || to) {
    dateFilter.slotDate = {};
    if (from) dateFilter.slotDate.$gte = new Date(from);
    if (to) dateFilter.slotDate.$lte = new Date(to);
  }
  const branchFilter = branchId ? { branchId } : {};
  const baseFilter = { ...dateFilter, ...branchFilter };

  const [
    totalBookings,
    completed,
    pending,
    cancelled,
    missed,
    inProgress,
    totalCustomers,
    vehicleStats,
    feedbackStats,
    bookingsByStatus,
    bookingsByModel,
    bookingTrend,
    executivePerf,
    topFeedback
  ] = await Promise.all([
    TDBooking.countDocuments(baseFilter),
    TDBooking.countDocuments({ ...baseFilter, bookingStatus: 'COMPLETED' }),
    TDBooking.countDocuments({ ...baseFilter, bookingStatus: { $in: ['PENDING', 'CONFIRMED'] } }),
    TDBooking.countDocuments({ ...baseFilter, bookingStatus: 'CANCELLED' }),
    TDBooking.countDocuments({ ...baseFilter, bookingStatus: 'MISSED' }),
    TDBooking.countDocuments({ ...baseFilter, bookingStatus: 'IN_PROGRESS' }),
    Customer.countDocuments(branchFilter),
    DemoVehicle.aggregate([
      ...(branchId ? [{ $match: { branchId: require('mongoose').Types.ObjectId.createFromHexString(branchId) } }] : []),
      { $group: { _id: '$status', count: { $sum: 1 } } }
    ]),
    TDFeedback.aggregate([
      { $group: { _id: null, avgOverall: { $avg: '$overallRating' }, count: { $sum: 1 } } }
    ]),
    TDBooking.aggregate([
      { $match: baseFilter },
      { $group: { _id: '$bookingStatus', count: { $sum: 1 } } }
    ]),
    TDBooking.aggregate([
      { $match: baseFilter },
      { $group: { _id: '$preferredModel', count: { $sum: 1 } } }
    ]),
    TDBooking.aggregate([
      { $match: baseFilter },
      { $group: { _id: { $dateToString: { format: '%Y-%m-%d', date: '$slotDate' } }, count: { $sum: 1 } } },
      { $sort: { _id: 1 } },
      { $limit: 30 }
    ]),
    TDBooking.aggregate([
      { $match: { ...baseFilter, assignedExecutive: { $exists: true } } },
      { $group: { _id: '$assignedExecutive', total: { $sum: 1 }, completed: { $sum: { $cond: [{ $eq: ['$bookingStatus', 'COMPLETED'] }, 1, 0] } } } },
      { $lookup: { from: 'admins', localField: '_id', foreignField: '_id', as: 'executive' } },
      { $unwind: { path: '$executive', preserveNullAndEmptyArrays: true } },
      { $project: { name: '$executive.name', total: 1, completed: 1 } },
      { $sort: { completed: -1 } },
      { $limit: 10 }
    ]),
    TDFeedback.find().populate('customerId', 'name').sort({ overallRating: -1 }).limit(5)
  ]);

  const conversionRate = totalBookings > 0 ? Math.round((completed / totalBookings) * 100) : 0;
  const vehicleStatusMap = Object.fromEntries(vehicleStats.map((v) => [v._id, v.count]));

  res.json({
    success: true,
    data: {
      overview: { totalBookings, completed, pending, cancelled, missed, inProgress, totalCustomers, conversionRate },
      vehicleFleet: vehicleStatusMap,
      feedback: feedbackStats[0] || { avgOverall: 0, count: 0 },
      charts: {
        bookingsByStatus: Object.fromEntries(bookingsByStatus.map((x) => [x._id, x.count])),
        bookingsByModel: Object.fromEntries(bookingsByModel.map((x) => [x._id || 'Unknown', x.count])),
        bookingTrend,
      },
      executivePerformance: executivePerf,
      topFeedback
    }
  });
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
