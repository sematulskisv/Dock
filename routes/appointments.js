'use strict';

const express = require('express');
const db = require('../db');
const { requireAuth, requireAdmin, clientIp } = require('../middleware/auth');
const A = require('../lib/appointments');

const router = express.Router();

router.use(requireAuth);

// ---------------------------------------------------------------------
// Validacija
// ---------------------------------------------------------------------
function str(value, max = 200) {
  if (value === undefined || value === null) return null;
  const s = String(value).trim();
  if (!s) return null;
  return s.slice(0, max);
}

function parseDate(value) {
  if (!value) return null;
  const d = new Date(value);
  return Number.isFinite(d.getTime()) ? d : null;
}

/** Bendra vizito lauku validacija. `partial` - PUT atveju netikrinam trukstamu. */
function validateBody(body, { partial = false } = {}) {
  const errors = [];
  const data = {};

  if (!partial || body.plannedAt !== undefined) {
    const planned = parseDate(body.plannedAt);
    if (!planned) errors.push('plannedAt');
    else data.planned_at = planned;
  }

  if (!partial || body.operation !== undefined) {
    const op = str(body.operation, 20);
    if (!A.OPERATIONS.includes(op)) errors.push('operation');
    else data.operation = op;
  }

  if (!partial || body.truckPlate !== undefined) {
    const plate = str(body.truckPlate, 32);
    if (!plate) errors.push('truckPlate');
    else data.truck_plate = plate.toUpperCase();
  }

  if (body.trailerPlate !== undefined) {
    const p = str(body.trailerPlate, 32);
    data.trailer_plate = p ? p.toUpperCase() : null;
  }
  if (body.driverName !== undefined) data.driver_name = str(body.driverName, 120);
  if (body.driverPhone !== undefined) data.driver_phone = str(body.driverPhone, 40);
  if (body.carrier !== undefined) data.carrier = str(body.carrier, 160);
  if (body.customer !== undefined) data.customer = str(body.customer, 160);
  if (body.reference !== undefined) data.reference = str(body.reference, 120);
  if (body.notes !== undefined) data.notes = str(body.notes, 2000);

  if (body.dockId !== undefined) {
    if (body.dockId === null || body.dockId === '' || body.dockId === 'none') {
      data.dock_id = null;
    } else {
      const id = Number(body.dockId);
      if (!Number.isInteger(id) || id <= 0) errors.push('dockId');
      else data.dock_id = id;
    }
  }

  return { errors, data };
}

function pageParams(q) {
  const limit = Math.min(Math.max(Number(q.limit) || 100, 1), 500);
  const offset = Math.max(Number(q.offset) || 0, 0);
  return { limit, offset };
}

/** Vienas vizitas su apskaiciuotais laukais (naudojam po INSERT/UPDATE). */
async function fetchOne(id, runner = db) {
  const { rows } = await runner.query(`${A.baseSelect()} WHERE a.id = ?`, [id]);
  return rows[0] || null;
}

// ---------------------------------------------------------------------
// GET /api/appointments/options - reiksmes filtru sarasams
// (turi buti pries /:id)
// ---------------------------------------------------------------------
router.get('/options', async (req, res) => {
  try {
    const [docks, customers, carriers] = await Promise.all([
      db.query('SELECT id, code, name, is_active FROM docks ORDER BY sort_order, code'),
      db.query(`SELECT DISTINCT customer AS value FROM appointments
                 WHERE customer IS NOT NULL AND customer <> '' ORDER BY customer`),
      db.query(`SELECT DISTINCT carrier AS value FROM appointments
                 WHERE carrier IS NOT NULL AND carrier <> '' ORDER BY carrier`),
    ]);
    res.json({
      docks: docks.rows,
      customers: customers.rows.map((r) => r.value),
      carriers: carriers.rows.map((r) => r.value),
      statuses: A.STATUSES,
      operations: A.OPERATIONS,
      waitingAlertMinutes: A.waitingAlertMinutes(),
      lateGraceMinutes: A.lateGraceMinutes(),
    });
  } catch (err) {
    console.error('[appointments] options klaida:', err);
    res.status(500).json({ error: 'server_error' });
  }
});

