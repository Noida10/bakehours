// JSON-file storage layer. Reads/writes structured files under /data,
// auto-creating empty structures (with all dev members) when missing.

const fs = require('fs');
const path = require('path');
const { DEV_MEMBERS } = require('./names');
const { weekInfoFromId } = require('./weeks');

const DATA_DIR = path.join(__dirname, '..', '..', 'data');
const SPRINT_DIR = path.join(DATA_DIR, 'sprints');
const VACATION_DIR = path.join(DATA_DIR, 'vacations');
const PROJECT_DIR = path.join(DATA_DIR, 'projects');

for (const dir of [DATA_DIR, SPRINT_DIR, VACATION_DIR, PROJECT_DIR]) {
  fs.mkdirSync(dir, { recursive: true });
}

function readJSON(file) {
  try {
    return JSON.parse(fs.readFileSync(file, 'utf8'));
  } catch {
    return null;
  }
}

function writeJSON(file, data) {
  fs.writeFileSync(file, JSON.stringify(data, null, 2));
}

function emptySprintMember() {
  return {
    project: 0,
    bug: 0,
    training: 0,
    other: 0,
    meeting: 0,
    lead: 0,
    off: 0,
    lastUpdated: null,
  };
}

// ---- Sprints ----------------------------------------------------------

function sprintFile(weekId) {
  return path.join(SPRINT_DIR, `${weekId}.json`);
}

function loadSprint(weekId) {
  const info = weekInfoFromId(weekId);
  if (!info) return null;
  const file = sprintFile(weekId);
  let data = readJSON(file);
  if (!data) {
    data = {
      week: info.week,
      year: info.year,
      startDate: info.startDate,
      endDate: info.endDate,
      members: {},
    };
  }
  // Ensure every dev member has a row.
  let changed = !data.members;
  if (!data.members) data.members = {};
  for (const name of DEV_MEMBERS) {
    if (!data.members[name]) {
      data.members[name] = emptySprintMember();
      changed = true;
    }
  }
  if (changed) writeJSON(file, data);
  return data;
}

function saveSprintMember(weekId, member, fields) {
  const data = loadSprint(weekId);
  if (!data) return null;
  const numericKeys = [
    'project', 'bug', 'training', 'other', 'meeting', 'lead', 'off',
  ];
  const row = data.members[member] || emptySprintMember();
  for (const key of numericKeys) {
    if (fields[key] !== undefined) {
      const n = Number(fields[key]);
      row[key] = Number.isFinite(n) ? n : 0;
    }
  }
  row.lastUpdated = new Date().toISOString();
  data.members[member] = row;
  writeJSON(sprintFile(weekId), data);
  return row;
}

// ---- Vacations --------------------------------------------------------

function vacationFile(month) {
  return path.join(VACATION_DIR, `${month}.json`);
}

function loadVacation(month) {
  if (!/^\d{4}-\d{2}$/.test(month)) return null;
  const file = vacationFile(month);
  let data = readJSON(file);
  if (!data) {
    data = { month, members: {} };
  }
  if (!data.members) data.members = {};
  let changed = false;
  for (const name of DEV_MEMBERS) {
    if (!data.members[name]) {
      data.members[name] = {};
      changed = true;
    }
  }
  if (changed) writeJSON(file, data);
  return data;
}

const VALID_VAC = ['V', 'H', 'WFH'];

function saveVacationMember(month, member, entries) {
  const data = loadVacation(month);
  if (!data) return null;
  const current = data.members[member] || {};
  for (const [date, code] of Object.entries(entries || {})) {
    if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) continue;
    if (code === null || code === '' || code === undefined) {
      delete current[date];
    } else if (VALID_VAC.includes(code)) {
      current[date] = code;
    }
  }
  data.members[member] = current;
  writeJSON(vacationFile(month), data);
  return current;
}

// ---- Projects ---------------------------------------------------------

function projectFile(weekId) {
  return path.join(PROJECT_DIR, `${weekId}.json`);
}

function loadProjects(weekId) {
  const info = weekInfoFromId(weekId);
  if (!info) return null;
  const file = projectFile(weekId);
  let data = readJSON(file);
  if (!data) {
    data = { week: info.week, memberBreakdowns: {}, compiledSummary: [] };
  }
  if (!data.memberBreakdowns) data.memberBreakdowns = {};
  if (!data.compiledSummary) data.compiledSummary = [];
  for (const name of DEV_MEMBERS) {
    if (!data.memberBreakdowns[name]) data.memberBreakdowns[name] = [];
  }
  return data;
}

// Recompile the team-wide summary from member breakdowns.
function compileSummary(memberBreakdowns) {
  const map = new Map();
  for (const [member, entries] of Object.entries(memberBreakdowns || {})) {
    for (const entry of entries || []) {
      const name = (entry.name || '').trim();
      if (!name) continue;
      const days = Number(entry.days) || 0;
      const key = name.toLowerCase();
      if (!map.has(key)) {
        map.set(key, { name, days: 0, contributors: [] });
      }
      const item = map.get(key);
      item.days += days;
      if (!item.contributors.includes(member)) item.contributors.push(member);
    }
  }
  return [...map.values()].sort((a, b) => b.days - a.days);
}

function saveProjectMember(weekId, member, entries) {
  const data = loadProjects(weekId);
  if (!data) return null;
  const clean = (entries || [])
    .map((e) => ({ name: String(e.name || '').trim(), days: Number(e.days) || 0 }))
    .filter((e) => e.name !== '' || e.days > 0);
  data.memberBreakdowns[member] = clean;
  data.compiledSummary = compileSummary(data.memberBreakdowns);
  writeJSON(projectFile(weekId), data);
  return data;
}

function saveCompiledSummary(weekId, summary) {
  const data = loadProjects(weekId);
  if (!data) return null;
  data.compiledSummary = (summary || []).map((s) => ({
    name: String(s.name || '').trim(),
    days: Number(s.days) || 0,
    contributors: Array.isArray(s.contributors) ? s.contributors : [],
  }));
  writeJSON(projectFile(weekId), data);
  return data;
}

module.exports = {
  DATA_DIR,
  loadSprint,
  saveSprintMember,
  loadVacation,
  saveVacationMember,
  loadProjects,
  saveProjectMember,
  saveCompiledSummary,
  compileSummary,
  emptySprintMember,
};
