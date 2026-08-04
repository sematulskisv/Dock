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
// Duomenu bazes busena
//
// Anksciau nepavykus prisijungti procesas issijungdavo (process.exit) dar
// nepradejes klausytis porto. Bendrame hostinge tai atrodo kaip tuscias 503
// puslapis be jokios uzuominos, ka taisyti. Todel dabar serveris pakyla
// visada, aiskiai parodo problema ir fone bando prisijungti is naujo.
// ---------------------------------------------------------------------
const dbState = {
  ready: false,
  everConnected: false, // ar bent karta pavyko prisijungti (zr. /api/health)
  lastError: null,
  lastCode: null,
  attempts: 0,
};

/** Kuriu butinu kintamuju truksta (DB_PASSWORD gali buti tuscias). */
function missingDbEnv() {
  if (process.env.DATABASE_URL) return [];
  return ['DB_HOST', 'DB_USER', 'DB_NAME'].filter((key) => !process.env[key]);
}

/** Zmogui suprantama uzuomina pagal MySQL klaidos koda. */
function explainDbError(err) {
  const code = (err && (err.code || err.errno)) || null;
  switch (code) {
    case 'ER_ACCESS_DENIED_ERROR':
      return 'neteisingas DB_USER arba DB_PASSWORD';
    case 'ER_BAD_DB_ERROR':
      return 'tokios duomenu bazes nera - patikrinkite DB_NAME';
    case 'ECONNREFUSED':
      return 'MySQL neatsiliepia nurodytu DB_HOST/DB_PORT';
    case 'ENOTFOUND':
      return 'nezinomas DB_HOST';
    case 'ETIMEDOUT':
      return 'baigesi laukimo laikas - patikrinkite DB_HOST ir ugniasiene';
    case 'ER_CON_COUNT_ERROR':
      return 'virsytas vienalaikiu MySQL rysiu limitas - sumazinkite DB_POOL_SIZE';
    default:
      return null;
  }
}

async function tryInitDb() {
  dbState.attempts += 1;
  try {
    await db.initDb();
    dbState.ready = true;
    dbState.everConnected = true;
    dbState.lastError = null;
    dbState.lastCode = null;
    console.log('[server] duomenu baze paruosta');
    return true;
  } catch (err) {
    dbState.ready = false;
    dbState.lastError = err.message;
    dbState.lastCode = err.code || err.errno || null;

    console.error(`[server] nepavyko prisijungti prie duomenu bazes (bandymas ${dbState.attempts}): ${err.message}`);

    const missing = missingDbEnv();
    if (missing.length) {
      console.error(`        TRUKSTA aplinkos kintamuju: ${missing.join(', ')}`);
      console.error('        Juos reikia suvesti hostingo valdymo skyde (Node.js aplikacijos nustatymai).');
    }
    const hint = explainDbError(err);
    if (hint) console.error(`        Tiketina priezastis: ${hint}`);

    return false;
  }
}

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

// API atsakymai niekada nekesuojami
app.use('/api', (req, res, next) => {
  res.setHeader('Cache-Control', 'no-store');
  next();
});

// ---------------------------------------------------------------------
// Sveikatos patikra - veikia visada, ir kai DB neprieinama.
// Detalios priezasties viesai nerodom, ji lieka serverio zurnaluose.
// ---------------------------------------------------------------------
app.get('/api/health', async (req, res) => {
  if (!dbState.ready) {
    const missing = missingDbEnv();
    const body = {
      status: 'degraded',
      database: 'down',
      configured: missing.length === 0,
      timestamp: new Date().toISOString(),
    };

    // Kol nera buve NE VIENO sekmingo prisijungimo, parodom ir MySQL klaidos
    // koda su uzuomina - kitaip pirminio diegimo klaidos diagnozuoti neimanoma
    // neturint hostingo zurnalu. Rodomi tik kintamuju VARDAI ir klaidos kodas,
    // niekada reiksmes. Vienąkart prisijungus tai daugiau nerodoma.
    if (!dbState.everConnected) {
      if (missing.length) body.missing = missing;
      if (dbState.lastCode) body.code = dbState.lastCode;
      const hint = explainDbError({ code: dbState.lastCode });
      if (hint) body.hint = hint;
    }

    return res.status(503).json(body);
  }
  try {
    await db.query('SELECT 1');
    res.json({ status: 'ok', database: 'up', timestamp: new Date().toISOString() });
  } catch (err) {
    dbState.ready = false;
    dbState.lastError = err.message;
    res.status(503).json({ status: 'degraded', database: 'down', timestamp: new Date().toISOString() });
  }
});