// ---------------------------------------------------------------------
// GET /api/appointments - sarasas su filtrais
// ---------------------------------------------------------------------
router.get('/', async (req, res) => {
  try {
    const { whereSql, params } = A.buildFilters(req.query);
    const { limit, offset } = pageParams(req.query);

    const sortable = {
      planned_at: 'a.planned_at',
      status: 'a.status',
      dock: 'd.sort_order',
      customer: 'a.customer',
      carrier: 'a.carrier',
      truck: 'a.truck_plate',
    };
    const sortCol = sortable[req.query.sort] || 'a.planned_at';
    const sortDir = String(req.query.dir).toLowerCase() === 'desc' ? 'DESC' : 'ASC';

    const listSql = `
      ${A.baseSelect()}
      ${whereSql}
      ORDER BY ${sortCol} ${sortDir}, a.id ASC
      LIMIT ${limit} OFFSET ${offset}
    `;

    const countSql = `
      SELECT COUNT(*) AS total
        FROM appointments a
        LEFT JOIN docks d ON d.id = a.dock_id
      ${whereSql}
    `;

    const [list, count] = await Promise.all([
      db.query(listSql, params),
      db.query(countSql, params),
    ]);

    res.json({
      appointments: list.rows,
      total: Number(count.rows[0].total),
      limit,
      offset,
      waitingAlertMinutes: A.waitingAlertMinutes(),
      lateGraceMinutes: A.lateGraceMinutes(),
      serverTime: new Date().toISOString(),
    });
  } catch (err) {
    console.error('[appointments] saraso klaida:', err);
    res.status(500).json({ error: 'server_error' });
  }
});

// ---------------------------------------------------------------------
// GET /api/appointments/stats - suvestine (pagal tuos pacius filtrus)
// ---------------------------------------------------------------------
router.get('/stats', async (req, res) => {
  try {
    const { whereSql, params } = A.buildFilters(req.query);
    const wait = A.waitingAlertMinutes();
    const grace = A.lateGraceMinutes();

    const sql = `
      SELECT
        COUNT(*) AS total,
        COUNT(CASE WHEN a.operation = 'loading'   THEN 1 END) AS loading,
        COUNT(CASE WHEN a.operation = 'unloading' THEN 1 END) AS unloading,
        COUNT(CASE WHEN a.status IN ('planned','arrived','waiting','at_dock','in_progress') THEN 1 END) AS active,
        COUNT(CASE WHEN a.status IN ('completed','departed') THEN 1 END) AS completed,
        COUNT(CASE WHEN a.status = 'cancelled' THEN 1 END) AS cancelled,
        COUNT(CASE WHEN a.status IN ('planned','arrived','waiting')
                    AND UTC_TIMESTAMP() > a.planned_at + INTERVAL ${grace} MINUTE
                   THEN 1 END) AS delayed,
        COUNT(CASE WHEN a.status IN ('arrived','waiting')
                    AND COALESCE(a.waiting_since, a.arrived_at) IS NOT NULL
                    AND UTC_TIMESTAMP() > COALESCE(a.waiting_since, a.arrived_at) + INTERVAL ${wait} MINUTE
                   THEN 1 END) AS waiting_long
      FROM appointments a
      LEFT JOIN docks d ON d.id = a.dock_id
      ${whereSql}
    `;

    const { rows } = await db.query(sql, params);
    const stats = {};
    for (const [k, v] of Object.entries(rows[0])) stats[k] = Number(v);
    res.json({ stats });
  } catch (err) {
    console.error('[appointments] stats klaida:', err);
    res.status(500).json({ error: 'server_error' });
  }
});

// ---------------------------------------------------------------------
// GET /api/appointments/:id - vienas vizitas su pilna istorija
// ---------------------------------------------------------------------
router.get('/:id', async (req, res) => {
  const id = Number(req.params.id);
  if (!Number.isInteger(id)) return res.status(400).json({ error: 'bad_id' });

  try {
    const appointment = await fetchOne(id);
    if (!appointment) return res.status(404).json({ error: 'not_found' });

    const events = await db.query(
      `SELECT e.*, u.full_name AS changed_by_name, u.email AS changed_by_email
         FROM status_events e
         LEFT JOIN users u ON u.id = e.changed_by
        WHERE e.appointment_id = ?
        ORDER BY e.changed_at ASC, e.id ASC`,
      [id]
    );

    const audit = await db.query(
      `SELECT l.*, u.full_name AS user_name
         FROM audit_log l
         LEFT JOIN users u ON u.id = l.user_id
        WHERE l.entity = 'appointment' AND l.entity_id = ?
        ORDER BY l.created_at DESC
        LIMIT 100`,
      [id]
    );

    res.json({
      appointment,
      events: events.rows,
      audit: audit.rows.map((r) => ({ ...r, details: db.parseDetails(r.details) })),
    });
  } catch (err) {
    console.error('[appointments] detalu klaida:', err);
    res.status(500).json({ error: 'server_error' });
  }
});

