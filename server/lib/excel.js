// Styled .xlsx generation with exceljs. Dark-blue headers, alternating
// row shading, bold totals, color-coded vacation cells.

const ExcelJS = require('exceljs');
const { getDevMembers } = require('./roster');
const {
  loadSprint,
  loadProjects,
  loadVacation,
  compileSummary,
} = require('./storage');
const {
  weekInfoFromId,
  workingDaysBetween,
  monthsBetween,
  MONTHS,
} = require('./weeks');

const HEADER_FILL = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF1E3A8A' } };
const HEADER_FONT = { bold: true, color: { argb: 'FFFFFFFF' }, size: 11 };
const TOTAL_FILL = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFDBEAFE' } };
const ALT_FILL = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFF1F5F9' } };
const TITLE_FONT = { bold: true, size: 14, color: { argb: 'FF1E3A8A' } };

const VAC_FILLS = {
  V: { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFFCA5A5' } },
  H: { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFFDE68A' } },
  WFH: { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFA7F3D0' } },
};

const SPRINT_COLS = [
  'project', 'bug', 'training', 'other', 'meeting', 'lead', 'off',
];
const SPRINT_HEADERS = [
  'Who', 'Project', 'Bug', 'Training', 'Other', 'Meeting', 'Lead', 'Off',
  'Total', 'Total Dev',
];

const DAY_NAMES = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

const FULL_MONTHS = [
  'January', 'February', 'March', 'April', 'May', 'June',
  'July', 'August', 'September', 'October', 'November', 'December',
];

// "June 08" or, with year, "June 26, 2026" — matches the vacation title format.
function titleDate(iso, withYear) {
  const dt = new Date(`${iso}T00:00:00Z`);
  const d = String(dt.getUTCDate()).padStart(2, '0');
  const base = `${FULL_MONTHS[dt.getUTCMonth()]} ${d}`;
  return withYear ? `${base}, ${dt.getUTCFullYear()}` : base;
}

function thinBorder() {
  const side = { style: 'thin', color: { argb: 'FFCBD5E1' } };
  return { top: side, left: side, bottom: side, right: side };
}

function styleHeaderRow(row) {
  row.eachCell((cell) => {
    cell.fill = HEADER_FILL;
    cell.font = HEADER_FONT;
    cell.alignment = { horizontal: 'center', vertical: 'middle' };
    cell.border = thinBorder();
  });
  row.height = 22;
}

// Merge a member's vacation entries across all months in a date range.
async function loadMergedVacation(startISO, endISO) {
  const months = monthsBetween(startISO, endISO);
  const merged = {};
  for (const month of months) {
    const data = await loadVacation(month);
    for (const [name, entries] of Object.entries(data.members)) {
      merged[name] = { ...(merged[name] || {}), ...entries };
    }
  }
  return merged;
}

// --- Sprint sheet ------------------------------------------------------

function addSprintSheet(workbook, info, sprint, projects, devMembers, sheetName) {
  const ws = workbook.addWorksheet(sheetName || `Week ${info.week}`);

  ws.mergeCells('A1', 'J1');
  ws.getCell('A1').value = `Sprint Report — ${info.label}`;
  ws.getCell('A1').font = TITLE_FONT;
  ws.getCell('A1').alignment = { vertical: 'middle' };
  ws.getRow(1).height = 26;

  const headerRow = ws.addRow(SPRINT_HEADERS);
  styleHeaderRow(headerRow);

  const totals = { project: 0, bug: 0, training: 0, other: 0, meeting: 0, lead: 0, off: 0 };
  let rowIndex = 0;
  for (const name of devMembers) {
    const m0 = sprint.members[name] || {};
    // Project hours = total days in the member's project breakdown. Anmol falls
    // back to his typed value only if he hasn't added a breakdown yet.
    const bd =
      (projects && projects.memberBreakdowns && projects.memberBreakdowns[name]) || [];
    const projectDays = bd.length
      ? bd.reduce((s, e) => s + (Number(e.days) || 0), 0)
      : name === 'Anmol'
      ? Number(m0.project) || 0
      : 0;
    const m = { ...m0, project: projectDays };
    const total = SPRINT_COLS.reduce((s, k) => s + (Number(m[k]) || 0), 0);
    const totalDev = (Number(m.project) || 0) + (Number(m.bug) || 0) + (Number(m.training) || 0);
    for (const k of SPRINT_COLS) totals[k] += Number(m[k]) || 0;
    const row = ws.addRow([
      name,
      ...SPRINT_COLS.map((k) => Number(m[k]) || 0),
      total,
      totalDev,
    ]);
    const alt = rowIndex % 2 === 1;
    row.eachCell((cell, col) => {
      cell.border = thinBorder();
      if (alt) cell.fill = ALT_FILL;
      if (col === 1) cell.font = { bold: true };
      else cell.alignment = { horizontal: 'center' };
    });
    rowIndex++;
  }

  const grandTotal = SPRINT_COLS.reduce((s, k) => s + totals[k], 0);
  const grandDev = totals.project + totals.bug + totals.training;
  const totalRow = ws.addRow([
    'Total',
    ...SPRINT_COLS.map((k) => totals[k]),
    grandTotal,
    grandDev,
  ]);
  totalRow.eachCell((cell, col) => {
    cell.fill = TOTAL_FILL;
    cell.font = { bold: true };
    cell.border = thinBorder();
    if (col > 1) cell.alignment = { horizontal: 'center' };
  });

  // Project breakdown section.
  ws.addRow([]);
  const pbTitleRow = ws.addRow(['Team Project Breakdown']);
  pbTitleRow.getCell(1).font = TITLE_FONT;
  const pbHeader = ws.addRow(['Project', 'Days']);
  styleHeaderRow(pbHeader);
  const summary = (projects.compiledSummary || []).length
    ? projects.compiledSummary
    : compileSummary(projects.memberBreakdowns);
  let pbIndex = 0;
  for (const item of summary) {
    const row = ws.addRow([item.name, Number(item.days) || 0]);
    const alt = pbIndex % 2 === 1;
    row.eachCell((cell) => {
      cell.border = thinBorder();
      if (alt) cell.fill = ALT_FILL;
    });
    pbIndex++;
  }

  ws.getColumn(1).width = 26;
  for (let c = 2; c <= 10; c++) ws.getColumn(c).width = 11;
  return ws;
}

// --- Vacation sheet ----------------------------------------------------

function addVacationSheet(workbook, startISO, endISO, vacData, devMembers, sheetName) {
  const days = workingDaysBetween(startISO, endISO);
  const lastCol = days.length + 2; // Sr. + Team Member + one per day

  const ws = workbook.addWorksheet(sheetName || 'Vacation Planner');

  // Title.
  ws.mergeCells(1, 1, 1, lastCol);
  ws.getCell('A1').value = `Team Vacation Planner — ${titleDate(
    startISO,
    false
  )} to ${titleDate(endISO, true)}`;
  ws.getCell('A1').font = TITLE_FONT;
  ws.getRow(1).height = 26;

  // Legend at the top.
  const legendRow = ws.addRow([
    'Legend:', '', 'V = Vacation', 'H = Half Day', 'WFH = Work From Home',
  ]);
  legendRow.getCell(1).font = { bold: true };
  legendRow.getCell(3).fill = VAC_FILLS.V;
  legendRow.getCell(4).fill = VAC_FILLS.H;
  legendRow.getCell(5).fill = VAC_FILLS.WFH;
  ws.addRow([]); // spacer

  // Two header rows: Sr. / Team Member / dates, then weekday names.
  const dateHeader = ws.addRow([
    'Sr.',
    'Team Member',
    ...days.map((d) => {
      const dt = new Date(`${d}T00:00:00Z`);
      return `${String(dt.getUTCDate()).padStart(2, '0')}-${MONTHS[dt.getUTCMonth()]}`;
    }),
  ]);
  styleHeaderRow(dateHeader);
  const dayHeader = ws.addRow([
    '',
    '',
    ...days.map((d) => DAY_NAMES[new Date(`${d}T00:00:00Z`).getUTCDay()]),
  ]);
  styleHeaderRow(dayHeader);

  devMembers.forEach((name, i) => {
    const entries = vacData[name] || {};
    const row = ws.addRow([i + 1, name, ...days.map((d) => entries[d] || '')]);
    row.eachCell((cell, col) => {
      cell.border = thinBorder();
      cell.alignment = { horizontal: 'center' };
      if (col === 1) {
        cell.alignment = { horizontal: 'center' };
      } else if (col === 2) {
        cell.font = { bold: true };
        cell.alignment = { horizontal: 'left' };
      } else {
        const code = days[col - 3] ? entries[days[col - 3]] : '';
        if (code && VAC_FILLS[code]) cell.fill = VAC_FILLS[code];
      }
    });
  });

  ws.getColumn(1).width = 5;
  ws.getColumn(2).width = 16;
  for (let c = 3; c <= lastCol; c++) ws.getColumn(c).width = 9;
  return ws;
}

// --- Availability summary sheet ---------------------------------------

function addAvailabilitySheet(workbook, startISO, endISO, vacData, devMembers) {
  const days = workingDaysBetween(startISO, endISO);

  const ws = workbook.addWorksheet('Availability Summary');
  ws.mergeCells('A1', 'E1');
  ws.getCell('A1').value = 'Team Availability Summary';
  ws.getCell('A1').font = TITLE_FONT;
  ws.getRow(1).height = 26;

  const header = ws.addRow(['Date', 'Day', 'Available', 'Off (V)', 'Half/WFH']);
  styleHeaderRow(header);

  let idx = 0;
  for (const d of days) {
    const dt = new Date(`${d}T00:00:00Z`);
    let off = 0;
    let partial = 0;
    for (const name of devMembers) {
      const code = (vacData[name] || {})[d];
      if (code === 'V') off++;
      else if (code === 'H' || code === 'WFH') partial++;
    }
    const available = devMembers.length - off;
    const row = ws.addRow([
      `${dt.getUTCDate()} ${MONTHS[dt.getUTCMonth()]}`,
      DAY_NAMES[dt.getUTCDay()],
      `${available}/${devMembers.length}`,
      off,
      partial,
    ]);
    const alt = idx % 2 === 1;
    row.eachCell((cell) => {
      cell.border = thinBorder();
      if (alt) cell.fill = ALT_FILL;
    });
    if (off >= 2) {
      row.getCell(4).fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFFDBA74' } };
      row.getCell(4).font = { bold: true };
    }
    idx++;
  }

  ws.getColumn(1).width = 14;
  ws.getColumn(2).width = 8;
  ws.getColumn(3).width = 12;
  ws.getColumn(4).width = 10;
  ws.getColumn(5).width = 12;
  return ws;
}

// --- Public builders ---------------------------------------------------

async function buildSprintWorkbook(weekId) {
  const wb = new ExcelJS.Workbook();
  const devMembers = await getDevMembers();
  const info = weekInfoFromId(weekId);
  const sprint = await loadSprint(weekId);
  const projects = await loadProjects(weekId);
  addSprintSheet(wb, info, sprint, projects, devMembers);
  return wb;
}

async function buildSprintRangeWorkbook(weekIds) {
  const wb = new ExcelJS.Workbook();
  const devMembers = await getDevMembers();
  for (const weekId of weekIds) {
    const info = weekInfoFromId(weekId);
    const sprint = await loadSprint(weekId);
    const projects = await loadProjects(weekId);
    addSprintSheet(wb, info, sprint, projects, devMembers, `Week ${info.week}`);
  }
  return wb;
}

async function buildVacationWorkbook(startISO, endISO) {
  const wb = new ExcelJS.Workbook();
  const devMembers = await getDevMembers();
  const vacData = await loadMergedVacation(startISO, endISO);
  addVacationSheet(wb, startISO, endISO, vacData, devMembers);
  return wb;
}

async function buildCombinedWorkbook(weekId, startISO, endISO) {
  const wb = new ExcelJS.Workbook();
  const devMembers = await getDevMembers();
  const info = weekInfoFromId(weekId);
  const sprint = await loadSprint(weekId);
  const projects = await loadProjects(weekId);
  const vacData = await loadMergedVacation(startISO, endISO);
  addSprintSheet(wb, info, sprint, projects, devMembers, 'Sprint Report');
  addVacationSheet(wb, startISO, endISO, vacData, devMembers, 'Vacation Planner');
  addAvailabilitySheet(wb, startISO, endISO, vacData, devMembers);
  return wb;
}

module.exports = {
  buildSprintWorkbook,
  buildSprintRangeWorkbook,
  buildVacationWorkbook,
  buildCombinedWorkbook,
};
