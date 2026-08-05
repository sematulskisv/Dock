'use strict';

const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const mysql = require('mysql2/promise');

// ---------------------------------------------------------------------
// Prisijungimas
// ---------------------------------------------------------------------
// Hostingu valdymo skyduose ivedant/iklijuojant reiksmes labai lengva palikti
// nematoma tarpa gale. MySQL tada atmeta prisijungima su ER_ACCESS_DENIED_ERROR,
// o skyde viskas atrodo teisingai. Todel visas reiksmes apkarpom patys.
function env(name, fallback = '') {
  const value = process.env[name];
  return value === undefined || value === null ? fallback : String(value).trim();
}

function buildPoolConfig() {
  const ssl = env('DB_SSL').toLowerCase() === 'true'
    ? { rejectUnauthorized: false }
    : undefined;

  const common = {
    waitForConnections: true,
    connectionLimit: Number(env('DB_POOL_SIZE')) || 10,
    queueLimit: 0,
    charset: 'utf8mb4_unicode_ci',
    // Visos DATETIME reiksmes traktuojamos kaip UTC (zr. db/schema.sql).
    timezone: 'Z',
    dateStrings: false,
    supportBigNumbers: true,
    ssl,
  };

  if (env('DATABASE_URL')) {
    const url = new URL(env('DATABASE_URL'));
    return {
      ...common,
      host: url.hostname,
      port: Number(url.port || 3306),
      user: decodeURIComponent(url.username),
      password: decodeURIComponent(url.password),
      database: url.pathname.replace(/^\//, ''),
    };
  }

  return {
    ...common,
    // Numatytasis 127.0.0.1, o ne 'localhost': nuo Node 17 'localhost'
    // issprendziamas i IPv6 (::1), o MySQL teises paprastai galioja tik
    // 'user@localhost' / 'user@127.0.0.1'.
    host: env('DB_HOST', '127.0.0.1'),
    port: Number(env('DB_PORT')) || 3306,
    // Slaptazodzio NEapkarpom: jame tarpas gali buti tikras simbolis.
    // Vietoj to /api/health parodo, ar reiksme turi tarpu kraštuose.
    user: env('DB_USER', 'root'),
    password: process.env.DB_PASSWORD || '',
    database: env('DB_NAME', 'warehouse_ops'),
  };
}

const pool = mysql.createPool(buildPoolConfig());

// Kiekvienam naujam rysiui - UTC laiko juosta ir grieztas rezimas, kad tylus
// duomenu apkarpymas taptu klaida. Tai paveikia tik DDL numatytasias reiksmes:
// visose savo uzklausose naudojame UTC_TIMESTAMP(), o ne NOW(), todel programa
// veikia teisingai net jei sis ivykis kokioje nors mysql2 versijoje neiviktu.
pool.on('connection', (conn) => {
  Promise.resolve(
    conn.query("SET time_zone = '+00:00', sql_mode = 'STRICT_TRANS_TABLES,NO_ENGINE_SUBSTITUTION'")
  ).catch((err) => console.error('[db] nepavyko paruosti rysio:', err.message));
});

/**
 * Vienodas atsakymo formatas ir SELECT, ir INSERT/UPDATE/DELETE atvejams.
 * SELECT -> { rows }, kiti -> { rowCount, insertId }.
 */
function normalize(result) {
  if (Array.isArray(result)) {
    return { rows: result, rowCount: result.length };
  }
  return {
    rows: [],
    rowCount: result.affectedRows || 0,
    affectedRows: result.affectedRows || 0,
    changedRows: result.changedRows || 0,
    insertId: result.insertId || null,
  };
}

async function query(sql, params = []) {
  const [result] = await pool.query(sql, params);
  return normalize(result);
}

/** Tas pats API, tik ant konkretaus rysio (transakcijai). */
function wrapConnection(conn) {
  return {
    async query(sql, params = []) {
      const [result] = await conn.query(sql, params);
      return normalize(result);
    },
    connection: conn,
  };
}

/** Vykdo funkcija vienoje transakcijoje. */
async function withTransaction(fn) {
  const conn = await pool.getConnection();
  try {
    await conn.beginTransaction();
    const result = await fn(wrapConnection(conn));
    await conn.commit();
    return result;
  } catch (err) {
    try { await conn.rollback(); } catch { /* ignoruojam */ }
    throw err;
  } finally {
    conn.release();
  }
}

// ---------------------------------------------------------------------
// Schema
// ---------------------------------------------------------------------

/** MySQL viena uzklausa nevykdo keliu sakiniu, todel skaidom faila. */
function splitStatements(sql) {
  return sql
    .split('\n')
    .filter((line) => !/^\s*--/.test(line))
    .join('\n')
    .split(';')
    .map((s) => s.trim())
    .filter(Boolean);
}

/** Sukuria schema (idempotentiska) ir uzpildo numatytuosius dokus. */
async function initDb() {
  const sql = fs.readFileSync(path.join(__dirname, 'db', 'schema.sql'), 'utf8');
  for (const statement of splitStatements(sql)) {
    await pool.query(statement);
  }

  // CREATE TABLE IF NOT EXISTS neprideda nauju stulpeliu jau veikianciai
  // instaliacijai, todel sios priedines migracijos yra saugios atnaujinimams.
  const appointmentColumns = [
    ['pallet_count', 'TINYINT UNSIGNED NOT NULL DEFAULT 1'],
    ['handling_minutes', 'SMALLINT UNSIGNED NOT NULL DEFAULT 30'],
    ['origin_country', 'CHAR(2) NULL'],
    ['destination_country', 'CHAR(2) NULL'],
  ];
  for (const [column, definition] of appointmentColumns) {
    const exists = await query(
      `SELECT 1 FROM INFORMATION_SCHEMA.COLUMNS
        WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'appointments' AND COLUMN_NAME = ?`,
      [column]
    );
    if (!exists.rows[0]) await query(`ALTER TABLE appointments ADD COLUMN ${column} ${definition}`);
  }

  const docks = await query('SELECT COUNT(*) AS n FROM docks');
  if (Number(docks.rows[0].n) === 0) {
    for (let i = 1; i <= 6; i += 1) {
      await query(
        'INSERT IGNORE INTO docks (code, name, sort_order) VALUES (?, ?, ?)',
        [`D${i}`, `Vartai ${i}`, i]
      );
    }
    console.log('[db] sukurti 6 numatytieji sandelio vartai');
  }
  return true;
}

/**
 * Pirmasis administratorius bendrame hostinge, kur nera SSH.
 *
 * Sukuriama TIK tada, kai users lentele visiskai tuscia, todel palikti siuos
 * kintamuosius nepavojinga: antro administratoriaus jie nesukurs ir esamo
 * slaptazodzio neperrasys. Tai kartu ir atsarginis kelias, jei kada liktum
 * be nei vienos paskyros.
 */
async function ensureBootstrapAdmin() {
  const email = env('BOOTSTRAP_ADMIN_EMAIL').toLowerCase();
  const password = process.env.BOOTSTRAP_ADMIN_PASSWORD || '';
  const fullName = env('BOOTSTRAP_ADMIN_NAME', 'Administratorius');

  if (!email || !password) return null;

  const { rows } = await query('SELECT COUNT(*) AS n FROM users');
  if (Number(rows[0].n) > 0) return null;

  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    console.error('[db] BOOTSTRAP_ADMIN_EMAIL netinkamas - administratorius nesukurtas');
    return null;
  }
  if (password.length < 8) {
    console.error('[db] BOOTSTRAP_ADMIN_PASSWORD per trumpas (min. 8) - administratorius nesukurtas');
    return null;
  }

  const { hash, salt } = hashPassword(password);
  await query(
    `INSERT INTO users (email, full_name, role, password_hash, password_salt, created_at, updated_at)
     VALUES (?, ?, 'admin', ?, ?, UTC_TIMESTAMP(), UTC_TIMESTAMP())`,
    [email, fullName, hash, salt]
  );

  console.log(`[db] sukurtas pradinis administratorius: ${email}`);
  console.log('[db] SVARBU: pasalinkite BOOTSTRAP_ADMIN_* kintamuosius is aplinkos');
  return email;
}

