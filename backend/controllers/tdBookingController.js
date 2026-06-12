const TDBooking          = require('../models/TDBooking');
const DemoVehicle        = require('../models/DemoVehicle');
const Customer           = require('../models/Customer');
const Lead               = require('../models/Lead');
const LeadStageHistory   = require('../models/LeadStageHistory');
const asyncHandler       = require('../utils/asyncHandler');
const ApiError           = require('../utils/ApiError');
const { getPagination, buildPaginatedResponse } = require('../utils/pagination');
const { lockVehicle, releaseLock, updateVehicleStatus } = require('../utils/vehicleLock');
const { autoAssignExecutive }  = require('../utils/executiveAssignment');
const { sendNotification }     = require('../utils/notifications');

// ─── Public / Customer ────────────────────────────────────────────────────────

exports.getMyBookings = asyncHandler(async (req, res) => {
  const { page, limit, skip } = getPagination(req);
  const query = { customerId: req.customer._id };
  if (req.query.status) query.bookingStatus = req.query.status;

  const [docs, total] = await Promise.all([
    TDBooking.find(query)
      .populate('vehicleId', 'vehicleId model variant color')
      .populate('branchId',  'name code address')
      .populate('assignedExecutive', 'name')
      .sort({ createdAt: -1 }).skip(skip).limit(limit),
    TDBooking.countDocuments(query)
  ]);

  res.json({ success: true, ...buildPaginatedResponse({ docs, total, page, limit }) });
});

// ─── Create Booking (Admin / Customer portal) ─────────────────────────────────

exports.createBooking = asyncHandler(async (req, res) => {
  const { customerId, vehicleId, branchId, slotDate, slotTime, slotDuration, dlVerified } = req.body;

  // 1. Validate customer
  const customer = await Customer.findById(customerId);
  if (!customer) throw new ApiError(404, 'Customer not found');

  // 2. DL expiry gate
  if (customer.dlExpiry && new Date(customer.dlExpiry) < new Date()) {
    throw new ApiError(400, 'Customer driving license has expired. Upload a valid DL before booking.');
  }

  // 3. Validate vehicle availability
  const vehicle = await DemoVehicle.findById(vehicleId);
  if (!vehicle) throw new ApiError(404, 'Vehicle not found');
  if (vehicle.status !== 'AVAILABLE' || vehicle.isLocked) {
    throw new ApiError(409, 'Selected vehicle is not available for booking');
  }

  // 4. Check double-booking for this slot + vehicle
  const startOfDay = new Date(slotDate); startOfDay.setHours(0, 0, 0, 0);
  const endOfDay   = new Date(slotDate); endOfDay.setHours(23, 59, 59, 999);

  const conflict = await TDBooking.exists({
    vehicleId,
    slotDate:      { $gte: startOfDay, $lte: endOfDay },
    slotTime,
    bookingStatus: { $in: ['PENDING', 'CONFIRMED', 'IN_PROGRESS'] }
  });
  if (conflict) throw new ApiError(409, 'This slot is already booked for the selected vehicle');

  // 5. Lock vehicle (prevents race conditions)
  await lockVehicle(vehicleId, req.admin?._id || null);

  // 6. Create booking
  const booking = await TDBooking.create({
    customerId,
    vehicleId,
    branchId,
    slotDate:     new Date(slotDate),
    slotTime,
    slotDuration: slotDuration || 30,
    dlVerified:   dlVerified || false
  });

  // 7. Auto-assign executive and confirm
  const executive = await autoAssignExecutive(branchId, new Date(slotDate), slotTime, slotDuration);
  if (executive) {
    booking.assignedExecutive = executive._id;
    booking.bookingStatus     = 'CONFIRMED';
    booking.confirmationSentAt = new Date();
    await booking.save();
    await updateVehicleStatus(vehicleId, 'BOOKED', req.admin?._id, 'Booking confirmed + executive assigned', booking._id);
  }

  // 8. CRM: update lead stage if customer has a linked lead
  if (customer.leadId) {
    const lead = await Lead.findById(customer.leadId);
    if (lead) {
      await LeadStageHistory.create({
        leadId:    lead._id,
        bookingId: booking._id,
        fromStage: lead.status,
        toStage:   'TEST_DRIVE_BOOKED',
        reason:    'TD booking created'
      });
      lead.status = 'Booked';
      await lead.save();
    }
  }

  // 9. Notifications
  await sendNotification({
    recipientType: 'CUSTOMER',
    recipientId:   customer._id,
    channel:       'IN_APP',
    templateKey:   'BOOKING_CONFIRMED',
    payload:       { customerName: customer.name, slotDate: new Date(slotDate).toDateString(), slotTime, bookingId: booking.bookingId },
    bookingId:     booking._id
  });

  if (executive) {
    await sendNotification({
      recipientType: 'EXECUTIVE',
      recipientId:   executive._id,
      channel:       'IN_APP',
      templateKey:   'EXECUTIVE_ASSIGNED',
      payload:       { executiveName: executive.name, slotTime, bookingId: booking.bookingId },
      bookingId:     booking._id
    });
  }

  const populated = await TDBooking.findById(booking._id)
    .populate('customerId',        'name mobile customerId')
    .populate('vehicleId',         'vehicleId model variant registrationNo')
    .populate('branchId',          'name code')
    .populate('assignedExecutive', 'name email');

  res.status(201).json({ success: true, data: populated, message: 'Booking created successfully' });
});

