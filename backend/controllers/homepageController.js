const HeroSlide = require('../models/HeroSlide');
const SiteConfig = require('../models/SiteConfig');
const asyncHandler = require('../utils/asyncHandler');
const ApiError = require('../utils/ApiError');

const CONFIG_KEYS = ['whatsappNumber', 'phoneNumber', 'heroTagline', 'vf7Price', 'vf6Price', 'vf7Range', 'vf6Range', 'leadStripTitle', 'leadStripSubtitle'];
const DEALER_KEYS = ['dealerName', 'brand', 'phone', 'whatsapp', 'email', 'address', 'showroomHours', 'gstNo', 'mapEmbedUrl'];

const fetchByKeys = async (keys) => {
  const rows = await SiteConfig.find({ key: { $in: keys } });
  return rows.reduce((acc, row) => ({ ...acc, [row.key]: row.value }), {});
};

const upsertKeys = async (keys, body) => {
  const entries = Object.entries(body).filter(([key]) => keys.includes(key));
  await Promise.all(entries.map(([key, value]) =>
    SiteConfig.findOneAndUpdate({ key }, { key, value }, { new: true, upsert: true, setDefaultsOnInsert: true })
  ));
};

const fetchConfigObject = async () => fetchByKeys(CONFIG_KEYS);

exports.getPublicHeroSlides = asyncHandler(async (req, res) => {
  const docs = await HeroSlide.find({ active: true }).sort({ order: 1, createdAt: -1 });
  res.json({ success: true, data: docs });
});

exports.getAdminSlides = asyncHandler(async (req, res) => {
  const docs = await HeroSlide.find().sort({ order: 1, createdAt: -1 });
  res.json({ success: true, data: docs });
});

exports.createSlide = asyncHandler(async (req, res) => {
  const doc = await HeroSlide.create(req.body);
  res.status(201).json({ success: true, data: doc });
});

exports.updateSlide = asyncHandler(async (req, res) => {
  const doc = await HeroSlide.findByIdAndUpdate(req.params.id, req.body, { new: true, runValidators: true });
  if (!doc) throw new ApiError(404, 'Hero slide not found');
  res.json({ success: true, data: doc });
});

exports.deleteSlide = asyncHandler(async (req, res) => {
  const doc = await HeroSlide.findById(req.params.id);
  if (!doc) throw new ApiError(404, 'Hero slide not found');
  await doc.deleteOne();
  res.json({ success: true, message: 'Hero slide deleted successfully' });
});

exports.getPublicConfig = asyncHandler(async (req, res) => {
  res.json({ success: true, data: await fetchConfigObject() });
});

// GET /public/site-config  — used by frontend PublicSiteContext
exports.getPublicSiteConfig = asyncHandler(async (req, res) => {
  const data = await fetchByKeys(CONFIG_KEYS);
  data.features = { whatsappOtp: process.env.WHATSAPP_OTP_ENABLED === 'true' };
  res.json({ success: true, data });
});

// GET /public/dealer-settings  — used by frontend PublicSiteContext
exports.getPublicDealerSettings = asyncHandler(async (req, res) => {
  const data = await fetchByKeys(DEALER_KEYS);
  res.json({ success: true, data });
});

// GET /admin/settings/dealer
exports.getAdminDealerSettings = asyncHandler(async (req, res) => {
  const data = await fetchByKeys(DEALER_KEYS);
  res.json({ success: true, data });
});

// PUT /admin/settings/dealer
exports.updateDealerSettings = asyncHandler(async (req, res) => {
  await upsertKeys(DEALER_KEYS, req.body);
  res.json({ success: true, message: 'Dealer settings updated successfully' });
});

exports.getAdminConfig = asyncHandler(async (req, res) => {
  res.json({ success: true, data: await fetchConfigObject() });
});

exports.updateConfig = asyncHandler(async (req, res) => {
  await upsertKeys(CONFIG_KEYS, req.body);
  res.json({ success: true, message: 'Configuration updated successfully' });
});
