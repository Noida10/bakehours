const express = require('express');
const {
  loadProjects,
  saveProjectMember,
  saveCompiledSummary,
} = require('../lib/storage');
const { canWriteMember } = require('../lib/auth');
const { resolveName, hasDataRow } = require('../lib/names');

const router = express.Router();

// GET project breakdowns. Admin sees all; member sees own + compiled summary.
router.get('/:weekId', (req, res) => {
  const data = loadProjects(req.params.weekId);
  if (!data) return res.status(400).json({ error: 'Invalid week id' });

  if (req.user.isAdmin) return res.json(data);

  res.json({
    week: data.week,
    memberBreakdowns: {
      [req.user.name]: data.memberBreakdowns[req.user.name] || [],
    },
    compiledSummary: [],
  });
});

// PUT one member's project list.
router.put('/:weekId/compiled', (req, res) => {
  // Only Anmol (editing admin) may curate the compiled summary.
  if (!req.user.isAdmin || !req.user.canEdit) {
    return res.status(403).json({ error: 'Only Anmol can edit the summary' });
  }
  const data = saveCompiledSummary(req.params.weekId, req.body && req.body.compiledSummary);
  if (!data) return res.status(400).json({ error: 'Invalid week id' });
  res.json(data);
});

router.put('/:weekId/:member', (req, res) => {
  const member = resolveName(req.params.member) || req.params.member;
  if (!hasDataRow(member)) {
    return res.status(400).json({ error: 'Unknown member' });
  }
  if (!canWriteMember(req, member)) {
    return res.status(403).json({ error: 'Not allowed to edit this member' });
  }
  const data = saveProjectMember(
    req.params.weekId,
    member,
    (req.body && req.body.entries) || []
  );
  if (!data) return res.status(400).json({ error: 'Invalid week id' });
  res.json(data);
});

module.exports = router;
