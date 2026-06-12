// Domain storage layer. Builds on the pluggable key/value store (`store.js`),
// auto-creating empty structures (with all dev members) when missing.

const { read, write } = require('./store');
const { DEV_MEMBERS } = require('./names');
const { weekInfoFromId } = require('./weeks');

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

async function loadSprint(weekId) {
  const info = weekInfoFromId(weekId);
  if (!info) return null;
  let data = await read('sprints', weekId);
  let changed = false;
  if (!data) {
    data = {
      week: info.week,
      year: info.year,
      startDate: info.startDate,
      endDate: info.endDate,
      members: {},
    };
    changed = true;
  }
  if (!data.members) {
    data.members = {};
    changed = true;
  }
  for (const name of DEV_MEMBERS) {
    if (!data.members[name]) {
      data.members[name] = emptySprintMember();
      changed = true;
    }
  }
  if (changed) await write('sprints', weekId, data);
  return data;
}

async function saveSprintMember(weekId, member, fields) {
  const data = await loadSprint(weekId);
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
  await write('sprints', weekId, data);
  return row;
}

// ---- Vacations --------------------------------------------------------

async function loadVacation(month) {
  if (!/^\d{4}-\d{2}$/.test(month)) return null;
  let data = await read('vacations', month);
  let changed = false;
  if (!data) {
    data = { month, members: {} };
    changed = true;
  }
  if (!data.members) {
    data.members = {};
    changed = true;
  }
  for (const name of DEV_MEMBERS) {
    if (!data.members[name]) {
      data.members[name] = {};
      changed = true;
    }
  }
  if (changed) await write('vacations', month, data);
  return data;
}

const VALID_VAC = ['V', 'H', 'WFH'];

async function saveVacationMember(month, member, entries) {
  const data = await loadVacation(month);
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
  await write('vacations', month, data);
  return current;
}

// ---- Projects ---------------------------------------------------------

async function loadProjects(weekId) {
  const info = weekInfoFromId(weekId);
  if (!info) return null;
  let data = await read('projects', weekId);
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

async function saveProjectMember(weekId, member, entries) {
  const data = await loadProjects(weekId);
  if (!data) return null;
  const clean = (entries || [])
    .map((e) => ({ name: String(e.name || '').trim(), days: Number(e.days) || 0 }))
    .filter((e) => e.name !== '' || e.days > 0);
  data.memberBreakdowns[member] = clean;
  data.compiledSummary = compileSummary(data.memberBreakdowns);
  await write('projects', weekId, data);
  return data;
}

async function saveCompiledSummary(weekId, summary) {
  const data = await loadProjects(weekId);
  if (!data) return null;
  data.compiledSummary = (summary || []).map((s) => ({
    name: String(s.name || '').trim(),
    days: Number(s.days) || 0,
    contributors: Array.isArray(s.contributors) ? s.contributors : [],
  }));
  await write('projects', weekId, data);
  return data;
}

module.exports = {
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
