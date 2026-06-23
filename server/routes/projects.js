const express = require('express');
const {
  loadProjects,
  saveProjectMember,
  saveCompiledSummary,
} = require('../lib/storage');
const { mergeProjects } = require('../lib/catalog');
const { canWriteMember } = require('../lib/auth');
const { resolveName, hasDataRow } = require('../lib/roster');
const asyncHandler = require('../lib/asyncHandler');

const router = express.Router();

// GET project breakdowns. Admin sees all; member sees own + compiled summary.
router.get(
  '/:weekId',
  asyncHandler(async (req, res) => {
    const data = await loadProjects(req.params.weekId);
    if (!data) return res.status(400).json({ error: 'Invalid week id' });

    if (req.user.isAdmin) return res.json(data);

    res.json({
      week: data.week,
      memberBreakdowns: {
        [req.user.name]: data.memberBreakdowns[req.user.name] || [],
      },
      compiledSummary: [],
    });
  })
);

// PUT the compiled summary (Anmol only).
router.put(
  '/:weekId/compiled',
  asyncHandler(async (req, res) => {
    if (!req.user.isAdmin || !req.user.canEdit) {
      return res.status(403).json({ error: 'Only Anmol can edit the summary' });
    }
    const data = await saveCompiledSummary(
      req.params.weekId,
      req.body && req.body.compiledSummary
    );
    if (!data) return res.status(400).json({ error: 'Invalid week id' });
    res.json(data);
  })
);

// PUT one member's project list.
router.put(
  '/:weekId/:member',
  asyncHandler(async (req, res) => {
    const member = (await resolveName(req.params.member)) || req.params.member;
    if (!(await hasDataRow(member))) {
      return res.status(400).json({ error: 'Unknown member' });
    }
    if (!canWriteMember(req, member)) {
      return res.status(403).json({ error: 'Not allowed to edit this member' });
    }
    const entries = (req.body && req.body.entries) || [];
    const data = await saveProjectMember(req.params.weekId, member, entries);
    if (!data) return res.status(400).json({ error: 'Invalid week id' });

    // Any custom project the member typed joins the shared catalog so it
    // shows up in everyone's dropdown. Best-effort — don't fail the save.
    try {
      await mergeProjects(entries.map((e) => e && e.name));
    } catch {
      /* ignore catalog merge errors */
    }
    res.json(data);
  })
);

module.exports = router;
