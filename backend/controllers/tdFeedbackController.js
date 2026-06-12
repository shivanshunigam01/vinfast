const TDFeedback   = require('../models/TDFeedback');
const TDBooking    = require('../models/TDBooking');
const asyncHandler = require('../utils/asyncHandler');
const ApiError     = require('../utils/ApiError');
const { getPagination, buildPaginatedResponse } = require('../utils/pagination');

exports.submitFeedback = asyncHandler(async (req, res) => {
  const { bookingId } = req.body;
  if (!bookingId) throw new ApiError(400, 'bookingId is required');

  const booking = await TDBooking.findById(bookingId);
  if (!booking) throw new ApiError(404, 'Booking not found');
  if (booking.bookingStatus !== 'COMPLETED') {
    throw new ApiError(400, 'Feedback can only be submitted after the test drive is completed');
  }

  const already = await TDFeedback.exists({ bookingId });
  if (already) throw new ApiError(409, 'Feedback has already been submitted for this booking');

  // Determine customerId: from JWT customer or body
  const customerId = req.customer?._id || req.body.customerId;
  if (!customerId) throw new ApiError(400, 'customerId is required');

  const feedback = await TDFeedback.create({ ...req.body, bookingId, customerId });

  res.status(201).json({ success: true, data: feedback, message: 'Thank you for your valuable feedback!' });
});

exports.getFeedbacks = asyncHandler(async (req, res) => {
  const { page, limit, skip } = getPagination(req);
  const query = {};
  if (req.query.bookingId) query.bookingId = req.query.bookingId;

  const [docs, total] = await Promise.all([
    TDFeedback.find(query)
      .populate('bookingId',  'bookingId slotDate slotTime')
      .populate('customerId', 'name mobile')
      .sort({ createdAt: -1 }).skip(skip).limit(limit),
    TDFeedback.countDocuments(query)
  ]);

  res.json({ success: true, ...buildPaginatedResponse({ docs, total, page, limit }) });
});

exports.getFeedbackByBooking = asyncHandler(async (req, res) => {
  const feedback = await TDFeedback.findOne({ bookingId: req.params.bookingId })
    .populate('customerId', 'name mobile');
  if (!feedback) throw new ApiError(404, 'No feedback found for this booking');
  res.json({ success: true, data: feedback });
});
