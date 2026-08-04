'use strict';

const express = require('express');
const db = require('../db');
const { requireAuth, requireAdmin, clientIp } = require('../middleware/auth');

const router = express.Router();

const isDuplicate = (err) => err && (err.code === 'ER_DUP_ENTRY' || err.errno === 1062);

// GET /api/docks - mato visi prisijunge naudotojai
router.get('/', requireAuth, async (req, res) => {
  try {
    const { rows } = await db.query('SELECT * FROM docks ORDER BY sort_order, code');
    res.json({ docks: rows });
  } catch (err) {
    console.error('[docks] saraso klaida:', err);
    res.status(500).json({ error: 'server_error' });
  }
});

// POST /api/docks
router.post('/', requireAdmin, async (req, res) => {
  const code = String(req.body?.code || '').trim().slice(0, 32);
  const name = String(req.body?.name || '').trim().slice(0, 120) || null;
  const sortOrder = Number(req.body?.sortOrder) || 0;
  if (!code) return res.status(400).json({ error: 'invalid_code' });

  try {
    const insert = await db.query(
      'INSERT INTO docks (code, name, sort_order, created_at) VALUES (?, ?, ?, UTC_TIMESTAMP())',
      [code, name, sortOrder]
    );
    const { rows } = await db.query('SELECT * FROM docks WHERE id = ?', [insert.insertId]);

    await db.writeAudit({
      entity: 'dock', entityId: insert.insertId, action: 'create',
      details: { code }, userId: req.user.id, ip: clientIp(req),
    });
    res.status(201).json({ dock: rows[0] });
  } catch (err) {
    if (isDuplicate(err)) return res.status(409).json({ error: 'code_exists' });
    console.error('[docks] kurimo klaida:', err);
    res.status(500).json({ error: 'server_error' });
  }
});

// PATCH /api/docks/:id
router.patch('/:id', requireAdmin, async (req, res) => {
  const id = Number(req.params.id);
  if (!Number.isInteger(id)) return res.status(400).json({ error: 'bad_id' });

  const sets = [];
  const values = [];
  const push = (col, val) => { sets.push(`${col} = ?`); values.push(val); };

  if (req.body?.code !== undefined) {
    const code = String(req.body.code).trim().slice(0, 32);
    if (!code) return res.status(400).json({ error: 'invalid_code' });
    push('code', code);
  }
  if (req.body?.name !== undefined) push('name', String(req.body.name).trim().slice(0, 120) || null);
  if (req.body?.isActive !== undefined) push('is_active', req.body.isActive ? 1 : 0);
  if (req.body?.sortOrder !== undefined) push('sort_order', Number(req.body.sortOrder) || 0);

  if (!sets.length) return res.status(400).json({ error: 'nothing_to_update' });

  try {
    const upd = await db.query(
      `UPDATE docks SET ${sets.join(', ')} WHERE id = ?`,
      [...values, id]
    );
    if (!upd.affectedRows) return res.status(404).json({ error: 'not_found' });

    const { rows } = await db.query('SELECT * FROM docks WHERE id = ?', [id]);
    await db.writeAudit({
      entity: 'dock', entityId: id, action: 'update',
      details: { fields: Object.keys(req.body || {}) }, userId: req.user.id, ip: clientIp(req),
    });
    res.json({ dock: rows[0] });
  } catch (err) {
    if (isDuplicate(err)) return res.status(409).json({ error: 'code_exists' });
    console.error('[docks] atnaujinimo klaida:', err);
    res.status(500).json({ error: 'server_error' });
  }
});

// DELETE /api/docks/:id - vizitai islieka, tik atsiejami (ON DELETE SET NULL)
router.delete('/:id', requireAdmin, async (req, res) => {
  const id = Number(req.params.id);
  if (!Number.isInteger(id)) return res.status(400).json({ error: 'bad_id' });

  try {
    const found = await db.query('SELECT code FROM docks WHERE id = ?', [id]);
    if (!found.rows[0]) return res.status(404).json({ error: 'not_found' });

    await db.query('DELETE FROM docks WHERE id = ?', [id]);
    await db.writeAudit({
      entity: 'dock', entityId: id, action: 'delete',
      details: { code: found.rows[0].code }, userId: req.user.id, ip: clientIp(req),
    });
    res.json({ ok: true });
  } catch (err) {
    console.error('[docks] trynimo klaida:', err);
    res.status(500).json({ error: 'server_error' });
  }
});

module.exports = router;
