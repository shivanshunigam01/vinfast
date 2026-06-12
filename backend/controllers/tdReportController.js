const mongoose    = require('mongoose');
const TDBooking   = require('../models/TDBooking');
const TDLog       = require('../models/TDLog');
const TDFeedback  = require('../models/TDFeedback');
const DemoVehicle = require('../models/DemoVehicle');
const Customer    = require('../models/Customer');
const asyncHandler = require('../utils/asyncHandler');

// ─── Super Admin Dashboard ────────────────────────────────────────────────────

exports.getAdminDashboard = asyncHandler(async (req, res) => {
  const weekAgo = new Date(); weekAgo.setDate(weekAgo.getDate() - 7);

  const [
    totalBookings,
    completedTD,
    pendingTD,
    missedBookings,
    totalVehicles,
    availableVehicles,
    totalCustomers,
    bookingsThisWeek,
    vehicleStatusBreakdown,
    executivePerformance,
    feedbackStats,
    bookingsByStatus,
    bookingsByModel
  ] = await Promise.all([
    TDBooking.countDocuments(),
    TDBooking.countDocuments({ bookingStatus: 'COMPLETED' }),
    TDBooking.countDocuments({ bookingStatus: { $in: ['PENDING', 'CONFIRMED'] } }),
    TDBooking.countDocuments({ bookingStatus: 'MISSED' }),
    DemoVehicle.countDocuments({ active: true }),
    DemoVehicle.countDocuments({ status: 'AVAILABLE', active: true }),
    Customer.countDocuments({ active: true }),
    TDBooking.countDocuments({ createdAt: { $gte: weekAgo } }),

    DemoVehicle.aggregate([
      { $group: { _id: '$status', count: { $sum: 1 }, totalKM: { $sum: '$totalTestDriveKM' } } }
    ]),

    TDBooking.aggregate([
      { $match: { bookingStatus: 'COMPLETED' } },
      { $group: { _id: '$assignedExecutive', completed: { $sum: 1 } } },
      { $sort: { completed: -1 } },
      { $limit: 10 },
      { $lookup: { from: 'admins', localField: '_id', foreignField: '_id', as: 'exec' } },
      { $unwind: { path: '$exec', preserveNullAndEmpty: true } },
      { $project: { name: '$exec.name', email: '$exec.email', completed: 1 } }
    ]),

    TDFeedback.aggregate([
      { $group: {
        _id: null,
        avgOverall:           { $avg: '$overallRating' },
        avgPurchaseIntention: { $avg: '$purchaseIntention' },
        count:                { $sum: 1 }
      }}
    ]),

    TDBooking.aggregate([
      { $group: { _id: '$bookingStatus', count: { $sum: 1 } } }
    ]),

    TDBooking.aggregate([
      { $lookup: { from: 'demovehicles', localField: 'vehicleId', foreignField: '_id', as: 'vehicle' } },
      { $unwind: { path: '$vehicle', preserveNullAndEmpty: true } },
      { $group: { _id: '$vehicle.model', count: { $sum: 1 } } }
    ])
  ]);

  const conversionRate      = totalBookings   > 0 ? ((completedTD / totalBookings) * 100).toFixed(1) : 0;
  const utilizationRate     = totalVehicles   > 0 ? (((totalVehicles - availableVehicles) / totalVehicles) * 100).toFixed(1) : 0;
  const toMap = (arr) => Object.fromEntries(arr.filter(x => x._id).map(x => [x._id, x.count]));

  res.json({
    success: true,
    data: {
      overview: { totalBookings, completedTD, pendingTD, missedBookings, totalVehicles, availableVehicles, totalCustomers, bookingsThisWeek },
      rates:    { conversionRate: `${conversionRate}%`, utilizationRate: `${utilizationRate}%` },
      vehicleStatusBreakdown,
      executivePerformance,
      feedback:        feedbackStats[0] || { avgOverall: 0, avgPurchaseIntention: 0, count: 0 },
      bookingsByStatus: toMap(bookingsByStatus),
      bookingsByModel:  toMap(bookingsByModel)
    }
  });
});

// ─── Sales Manager Dashboard ─────────────────────────────────────────────────

exports.getManagerDashboard = asyncHandler(async (req, res) => {
  const branchId = req.query.branchId;
  const today    = new Date(); today.setHours(0, 0, 0, 0);
  const tomorrow = new Date(today); tomorrow.setDate(tomorrow.getDate() + 1);

  const branchFilter = branchId ? { branchId: new mongoose.Types.ObjectId(branchId) } : {};

  const [dailyBookings, execWise, vehicleStatus, missedToday] = await Promise.all([
    TDBooking.countDocuments({ ...branchFilter, slotDate: { $gte: today, $lt: tomorrow } }),

    TDBooking.aggregate([
      { $match: branchFilter },
      { $group: { _id: { exec: '$assignedExecutive', status: '$bookingStatus' }, count: { $sum: 1 } } },
      { $lookup: { from: 'admins', localField: '_id.exec', foreignField: '_id', as: 'exec' } },
      { $unwind: { path: '$exec', preserveNullAndEmpty: true } },
      { $group: {
        _id:      '$_id.exec',
        name:     { $first: '$exec.name' },
        bookings: { $push: { status: '$_id.status', count: '$count' } }
      }}
    ]),

    DemoVehicle.aggregate([
      ...(branchId ? [{ $match: { branchId: new mongoose.Types.ObjectId(branchId) } }] : []),
      { $group: { _id: '$status', count: { $sum: 1 } } }
    ]),

    TDBooking.countDocuments({ ...branchFilter, bookingStatus: 'MISSED', slotDate: { $gte: today, $lt: tomorrow } })
  ]);

  res.json({ success: true, data: { dailyBookings, execWise, vehicleStatus, missedToday } });
});

// ─── Executive Dashboard ──────────────────────────────────────────────────────

exports.getExecutiveDashboard = asyncHandler(async (req, res) => {
  const execId   = req.admin._id;
  const today    = new Date(); today.setHours(0, 0, 0, 0);
  const tomorrow = new Date(today); tomorrow.setDate(tomorrow.getDate() + 1);

  // Collect bookingIds that already have feedback
  const feedbackBookingIds = await TDFeedback.distinct('bookingId');

  const [todayTDs, upcomingTDs, pendingFeedbackCount, totalCompleted] = await Promise.all([
    TDBooking.find({
      assignedExecutive: execId,
      slotDate:      { $gte: today, $lt: tomorrow },
      bookingStatus: { $in: ['CONFIRMED', 'IN_PROGRESS'] }
    }).populate('customerId', 'name mobile').populate('vehicleId', 'model vehicleId'),

    TDBooking.find({
      assignedExecutive: execId,
      slotDate:      { $gte: tomorrow },
      bookingStatus: 'CONFIRMED'
    }).populate('customerId', 'name mobile').populate('vehicleId', 'model vehicleId').limit(10),

    TDBooking.countDocuments({
      assignedExecutive: execId,
      bookingStatus:     'COMPLETED',
      _id:               { $nin: feedbackBookingIds }
    }),

    TDBooking.countDocuments({ assignedExecutive: execId, bookingStatus: 'COMPLETED' })
  ]);

  res.json({ success: true, data: { todayTDs, upcomingTDs, pendingFeedbackCount, totalCompleted } });
});

// ─── Vehicle Report ───────────────────────────────────────────────────────────

exports.getVehicleReport = asyncHandler(async (req, res) => {
  const vehicles = await DemoVehicle.find({ active: true })
    .populate('branchId', 'name code')
    .sort({ totalTestDriveKM: -1 });
  res.json({ success: true, data: vehicles });
});
