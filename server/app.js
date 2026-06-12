const fs = require('fs');
const path = require('path');
const express = require('express');
const { identify, requireUser, requireAdmin } = require('./lib/auth');
const { mode: storageMode, persistent } = require('./lib/store');

const authRoutes = require('./routes/auth');
const sprintRoutes = require('./routes/sprint');
const vacationRoutes = require('./routes/vacation');
const projectRoutes = require('./routes/projects');
const downloadRoutes = require('./routes/download');
const rosterRoutes = require('./routes/roster');
const catalogRoutes = require('./routes/catalog');

const app = express();
// API payloads are live data — never let the browser/CDN serve a cached or
// 304-revalidated copy, which can leave the UI stuck on stale/empty state.
app.set('etag', false);
app.use(express.json());

// Identify the caller from the x-user-name header on every API request.
app.use('/api', identify);

// No-store on all API responses so every fetch returns fresh JSON.
app.use('/api', (req, res, next) => {
  res.set('Cache-Control', 'no-store');
  next();
});

// Public auth endpoints (no user required).
app.use('/api', authRoutes);

// Health also reports the active storage backend ("kv" or "file") so it's
// easy to confirm Vercel KV is connected: a deployed app should report "kv".
app.get('/api/health', (req, res) =>
  res.json({ ok: true, storage: storageMode, persistent })
);

// Storage self-test: writes a throwaway record and reads it back, so it's
// easy to confirm on the live deployment whether persistence actually works
// (and to surface the exact error if it doesn't). Safe to call anytime.
app.get('/api/health/storage', async (req, res) => {
  const store = require('./lib/store');
  const out = { mode: store.mode, persistent: store.persistent };
  const stamp = new Date().toISOString();
  try {
    await store.write('meta', '_selftest', { stamp });
    out.wrote = true;
  } catch (e) {
    out.wrote = false;
    out.writeError = String((e && e.message) || e);
    return res.json(out);
  }
  try {
    const back = await store.read('meta', '_selftest');
    out.readBack = !!(back && back.stamp === stamp);
    out.value = back;
  } catch (e) {
    out.readBack = false;
    out.readError = String((e && e.message) || e);
  }
  res.json(out);
});

// Everything else needs a recognised user.
app.use('/api/sprint', requireUser, sprintRoutes);
app.use('/api/vacation', requireUser, vacationRoutes);
app.use('/api/projects', requireUser, projectRoutes);
app.use('/api/download', requireUser, downloadRoutes);

// Shared project catalog (read: any user; write: admin) and roster
// management (admin only — both Anmol and Julien).
app.use('/api/catalog', requireUser, catalogRoutes);
app.use('/api/roster-admin', requireUser, requireAdmin, rosterRoutes);

// Unknown API routes return JSON 404 (matched before static fallback).
app.use('/api', (req, res) => res.status(404).json({ error: 'Not found' }));

// Serve the built client. On Vercel the static files are served by the CDN
// and only /api/* reaches this function, so this block is a no-op there but
// makes `npm start` a single self-contained server locally.
const clientDist = path.join(__dirname, '..', 'client', 'dist');
const indexHtml = path.join(clientDist, 'index.html');
app.use(express.static(clientDist));
app.get('*', (req, res) => {
  // On Vercel the CDN serves static assets and this file isn't bundled into
  // the function, so guard against a missing index.html.
  if (fs.existsSync(indexHtml)) return res.sendFile(indexHtml);
  res.status(404).json({ error: 'Not found' });
});

// Centralised error handler.
app.use((err, req, res, next) => {
  console.error(err);
  res.status(500).json({ error: 'Internal server error' });
});

module.exports = app;
