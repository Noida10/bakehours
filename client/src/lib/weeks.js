// Client-side ISO week + working-day helpers, mirroring the server logic
// so selectors and grids can render without a round-trip.

const MONTHS = [
  'Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun',
  'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec',
];
const DAY_NAMES = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

const pad2 = (n) => String(n).padStart(2, '0');

export function toISODate(date) {
  return `${date.getUTCFullYear()}-${pad2(date.getUTCMonth() + 1)}-${pad2(
    date.getUTCDate()
  )}`;
}

export function mondayOf(date) {
  const d = new Date(
    Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate())
  );
  const day = d.getUTCDay();
  const diff = day === 0 ? -6 : 1 - day;
  d.setUTCDate(d.getUTCDate() + diff);
  return d;
}

export function isoWeek(date) {
  const d = new Date(
    Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate())
  );
  const day = d.getUTCDay() || 7;
  d.setUTCDate(d.getUTCDate() + 4 - day);
  const year = d.getUTCFullYear();
  const yearStart = new Date(Date.UTC(year, 0, 1));
  const week = Math.ceil(((d - yearStart) / 86400000 + 1) / 7);
  return { year, week };
}

export function weekLabel(week, monday, friday) {
  const start = `${monday.getUTCDate()} ${MONTHS[monday.getUTCMonth()]}`;
  const end = `${friday.getUTCDate()} ${MONTHS[friday.getUTCMonth()]} ${friday.getUTCFullYear()}`;
  return `Week ${week} (${start} – ${end})`;
}

export function weekInfoFromDate(date) {
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
    monthKey: `${monday.getUTCFullYear()}-${pad2(monday.getUTCMonth() + 1)}`,
    label: weekLabel(week, monday, friday),
  };
}

export function currentWeekInfo() {
  return weekInfoFromDate(new Date());
}

// List of week-info objects: `back` weeks before through `fwd` after current.
export function weekOptions(back = 12, fwd = 2) {
  const center = mondayOf(new Date());
  const out = [];
  for (let i = fwd; i >= -back; i--) {
    const d = new Date(center);
    d.setUTCDate(center.getUTCDate() + i * 7);
    out.push(weekInfoFromDate(d));
  }
  return out;
}

// Working days (Mon–Fri) inclusive between two ISO date strings.
export function workingDays(startISO, endISO) {
  const out = [];
  const start = new Date(`${startISO}T00:00:00Z`);
  const end = new Date(`${endISO}T00:00:00Z`);
  const d = new Date(start);
  while (d <= end) {
    const day = d.getUTCDay();
    if (day >= 1 && day <= 5) {
      out.push({
        iso: toISODate(d),
        dayName: DAY_NAMES[day],
        label: `${d.getUTCDate()}-${MONTHS[d.getUTCMonth()]}`,
        monthKey: `${d.getUTCFullYear()}-${pad2(d.getUTCMonth() + 1)}`,
      });
    }
    d.setUTCDate(d.getUTCDate() + 1);
  }
  return out;
}

// Default vacation window: current week Monday through +4 weeks Friday.
export function defaultVacationRange() {
  const monday = mondayOf(new Date());
  const end = new Date(monday);
  end.setUTCDate(monday.getUTCDate() + 4 * 7 + 4); // 5 weeks, Mon..Fri
  return { start: toISODate(monday), end: toISODate(end) };
}

export function monthsBetween(startISO, endISO) {
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

export function shortDate(iso) {
  const d = new Date(`${iso}T00:00:00Z`);
  return `${MONTHS[d.getUTCMonth()]} ${d.getUTCDate()}`;
}

export { MONTHS, DAY_NAMES };
