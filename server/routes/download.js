const express = require('express');
const {
  buildSprintWorkbook,
  buildSprintRangeWorkbook,
  buildVacationWorkbook,
  buildCombinedWorkbook,
} = require('../lib/excel');
const { weekInfoFromId } = require('../lib/weeks');

const router = express.Router();

const XLSX_TYPE =
  'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet';

// Admin-only guard for the whole router.
router.use((req, res, next) => {
  if (!req.user || !req.user.isAdmin) {
    return res.status(403).json({ error: 'Admin only' });
  }
  next();
});

// Accept "2026-W22" or bare "W22" (defaults to current ISO year).
function normalizeWeekId(raw, fallbackYear) {
  if (!raw) return null;
  if (/^\d{4}-W\d{1,2}$/.test(raw)) {
    const [y, w] = raw.split('-W');
    return `${y}-W${String(Number(w)).padStart(2, '0')}`;
  }
  const m = /^W?(\d{1,2})$/.exec(raw);
  if (m) {
    const year = fallbackYear || new Date().getUTCFullYear();
    return `${year}-W${String(Number(m[1])).padStart(2, '0')}`;
  }
  return null;
}

async function send(res, wb, filename) {
  res.setHeader('Content-Type', XLSX_TYPE);
  res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
  await wb.xlsx.write(res);
  res.end();
}

router.get('/sprint/:weekId', async (req, res) => {
  const weekId = normalizeWeekId(req.params.weekId, req.query.year);
  if (!weekId || !weekInfoFromId(weekId)) {
    return res.status(400).json({ error: 'Invalid week id' });
  }
  const wb = await buildSprintWorkbook(weekId);
  await send(res, wb, `sprint-${weekId}.xlsx`);
});

router.get('/sprint-range', async (req, res) => {
  const year = req.query.year ? Number(req.query.year) : new Date().getUTCFullYear();
  const from = normalizeWeekId(req.query.from, year);
  const to = normalizeWeekId(req.query.to, year);
  if (!from || !to) return res.status(400).json({ error: 'Invalid range' });
  const fromW = Number(from.split('-W')[1]);
  const toW = Number(to.split('-W')[1]);
  const fromY = Number(from.split('-W')[0]);
  if (toW < fromW) return res.status(400).json({ error: 'to must be >= from' });
  const ids = [];
  for (let w = fromW; w <= toW; w++) {
    ids.push(`${fromY}-W${String(w).padStart(2, '0')}`);
  }
  const wb = await buildSprintRangeWorkbook(ids);
  await send(res, wb, `sprint-${from}-to-${to}.xlsx`);
});

router.get('/vacation', async (req, res) => {
  const { start, end } = req.query;
  if (!/^\d{4}-\d{2}-\d{2}$/.test(start || '') || !/^\d{4}-\d{2}-\d{2}$/.test(end || '')) {
    return res.status(400).json({ error: 'Invalid date range' });
  }
  const wb = await buildVacationWorkbook(start, end);
  await send(res, wb, `vacation-${start}-to-${end}.xlsx`);
});

router.get('/combined', async (req, res) => {
  const weekId = normalizeWeekId(req.query.week, req.query.year);
  const { vacStart, vacEnd } = req.query;
  if (!weekId || !weekInfoFromId(weekId)) {
    return res.status(400).json({ error: 'Invalid week id' });
  }
  if (!/^\d{4}-\d{2}-\d{2}$/.test(vacStart || '') || !/^\d{4}-\d{2}-\d{2}$/.test(vacEnd || '')) {
    return res.status(400).json({ error: 'Invalid vacation date range' });
  }
  const wb = await buildCombinedWorkbook(weekId, vacStart, vacEnd);
  await send(res, wb, `combined-${weekId}.xlsx`);
});

module.exports = router;
