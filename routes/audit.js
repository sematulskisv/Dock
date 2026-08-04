'use strict';

const express = require('express');
const db = require('../db');
const { requireAuth } = require('../middleware/auth');
const { localDayStart, localDayEnd } = require('../lib/timezone');

const router = express.Router();
router.use(requireAuth);
router.use((req, res, next) => {
  if (req.user.role === 'customer') return res.status(403).json({ error: 'forbidden' });
  return next();
});

function page(q) {
  const limit = Math.min(Math.max(Number(q.limit) || 100, 1), 500);
  const offset = Math.max(Number(q.offset) || 0, 0);
  return { limit, offset };
}

// ---------------------------------------------------------------------
// GET /api/audit/status-changes
// Kas ir kada keite vizitu busenas (pagrindinis audito vaizdas)
// ---------------------------------------------------------------------
router.get('/status-changes', async (req, res) => {
  try {
    const params = [];
    const where = [];

    if (req.query.dateFrom) {
      const start = localDayStart(req.query.dateFrom);
      if (start) { where.push('e.changed_at >= ?'); params.push(start); }
    }
    if (req.query.dateTo) {
      const end = localDayEnd(req.query.dateTo);
      if (end) { where.push('e.changed_at < ?'); params.push(end); }
    }
    if (req.query.userId) {
      const id = Number(req.query.userId);
      if (Number.isInteger(id)) { where.push('e.changed_by = ?'); params.push(id); }
    }
    if (req.query.status) { where.push('e.to_status = ?'); params.push(String(req.query.status)); }
    if (req.query.appointmentId) {
      const id = Number(req.query.appointmentId);
      if (Number.isInteger(id)) { where.push('e.appointment_id = ?'); params.push(id); }
    }
    if (req.query.q && String(req.query.q).trim()) {
      const term = `%${String(req.query.q).trim()}%`;
      where.push(`(a.truck_plate LIKE ?
                OR COALESCE(a.reference,'') LIKE ?
                OR COALESCE(u.full_name,'') LIKE ?)`);
      params.push(term, term, term);
    }

    const whereSql = where.length ? `WHERE ${where.join(' AND ')}` : '';
    const { limit, offset } = page(req.query);

    const sql = `
      SELECT e.id, e.appointment_id, e.from_status, e.to_status, e.note, e.changed_at,
             u.id AS user_id, u.full_name AS user_name, u.email AS user_email, u.role AS user_role,
             a.truck_plate, a.trailer_plate, a.operation, a.reference, a.customer, a.carrier,
             a.planned_at, d.code AS dock_code
        FROM status_events e
        LEFT JOIN users u        ON u.id = e.changed_by
        LEFT JOIN appointments a ON a.id = e.appointment_id
        LEFT JOIN docks d        ON d.id = a.dock_id
      ${whereSql}
      ORDER BY e.changed_at DESC, e.id DESC
      LIMIT ${limit} OFFSET ${offset}
    `;
    const countSql = `
      SELECT COUNT(*) AS total
        FROM status_events e
        LEFT JOIN users u        ON u.id = e.changed_by
        LEFT JOIN appointments a ON a.id = e.appointment_id
      ${whereSql}
    `;

    const [list, count] = await Promise.all([
      db.query(sql, params),
      db.query(countSql, params),
    ]);

    res.json({ events: list.rows, total: Number(count.rows[0].total), limit, offset });
  } catch (err) {
    console.error('[audit] status-changes klaida:', err);
    res.status(500).json({ error: 'server_error' });
  }
});

// ---------------------------------------------------------------------
// GET /api/audit - bendras zurnalas (sukurimai, redagavimai, prisijungimai)
// ---------------------------------------------------------------------
router.get('/', async (req, res) => {
  try {
    const params = [];
    const where = [];

    if (req.query.entity) { where.push('l.entity = ?'); params.push(String(req.query.entity)); }
    if (req.query.action) { where.push('l.action = ?'); params.push(String(req.query.action)); }
    if (req.query.userId) {
      const id = Number(req.query.userId);
      if (Number.isInteger(id)) { where.push('l.user_id = ?'); params.push(id); }
    }
    if (req.query.entityId) {
      const id = Number(req.query.entityId);
      if (Number.isInteger(id)) { where.push('l.entity_id = ?'); params.push(id); }
    }
    if (req.query.dateFrom) {
      const start = localDayStart(req.query.dateFrom);
      if (start) { where.push('l.created_at >= ?'); params.push(start); }
    }
    if (req.query.dateTo) {
      const end = localDayEnd(req.query.dateTo);
      if (end) { where.push('l.created_at < ?'); params.push(end); }
    }

    // Operatorius nemato autentifikacijos irasu apie kitus naudotojus
    if (req.user.role !== 'admin') {
      where.push("(l.entity <> 'auth' OR l.user_id = ?)");
      params.push(req.user.id);
    }

    const whereSql = where.length ? `WHERE ${where.join(' AND ')}` : '';
    const { limit, offset } = page(req.query);

    const [list, count] = await Promise.all([
      db.query(`
        SELECT l.*, u.full_name AS user_name, u.email AS user_email, u.role AS user_role
          FROM audit_log l
          LEFT JOIN users u ON u.id = l.user_id
        ${whereSql}
        ORDER BY l.created_at DESC, l.id DESC
        LIMIT ${limit} OFFSET ${offset}
      `, params),
      db.query(`SELECT COUNT(*) AS total FROM audit_log l ${whereSql}`, params),
    ]);

    res.json({
      entries: list.rows.map((r) => ({ ...r, details: db.parseDetails(r.details) })),
      total: Number(count.rows[0].total),
      limit,
      offset,
    });
  } catch (err) {
    console.error('[audit] saraso klaida:', err);
    res.status(500).json({ error: 'server_error' });
  }
});

module.exports = router;
