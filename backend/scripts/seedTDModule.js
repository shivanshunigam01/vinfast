require('dotenv').config();
const connectDB = require('../config/db');

const Admin            = require('../models/Admin');
const Lead             = require('../models/Lead');
const Branch           = require('../models/Branch');
const Customer         = require('../models/Customer');
const DrivingLicense   = require('../models/DrivingLicense');
const DemoVehicle      = require('../models/DemoVehicle');
const TDSlotConfig     = require('../models/TDSlotConfig');
const TDBooking        = require('../models/TDBooking');
const TDLog            = require('../models/TDLog');
const TDFeedback       = require('../models/TDFeedback');
const TDNotification   = require('../models/TDNotification');
const ChargingLog      = require('../models/ChargingLog');
const RepairLog        = require('../models/RepairLog');
const LeadStageHistory = require('../models/LeadStageHistory');
const VehicleStatusLog = require('../models/VehicleStatusLog');

const FRESH = process.argv.includes('--fresh');
const ok  = (m) => console.log(`  ✔  ${m}`);
const dup = (m) => console.log(`  ~  ${m} (already exists)`);

async function upsertAdmin(data) {
  const existing = await Admin.findOne({ email: data.email });
  if (existing) { dup(`Admin ${data.email}`); return existing; }
  const a = await Admin.create(data);
  ok(`Admin: ${a.email} [${a.role}]`);
  return a;
}

