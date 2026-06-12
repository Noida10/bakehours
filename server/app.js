const path = require('path');
const express = require('express');
const { identify, requireUser } = require('./lib/auth');

const authRoutes = require('./routes/auth');
const sprintRoutes = require('./routes/sprint');
const vacationRoutes = require('./routes/vacation');
const projectRoutes = require('./routes/projects');
const downloadRoutes = require('./routes/download');

const app = express();
app.use(express.json());

// Identify the caller from the x-user-name header on every API request.
app.use('/api', identify);

// Public auth endpoints (no user required).
app.use('/api', authRoutes);
app.get('/api/health', (req, res) => res.json({ ok: true }));

// Everything else needs a recognised user.
app.use('/api/sprint', requireUser, sprintRoutes);
app.use('/api/vacation', requireUser, vacationRoutes);
app.use('/api/projects', requireUser, projectRoutes);
app.use('/api/download', requireUser, downloadRoutes);

// Unknown API routes return JSON 404 (matched before static fallback).
app.use('/api', (req, res) => res.status(404).json({ error: 'Not found' }));

// Serve the built client. On Vercel the static files are served by the CDN
// and only /api/* reaches this function, so this block is a no-op there but
// makes `npm start` a single self-contained server locally.
const clientDist = path.join(__dirname, '..', 'client', 'dist');
app.use(express.static(clientDist));
app.get('*', (req, res) => {
  res.sendFile(path.join(clientDist, 'index.html'));
});

// Centralised error handler.
app.use((err, req, res, next) => {
  console.error(err);
  res.status(500).json({ error: 'Internal server error' });
});

module.exports = app;
