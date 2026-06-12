// Vercel serverless entry point. The whole Express app is exported as the
// function handler; vercel.json rewrites /api/* here.
module.exports = require('../server/app');
