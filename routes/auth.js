'use strict';

const express = require('express');
const db = require('../db');
const { rateLimit } = require('../middleware/rateLimit');
const {
  requireAuth, setSessionCookie, clearSessionCookie, clientIp,
} = require('../middleware/auth');

const router = express.Router();

const loginLimiter = rateLimit({ windowMs: 15 * 60 * 1000, max: 15 });

function publicUser(u) {
  if (!u) return null;
  return {
    id: u.id,
    email: u.email,
    fullName: u.full_name,
    role: u.role,
  };
}

// POST /api/login
router.post('/login', loginLimiter, async (req, res) => {
  const email = String(req.body?.email || '').trim().toLowerCase();
  const password = String(req.body?.password || '');

  if (!email || !password) {
    return res.status(400).json({ error: 'missing_credentials' });
  }

  try {
    // Palyginimas case-insensitive del utf8mb4_unicode_ci
    const { rows } = await db.query('SELECT * FROM users WHERE email = ? LIMIT 1', [email]);
    const user = rows[0];
    const ok = user && user.is_active
      && db.verifyPassword(password, user.password_hash, user.password_salt);

    if (!ok) {
      await db.writeAudit({
        entity: 'auth',
        action: 'login_failed',
        details: { email },
        userId: user ? user.id : null,
        ip: clientIp(req),
      });
      return res.status(401).json({ error: 'invalid_credentials' });
    }

    const { token, expiresAt } = await db.createSession(user.id, {
      userAgent: req.headers['user-agent'],
      ip: clientIp(req),
    });
    setSessionCookie(res, token, expiresAt);

    await db.query('UPDATE users SET last_login_at = UTC_TIMESTAMP() WHERE id = ?', [user.id]);
    await db.writeAudit({
      entity: 'auth', action: 'login', userId: user.id, ip: clientIp(req),
    });

    res.json({ user: publicUser(user) });
  } catch (err) {
    console.error('[auth] login klaida:', err);
    res.status(500).json({ error: 'server_error' });
  }
});

// GET /api/me
router.get('/me', (req, res) => {
  res.json({ user: publicUser(req.user) });
});

// POST /api/logout
router.post('/logout', async (req, res) => {
  try {
    if (req.sessionToken) await db.destroySession(req.sessionToken);
    if (req.user) {
      await db.writeAudit({ entity: 'auth', action: 'logout', userId: req.user.id, ip: clientIp(req) });
    }
  } catch (err) {
    console.error('[auth] logout klaida:', err.message);
  }
  clearSessionCookie(res);
  res.json({ ok: true });
});

// POST /api/password - naudotojas keicia savo slaptazodi
router.post('/password', requireAuth, rateLimit({ windowMs: 60 * 60 * 1000, max: 10 }), async (req, res) => {
  const currentPassword = String(req.body?.currentPassword || '');
  const newPassword = String(req.body?.newPassword || '');

  if (newPassword.length < 8) {
    return res.status(400).json({ error: 'weak_password' });
  }

  try {
    const { rows } = await db.query('SELECT * FROM users WHERE id = ?', [req.user.id]);
    const user = rows[0];
    if (!user || !db.verifyPassword(currentPassword, user.password_hash, user.password_salt)) {
      return res.status(400).json({ error: 'invalid_current_password' });
    }

    const { hash, salt } = db.hashPassword(newPassword);
    await db.query(
      'UPDATE users SET password_hash = ?, password_salt = ?, updated_at = UTC_TIMESTAMP() WHERE id = ?',
      [hash, salt, user.id]
    );

    // Atjungiam visas kitas sesijas
    await db.query(
      'DELETE FROM sessions WHERE user_id = ? AND token_hash <> ?',
      [user.id, db.hashToken(req.sessionToken || '')]
    );

    await db.writeAudit({
      entity: 'user', entityId: user.id, action: 'password_change', userId: user.id, ip: clientIp(req),
    });
    res.json({ ok: true });
  } catch (err) {
    console.error('[auth] slaptazodzio keitimo klaida:', err);
    res.status(500).json({ error: 'server_error' });
  }
});

module.exports = router;
module.exports.publicUser = publicUser;
