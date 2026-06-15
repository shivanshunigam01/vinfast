const mongoose = require('mongoose');

const LEAD_STATUSES = [
  'New Lead', 'Contact Attempted', 'Interested', 'Negotiation',
  'Booked', 'Delivered', 'Lost', 'Not Interested'
];

const MetaLeadSchema = new mongoose.Schema({
  name: { type: String, trim: true },
  mobile: { type: String, trim: true },
  whatsappNumber: { type: String, trim: true },
  email: { type: String, lowercase: true, trim: true },
  state: { type: String, trim: true },
  pin: { type: String, trim: true },
  interestedModel: { type: String, trim: true },
  existingVehicle: { type: String, trim: true },
  status: { type: String, enum: LEAD_STATUSES, default: 'New Lead' },
  source: { type: String, default: 'Meta Ads', trim: true },
  model: { type: String, trim: true },
  nextFollowUp: { type: Date },
  remarks: { type: String, trim: true },
  financeNeeded: { type: Boolean, default: false },
  exchangeNeeded: { type: Boolean, default: false },
  leadId: { type: mongoose.Schema.Types.ObjectId, ref: 'Lead' },
  uniqueId: { type: String, trim: true, sparse: true },
  receivedAt: { type: Date },
  whatsapp_number: { type: String, trim: true },
  flow_token: { type: mongoose.Schema.Types.Mixed },
  screen_0_Name_0: { type: String, trim: true },
  screen_0_Contact_No_1: { type: String, trim: true },
  screen_0_State_2: { type: String, trim: true },
  screen_0_PIN_3: { type: String, trim: true },
  screen_0_Email_ID_4: { type: String, trim: true },
  screen_0_Interested_Model_5: { type: String, trim: true },
  screen_0_Existing_Vehicle__6: { type: String, trim: true }
}, { timestamps: true });

module.exports = mongoose.model('MetaLead', MetaLeadSchema);
