'use strict';

const db = require('../db');

const COOKIE_NAME = 'wops_sid';

/** Paprastas slapuku parseris (be papildomu priklausomybiu). */
function parseCookies(header) {
  const out = {};
  if (!header) return out;
  for (const part of String(header).split(';')) {
    const idx = part.indexOf('=');
    if (idx < 0) continue;
    const key = part.slice(0, idx).trim();
    const val = part.slice(idx + 1).trim();
    if (key) out[key] = decodeURIComponent(val);
  }
  return out;
}

// DB stulpelis yra VARCHAR(64), o rysys veikia STRICT rezimu, todel per ilga
// (ar suklastota) X-Forwarded-For reiksme butu ne apkarpyta, o mestu klaida.
function clientIp(req) {
  const fwd = req.headers['x-forwarded-for'];
  const raw = fwd ? String(fwd).split(',')[0].trim() : req.socket?.remoteAddress;
  if (!raw) return null;
  return raw.slice(0, 64);
}

function setSessionCookie(res, token, expiresAt) {
  const secure = String(process.env.COOKIE_SECURE || '').toLowerCase() === 'true';
  res.cookie(COOKIE_NAME, token, {
    httpOnly: true,
    sameSite: 'lax',
    secure,
    expires: expiresAt,
    path: '/',
  });
}

function clearSessionCookie(res) {
  res.clearCookie(COOKIE_NAME, { path: '/' });
}

/** Prisega req.user, jei sesija galioja. Neblokuoja. */
async function attachUser(req, res, next) {
  try {
    const cookies = parseCookies(req.headers.cookie);
    req.sessionToken = cookies[COOKIE_NAME] || null;
    req.user = req.sessionToken ? await db.getSessionUser(req.sessionToken) : null;
  } catch (err) {
    console.error('[auth] sesijos nuskaitymo klaida:', err.message);
    req.user = null;
  }
  next();
}

function requireAuth(req, res, next) {
  if (!req.user) return res.status(401).json({ error: 'unauthorized' });
  next();
}

function requireAdmin(req, res, next) {
  if (!req.user) return res.status(401).json({ error: 'unauthorized' });
  if (req.user.role !== 'admin') return res.status(403).json({ error: 'forbidden' });
  next();
}

module.exports = {
  COOKIE_NAME,
  parseCookies,
  clientIp,
  setSessionCookie,
  clearSessionCookie,
  attachUser,
  requireAuth,
  requireAdmin,
};