// ---------------------------------------------------------------------
// Slaptazodziai (scrypt, be isoriniu priklausomybiu)
// ---------------------------------------------------------------------
function hashPassword(password, salt = crypto.randomBytes(16).toString('hex')) {
  const hash = crypto.scryptSync(String(password), salt, 64).toString('hex');
  return { hash, salt };
}

function verifyPassword(password, hash, salt) {
  if (!hash || !salt) return false;
  const candidate = crypto.scryptSync(String(password), salt, 64);
  const expected = Buffer.from(hash, 'hex');
  if (candidate.length !== expected.length) return false;
  return crypto.timingSafeEqual(candidate, expected);
}

// ---------------------------------------------------------------------
// Sesijos
// ---------------------------------------------------------------------
const SESSION_DAYS = 14;

function hashToken(token) {
  return crypto.createHash('sha256').update(token).digest('hex');
}

async function createSession(userId, { userAgent, ip } = {}) {
  const token = crypto.randomBytes(32).toString('hex');
  const expiresAt = new Date(Date.now() + SESSION_DAYS * 24 * 60 * 60 * 1000);
  await query(
    `INSERT INTO sessions (token_hash, user_id, user_agent, ip, expires_at)
     VALUES (?, ?, ?, ?, ?)`,
    [hashToken(token), userId, (userAgent || '').slice(0, 300), ip || null, expiresAt]
  );
  return { token, expiresAt };
}

