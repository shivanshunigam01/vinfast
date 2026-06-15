/**
 * cleanTD.js — wipes ALL Test Drive module data.
 * Run: node scripts/cleanTD.js
 * Safe: does NOT touch Admins, Leads, Enquiries, SiteConfig, or any other module.
 */
require('dotenv').config();
const mongoose = require('mongoose');

const MONGO_URI = process.env.MONGO_URI;
if (!MONGO_URI) { console.error('❌  MONGO_URI not set in .env'); process.exit(1); }

const COLLECTIONS = [
  'tdbookings',
  'tdlogs',
  'tdfeedbacks',
  'tdnotifications',
  'tdslotconfigs',
  'customers',
  'drivinglicenses',
  'demovehicles',
  'branches',
  'charginglogs',
  'repairlogs',
  'vehiclestatuslogs',
  'leadstagehistories',
];

(async () => {
  console.log('🔌  Connecting to MongoDB…');
  await mongoose.connect(MONGO_URI);
  console.log('✅  Connected.\n');

  const db = mongoose.connection.db;
  const existing = (await db.listCollections().toArray()).map(c => c.name);

  let totalDeleted = 0;
  for (const col of COLLECTIONS) {
    if (!existing.includes(col)) {
      console.log(`   ⏭  ${col} — does not exist, skipping`);
      continue;
    }
    const result = await db.collection(col).deleteMany({});
    totalDeleted += result.deletedCount;
    console.log(`   🗑  ${col.padEnd(22)} — ${result.deletedCount} documents removed`);
  }

  console.log(`\n✅  Done. Total removed: ${totalDeleted} documents.`);
  await mongoose.disconnect();
  process.exit(0);
})().catch(err => {
  console.error('❌  Error:', err.message);
  process.exit(1);
});
