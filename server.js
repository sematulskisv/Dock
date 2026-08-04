'use strict';

require('dotenv').config();

const path = require('path');
const express = require('express');

const db = require('./db');
const { attachUser } = require('./middleware/auth');

const app = express();
const PORT = Number(process.env.PORT || 3000);

app.set('trust proxy', 1);
app.disable('x-powered-by');

// ---------------------------------------------------------------------
// Saugumo antrastes
// ---------------------------------------------------------------------
app.use((req, res, next) => {
  res.setHeader('X-Content-Type-Options', 'nosniff');
  res.setHeader('X-Frame-Options', 'SAMEORIGIN');
  res.setHeader('Referrer-Policy', 'same-origin');
  res.setHeader('Permissions-Policy', 'geolocation=(), microphone=(), camera=()');
  res.setHeader(
    'Content-Security-Policy',
    [
      "default-src 'self'",
      "script-src 'self'",
      "style-src 'self' 'unsafe-inline'",
      "img-src 'self' data:",
      "connect-src 'self'",
      "font-src 'self'",
      "base-uri 'self'",
      "form-action 'self'",
      "frame-ancestors 'self'",
    ].join('; ')
  );
  next();
});

app.use(express.json({ limit: '256kb' }));
app.use(attachUser);

// API atsakymai niekada nekesuojami
app.use('/api', (req, res, next) => {
  res.setHeader('Cache-Control', 'no-store');
  next();
});

// ---------------------------------------------------------------------
// Marsrutai
// ---------------------------------------------------------------------
app.use('/api', require('./routes/auth'));
app.use('/api/appointments', require('./routes/appointments'));
app.use('/api/docks', require('./routes/docks'));
app.use('/api/users', require('./routes/users'));
app.use('/api/audit', require('./routes/audit'));
app.use('/api/export', require('./routes/export'));

app.get('/api/health', async (req, res) => {
  try {
    await db.query('SELECT 1');
    res.json({ status: 'ok', database: 'up', timestamp: new Date().toISOString() });
  } catch (err) {
    res.status(503).json({ status: 'degraded', database: 'down', error: err.message });
  }
});

app.use('/api', (req, res) => res.status(404).json({ error: 'not_found' }));

// ---------------------------------------------------------------------
// Statiniai failai + SPA
// ---------------------------------------------------------------------
app.use(express.static(path.join(__dirname, 'public'), {
  maxAge: process.env.NODE_ENV === 'production' ? '1h' : 0,
  setHeaders(res, filePath) {
    if (filePath.endsWith('index.html')) res.setHeader('Cache-Control', 'no-cache');
  },
}));

app.get('*', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

// Bendras klaidu gaudytuvas
app.use((err, req, res, next) => { // eslint-disable-line no-unused-vars
  console.error('[server] neapdorota klaida:', err);
  if (res.headersSent) return;
  res.status(500).json({ error: 'server_error' });
});

// ---------------------------------------------------------------------
// Startas
// ---------------------------------------------------------------------
async function start() {
  try {
    await db.initDb();
    console.log('[server] duomenu baze paruosta');
  } catch (err) {
    console.error('[server] nepavyko paruosti duomenu bazes:', err.message);
    console.error('        patikrinkite DB_HOST / DB_USER / DB_PASSWORD / DB_NAME (arba DATABASE_URL) .env faile');
    process.exit(1);
  }

  // Kartkartemis isvalom pasibaigusias sesijas
  setInterval(() => {
    db.purgeExpiredSessions().catch((e) => console.error('[server] sesiju valymas:', e.message));
  }, 6 * 60 * 60 * 1000).unref?.();

  app.listen(PORT, () => {
    console.log(`[server] Warehouse Ops veikia: http://localhost:${PORT}`);
  });
}

start();

module.exports = app;
