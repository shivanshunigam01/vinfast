const TDLog              = require('../models/TDLog');
const TDBooking          = require('../models/TDBooking');
const DemoVehicle        = require('../models/DemoVehicle');
const Customer           = require('../models/Customer');
const Lead               = require('../models/Lead');
const LeadStageHistory   = require('../models/LeadStageHistory');
const asyncHandler       = require('../utils/asyncHandler');
const ApiError           = require('../utils/ApiError');
const { getPagination, buildPaginatedResponse } = require('../utils/pagination');
const { updateVehicleStatus } = require('../utils/vehicleLock');
const { sendNotification }    = require('../utils/notifications');
const { checkDepletionAlerts } = require('../utils/depletionEngine');

const populateLog = (q) => q
  .populate('bookingId',   'bookingId slotDate slotTime slotDuration bookingStatus')
  .populate('executiveId', 'name email')
  .populate('customerId',  'name mobile customerId')
  .populate('vehicleId',   'vehicleId model variant registrationNo batteryPercent');

// ─── Start Test Drive ─────────────────────────────────────────────────────────

exports.startTestDrive = asyncHandler(async (req, res) => {
  const { bookingId, openingOdometer, openingBattery, startPhotoUrl, customerOtpVerified, gpsLocation } = req.body;
  if (!bookingId) throw new ApiError(400, 'bookingId is required');

  const booking = await TDBooking.findById(bookingId);
  if (!booking) throw new ApiError(404, 'Booking not found');
  if (!['CONFIRMED', 'PENDING'].includes(booking.bookingStatus)) {
    throw new ApiError(400, `Cannot start a test drive for a booking in status: ${booking.bookingStatus}`);
  }

  const existing = await TDLog.findOne({ bookingId });
  if (existing && existing.status === 'STARTED') {
    throw new ApiError(409, 'Test drive is already in progress for this booking');
  }

  const log = await TDLog.create({
    bookingId,
    executiveId:         booking.assignedExecutive || req.admin._id,
    customerId:          booking.customerId,
    vehicleId:           booking.vehicleId,
    openingOdometer:     openingOdometer || 0,
    openingBattery:      openingBattery  || 0,
    startPhotoUrl:       startPhotoUrl   || null,
    customerOtpVerified: customerOtpVerified || false,
    startTime:           new Date(),
    gpsRoute:            gpsLocation ? [{ ...gpsLocation, timestamp: new Date() }] : [],
    status:              'STARTED'
  });

  booking.bookingStatus = 'IN_PROGRESS';
  await booking.save();

  await updateVehicleStatus(booking.vehicleId, 'RUNNING', req.admin._id, 'Test drive started', booking._id);

  res.status(201).json({ success: true, data: log, message: 'Test drive started successfully' });
});

// ─── End Test Drive ───────────────────────────────────────────────────────────

exports.endTestDrive = asyncHandler(async (req, res) => {
  const log = await TDLog.findById(req.params.logId);
  if (!log)                        throw new ApiError(404, 'Test drive log not found');
  if (log.status === 'COMPLETED')  throw new ApiError(400, 'Test drive is already completed');

  const { closingOdometer, closingBattery, endPhotoUrl, damageNotes, executiveRemarks, customerSignatureUrl } = req.body;

  const endTime        = new Date();
  const totalKM        = (closingOdometer || 0) - (log.openingOdometer || 0);
  const durationMins   = Math.round((endTime - new Date(log.startTime)) / 60000);
  const batteryUsed    = (log.openingBattery || 0) - (closingBattery || 0);

  log.closingOdometer      = closingOdometer;
  log.closingBattery       = closingBattery;
  log.totalKM              = totalKM;
  log.batteryUsed          = batteryUsed;
  log.endTime              = endTime;
  log.durationMinutes      = durationMins;
  log.endPhotoUrl          = endPhotoUrl;
  log.damageNotes          = damageNotes;
  log.executiveRemarks     = executiveRemarks;
  log.customerSignatureUrl = customerSignatureUrl;
  log.status               = 'COMPLETED';
  await log.save();

  // Update booking
  const booking = await TDBooking.findById(log.bookingId);
  booking.bookingStatus = 'COMPLETED';
  await booking.save();

  // Update vehicle stats
  const vehicle = await DemoVehicle.findById(log.vehicleId);
  vehicle.currentOdometer  = closingOdometer || vehicle.currentOdometer;
  vehicle.batteryPercent   = closingBattery  || vehicle.batteryPercent;
  vehicle.totalTestDriveKM = (vehicle.totalTestDriveKM || 0) + Math.max(totalKM, 0);
  vehicle.totalTestDrives  = (vehicle.totalTestDrives  || 0) + 1;
  vehicle.isLocked         = false;
  vehicle.lockExpiresAt    = null;
  vehicle.status           = (closingBattery || 100) <= 20 ? 'BATTERY_LOW' : 'AVAILABLE';
  await vehicle.save();

  await updateVehicleStatus(vehicle._id, vehicle.status, req.admin._id, 'Test drive ended', booking._id);

  // CRM: update lead stage
  const customer = await Customer.findById(log.customerId);
  if (customer?.leadId) {
    const lead = await Lead.findById(customer.leadId);
    if (lead) {
      await LeadStageHistory.create({
        leadId:    lead._id,
        bookingId: booking._id,
        fromStage: lead.status,
        toStage:   'TEST_DRIVE_COMPLETED',
        changedBy: req.admin._id,
        reason:    'Test drive completed'
      });
      lead.status = 'Interested';
      await lead.save();
    }
  }

  // Feedback request notification
  await sendNotification({
    recipientType: 'CUSTOMER',
    recipientId:   log.customerId,
    channel:       'IN_APP',
    templateKey:   'FEEDBACK_REQUEST',
    payload:       { customerName: customer?.name || 'Customer', bookingId: booking.bookingId },
    bookingId:     booking._id
  });

  // Depletion alerts
  await checkDepletionAlerts(vehicle._id, req.admin._id);

  res.json({ success: true, data: await populateLog(TDLog.findById(log._id)), message: 'Test drive completed successfully' });
});

// ─── Queries ──────────────────────────────────────────────────────────────────

exports.getLogs = asyncHandler(async (req, res) => {
  const { page, limit, skip } = getPagination(req);
  const query = {};

  if (req.query.vehicleId)   query.vehicleId   = req.query.vehicleId;
  if (req.query.executiveId) query.executiveId = req.query.executiveId;
  if (req.admin?.role === 'executive') query.executiveId = req.admin._id;

  const [docs, total] = await Promise.all([
    populateLog(TDLog.find(query).sort({ createdAt: -1 }).skip(skip).limit(limit)),
    TDLog.countDocuments(query)
  ]);

  res.json({ success: true, ...buildPaginatedResponse({ docs, total, page, limit }) });
});

exports.getLogByBooking = asyncHandler(async (req, res) => {
  const log = await populateLog(TDLog.findOne({ bookingId: req.params.bookingId }));
  if (!log) throw new ApiError(404, 'No log found for this booking');
  res.json({ success: true, data: log });
});

exports.addGpsPoint = asyncHandler(async (req, res) => {
  const log = await TDLog.findById(req.params.logId);
  if (!log) throw new ApiError(404, 'Log not found');
  if (log.status === 'COMPLETED') throw new ApiError(400, 'Cannot add GPS point to a completed test drive');

  log.gpsRoute.push({ lat: req.body.lat, lng: req.body.lng, timestamp: new Date() });
  await log.save();

  res.json({ success: true, message: 'GPS point recorded', total: log.gpsRoute.length });
});