(async () => {
  await connectDB();
  console.log('\n--- TD Module Seed ---\n');

  if (FRESH) {
    await Promise.all([
      Branch.deleteMany(), Customer.deleteMany(), DrivingLicense.deleteMany(),
      DemoVehicle.deleteMany(), TDSlotConfig.deleteMany(), TDBooking.deleteMany(),
      TDLog.deleteMany(), TDFeedback.deleteMany(), TDNotification.deleteMany(),
      ChargingLog.deleteMany(), RepairLog.deleteMany(),
      LeadStageHistory.deleteMany(), VehicleStatusLog.deleteMany()
    ]);
    ok('Collections cleared (--fresh)');
  }

  // 1. Branch
  let branch = await Branch.findOne({ code: 'PAT' });
  if (!branch) {
    branch = await Branch.create({ name: 'Patliputra Auto Patna', code: 'PAT', address: 'Boring Road, Patna', city: 'Patna', phone: '9876500001' });
    ok(`Branch: ${branch.name}`);
  } else dup('Branch PAT');

  // 2. Admins
  const sa  = await upsertAdmin({ name: 'Super Admin',       email: 'superadmin@vinfast.in', password: 'Admin@12345', role: 'superadmin' });
  const mgr = await upsertAdmin({ name: 'Rajesh Manager',    email: 'manager@vinfast.in',    password: 'Admin@12345', role: 'manager'    });
  const ex1 = await upsertAdmin({ name: 'Vikram Executive',  email: 'exec1@vinfast.in',      password: 'Admin@12345', role: 'executive'  });
  await upsertAdmin(              { name: 'Priya Executive',  email: 'exec2@vinfast.in',      password: 'Admin@12345', role: 'executive'  });

  if (!branch.manager) { branch.manager = mgr._id; await branch.save(); ok('Branch manager set'); }

  // 3. Leads
  let lead1 = await Lead.findOne({ mobile: '9876543210' });
  if (!lead1) { lead1 = await Lead.create({ name: 'Rahul Kumar', mobile: '9876543210', email: 'rahul@example.com', city: 'Patna', model: 'VF 7', source: 'Website', status: 'Interested' }); ok('Lead: Rahul Kumar'); }

  let lead2 = await Lead.findOne({ mobile: '9876543211' });
  if (!lead2) { lead2 = await Lead.create({ name: 'Priya Singh', mobile: '9876543211', email: 'priya@example.com', city: 'Patna', model: 'VF 6', source: 'Meta Ads', status: 'New Lead' }); ok('Lead: Priya Singh'); }

  // 4. Customers
  let c1 = await Customer.findOne({ mobile: '9876543210' });
  if (!c1) { c1 = await Customer.create({ name: 'Rahul Kumar', mobile: '9876543210', email: 'rahul@example.com', city: 'Patna', pinCode: '800001', dlNumber: 'BR0120230012345', dlExpiry: new Date('2028-06-01'), preferredVehicle: 'VF 7', branchId: branch._id, leadId: lead1._id }); ok(`Customer: ${c1.name} [${c1.customerId}]`); } else dup('Customer Rahul');

  let c2 = await Customer.findOne({ mobile: '9876543211' });
  if (!c2) { c2 = await Customer.create({ name: 'Priya Singh', mobile: '9876543211', email: 'priya@example.com', city: 'Patna', pinCode: '800002', dlNumber: 'BR0120220054321', dlExpiry: new Date('2027-03-15'), preferredVehicle: 'VF 6', branchId: branch._id, leadId: lead2._id }); ok(`Customer: ${c2.name} [${c2.customerId}]`); } else dup('Customer Priya');

  let c3 = await Customer.findOne({ mobile: '9876543212' });
  if (!c3) { c3 = await Customer.create({ name: 'Amit Verma', mobile: '9876543212', email: 'amit@example.com', city: 'Patna', pinCode: '800003', dlNumber: 'BR0120210078900', dlExpiry: new Date('2029-12-31'), preferredVehicle: 'VF 7', branchId: branch._id }); ok(`Customer: ${c3.name} [${c3.customerId}]`); } else dup('Customer Amit');

  // 5. DL records
  if (!(await DrivingLicense.exists({ customerId: c1._id }))) {
    await DrivingLicense.insertMany([
      { customerId: c1._id, dlNumber: 'BR0120230012345', dlExpiry: new Date('2028-06-01'), verificationStatus: 'VERIFIED', nameMatchStatus: 'MATCHED', verifiedBy: sa._id },
      { customerId: c2._id, dlNumber: 'BR0120220054321', dlExpiry: new Date('2027-03-15'), verificationStatus: 'VERIFIED', nameMatchStatus: 'MATCHED', verifiedBy: mgr._id }
    ]);
    ok('DL records seeded');
  }

  // 6. Vehicles
  let v1 = await DemoVehicle.findOne({ registrationNo: 'BR01AB1234' });
  if (!v1) { v1 = await DemoVehicle.create({ model: 'VF 7', variant: 'Plus', registrationNo: 'BR01AB1234', vinNo: 'VIN0000001', batteryPercent: 98, currentOdometer: 4820, branchId: branch._id, status: 'AVAILABLE', color: 'Pearl White', insuranceValidity: new Date('2026-12-31'), serviceDueDate: new Date('2026-09-01') }); ok(`Vehicle: ${v1.vehicleId} VF7`); } else dup('Vehicle BR01AB1234');

  let v2 = await DemoVehicle.findOne({ registrationNo: 'BR01AB5678' });
  if (!v2) { v2 = await DemoVehicle.create({ model: 'VF 6', variant: 'Eco', registrationNo: 'BR01AB5678', vinNo: 'VIN0000002', batteryPercent: 85, currentOdometer: 2310, branchId: branch._id, status: 'AVAILABLE', color: 'Midnight Black', insuranceValidity: new Date('2026-12-31'), serviceDueDate: new Date('2027-01-15') }); ok(`Vehicle: ${v2.vehicleId} VF6`); } else dup('Vehicle BR01AB5678');

  // 7. Slot config
  const today = new Date(); today.setHours(0,0,0,0);
  const tomorrow = new Date(today); tomorrow.setDate(tomorrow.getDate()+1);
  for (const d of [today, tomorrow]) {
    if (!(await TDSlotConfig.exists({ branchId: branch._id, date: d }))) {
      await TDSlotConfig.create({ branchId: branch._id, date: d, startTime: '09:00', endTime: '18:00', slotDuration: 30, bufferTime: 15 });
      ok(`Slot config: ${d.toDateString()}`);
    }
  }

  // 8. Booking1 – CONFIRMED (Rahul / VF7 / today 10:00)
  let b1 = await TDBooking.findOne({ customerId: c1._id, bookingStatus: { $in: ['CONFIRMED','PENDING'] } });
  if (!b1) {
    const d = new Date(today); d.setHours(10,0,0,0);
    b1 = await TDBooking.create({ customerId: c1._id, vehicleId: v1._id, branchId: branch._id, assignedExecutive: ex1._id, slotDate: d, slotTime: '10:00', slotDuration: 30, bookingStatus: 'CONFIRMED', dlVerified: true, confirmationSentAt: new Date() });
    v1.status = 'BOOKED'; await v1.save();
    await VehicleStatusLog.create({ vehicleId: v1._id, fromStatus: 'AVAILABLE', toStatus: 'BOOKED', changedBy: sa._id, bookingId: b1._id, reason: 'Booking confirmed' });
    ok(`Booking: ${b1.bookingId} Rahul/VF7 10:00 CONFIRMED`);
  } else dup('Booking Rahul');

  // 9. Booking2 – COMPLETED (Priya / VF6) + Log + Feedback
  let b2 = await TDBooking.findOne({ customerId: c2._id, bookingStatus: 'COMPLETED' });
  if (!b2) {
    const yd = new Date(today); yd.setDate(yd.getDate()-1); yd.setHours(14,0,0,0);
    b2 = await TDBooking.create({ customerId: c2._id, vehicleId: v2._id, branchId: branch._id, assignedExecutive: ex1._id, slotDate: yd, slotTime: '14:00', slotDuration: 30, bookingStatus: 'COMPLETED', dlVerified: true });
    ok(`Booking: ${b2.bookingId} Priya/VF6 COMPLETED`);

    const st = new Date(yd), et = new Date(yd.getTime() + 32*60000);
    await TDLog.create({
      bookingId: b2._id, executiveId: ex1._id, customerId: c2._id, vehicleId: v2._id,
      openingOdometer: 2310, closingOdometer: 2326, totalKM: 16,
      openingBattery: 85, closingBattery: 78, batteryUsed: 7,
      startTime: st, endTime: et, durationMinutes: 32,
      startPhotoUrl: 'https://res.cloudinary.com/demo/image/upload/sample.jpg',
      endPhotoUrl:   'https://res.cloudinary.com/demo/image/upload/sample.jpg',
      damageNotes: 'No damage', executiveRemarks: 'Customer very impressed.',
      customerOtpVerified: true, status: 'COMPLETED',
      gpsRoute: [
        { lat: 25.5941, lng: 85.1376, timestamp: st },
        { lat: 25.5960, lng: 85.1400, timestamp: new Date(st.getTime()+10*60000) },
        { lat: 25.5941, lng: 85.1376, timestamp: et }
      ]
    });
    ok('TD Log: 16KM 32min GPS route');

    v2.currentOdometer = 2326; v2.batteryPercent = 78; v2.totalTestDriveKM = 16; v2.totalTestDrives = 1;
    await v2.save();

    await TDFeedback.create({ bookingId: b2._id, customerId: c2._id, drivingExperience: 5, vehicleComfort: 4, batteryConfidence: 4, executiveBehaviour: 5, purchaseIntention: 5, preferredVariant: 'Eco', remarks: 'Excellent! Planning to book soon.' });
    ok('Feedback: Priya Singh 5 stars');

    await LeadStageHistory.create({ leadId: lead2._id, bookingId: b2._id, fromStage: 'New Lead', toStage: 'TEST_DRIVE_COMPLETED', changedBy: ex1._id, reason: 'TD completed' });
    lead2.status = 'Interested'; await lead2.save();
    ok('CRM: lead2 -> Interested');
  } else dup('Completed booking Priya');

  // 10. Booking3 – PENDING (Amit / VF7 / tomorrow 11:00)
  let b3 = await TDBooking.findOne({ customerId: c3._id });
  if (!b3) {
    const d = new Date(tomorrow); d.setHours(11,0,0,0);
    b3 = await TDBooking.create({ customerId: c3._id, vehicleId: v1._id, branchId: branch._id, slotDate: d, slotTime: '11:00', slotDuration: 30, bookingStatus: 'PENDING', dlVerified: false });
    ok(`Booking: ${b3.bookingId} Amit/VF7 tomorrow PENDING`);
  } else dup('Booking Amit');

  // 11. Charging log
  if (!(await ChargingLog.exists({ vehicleId: v2._id }))) {
    const cs = new Date(); cs.setHours(cs.getHours()-2);
    await ChargingLog.create({ vehicleId: v2._id, startTime: cs, startBattery: 78, targetBattery: 100, expectedCompletionTime: new Date(cs.getTime()+90*60000), actualCompletionTime: new Date(cs.getTime()+85*60000), chargingPoint: 'Point A', status: 'COMPLETED', loggedBy: mgr._id });
    ok('Charging log: VF6');
  }

  // 12. Repair log
  if (!(await RepairLog.exists({ vehicleId: v1._id }))) {
    await RepairLog.create({ vehicleId: v1._id, complaint: 'Minor scratch on bumper', repairStatus: 'CLOSED', workshop: 'VinFast Workshop Patna', estimatedCompletion: new Date('2026-06-08'), actualCompletion: new Date('2026-06-09'), remarks: 'Touch-up applied. Cleared.', loggedBy: mgr._id });
    ok('Repair log: VF7');
  }

  // 13. Notifications
  if (b2 && !(await TDNotification.exists({ bookingId: b2._id }))) {
    await TDNotification.insertMany([
      { recipientType: 'CUSTOMER', recipientId: c2._id, channel: 'IN_APP', templateKey: 'BOOKING_CONFIRMED', status: 'SENT', bookingId: b2._id, payload: { message: 'Booking confirmed' }, sentAt: new Date() },
      { recipientType: 'CUSTOMER', recipientId: c2._id, channel: 'IN_APP', templateKey: 'FEEDBACK_REQUEST',  status: 'SENT', bookingId: b2._id, payload: { message: 'Please share feedback' }, sentAt: new Date() }
    ]);
    ok('Notifications seeded');
  }

  console.log('\n========================================');
  console.log('  TD MODULE SEED COMPLETE');
  console.log('========================================');
  console.log('  superadmin@vinfast.in  /  Admin@12345  [superadmin]');
  console.log('  manager@vinfast.in     /  Admin@12345  [manager]');
  console.log('  exec1@vinfast.in       /  Admin@12345  [executive]');
  console.log('  exec2@vinfast.in       /  Admin@12345  [executive]');
  console.log('\n  Bookings: 1 CONFIRMED + 1 COMPLETED + 1 PENDING');
  console.log('  Vehicles: VF7 (BOOKED) + VF6 (AVAILABLE)');
  console.log('  Feedback: Priya Singh 5 stars');
  console.log('========================================\n');
  process.exit(0);
})().catch(e => { console.error('Seed error:', e.message); process.exit(1); });
