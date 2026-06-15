/**
 * Test Drive Management Module — Full Seed Script
 * Seeds: Branch, Admins (manager + executives), Customers, DL records,
 *        Demo Vehicles, Slot Config, Bookings, TD Logs, Feedbacks
 *
 * Run: node scripts/seedTD.js
 */
require('dotenv').config();
const connectDB = require('../config/db');
const mongoose = require('mongoose');

const Admin = require('../models/Admin');
const Branch = require('../models/Branch');
const Customer = require('../models/Customer');
const DrivingLicense = require('../models/DrivingLicense');
const DemoVehicle = require('../models/DemoVehicle');
const TDSlotConfig = require('../models/TDSlotConfig');
const TDBooking = require('../models/TDBooking');
const TDLog = require('../models/TDLog');
const TDFeedback = require('../models/TDFeedback');
const ChargingLog = require('../models/ChargingLog');
const VehicleStatusLog = require('../models/VehicleStatusLog');
const { buildDemoFleet, SLOT_CONFIG_DEFAULTS } = require('../data/tdDemoFleet');

const FORCE_RESEED = process.argv.includes('--force');

async function clearTDData() {
  console.log('🗑️  Clearing existing TD module data...');
  await TDFeedback.deleteMany({});
  await TDLog.deleteMany({});
  await TDBooking.deleteMany({});
  await TDSlotConfig.deleteMany({});
  await DrivingLicense.deleteMany({});
  await DemoVehicle.deleteMany({});
  await Customer.deleteMany({});
  await ChargingLog.deleteMany({});
  await VehicleStatusLog.deleteMany({});
  // Only remove TD-specific staff users created by seed
  await Admin.deleteMany({ designation: { $in: ['sales_executive', 'sales_manager', 'branch_manager', 'gm', 'ceo', 'md'] } });
  await Admin.deleteMany({ role: { $in: ['manager', 'executive'] }, designation: { $exists: false } });
  await Branch.deleteMany({});
  console.log('✅ TD data cleared\n');
}

