const express = require('express');
const { loadSprint, saveSprintMember } = require('../lib/storage');
const { canWriteMember } = require('../lib/auth');
const { resolveName, hasDataRow } = require('../lib/names');

const router = express.Router();

// GET full sprint (admin) or just the caller's own row (member).
router.get('/:weekId', (req, res) => {
  const data = loadSprint(req.params.weekId);
  if (!data) return res.status(400).json({ error: 'Invalid week id' });

  if (req.user.isAdmin) return res.json(data);

  const own = data.members[req.user.name] || null;
  res.json({
    week: data.week,
    year: data.year,
    startDate: data.startDate,
    endDate: data.endDate,
    members: own ? { [req.user.name]: own } : {},
  });
});

// PUT one member's sprint row.
router.put('/:weekId/:member', (req, res) => {
  const member = resolveName(req.params.member) || req.params.member;
  if (!hasDataRow(member)) {
    return res.status(400).json({ error: 'Unknown member' });
  }
  if (!canWriteMember(req, member)) {
    return res.status(403).json({ error: 'Not allowed to edit this member' });
  }
  const row = saveSprintMember(req.params.weekId, member, req.body || {});
  if (!row) return res.status(400).json({ error: 'Invalid week id' });
  res.json(row);
});

module.exports = router;
