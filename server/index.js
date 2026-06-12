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

// Identify the caller from the x-user-name header on every request.
app.use('/api', identify);

// Public auth endpoints (no user required).
app.use('/api', authRoutes);

// Everything else needs a recognised user.
app.use('/api/sprint', requireUser, sprintRoutes);
app.use('/api/vacation', requireUser, vacationRoutes);
app.use('/api/projects', requireUser, projectRoutes);
app.use('/api/download', requireUser, downloadRoutes);

app.get('/api/health', (req, res) => res.json({ ok: true }));

// Serve the built client in production.
const clientDist = path.join(__dirname, '..', 'client', 'dist');
app.use(express.static(clientDist));
app.get('*', (req, res) => {
  if (req.path.startsWith('/api')) return res.status(404).json({ error: 'Not found' });
  res.sendFile(path.join(clientDist, 'index.html'));
});

// Centralised error handler.
app.use((err, req, res, next) => {
  console.error(err);
  res.status(500).json({ error: 'Internal server error' });
});

const PORT = process.env.PORT || 3001;
app.listen(PORT, () => {
  console.log(`Equinox India Team Portal API listening on :${PORT}`);
});

module.exports = app;
