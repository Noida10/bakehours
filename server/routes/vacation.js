const express = require('express');
const { loadVacation, saveVacationMember } = require('../lib/storage');
const { canWriteMember } = require('../lib/auth');
const { resolveName, hasDataRow } = require('../lib/names');

const router = express.Router();

// GET full month (admin) or just the caller's own entries (member).
router.get('/:month', (req, res) => {
  const data = loadVacation(req.params.month);
  if (!data) return res.status(400).json({ error: 'Invalid month' });

  if (req.user.isAdmin) return res.json(data);

  res.json({
    month: data.month,
    members: { [req.user.name]: data.members[req.user.name] || {} },
  });
});

// PUT one member's vacation entries for the month.
router.put('/:month/:member', (req, res) => {
  const member = resolveName(req.params.member) || req.params.member;
  if (!hasDataRow(member)) {
    return res.status(400).json({ error: 'Unknown member' });
  }
  if (!canWriteMember(req, member)) {
    return res.status(403).json({ error: 'Not allowed to edit this member' });
  }
  const entries = saveVacationMember(req.params.month, member, req.body || {});
  if (entries === null) return res.status(400).json({ error: 'Invalid month' });
  res.json(entries);
});

module.exports = router;
