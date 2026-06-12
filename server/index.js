// Local / self-hosted entry point. On Vercel the app is invoked as a
// serverless function via /api/index.js instead (no listen).
const app = require('./app');

const PORT = process.env.PORT || 3001;
app.listen(PORT, () => {
  console.log(`Equinox India Team Portal API listening on :${PORT}`);
});
