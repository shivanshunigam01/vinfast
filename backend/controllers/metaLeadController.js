const mongoose = require('mongoose');
const MetaLead = require('../models/MetaLead');
const Lead = require('../models/Lead');
const asyncHandler = require('../utils/asyncHandler');
const ApiError = require('../utils/ApiError');

function normalizeModel(value) {
  const raw = String(value || '').trim();
  if (!raw) return 'VF 7';
  const upper = raw.toUpperCase().replace(/\s+/g, ' ');
  if (upper.includes('VF 6') || upper === 'VF6') return 'VF 6';
  if (upper.includes('BOTH')) return 'Both';
  return 'VF 7';
}

function buildMetaPayload(body) {
  const name = String(body.name || '').trim();
  const mobile = String(body.mobile || '').trim();
  const interestedModel = String(body.interestedModel || body.model || '').trim();
  const model = normalizeModel(body.model || interestedModel);

  return {
    name,
    mobile,
    whatsappNumber: String(body.whatsappNumber || body.mobile || '').trim() || mobile,
    email: body.email ? String(body.email).trim().toLowerCase() : undefined,
    state: body.state ? String(body.state).trim() : undefined,
    pin: body.pin ? String(body.pin).trim() : undefined,
    interestedModel: interestedModel || undefined,
    existingVehicle: body.existingVehicle ? String(body.existingVehicle).trim() : undefined,
    status: body.status || 'New Lead',
    source: body.source ? String(body.source).trim() : 'Meta Ads',
    model,
    nextFollowUp: body.nextFollowUp ? new Date(body.nextFollowUp) : undefined,
    remarks: body.remarks ? String(body.remarks).trim() : undefined,
    financeNeeded: Boolean(body.financeNeeded),
    exchangeNeeded: Boolean(body.exchangeNeeded),
    receivedAt: body.receivedAt ? new Date(body.receivedAt) : new Date()
  };
}

async function createLinkedLead(payload) {
  if (!payload.name || !payload.mobile) return null;
  return Lead.create({
    name: payload.name,
    mobile: payload.mobile,
    email: payload.email,
    city: payload.state,
    model: normalizeModel(payload.model || payload.interestedModel),
    source: 'Meta Ads',
    status: payload.status || 'New Lead',
    nextFollowUp: payload.nextFollowUp,
    remarks: payload.remarks,
    financeNeeded: payload.financeNeeded,
    exchangeNeeded: payload.exchangeNeeded
  });
}

async function findMetaLeadByIdParam(id) {
  if (mongoose.Types.ObjectId.isValid(id)) {
    const byId = await MetaLead.findById(id);
    if (byId) return byId;
  }
  return MetaLead.findOne({ uniqueId: String(id).trim() });
}

exports.getAllPublic = asyncHandler(async (req, res) => {
  const docs = await MetaLead.find().sort({ createdAt: -1 });
  res.json({ success: true, data: docs, meta: { total: docs.length } });
});

exports.createMetaLead = asyncHandler(async (req, res) => {
  const payload = buildMetaPayload(req.body);
  if (!payload.name || !payload.mobile) {
    throw new ApiError(400, 'Name and mobile are required.');
  }

  const lead = await createLinkedLead(payload);
  const doc = await MetaLead.create({
    ...payload,
    leadId: lead?._id
  });

  res.status(201).json({ success: true, data: doc });
});

exports.bulkCreateMetaLeads = asyncHandler(async (req, res) => {
  const rows = Array.isArray(req.body.leads) ? req.body.leads : [];
  if (rows.length === 0) throw new ApiError(400, 'No leads provided.');

  const failed = [];
  let created = 0;

  for (let i = 0; i < rows.length; i++) {
    const payload = buildMetaPayload(rows[i]);
    if (!payload.name || !payload.mobile) {
      failed.push({
        row: i + 1,
        name: payload.name,
        mobile: payload.mobile,
        message: 'Name and mobile are required.'
      });
      continue;
    }
    try {
      const lead = await createLinkedLead(payload);
      await MetaLead.create({ ...payload, leadId: lead?._id });
      created += 1;
    } catch (err) {
      failed.push({
        row: i + 1,
        name: payload.name,
        mobile: payload.mobile,
        message: err.message || 'Could not create lead.'
      });
    }
  }

  res.status(201).json({ success: true, data: { created, failed } });
});

exports.updateMetaLead = asyncHandler(async (req, res) => {
  const doc = await findMetaLeadByIdParam(req.params.id);
  if (!doc) throw new ApiError(404, 'Meta lead not found');

  const updates = buildMetaPayload({ ...doc.toObject(), ...req.body });
  Object.assign(doc, updates);
  await doc.save();

  res.json({ success: true, data: doc });
});

exports.deleteMetaLead = asyncHandler(async (req, res) => {
  const doc = await findMetaLeadByIdParam(req.params.id);
  if (!doc) throw new ApiError(404, 'Meta lead not found');
  await doc.deleteOne();
  res.json({ success: true, message: 'Meta lead deleted successfully' });
});