// ---------------------------------------------------------------------
// POST /api/appointments - naujas vizitas
// ---------------------------------------------------------------------
router.post('/', async (req, res) => {
  const { errors, data } = validateBody(req.body || {});
  if (errors.length) return res.status(400).json({ error: 'validation_failed', fields: errors });

  try {
    const created = await db.withTransaction(async (client) => {
      const insert = await client.query(
        `INSERT INTO appointments
           (planned_at, operation, truck_plate, trailer_plate, driver_name, driver_phone,
            carrier, customer, reference, dock_id, notes, status,
            created_by, updated_by, created_at, updated_at)
         VALUES (?,?,?,?,?,?,?,?,?,?,?,'planned',?,?,UTC_TIMESTAMP(),UTC_TIMESTAMP())`,
        [
          data.planned_at, data.operation, data.truck_plate, data.trailer_plate ?? null,
          data.driver_name ?? null, data.driver_phone ?? null, data.carrier ?? null,
          data.customer ?? null, data.reference ?? null, data.dock_id ?? null,
          data.notes ?? null, req.user.id, req.user.id,
        ]
      );
      const newId = insert.insertId;

      await client.query(
        `INSERT INTO status_events (appointment_id, from_status, to_status, note, changed_by, changed_at)
         VALUES (?, NULL, 'planned', ?, ?, UTC_TIMESTAMP())`,
        [newId, 'Vizitas sukurtas', req.user.id]
      );

      await db.writeAudit({
        entity: 'appointment',
        entityId: newId,
        action: 'create',
        details: {
          truckPlate: data.truck_plate,
          plannedAt: data.planned_at,
          operation: data.operation,
        },
        userId: req.user.id,
        ip: clientIp(req),
      }, client);

      return fetchOne(newId, client);
    });

    res.status(201).json({ appointment: created });
  } catch (err) {
    console.error('[appointments] kurimo klaida:', err);
    res.status(500).json({ error: 'server_error' });
  }
});

// ---------------------------------------------------------------------
// PUT /api/appointments/:id - redagavimas
// ---------------------------------------------------------------------
router.put('/:id', async (req, res) => {
  const id = Number(req.params.id);
  if (!Number.isInteger(id)) return res.status(400).json({ error: 'bad_id' });

  const { errors, data } = validateBody(req.body || {}, { partial: true });
  if (errors.length) return res.status(400).json({ error: 'validation_failed', fields: errors });

  const keys = Object.keys(data);
  if (!keys.length) return res.status(400).json({ error: 'nothing_to_update' });

  try {
    const updated = await db.withTransaction(async (client) => {
      const before = await client.query('SELECT * FROM appointments WHERE id = ? FOR UPDATE', [id]);
      if (!before.rows[0]) return null;

      const sets = keys.map((k) => `${k} = ?`);
      const values = keys.map((k) => data[k]);

      await client.query(
        `UPDATE appointments
            SET ${sets.join(', ')}, updated_by = ?, updated_at = UTC_TIMESTAMP()
          WHERE id = ?`,
        [...values, req.user.id, id]
      );

      const after = await client.query('SELECT * FROM appointments WHERE id = ?', [id]);

      // Auditui saugom tik realiai pasikeitusius laukus
      const changes = {};
      for (const k of keys) {
        const oldVal = before.rows[0][k];
        const newVal = after.rows[0][k];
        const oldCmp = oldVal instanceof Date ? oldVal.toISOString() : oldVal;
        const newCmp = newVal instanceof Date ? newVal.toISOString() : newVal;
        if (oldCmp !== newCmp) changes[k] = { from: oldCmp, to: newCmp };
      }

      if (Object.keys(changes).length) {
        await db.writeAudit({
          entity: 'appointment', entityId: id, action: 'update',
          details: { changes }, userId: req.user.id, ip: clientIp(req),
        }, client);
      }

      return fetchOne(id, client);
    });

    if (!updated) return res.status(404).json({ error: 'not_found' });
    res.json({ appointment: updated });
  } catch (err) {
    console.error('[appointments] atnaujinimo klaida:', err);
    res.status(500).json({ error: 'server_error' });
  }
});