// ---------------------------------------------------------------------
// Kol DB neparuosta - nieko i ja neleidziam, bet aiskiai pasakom kodel
// ---------------------------------------------------------------------
const SETUP_PAGE = `<!DOCTYPE html>
<html lang="lt"><head><meta charset="utf-8" />
<meta name="viewport" content="width=device-width, initial-scale=1" />
<title>Reikia konfigūracijos</title>
<style>
  body{margin:0;min-height:100vh;display:grid;place-items:center;padding:24px;
    font:15px/1.55 -apple-system,BlinkMacSystemFont,"Segoe UI",Roboto,sans-serif;
    color:#14181d;background:#f4f5f7}
  .card{max-width:520px;background:#fff;border:1px solid #e3e6ea;border-radius:18px;
    box-shadow:0 4px 16px rgba(16,24,40,.09);padding:28px}
  h1{margin:0 0 6px;font-size:19px}
  p{margin:0 0 12px;color:#5b6572}
  code{font-family:ui-monospace,Menlo,Consolas,monospace;background:#f4f5f7;
    border:1px solid #e3e6ea;border-radius:6px;padding:1px 5px;font-size:13px}
  ul{margin:0 0 12px;padding-left:20px;color:#5b6572}
  .tag{display:inline-block;background:#fff1e8;color:#f04e10;border:1px solid #ffd6bd;
    border-radius:999px;padding:3px 10px;font-size:11px;font-weight:700;
    letter-spacing:.04em;text-transform:uppercase;margin-bottom:12px}
</style></head><body>
<div class="card">
  <span class="tag">Reikia konfigūracijos</span>
  <h1>Programa veikia, bet neprisijungia prie duomenų bazės</h1>
  <p>Serveris pakilo sėkmingai, tačiau nepavyksta pasiekti MySQL. Dažniausiai
     trūksta arba yra neteisingi aplinkos kintamieji.</p>
  <p>Hostingo valdymo skyde, Node.js aplikacijos nustatymuose, patikrinkite:</p>
  <ul>
    <li><code>DB_HOST</code></li>
    <li><code>DB_USER</code></li>
    <li><code>DB_PASSWORD</code></li>
    <li><code>DB_NAME</code></li>
  </ul>
  <p><strong>Pakeitę kintamuosius, programą būtinai perkraukite</strong> — veikiantis
     procesas naujų reikšmių nemato, jos nuskaitomos tik paleidimo metu.</p>
  <p>Tiksli klaidos priežastis įrašyta į serverio vykdymo žurnalą.</p>
  <p><a href="/api/health">/api/health</a></p>
</div></body></html>`;

app.use((req, res, next) => {
  if (dbState.ready) return next();

  if (req.path.startsWith('/api')) {
    return res.status(503).json({ error: 'database_unavailable' });
  }
  if (req.method === 'GET' && !path.extname(req.path)) {
    return res.status(503).type('html').send(SETUP_PAGE);
  }
  return res.status(503).end();
});

// ---------------------------------------------------------------------
// Marsrutai
// ---------------------------------------------------------------------
app.use(attachUser);

app.use('/api', require('./routes/auth'));
app.use('/api/appointments', require('./routes/appointments'));
app.use('/api/docks', require('./routes/docks'));
app.use('/api/users', require('./routes/users'));
app.use('/api/audit', require('./routes/audit'));
app.use('/api/export', require('./routes/export'));

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
  const missing = missingDbEnv();
  if (missing.length) {
    console.error(`[server] TRUKSTA aplinkos kintamuju: ${missing.join(', ')}`);
  }

  await tryInitDb();

  // Kol DB neprieinama - bandom prisijungti kas 30 s. Tai padeda, kai DB
  // laikinai nepasiekiama, BET ne tada, kai keiciami aplinkos kintamieji:
  // mysql2 pool'as sukuriamas is process.env vieną kartą modulio krovimo metu,
  // o veikiantis procesas naujų kintamųjų nemato. Tada butinas perkrovimas.
  const retry = setInterval(async () => {
    if (dbState.ready) return;
    if (await tryInitDb()) {
      console.log('[server] rysys su duomenu baze atkurtas');
    }
  }, 30000);
  retry.unref?.();

  // Kartkartemis isvalom pasibaigusias sesijas
  const purge = setInterval(() => {
    if (!dbState.ready) return;
    db.purgeExpiredSessions().catch((e) => console.error('[server] sesiju valymas:', e.message));
  }, 6 * 60 * 60 * 1000);
  purge.unref?.();

  app.listen(PORT, () => {
    console.log(`[server] Dock veikia ant porto ${PORT}`);
    if (!dbState.ready) {
      console.error('[server] DEMESIO: veikia be duomenu bazes - rodomas konfiguracijos puslapis');
    }
  });
}

start();

module.exports = app;