async function getSessionUser(token) {
  if (!token) return null;
  const { rows } = await query(
    `SELECT u.id, u.email, u.full_name, u.role, u.is_active
       FROM sessions s
       JOIN users u ON u.id = s.user_id
      WHERE s.token_hash = ? AND s.expires_at > UTC_TIMESTAMP()`,
    [hashToken(token)]
  );
  const user = rows[0];
  if (!user || !user.is_active) return null;
  return user;
}

async function destroySession(token) {
  if (!token) return;
  await query('DELETE FROM sessions WHERE token_hash = ?', [hashToken(token)]);
}

async function destroyUserSessions(userId) {
  await query('DELETE FROM sessions WHERE user_id = ?', [userId]);
}

async function purgeExpiredSessions() {
  const res = await query('DELETE FROM sessions WHERE expires_at <= UTC_TIMESTAMP()');
  return res.rowCount;
}

// ---------------------------------------------------------------------
// Auditas
// ---------------------------------------------------------------------
async function writeAudit(
  { entity, entityId = null, action, details = {}, userId = null, ip = null },
  client = null
) {
  const runner = client || { query };
  await runner.query(
    `INSERT INTO audit_log (entity, entity_id, action, details, user_id, ip, created_at)
     VALUES (?, ?, ?, ?, ?, ?, UTC_TIMESTAMP())`,
    [entity, entityId, action, JSON.stringify(details || {}), userId, ip]
  );
}

/** MariaDB JSON stulpeli grazina kaip teksta - suvienodinam. */
function parseDetails(value) {
  if (value === null || value === undefined) return {};
  if (typeof value === 'object') return value;
  try { return JSON.parse(value); } catch { return {}; }
}

module.exports = {
  pool,
  query,
  withTransaction,
  initDb,
  ensureBootstrapAdmin,
  hashPassword,
  verifyPassword,
  hashToken,
  createSession,
  getSessionUser,
  destroySession,
  destroyUserSessions,
  purgeExpiredSessions,
  writeAudit,
  parseDetails,
};