// ---------------------------------------------------------------------
// POST /api/appointments/:id/status - busenos keitimas + laiko zyma
// ---------------------------------------------------------------------
router.post('/:id/status', async (req, res) => {
  const id = Number(req.params.id);
  if (!Number.isInteger(id)) return res.status(400).json({ error: 'bad_id' });

  const nextStatus = str(req.body?.status, 20);
  const note = str(req.body?.note, 500);
  if (!A.STATUSES.includes(nextStatus)) {
    return res.status(400).json({ error: 'invalid_status' });
  }

  try {
    const result = await db.withTransaction(async (client) => {
      const cur = await client.query('SELECT * FROM appointments WHERE id = ? FOR UPDATE', [id]);
      const appt = cur.rows[0];
      if (!appt) return { notFound: true };

      if (appt.status === nextStatus) {
        return { conflict: 'same_status' };
      }
      if (!A.canTransition(appt.status, nextStatus, req.user.role)) {
        return { conflict: 'transition_not_allowed', from: appt.status };
      }

      // Laiko zyma: 'waiting' visada perrasoma (kad laukimo skaitiklis butu tikslus),
      // kitos - fiksuojamos pirma karta (COALESCE).
      const column = A.STATUS_TIMESTAMP[nextStatus];
      let timestampSql = '';
      if (column) {
        timestampSql = A.OVERWRITE_TIMESTAMP.has(nextStatus)
          ? `, ${column} = UTC_TIMESTAMP()`
          : `, ${column} = COALESCE(${column}, UTC_TIMESTAMP())`;
      }
      // Pereinant i doka laukimo skaitiklis sustabdomas
      if (nextStatus === 'at_dock') timestampSql += ', waiting_since = NULL';

      await client.query(
        `UPDATE appointments
            SET status = ?, updated_by = ?, updated_at = UTC_TIMESTAMP() ${timestampSql}
          WHERE id = ?`,
        [nextStatus, req.user.id, id]
      );

      await client.query(
        `INSERT INTO status_events (appointment_id, from_status, to_status, note, changed_by, changed_at)
         VALUES (?, ?, ?, ?, ?, UTC_TIMESTAMP())`,
        [id, appt.status, nextStatus, note, req.user.id]
      );

      await db.writeAudit({
        entity: 'appointment', entityId: id, action: 'status',
        details: { from: appt.status, to: nextStatus, note: note || undefined, truckPlate: appt.truck_plate },
        userId: req.user.id, ip: clientIp(req),
      }, client);

      return { appointment: await fetchOne(id, client) };
    });

    if (result.notFound) return res.status(404).json({ error: 'not_found' });
    if (result.conflict) return res.status(409).json({ error: result.conflict, from: result.from });
    res.json(result);
  } catch (err) {
    console.error('[appointments] busenos keitimo klaida:', err);
    res.status(500).json({ error: 'server_error' });
  }
});

// ---------------------------------------------------------------------
// DELETE /api/appointments/:id - tik administratorius
// ---------------------------------------------------------------------
router.delete('/:id', requireAdmin, async (req, res) => {
  const id = Number(req.params.id);
  if (!Number.isInteger(id)) return res.status(400).json({ error: 'bad_id' });

  try {
    const deleted = await db.withTransaction(async (client) => {
      const found = await client.query('SELECT * FROM appointments WHERE id = ? FOR UPDATE', [id]);
      const appt = found.rows[0];
      if (!appt) return null;

      await client.query('DELETE FROM appointments WHERE id = ?', [id]);

      await db.writeAudit({
        entity: 'appointment', entityId: id, action: 'delete',
        details: {
          truckPlate: appt.truck_plate,
          plannedAt: appt.planned_at,
          status: appt.status,
        },
        userId: req.user.id, ip: clientIp(req),
      }, client);
      return appt;
    });

    if (!deleted) return res.status(404).json({ error: 'not_found' });
    res.json({ ok: true });
  } catch (err) {
    console.error('[appointments] trynimo klaida:', err);
    res.status(500).json({ error: 'server_error' });
  }
});

module.exports = router;