// ─── Admin CRUD ───────────────────────────────────────────────────────────────

exports.getBookings = asyncHandler(async (req, res) => {
  const { page, limit, skip } = getPagination(req);
  const query = {};

  if (req.query.status)      query.bookingStatus    = req.query.status;
  if (req.query.branchId)    query.branchId         = req.query.branchId;
  if (req.query.executiveId) query.assignedExecutive = req.query.executiveId;
  if (req.query.date) {
    const d = new Date(req.query.date); const n = new Date(req.query.date); n.setDate(n.getDate() + 1);
    query.slotDate = { $gte: d, $lt: n };
  }

  // Executives see only their own bookings
  if (req.admin?.role === 'executive') query.assignedExecutive = req.admin._id;

  const [docs, total] = await Promise.all([
    TDBooking.find(query)
      .populate('customerId',        'name mobile customerId')
      .populate('vehicleId',         'vehicleId model variant registrationNo color')
      .populate('branchId',          'name code')
      .populate('assignedExecutive', 'name email')
      .sort({ slotDate: -1, slotTime: -1 }).skip(skip).limit(limit),
    TDBooking.countDocuments(query)
  ]);

  res.json({ success: true, ...buildPaginatedResponse({ docs, total, page, limit }) });
});

exports.getBookingById = asyncHandler(async (req, res) => {
  const booking = await TDBooking.findById(req.params.id)
    .populate('customerId',        'name mobile email customerId city dlNumber dlExpiry')
    .populate('vehicleId',         'vehicleId model variant registrationNo color batteryPercent currentOdometer')
    .populate('branchId',          'name code address phone')
    .populate('assignedExecutive', 'name email');
  if (!booking) throw new ApiError(404, 'Booking not found');
  res.json({ success: true, data: booking });
});

exports.confirmBooking = asyncHandler(async (req, res) => {
  const booking = await TDBooking.findById(req.params.id);
  if (!booking) throw new ApiError(404, 'Booking not found');
  if (booking.bookingStatus !== 'PENDING') throw new ApiError(400, 'Only PENDING bookings can be confirmed');

  if (req.body.assignedExecutive) booking.assignedExecutive = req.body.assignedExecutive;
  booking.bookingStatus      = 'CONFIRMED';
  booking.confirmationSentAt = new Date();
  await booking.save();

  await updateVehicleStatus(booking.vehicleId, 'BOOKED', req.admin._id, 'Booking confirmed by manager', booking._id);

  res.json({ success: true, data: booking, message: 'Booking confirmed' });
});

exports.rescheduleBooking = asyncHandler(async (req, res) => {
  const booking = await TDBooking.findById(req.params.id);
  if (!booking) throw new ApiError(404, 'Booking not found');
  if (['COMPLETED', 'CANCELLED'].includes(booking.bookingStatus)) {
    throw new ApiError(400, 'Cannot reschedule a completed or cancelled booking');
  }

  const { slotDate, slotTime, slotDuration } = req.body;
  if (!slotDate || !slotTime) throw new ApiError(400, 'New slotDate and slotTime are required');

  booking.slotDate        = new Date(slotDate);
  booking.slotTime        = slotTime;
  if (slotDuration) booking.slotDuration = slotDuration;
  booking.bookingStatus   = 'CONFIRMED';
  booking.rescheduleCount += 1;
  await booking.save();

  res.json({ success: true, data: booking, message: 'Booking rescheduled successfully' });
});

exports.cancelBooking = asyncHandler(async (req, res) => {
  const booking = await TDBooking.findById(req.params.id);
  if (!booking) throw new ApiError(404, 'Booking not found');
  if (['COMPLETED', 'CANCELLED'].includes(booking.bookingStatus)) {
    throw new ApiError(400, 'Booking is already completed or cancelled');
  }

  booking.bookingStatus = 'CANCELLED';
  booking.cancelReason  = req.body.reason || 'Cancelled';
  await booking.save();

  await releaseLock(booking.vehicleId, req.admin?._id || null, 'Booking cancelled');

  res.json({ success: true, message: 'Booking cancelled successfully' });
});
