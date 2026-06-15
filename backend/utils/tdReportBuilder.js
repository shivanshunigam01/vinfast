const mongoose = require('mongoose');
const TDBooking = require('../models/TDBooking');
const TDLog = require('../models/TDLog');
const TDFeedback = require('../models/TDFeedback');
const DemoVehicle = require('../models/DemoVehicle');
const Customer = require('../models/Customer');
const Lead = require('../models/Lead');
const TestDrive = require('../models/TestDrive');

const CONVERTED_LEAD_STATUSES = ['Interested', 'Negotiation', 'Booked', 'Delivered'];

function buildDateFilter(from, to) {
  const dateFilter = {};
  if (from || to) {
    dateFilter.slotDate = {};
    if (from) dateFilter.slotDate.$gte = new Date(from);
    if (to) {
      const end = new Date(to);
      end.setHours(23, 59, 59, 999);
      dateFilter.slotDate.$lte = end;
    }
  }
  return dateFilter;
}

function isConvertedLead(status) {
  return CONVERTED_LEAD_STATUSES.includes(status);
}

async function buildAdminReport({ from, to, branchId } = {}) {
  const dateFilter = buildDateFilter(from, to);
  const branchFilter = branchId
    ? { branchId: new mongoose.Types.ObjectId(branchId) }
    : {};
  const baseFilter = { ...dateFilter, ...branchFilter };

  const feedbackDateFilter = {};
  if (from || to) {
    feedbackDateFilter.createdAt = {};
    if (from) feedbackDateFilter.createdAt.$gte = new Date(from);
    if (to) {
      const end = new Date(to);
      end.setHours(23, 59, 59, 999);
      feedbackDateFilter.createdAt.$lte = end;
    }
  }

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
    vehicles,
    bookings,
    feedbacks,
    logs,
    leadsFromCustomers
  ] = await Promise.all([
    TDBooking.countDocuments(baseFilter),
    TDBooking.countDocuments({ ...baseFilter, bookingStatus: 'COMPLETED' }),
    TDBooking.countDocuments({ ...baseFilter, bookingStatus: { $in: ['PENDING', 'CONFIRMED'] } }),
    TDBooking.countDocuments({ ...baseFilter, bookingStatus: 'CANCELLED' }),
    TDBooking.countDocuments({ ...baseFilter, bookingStatus: 'MISSED' }),
    TDBooking.countDocuments({ ...baseFilter, bookingStatus: 'IN_PROGRESS' }),
    Customer.countDocuments(branchFilter),
    DemoVehicle.aggregate([
      ...(branchId ? [{ $match: { branchId: new mongoose.Types.ObjectId(branchId) } }] : []),
      { $group: { _id: '$status', count: { $sum: 1 } } }
    ]),
    TDFeedback.aggregate([
      ...(Object.keys(feedbackDateFilter).length ? [{ $match: feedbackDateFilter }] : []),
      {
        $group: {
          _id: null,
          avgOverall: { $avg: '$overallRating' },
          avgPurchase: { $avg: '$purchaseIntention' },
          count: { $sum: 1 }
        }
      }
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
      {
        $group: {
          _id: '$assignedExecutive',
          total: { $sum: 1 },
          completed: { $sum: { $cond: [{ $eq: ['$bookingStatus', 'COMPLETED'] }, 1, 0] } }
        }
      },
      { $lookup: { from: 'admins', localField: '_id', foreignField: '_id', as: 'executive' } },
      { $unwind: { path: '$executive', preserveNullAndEmptyArrays: true } },
      { $project: { name: '$executive.name', total: 1, completed: 1 } },
      { $sort: { completed: -1 } },
      { $limit: 20 }
    ]),
    DemoVehicle.find(branchFilter)
      .select('vehicleId model variant registrationNo color status availableAgainAt totalTestDrives totalTestDriveKM batteryPercent branchId')
      .populate('branchId', 'name code')
      .lean(),
    TDBooking.find(baseFilter)
      .populate({
        path: 'customerId',
        select: 'name mobile email leadId customerId',
        populate: { path: 'leadId', select: 'name status model source remarks' }
      })
      .populate('vehicleId', 'vehicleId model variant registrationNo color')
      .populate('assignedExecutive', 'name email')
      .populate('testDriveId', 'remarks customerName mobile model variant status feedback feedbackRating')
      .sort({ slotDate: -1 })
      .limit(500)
      .lean(),
    TDFeedback.find(feedbackDateFilter)
      .populate('customerId', 'name mobile leadId')
      .populate({
        path: 'bookingId',
        select: 'bookingId slotDate slotTime preferredModel vehicleId assignedExecutive remarks',
        populate: [
          { path: 'vehicleId', select: 'vehicleId model registrationNo variant' },
          { path: 'assignedExecutive', select: 'name' }
        ]
      })
      .sort({ createdAt: -1 })
      .limit(200)
      .lean(),
    TDLog.find({ status: 'COMPLETED' })
      .populate('vehicleId', 'vehicleId model registrationNo')
      .populate('customerId', 'name mobile leadId')
      .populate('bookingId', 'bookingId slotDate slotTime preferredModel')
      .populate('executiveId', 'name')
      .sort({ endTime: -1 })
      .limit(200)
      .lean(),
    Customer.find({ ...branchFilter, leadId: { $exists: true, $ne: null } })
      .populate('leadId', 'name mobile status model source remarks createdAt')
      .lean()
  ]);

  const leadIds = leadsFromCustomers.map((c) => c.leadId?._id || c.leadId).filter(Boolean);
  const leadsMap = new Map();
  if (leadIds.length) {
    const leads = await Lead.find({ _id: { $in: leadIds } }).lean();
    for (const l of leads) leadsMap.set(String(l._id), l);
  }

  const feedbackByBooking = new Map();
  for (const fb of feedbacks) {
    if (fb.bookingId?._id) feedbackByBooking.set(String(fb.bookingId._id), fb);
  }

  const completionRate = totalBookings > 0 ? Math.round((completed / totalBookings) * 100) : 0;
  const vehicleStatusMap = Object.fromEntries(vehicleStats.map((v) => [v._id, v.count]));

  const completedBookings = bookings.filter((b) => b.bookingStatus === 'COMPLETED');
  let leadsCreated = 0;
  let convertedCount = 0;

  const customerTestDriveLog = bookings.map((b) => {
    const customer = b.customerId;
    const fb = feedbackByBooking.get(String(b._id));
    const lead = customer?.leadId
      ? (typeof customer.leadId === 'object' ? customer.leadId : leadsMap.get(String(customer.leadId)))
      : null;
    const leadStatus = lead?.status || null;
    const converted = leadStatus ? isConvertedLead(leadStatus) : false;
    if (b.bookingStatus === 'COMPLETED' && lead) {
      leadsCreated += 1;
      if (converted) convertedCount += 1;
    }

    return {
      bookingId: b.bookingId,
      bookingDbId: b._id,
      customerName: b.testDriveId?.customerName || customer?.name || '—',
      mobile: b.testDriveId?.mobile || customer?.mobile || '—',
      email: customer?.email || '—',
      model: b.testDriveId?.model || b.preferredModel || '—',
      variant: b.testDriveId?.variant || b.vehicleId?.variant || '—',
      vehicleLabel: b.vehicleId
        ? `${b.vehicleId.model} · ${b.vehicleId.registrationNo}`
        : 'Not assigned',
      vehicleId: b.vehicleId?.vehicleId || null,
      slotDate: b.slotDate,
      slotTime: b.slotTime,
      status: b.bookingStatus,
      executiveName: b.assignedExecutive?.name || '—',
      remarks: [b.remarks, b.testDriveId?.remarks].filter(Boolean).join(' | ') || '—',
      feedback: fb
        ? {
            overallRating: fb.overallRating,
            purchaseIntention: fb.purchaseIntention,
            drivingExperience: fb.drivingExperience,
            vehicleComfort: fb.vehicleComfort,
            batteryConfidence: fb.batteryConfidence,
            executiveBehaviour: fb.executiveBehaviour,
            preferredVariant: fb.preferredVariant,
            remarks: fb.remarks
          }
        : null,
      leadId: lead?._id || customer?.leadId || null,
      leadStatus,
      converted
    };
  });

  const vehicleWiseReport = vehicles.map((v) => {
    const vehicleBookings = bookings.filter(
      (b) => b.vehicleId && String(b.vehicleId._id || b.vehicleId) === String(v._id)
    );
    const completedForVehicle = vehicleBookings.filter((b) => b.bookingStatus === 'COMPLETED');
    const vehicleLogs = logs.filter(
      (l) => l.vehicleId && String(l.vehicleId._id || l.vehicleId) === String(v._id)
    );

    const customers = completedForVehicle.map((b) => {
      const fb = feedbackByBooking.get(String(b._id));
      const customer = b.customerId;
      const lead = customer?.leadId
        ? (typeof customer.leadId === 'object' ? customer.leadId : leadsMap.get(String(customer.leadId)))
        : null;
      const log = vehicleLogs.find((l) => String(l.bookingId?._id || l.bookingId) === String(b._id));
      return {
        name: b.testDriveId?.customerName || customer?.name || '—',
        mobile: b.testDriveId?.mobile || customer?.mobile || '—',
        slotDate: b.slotDate,
        slotTime: b.slotTime,
        bookingId: b.bookingId,
        kmDriven: log?.totalKM ?? null,
        feedbackRating: fb?.overallRating ?? null,
        purchaseIntention: fb?.purchaseIntention ?? null,
        feedbackRemarks: fb?.remarks || '—',
        executiveRemarks: log?.executiveRemarks || '—',
        leadStatus: lead?.status || null,
        converted: lead?.status ? isConvertedLead(lead.status) : false
      };
    });

    const ratings = customers.map((c) => c.feedbackRating).filter((r) => r != null);
    const avgRating = ratings.length
      ? Math.round((ratings.reduce((a, b) => a + b, 0) / ratings.length) * 10) / 10
      : null;

    return {
      vehicleId: v.vehicleId,
      registrationNo: v.registrationNo,
      model: v.model,
      variant: v.variant,
      color: v.color,
      status: v.status,
      availableAgainAt: v.availableAgainAt || null,
      batteryPercent: v.batteryPercent,
      totalTestDrives: v.totalTestDrives || completedForVehicle.length,
      totalKM: v.totalTestDriveKM || 0,
      branchName: v.branchId?.name || '—',
      avgFeedbackRating: avgRating,
      completedDrives: completedForVehicle.length,
      scheduledBookings: vehicleBookings.filter((b) =>
        ['PENDING', 'CONFIRMED', 'IN_PROGRESS'].includes(b.bookingStatus)
      ).length,
      customers
    };
  });

  const allFeedback = feedbacks.map((fb) => {
    const booking = fb.bookingId;
    const customer = fb.customerId;
    const lead = customer?.leadId
      ? (typeof customer.leadId === 'object' ? customer.leadId : leadsMap.get(String(customer.leadId)))
      : null;
    return {
      createdAt: fb.createdAt,
      customerName: customer?.name || '—',
      mobile: customer?.mobile || '—',
      bookingId: booking?.bookingId || '—',
      slotDate: booking?.slotDate,
      slotTime: booking?.slotTime,
      model: booking?.preferredModel || '—',
      vehicleLabel: booking?.vehicleId
        ? `${booking.vehicleId.model} · ${booking.vehicleId.registrationNo}`
        : 'Not assigned',
      executiveName: booking?.assignedExecutive?.name || '—',
      overallRating: fb.overallRating,
      purchaseIntention: fb.purchaseIntention,
      drivingExperience: fb.drivingExperience,
      vehicleComfort: fb.vehicleComfort,
      batteryConfidence: fb.batteryConfidence,
      executiveBehaviour: fb.executiveBehaviour,
      preferredVariant: fb.preferredVariant,
      remarks: fb.remarks || '—',
      bookingRemarks: booking?.remarks || '—',
      leadStatus: lead?.status || null,
      converted: lead?.status ? isConvertedLead(lead.status) : false
    };
  });

  const vehicleAvailability = vehicles.reduce((acc, v) => {
    const key = v.model;
    if (!acc[key]) acc[key] = { model: key, total: 0, available: 0, booked: 0, other: 0 };
    acc[key].total += 1;
    if (v.status === 'AVAILABLE') acc[key].available += 1;
    else if (v.status === 'BOOKED') acc[key].booked += 1;
    else acc[key].other += 1;
    return acc;
  }, {});

  const leadConversionRate =
    completed > 0 ? Math.round((convertedCount / completed) * 100) : 0;

  const leadByStatus = {};
  for (const c of leadsFromCustomers) {
    const status = c.leadId?.status || 'Unknown';
    leadByStatus[status] = (leadByStatus[status] || 0) + 1;
  }

  return {
    overview: {
      totalBookings,
      completed,
      pending,
      cancelled,
      missed,
      inProgress,
      totalCustomers,
      completionRate,
      leadConversionRate,
      leadsFromTestDrives: leadsCreated,
      convertedToBusiness: convertedCount,
      feedbackCount: feedbackStats[0]?.count || 0
    },
    vehicleFleet: vehicleStatusMap,
    vehicleAvailability: Object.values(vehicleAvailability),
    feedback: feedbackStats[0] || { avgOverall: 0, avgPurchase: 0, count: 0 },
    charts: {
      bookingsByStatus: Object.fromEntries(bookingsByStatus.map((x) => [x._id, x.count])),
      bookingsByModel: Object.fromEntries(bookingsByModel.map((x) => [x._id || 'Unknown', x.count])),
      bookingTrend,
      leadByStatus
    },
    executivePerformance: executivePerf,
    topFeedback: allFeedback.slice(0, 10),
    allFeedback,
    customerTestDriveLog,
    vehicleWiseReport,
    driveLogs: logs.map((l) => ({
      bookingId: l.bookingId?.bookingId,
      customerName: l.customerId?.name,
      vehicleLabel: l.vehicleId ? `${l.vehicleId.model} · ${l.vehicleId.registrationNo}` : '—',
      totalKM: l.totalKM,
      durationMinutes: l.durationMinutes,
      executiveRemarks: l.executiveRemarks || '—',
      damageNotes: l.damageNotes || '—',
      endTime: l.endTime
    }))
  };
}

module.exports = { buildAdminReport, isConvertedLead };
