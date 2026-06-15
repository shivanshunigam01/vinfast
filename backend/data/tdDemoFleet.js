/**
 * Demo fleet + slot config aligned with website product lineup (VF 6 / VF 7 trims & colours).
 */

const WEBSITE_COLORS = [
  'Infinity Blanc',
  'Crimson Red',
  'Jet Black',
  'Desert Silver',
  'Zenith Grey',
  'Urban Mint'
];

const SLOT_CONFIG_DEFAULTS = {
  slotDuration: 60,
  bufferTime: 15,
  workingStartTime: '09:00',
  workingEndTime: '18:00',
  maxConcurrentBookings: 1,
  autoExpiry: true,
  blockedDates: [],
  slotTimes: ['09:00', '10:15', '11:30', '12:45', '14:00', '15:15', '16:30']
};

/** All showroom trims currently listed on the website */
function buildDemoFleet(branchId) {
  const ins = (months) => {
    const d = new Date();
    d.setMonth(d.getMonth() + months);
    return d;
  };

  return [
    // VF 6 — Earth, Wind, Wind Infinity
    {
      model: 'VF 6',
      variant: 'Earth',
      registrationNo: 'BR01AB1234',
      vinNo: 'VIN6EARTH001PAT',
      color: 'Infinity Blanc',
      batteryPercent: 95,
      currentOdometer: 1240,
      branchId,
      status: 'AVAILABLE',
      insuranceValidity: ins(18),
      serviceDueDate: ins(8)
    },
    {
      model: 'VF 6',
      variant: 'Wind',
      registrationNo: 'BR01AB5678',
      vinNo: 'VIN6WIND002PAT',
      color: 'Crimson Red',
      batteryPercent: 78,
      currentOdometer: 3450,
      branchId,
      status: 'AVAILABLE',
      insuranceValidity: ins(20),
      serviceDueDate: ins(9)
    },
    {
      model: 'VF 6',
      variant: 'Wind Infinity',
      registrationNo: 'BR01EF1234',
      vinNo: 'VIN6WINF003PAT',
      color: 'Urban Mint',
      batteryPercent: 60,
      currentOdometer: 2100,
      branchId,
      status: 'CHARGING',
      insuranceValidity: ins(22),
      serviceDueDate: ins(10)
    },
    // VF 7 — Earth, Wind, Wind Infinity, Sky, Sky Infinity
    {
      model: 'VF 7',
      variant: 'Earth',
      registrationNo: 'BR01GH1234',
      vinNo: 'VIN7EARTH004PAT',
      color: 'Desert Silver',
      batteryPercent: 88,
      currentOdometer: 980,
      branchId,
      status: 'AVAILABLE',
      insuranceValidity: ins(24),
      serviceDueDate: ins(11)
    },
    {
      model: 'VF 7',
      variant: 'Wind',
      registrationNo: 'BR01CD1234',
      vinNo: 'VIN7WIND005PAT',
      color: 'Zenith Grey',
      batteryPercent: 100,
      currentOdometer: 800,
      branchId,
      status: 'AVAILABLE',
      insuranceValidity: ins(26),
      serviceDueDate: ins(12)
    },
    {
      model: 'VF 7',
      variant: 'Wind Infinity',
      registrationNo: 'BR01GH5678',
      vinNo: 'VIN7WINF006PAT',
      color: 'Infinity Blanc',
      batteryPercent: 72,
      currentOdometer: 1560,
      branchId,
      status: 'BOOKED',
      insuranceValidity: ins(20),
      serviceDueDate: ins(9)
    },
    {
      model: 'VF 7',
      variant: 'Sky',
      registrationNo: 'BR01CD5678',
      vinNo: 'VIN7SKY007PAT',
      color: 'Jet Black',
      batteryPercent: 15,
      currentOdometer: 6200,
      branchId,
      status: 'BATTERY_LOW',
      insuranceValidity: ins(16),
      serviceDueDate: ins(6)
    },
    {
      model: 'VF 7',
      variant: 'Sky Infinity',
      registrationNo: 'BR01IJ5678',
      vinNo: 'VIN7SKINF008PAT',
      color: 'Crimson Red',
      batteryPercent: 91,
      currentOdometer: 420,
      branchId,
      status: 'AVAILABLE',
      insuranceValidity: ins(28),
      serviceDueDate: ins(14)
    }
  ];
}

module.exports = {
  WEBSITE_COLORS,
  SLOT_CONFIG_DEFAULTS,
  buildDemoFleet
};