async function seed() {
  try {
    await connectDB();
    console.log('🚀 Starting TD Module Seed...\n');

    if (FORCE_RESEED) await clearTDData();

    // ─── 1. Branch ────────────────────────────────────────────────────
    console.log('📍 Creating Branch...');
    let branch = await Branch.findOne({ code: 'PAT' });
    if (!branch) {
      branch = await Branch.create({
        name: 'Patna Showroom',
        code: 'PAT',
        address: 'Bailey Road, Patna, Bihar',
        city: 'Patna',
        phone: '0612-2345678',
        active: true
      });
    }
    console.log(`   ✅ Branch: ${branch.name} (${branch.code})`);

    // ─── 2. Staff Users (Sales hierarchy) ─────────────────────────────
    console.log('\n👥 Creating Staff Users...');

    const { authRoleForDesignation } = require('../utils/staffRoles');

    const staffUsersData = [
      { name: 'Amit Sharma', email: 'amit.sharma@patliputravinfast.com', password: 'Exec@1234', designation: 'sales_executive' },
      { name: 'Priya Singh', email: 'priya.singh@patliputravinfast.com', password: 'Exec@1234', designation: 'sales_executive' },
      { name: 'Rohan Verma', email: 'rohan.verma@patliputravinfast.com', password: 'Exec@1234', designation: 'sales_executive' },
      { name: 'Rajesh Kumar', email: 'manager@patliputravinfast.com', password: 'Manager@123', designation: 'sales_manager' },
      { name: 'Sunita Mehta', email: 'sunita.mehta@patliputravinfast.com', password: 'Branch@123', designation: 'branch_manager' },
      { name: 'Vikram Rao', email: 'vikram.rao@patliputravinfast.com', password: 'GM@123456', designation: 'gm' },
      { name: 'Anil Kapoor', email: 'anil.kapoor@patliputravinfast.com', password: 'CEO@123456', designation: 'ceo' },
      { name: 'Deepak Malhotra', email: 'deepak.malhotra@patliputravinfast.com', password: 'MD@1234567', designation: 'md' }
    ];

    const staffUsers = [];
    let branchManager = null;

    for (const sd of staffUsersData) {
      let user = await Admin.findOne({ email: sd.email });
      const role = authRoleForDesignation(sd.designation);
      if (!user) {
        user = await Admin.create({ ...sd, role, active: true });
      } else {
        user.name = sd.name;
        user.designation = sd.designation;
        user.role = role;
        user.active = true;
        if (sd.password) user.password = sd.password;
        await user.save();
      }
      staffUsers.push(user);
      if (sd.designation === 'branch_manager') branchManager = user;
    }

    if (branchManager) {
      branch.managerRef = branchManager._id;
      await branch.save();
    }

    staffUsers.forEach((u) => console.log(`   ✅ ${u.name} (${u.designation})`));

    const executives = staffUsers.filter((u) => u.designation === 'sales_executive');
    const manager = branchManager || staffUsers.find((u) => u.designation === 'sales_manager');

    // ─── 3. Demo Vehicles ─────────────────────────────────────────────
    console.log('\n🚗 Creating Demo Vehicles...');

    const vehiclesData = buildDemoFleet(branch._id);

    const vehicles = [];
    for (const vd of vehiclesData) {
      let v = await DemoVehicle.findOne({ registrationNo: vd.registrationNo });
      if (!v) v = await DemoVehicle.create(vd);
      else {
        Object.assign(v, vd);
        await v.save();
      }
      vehicles.push(v);
    }

    // Create charging log for the charging vehicle
    const chargingVeh = vehicles.find((v) => v.status === 'CHARGING');
    if (chargingVeh) {
      const existingCharge = await ChargingLog.findOne({ vehicleId: chargingVeh._id, status: 'CHARGING' });
      if (!existingCharge) {
        await ChargingLog.create({
          vehicleId: chargingVeh._id,
          startTime: new Date(Date.now() - 30 * 60 * 1000),
          startBattery: 12,
          targetBattery: 100,
          expectedCompletionTime: new Date(Date.now() + 3 * 60 * 60 * 1000),
          chargingPoint: 'Station A',
          status: 'CHARGING',
          loggedBy: manager._id
        });
      }
    }

    console.log(`   ✅ ${vehicles.length} vehicles created`);
    vehicles.forEach((v) => console.log(`      ${v.vehicleId} — ${v.model} ${v.variant} | ${v.status} | Battery: ${v.batteryPercent}%`));

    // ─── 4. Slot Configuration ────────────────────────────────────────
    console.log('\n⏰ Creating Slot Configuration...');
    let slotConfig = await TDSlotConfig.findOne({ branchId: branch._id });
    if (!slotConfig) {
      slotConfig = await TDSlotConfig.create({
        branchId: branch._id,
        ...SLOT_CONFIG_DEFAULTS
      });
    } else {
      Object.assign(slotConfig, SLOT_CONFIG_DEFAULTS);
      await slotConfig.save();
    }
    console.log(`   ✅ Slots: ${slotConfig.workingStartTime}–${slotConfig.workingEndTime}, ${slotConfig.slotDuration}min + ${slotConfig.bufferTime}min buffer`);

    // ─── 5. Customers ─────────────────────────────────────────────────
    console.log('\n👤 Creating Customers...');

    const customersData = [
      { name: 'Arjun Mishra', mobile: '9876543210', email: 'arjun.mishra@gmail.com', city: 'Patna', pinCode: '800001', preferredVehicle: 'VF 7', branchId: branch._id },
      { name: 'Sunita Devi', mobile: '9123456789', email: 'sunita.devi@gmail.com', city: 'Gaya', pinCode: '823001', preferredVehicle: 'VF 6', branchId: branch._id },
      { name: 'Rahul Gupta', mobile: '8765432109', email: 'rahul.gupta@yahoo.com', city: 'Muzaffarpur', pinCode: '842001', preferredVehicle: 'VF 7', branchId: branch._id },
      { name: 'Pooja Kumari', mobile: '7654321098', email: 'pooja.kumari@gmail.com', city: 'Bhagalpur', pinCode: '812001', preferredVehicle: 'VF 6', branchId: branch._id },
      { name: 'Vikram Yadav', mobile: '6543210987', email: 'vikram.yadav@outlook.com', city: 'Patna', pinCode: '800002', preferredVehicle: 'VF 7', branchId: branch._id }
    ];

    const customers = [];
    for (const cd of customersData) {
      let c = await Customer.findOne({ mobile: cd.mobile });
      if (!c) c = await Customer.create(cd);
      customers.push(c);
    }
    console.log(`   ✅ ${customers.length} customers created`);
    customers.forEach((c) => console.log(`      ${c.customerId} — ${c.name} (${c.mobile})`));

    // ─── 6. Driving Licenses ──────────────────────────────────────────
    console.log('\n🪪 Creating Driving Licenses...');

    const dlData = [
      { customerId: customers[0]._id, dlNumber: 'BR2020001234', dlExpiry: new Date('2028-05-15'), verificationStatus: 'VERIFIED', nameMatchStatus: 'MATCHED' },
      { customerId: customers[1]._id, dlNumber: 'BR2019005678', dlExpiry: new Date('2027-08-20'), verificationStatus: 'VERIFIED', nameMatchStatus: 'MATCHED' },
      { customerId: customers[2]._id, dlNumber: 'UP2021009876', dlExpiry: new Date('2026-07-10'), verificationStatus: 'MANUAL_REVIEW', nameMatchStatus: 'UNCHECKED', remarks: 'DL expires in < 30 days — manual check needed' },
      { customerId: customers[3]._id, dlNumber: 'BR2018003456', dlExpiry: new Date('2025-01-01'), verificationStatus: 'REJECTED', remarks: 'DL is expired — booking blocked' },
      { customerId: customers[4]._id, dlNumber: 'BR2022007890', dlExpiry: new Date('2029-11-30'), verificationStatus: 'VERIFIED', nameMatchStatus: 'MATCHED' }
    ];

    for (const dl of dlData) {
      const exists = await DrivingLicense.findOne({ customerId: dl.customerId });
      if (!exists) await DrivingLicense.create({ ...dl, frontImageUrl: 'https://via.placeholder.com/400x250/1a1a2e/00d4ff?text=DL+Front', backImageUrl: 'https://via.placeholder.com/400x250/1a1a2e/00d4ff?text=DL+Back' });
    }
    console.log(`   ✅ ${dlData.length} DL records created`);

    // ─── 7. Bookings ──────────────────────────────────────────────────
    console.log('\n📅 Creating TD Bookings...');

    const today = new Date();
    const tomorrow = new Date(today); tomorrow.setDate(today.getDate() + 1);
    const dayAfter = new Date(today); dayAfter.setDate(today.getDate() + 2);
    const yesterday = new Date(today); yesterday.setDate(today.getDate() - 1);
    const threeDaysAgo = new Date(today); threeDaysAgo.setDate(today.getDate() - 3);
    const fiveDaysAgo = new Date(today); fiveDaysAgo.setDate(today.getDate() - 5);

    const availableVehicle = vehicles.find((v) => v.status === 'AVAILABLE' && v.model === 'VF 7' && v.variant === 'Wind');
    const vf6Vehicle = vehicles.find((v) => v.status === 'AVAILABLE' && v.model === 'VF 6' && v.variant === 'Wind');
    const vf7WindInf = vehicles.find((v) => v.variant === 'Wind Infinity' && v.model === 'VF 7');

    const bookingsData = [
      // Completed booking with log + feedback
      {
        customerId: customers[0]._id,
        vehicleId: availableVehicle?._id,
        branchId: branch._id,
        assignedExecutive: executives[0]._id,
        slotDate: fiveDaysAgo,
        slotTime: '10:00',
        slotDuration: 60,
        bookingStatus: 'COMPLETED',
        dlVerified: true,
        preferredModel: 'VF 7',
        confirmationSentAt: new Date(fiveDaysAgo.getTime() - 60000)
      },
      // Completed booking without feedback
      {
        customerId: customers[1]._id,
        vehicleId: vf6Vehicle?._id,
        branchId: branch._id,
        assignedExecutive: executives[1]._id,
        slotDate: threeDaysAgo,
        slotTime: '14:00',
        slotDuration: 60,
        bookingStatus: 'COMPLETED',
        dlVerified: true,
        preferredModel: 'VF 6',
        confirmationSentAt: new Date(threeDaysAgo.getTime() - 60000)
      },
      // Yesterday — cancelled
      {
        customerId: customers[3]._id,
        branchId: branch._id,
        assignedExecutive: executives[2]._id,
        slotDate: yesterday,
        slotTime: '11:00',
        slotDuration: 60,
        bookingStatus: 'CANCELLED',
        dlVerified: false,
        preferredModel: 'VF 6',
        cancellationReason: 'Customer DL rejected — expired'
      },
      // Today — confirmed/upcoming
      {
        customerId: customers[2]._id,
        vehicleId: vf7WindInf?._id,
        branchId: branch._id,
        assignedExecutive: executives[0]._id,
        slotDate: today,
        slotTime: '15:30',
        slotDuration: 60,
        bookingStatus: 'CONFIRMED',
        dlVerified: false,
        preferredModel: 'VF 7',
        confirmationSentAt: new Date()
      },
      // Tomorrow — pending
      {
        customerId: customers[4]._id,
        vehicleId: vf7WindInf?._id,
        branchId: branch._id,
        assignedExecutive: executives[1]._id,
        slotDate: tomorrow,
        slotTime: '10:00',
        slotDuration: 60,
        bookingStatus: 'CONFIRMED',
        dlVerified: true,
        preferredModel: 'VF 7',
        confirmationSentAt: new Date()
      },
      // Day after tomorrow — pending
      {
        customerId: customers[0]._id,
        vehicleId: vf6Vehicle?._id,
        branchId: branch._id,
        assignedExecutive: executives[2]._id,
        slotDate: dayAfter,
        slotTime: '11:15',
        slotDuration: 60,
        bookingStatus: 'PENDING',
        dlVerified: true,
        preferredModel: 'VF 6'
      }
    ];

    const bookings = [];
    for (const bd of bookingsData) {
      const b = await TDBooking.create(bd);
      bookings.push(b);
    }
    console.log(`   ✅ ${bookings.length} bookings created`);
    bookings.forEach((b) => console.log(`      ${b.bookingId} — ${b.bookingStatus} | ${new Date(b.slotDate).toDateString()} ${b.slotTime}`));

    // ─── 8. TD Logs (for completed bookings) ─────────────────────────
    console.log('\n📋 Creating TD Logs...');

    const completedBookings = bookings.filter((b) => b.bookingStatus === 'COMPLETED');

    const logData = [
      {
        bookingId: completedBookings[0]._id,
        executiveId: executives[0]._id,
        customerId: customers[0]._id,
        vehicleId: availableVehicle?._id,
        openingOdometer: availableVehicle?.currentOdometer || 1240,
        closingOdometer: (availableVehicle?.currentOdometer || 1240) + 18,
        openingBattery: 95,
        closingBattery: 88,
        startTime: new Date(fiveDaysAgo.getTime() + 10 * 3600000),
        endTime: new Date(fiveDaysAgo.getTime() + 11.1 * 3600000),
        startPhotoUrl: 'https://via.placeholder.com/800x600/0d1117/00d4ff?text=TD+Start+Photo',
        endPhotoUrl: 'https://via.placeholder.com/800x600/0d1117/00d4ff?text=TD+End+Photo',
        customerOtpVerified: true,
        executiveRemarks: 'Customer very interested in VF 7. Loved the range and interior quality.',
        damageNotes: 'No damage observed.',
        status: 'COMPLETED'
      },
      {
        bookingId: completedBookings[1]._id,
        executiveId: executives[1]._id,
        customerId: customers[1]._id,
        vehicleId: vf6Vehicle?._id,
        openingOdometer: vf6Vehicle?.currentOdometer || 3450,
        closingOdometer: (vf6Vehicle?.currentOdometer || 3450) + 22,
        openingBattery: 78,
        closingBattery: 65,
        startTime: new Date(threeDaysAgo.getTime() + 14 * 3600000),
        endTime: new Date(threeDaysAgo.getTime() + 15.2 * 3600000),
        startPhotoUrl: 'https://via.placeholder.com/800x600/0d1117/00d4ff?text=TD+Start+VF6',
        customerOtpVerified: true,
        executiveRemarks: 'Customer comparing VF 6 and VF 7. Needs follow-up for finance options.',
        damageNotes: 'Minor dust on bumper — not new damage.',
        status: 'COMPLETED'
      }
    ];

    for (const ld of logData) {
      const existing = await TDLog.findOne({ bookingId: ld.bookingId });
      if (!existing) await TDLog.create(ld);
    }
    console.log(`   ✅ ${logData.length} TD logs created`);

    // ─── 9. Feedback ─────────────────────────────────────────────────
    console.log('\n⭐ Creating Feedback...');

    const existingFeedback = await TDFeedback.findOne({ bookingId: completedBookings[0]._id });
    if (!existingFeedback) {
      await TDFeedback.create({
        bookingId: completedBookings[0]._id,
        customerId: customers[0]._id,
        drivingExperience: 5,
        vehicleComfort: 5,
        batteryConfidence: 4,
        executiveBehaviour: 5,
        purchaseIntention: 4,
        preferredVariant: 'VF 7 Wind Infinity',
        remarks: 'Amazing experience! The VF 7 Wind Infinity is a beast. Very impressed with the range and technology. Definitely planning to buy.'
      });
      console.log(`   ✅ Feedback from ${customers[0].name} — ⭐⭐⭐⭐⭐`);
    }

    // ─── 10. Summary ─────────────────────────────────────────────────
    console.log('\n' + '='.repeat(60));
    console.log('🎉 TD Module Seed Complete!');
    console.log('='.repeat(60));
    console.log('\n📊 SUMMARY:');
    console.log(`   Branch:          ${branch.name}`);
    console.log(`   Staff users:     ${staffUsers.length} (Sales Executive → MD)`);
    staffUsers.forEach((u) => console.log(`                    ${u.name} — ${u.designation}`));
    console.log(`   Demo Vehicles:   ${vehicles.length} (${vehicles.filter((v) => v.status === 'AVAILABLE').length} available)`);
    console.log(`   Customers:       ${customers.length}`);
    console.log(`   Bookings:        ${bookings.length}`);
    console.log(`   Slot Config:     ${slotConfig.slotDuration}min slots, 9AM-6PM`);
    console.log('\n🔑 Admin Panel Login:');
    console.log(`   URL: http://localhost:5173/admin/login`);
    console.log(`   Sales Manager: manager@patliputravinfast.com / Manager@123`);
    console.log(`   Sales Executive: amit.sharma@patliputravinfast.com / Exec@1234`);
    console.log('\n🌐 API Base: http://localhost:${process.env.PORT || 5000}/api/v1');
    console.log('   GET  /api/v1/td/slots/available?branchId=<id>&date=<YYYY-MM-DD>');
    console.log('   GET  /api/v1/td/vehicles/available?branchId=<id>');
    console.log('   GET  /api/v1/admin/td/bookings (auth required)');
    console.log('   GET  /api/v1/admin/td/reports/admin (auth required)');
    console.log('='.repeat(60));

    process.exit(0);
  } catch (err) {
    console.error('\n❌ Seed failed:', err.message);
    if (err.code === 11000) {
      console.error('   Duplicate key error — run with --force to reseed: node scripts/seedTD.js --force');
    }
    process.exit(1);
  }
}

seed();
