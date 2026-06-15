/**
 * Normalize user-facing time strings to 24h "HH:MM" used by the TD slot engine.
 */
function normalizeTimeTo24h(input) {
  if (!input || typeof input !== 'string') return null;
  const trimmed = input.trim();

  const ampm = trimmed.match(/^(\d{1,2}):(\d{2})\s*(AM|PM)$/i);
  if (ampm) {
    let h = parseInt(ampm[1], 10);
    const m = ampm[2];
    const mer = ampm[3].toUpperCase();
    if (mer === 'PM' && h !== 12) h += 12;
    if (mer === 'AM' && h === 12) h = 0;
    return `${String(h).padStart(2, '0')}:${m}`;
  }

  const h24 = trimmed.match(/^(\d{1,2}):(\d{2})$/);
  if (h24) {
    const h = parseInt(h24[1], 10);
    const m = h24[2];
    if (h >= 0 && h <= 23) return `${String(h).padStart(2, '0')}:${m}`;
  }

  return null;
}

function formatTime12h(time24) {
  const normalized = normalizeTimeTo24h(time24);
  if (!normalized) return time24;
  const [hStr, m] = normalized.split(':');
  let h = parseInt(hStr, 10);
  const mer = h >= 12 ? 'PM' : 'AM';
  if (h === 0) h = 12;
  else if (h > 12) h -= 12;
  return `${h}:${m} ${mer}`;
}

/** YYYY-MM-DD in local timezone (avoids UTC day-shift for IST users). */
function toCalendarDateStr(input) {
  if (!input) return null;
  if (typeof input === 'string') {
    const m = input.trim().match(/^(\d{4})-(\d{2})-(\d{2})/);
    if (m) return `${m[1]}-${m[2]}-${m[3]}`;
  }
  const d = input instanceof Date ? input : new Date(input);
  if (Number.isNaN(d.getTime())) return null;
  const y = d.getFullYear();
  const mo = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${mo}-${day}`;
}

function calendarDateBounds(input) {
  const dateStr = toCalendarDateStr(input);
  if (!dateStr) return null;
  const [y, mo, d] = dateStr.split('-').map(Number);
  return {
    dateStr,
    startOfDay: new Date(y, mo - 1, d, 0, 0, 0, 0),
    endOfDay: new Date(y, mo - 1, d, 23, 59, 59, 999)
  };
}

function toLocalMidnight(input) {
  const bounds = calendarDateBounds(input);
  return bounds ? bounds.startOfDay : null;
}

function localTodayDateStr() {
  return toCalendarDateStr(new Date());
}

module.exports = {
  normalizeTimeTo24h,
  formatTime12h,
  toCalendarDateStr,
  calendarDateBounds,
  toLocalMidnight,
  localTodayDateStr
};
