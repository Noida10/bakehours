// ISO-week helpers. Week IDs are formatted "2026-W22".
// All week ranges are Monday–Friday (working days only).

function pad2(n) {
  return String(n).padStart(2, '0');
}

function toISODate(date) {
  return `${date.getUTCFullYear()}-${pad2(date.getUTCMonth() + 1)}-${pad2(
    date.getUTCDate()
  )}`;
}

// Returns the Monday (UTC) of the ISO week containing `date`.
function mondayOf(date) {
  const d = new Date(
    Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate())
  );
  const day = d.getUTCDay(); // 0 = Sun .. 6 = Sat
  const diff = day === 0 ? -6 : 1 - day; // shift back to Monday
  d.setUTCDate(d.getUTCDate() + diff);
  return d;
}

// ISO week number + ISO week-numbering year for a given date.
function isoWeek(date) {
  const d = new Date(
    Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate())
  );
  // Thursday of this week decides the ISO year.
  const day = d.getUTCDay() || 7;
  d.setUTCDate(d.getUTCDate() + 4 - day);
  const year = d.getUTCFullYear();
  const yearStart = new Date(Date.UTC(year, 0, 1));
  const week = Math.ceil(((d - yearStart) / 86400000 + 1) / 7);
  return { year, week };
}

// Build a full week-info object from a date inside that week.
function weekInfoFromDate(date) {
  const monday = mondayOf(date);
  const friday = new Date(monday);
  friday.setUTCDate(monday.getUTCDate() + 4);
  const { year, week } = isoWeek(monday);
  return {
    id: `${year}-W${pad2(week)}`,
    year,
    week,
    startDate: toISODate(monday),
    endDate: toISODate(friday),
    label: formatWeekLabel(week, monday, friday),
  };
}

function weekInfoFromId(weekId) {
  const m = /^(\d{4})-W(\d{1,2})$/.exec(weekId);
  if (!m) return null;
  const year = Number(m[1]);
  const week = Number(m[2]);
  // Find the Monday of ISO week `week` in `year`.
  const jan4 = new Date(Date.UTC(year, 0, 4));
  const jan4Monday = mondayOf(jan4);
  const monday = new Date(jan4Monday);
  monday.setUTCDate(jan4Monday.getUTCDate() + (week - 1) * 7);
  return weekInfoFromDate(monday);
}

const MONTHS = [
  'Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun',
  'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec',
];

// "Week 22 (25 May – 29 May 2026)"
function formatWeekLabel(week, monday, friday) {
  const sameMonth = monday.getUTCMonth() === friday.getUTCMonth();
  const start = `${monday.getUTCDate()} ${MONTHS[monday.getUTCMonth()]}`;
  const end = sameMonth
    ? `${friday.getUTCDate()} ${MONTHS[friday.getUTCMonth()]} ${friday.getUTCFullYear()}`
    : `${friday.getUTCDate()} ${MONTHS[friday.getUTCMonth()]} ${friday.getUTCFullYear()}`;
  return `Week ${week} (${start} – ${end})`;
}

// List of week-info objects: `back` weeks before current through `fwd` after.
function weekRange(centerDate, back = 8, fwd = 1) {
  const center = mondayOf(centerDate);
  const out = [];
  for (let i = -back; i <= fwd; i++) {
    const d = new Date(center);
    d.setUTCDate(center.getUTCDate() + i * 7);
    out.push(weekInfoFromDate(d));
  }
  return out;
}

// Working days (Mon–Fri) between two dates inclusive, as ISO date strings.
function workingDaysBetween(startISO, endISO) {
  const out = [];
  const start = new Date(`${startISO}T00:00:00Z`);
  const end = new Date(`${endISO}T00:00:00Z`);
  const d = new Date(start);
  while (d <= end) {
    const day = d.getUTCDay();
    if (day >= 1 && day <= 5) out.push(toISODate(d));
    d.setUTCDate(d.getUTCDate() + 1);
  }
  return out;
}

// Distinct "YYYY-MM" month keys spanned by a date range.
function monthsBetween(startISO, endISO) {
  const out = new Set();
  const start = new Date(`${startISO}T00:00:00Z`);
  const end = new Date(`${endISO}T00:00:00Z`);
  const d = new Date(Date.UTC(start.getUTCFullYear(), start.getUTCMonth(), 1));
  while (d <= end) {
    out.add(`${d.getUTCFullYear()}-${pad2(d.getUTCMonth() + 1)}`);
    d.setUTCMonth(d.getUTCMonth() + 1);
  }
  return [...out];
}

module.exports = {
  pad2,
  toISODate,
  mondayOf,
  isoWeek,
  weekInfoFromDate,
  weekInfoFromId,
  weekRange,
  workingDaysBetween,
  monthsBetween,
  formatWeekLabel,
  MONTHS,
};
