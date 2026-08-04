'use strict';

const express = require('express');
const db = require('../db');
const { requireAdmin, clientIp } = require('../middleware/auth');

const router = express.Router();
router.use(requireAdmin);

const ROLES = ['admin', 'operator', 'customer'];

const isDuplicate = (err) => err && (err.code === 'ER_DUP_ENTRY' || err.errno === 1062);

function publicUser(u) {
  return {
    id: u.id,
    email: u.email,
    fullName: u.full_name,
    role: u.role,
    isActive: Boolean(u.is_active),
    lastLoginAt: u.last_login_at,
    createdAt: u.created_at,
  };
}

function normEmail(v) {
  return String(v || '').trim().toLowerCase();
}

function validEmail(v) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(v) && v.length <= 190;
}

// GET /api/users
router.get('/', async (req, res) => {
  try {
    const { rows } = await db.query('SELECT * FROM users ORDER BY is_active DESC, full_name ASC');
    res.json({ users: rows.map(publicUser) });
  } catch (err) {
    console.error('[users] saraso klaida:', err);
    res.status(500).json({ error: 'server_error' });
  }
});

// POST /api/users
router.post('/', async (req, res) => {
  const email = normEmail(req.body?.email);
  const fullName = String(req.body?.fullName || '').trim().slice(0, 160);
  const role = String(req.body?.role || 'operator');
  const password = String(req.body?.password || '');

  if (!validEmail(email)) return res.status(400).json({ error: 'invalid_email' });
  if (!fullName) return res.status(400).json({ error: 'invalid_name' });
  if (!ROLES.includes(role)) return res.status(400).json({ error: 'invalid_role' });
  if (password.length < 8) return res.status(400).json({ error: 'weak_password' });

  try {
    const { hash, salt } = db.hashPassword(password);
    const insert = await db.query(
      `INSERT INTO users (email, full_name, role, password_hash, password_salt, created_at, updated_at)
       VALUES (?, ?, ?, ?, ?, UTC_TIMESTAMP(), UTC_TIMESTAMP())`,
      [email, fullName, role, hash, salt]
    );
    const { rows } = await db.query('SELECT * FROM users WHERE id = ?', [insert.insertId]);

    await db.writeAudit({
      entity: 'user', entityId: insert.insertId, action: 'create',
      details: { email, role }, userId: req.user.id, ip: clientIp(req),
    });
    res.status(201).json({ user: publicUser(rows[0]) });
  } catch (err) {
    if (isDuplicate(err)) return res.status(409).json({ error: 'email_exists' });
    console.error('[users] kurimo klaida:', err);
    res.status(500).json({ error: 'server_error' });
  }
});

// PATCH /api/users/:id
router.patch('/:id', async (req, res) => {
  const id = Number(req.params.id);
  if (!Number.isInteger(id)) return res.status(400).json({ error: 'bad_id' });

  const sets = [];
  const values = [];
  const push = (col, val) => { sets.push(`${col} = ?`); values.push(val); };

  if (req.body?.fullName !== undefined) {
    const name = String(req.body.fullName).trim().slice(0, 160);
    if (!name) return res.status(400).json({ error: 'invalid_name' });
    push('full_name', name);
  }
  if (req.body?.email !== undefined) {
    const email = normEmail(req.body.email);
    if (!validEmail(email)) return res.status(400).json({ error: 'invalid_email' });
    push('email', email);
  }
  if (req.body?.role !== undefined) {
    if (!ROLES.includes(req.body.role)) return res.status(400).json({ error: 'invalid_role' });
    if (id === req.user.id && req.body.role !== 'admin') {
      return res.status(400).json({ error: 'cannot_demote_self' });
    }
    push('role', req.body.role);
  }
  if (req.body?.isActive !== undefined) {
    if (id === req.user.id && !req.body.isActive) {
      return res.status(400).json({ error: 'cannot_disable_self' });
    }
    push('is_active', req.body.isActive ? 1 : 0);
  }

  if (!sets.length) return res.status(400).json({ error: 'nothing_to_update' });

  try {
    const upd = await db.query(
      `UPDATE users SET ${sets.join(', ')}, updated_at = UTC_TIMESTAMP() WHERE id = ?`,
      [...values, id]
    );
    if (!upd.affectedRows) return res.status(404).json({ error: 'not_found' });

    const { rows } = await db.query('SELECT * FROM users WHERE id = ?', [id]);

    // Isjungtas naudotojas ar pakeistas el. pastas -> nutraukiam jo sesijas
    if (req.body?.isActive === false || req.body?.email !== undefined) {
      await db.destroyUserSessions(id);
    }

    await db.writeAudit({
      entity: 'user', entityId: id, action: 'update',
      details: { fields: Object.keys(req.body || {}) }, userId: req.user.id, ip: clientIp(req),
    });
    res.json({ user: publicUser(rows[0]) });
  } catch (err) {
    if (isDuplicate(err)) return res.status(409).json({ error: 'email_exists' });
    console.error('[users] atnaujinimo klaida:', err);
    res.status(500).json({ error: 'server_error' });
  }
});

// POST /api/users/:id/password - administratorius nustato nauja slaptazodi
router.post('/:id/password', async (req, res) => {
  const id = Number(req.params.id);
  const password = String(req.body?.password || '');
  if (!Number.isInteger(id)) return res.status(400).json({ error: 'bad_id' });
  if (password.length < 8) return res.status(400).json({ error: 'weak_password' });

  try {
    const { hash, salt } = db.hashPassword(password);
    const upd = await db.query(
      'UPDATE users SET password_hash = ?, password_salt = ?, updated_at = UTC_TIMESTAMP() WHERE id = ?',
      [hash, salt, id]
    );
    if (!upd.affectedRows) return res.status(404).json({ error: 'not_found' });

    await db.destroyUserSessions(id);
    await db.writeAudit({
      entity: 'user', entityId: id, action: 'password_reset',
      userId: req.user.id, ip: clientIp(req),
    });
    res.json({ ok: true });
  } catch (err) {
    console.error('[users] slaptazodzio klaida:', err);
    res.status(500).json({ error: 'server_error' });
  }
});

// DELETE /api/users/:id
router.delete('/:id', async (req, res) => {
  const id = Number(req.params.id);
  if (!Number.isInteger(id)) return res.status(400).json({ error: 'bad_id' });
  if (id === req.user.id) return res.status(400).json({ error: 'cannot_delete_self' });

  try {
    const admins = await db.query(
      "SELECT COUNT(*) AS n FROM users WHERE role = 'admin' AND is_active = 1 AND id <> ?",
      [id]
    );
    if (Number(admins.rows[0].n) === 0) return res.status(400).json({ error: 'last_admin' });

    const found = await db.query('SELECT email FROM users WHERE id = ?', [id]);
    if (!found.rows[0]) return res.status(404).json({ error: 'not_found' });

    await db.query('DELETE FROM users WHERE id = ?', [id]);
    await db.writeAudit({
      entity: 'user', entityId: id, action: 'delete',
      details: { email: found.rows[0].email }, userId: req.user.id, ip: clientIp(req),
    });
    res.json({ ok: true });
  } catch (err) {
    console.error('[users] trynimo klaida:', err);
    res.status(500).json({ error: 'server_error' });
  }
});

module.exports = router;
