'use strict';

const crypto = require('crypto');
const express = require('express');
const fs = require('fs');
const path = require('path');
const multer = require('multer');
const db = require('../db');
const { requireAuth, requireAdmin, clientIp } = require('../middleware/auth');
const A = require('../lib/appointments');

const router = express.Router();

router.use(requireAuth);

const UPLOAD_DIR = path.resolve(process.env.UPLOAD_DIR || path.join(__dirname, '..', 'uploads'));
const MAX_UPLOAD_BYTES = (Number(process.env.UPLOAD_MAX_MB) || 15) * 1024 * 1024;
const ACCEPTED_MIME_TYPES = new Set([
  'application/pdf', 'image/jpeg', 'image/png',
  'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  'application/vnd.ms-excel',
]);
const EU_COUNTRY_CODES = new Set([
  'AT', 'BE', 'BG', 'HR', 'CY', 'CZ', 'DK', 'EE', 'FI', 'FR', 'DE', 'GR', 'HU',
  'IE', 'IT', 'LV', 'LT', 'LU', 'MT', 'NL', 'PL', 'PT', 'RO', 'SK', 'SI', 'ES', 'SE',
]);

function handlingMinutesForPallets(count) {
  if (count <= 8) return 30;
  if (count <= 16) return 60;
  if (count <= 26) return 90;
  return 120;
}

fs.mkdirSync(UPLOAD_DIR, { recursive: true });

const storage = multer.diskStorage({
  destination: (req, file, done) => done(null, UPLOAD_DIR),
  filename: (req, file, done) => {
    const ext = path.extname(file.originalname || '').toLowerCase().replace(/[^.a-z0-9]/g, '').slice(0, 12);
    done(null, `${crypto.randomBytes(20).toString('hex')}${ext}`);
  },
});
const upload = multer({
  storage,
  limits: { fileSize: MAX_UPLOAD_BYTES, files: 1 },
  fileFilter: (req, file, done) => {
    if (!ACCEPTED_MIME_TYPES.has(file.mimetype)) return done(new Error('invalid_document'));
    return done(null, true);
  },
});

function uploadSingle(req, res, next) {
  upload.single('document')(req, res, (err) => {
    if (!err) return next();
    if (err.code === 'LIMIT_FILE_SIZE') return res.status(400).json({ error: 'file_too_large' });
    return res.status(400).json({ error: 'invalid_document' });
  });
}

function isCustomer(req) {
  return req.user && req.user.role === 'customer';
}

function scopedFilters(req, query) {
  const result = A.buildFilters(query);
  if (!isCustomer(req)) return result;
  return {
    whereSql: result.whereSql ? `${result.whereSql} AND a.created_by = ?` : 'WHERE a.created_by = ?',
    params: [...result.params, req.user.id],
  };
}

function canAccessAppointment(req, appointment) {
  return !isCustomer(req) || Number(appointment.created_by) === Number(req.user.id);
}

function removeUploadedFile(file) {
  if (file && file.path) fs.unlink(file.path, () => {});
}

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

  if (!partial || body.palletCount !== undefined) {
    const pallets = Number(body.palletCount);
    if (!Number.isInteger(pallets) || pallets < 1 || pallets > 33) errors.push('palletCount');
    else {
      data.pallet_count = pallets;
      data.handling_minutes = handlingMinutesForPallets(pallets);
    }
  }

  for (const [bodyKey, column] of [['originCountry', 'origin_country'], ['destinationCountry', 'destination_country']]) {
    if (!partial || body[bodyKey] !== undefined) {
      const country = str(body[bodyKey], 2)?.toUpperCase() || null;
      if (!partial && (!country || !EU_COUNTRY_CODES.has(country))) errors.push(bodyKey);
      else if (country && !EU_COUNTRY_CODES.has(country)) errors.push(bodyKey);
      else data[column] = country;
    }
  }

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

const DOCK_OCCUPYING_STATUSES = ['at_dock'];

async function checkDock(client, dockId, appointmentId = null, requireFree = false) {
  if (!dockId) return { error: 'dock_required' };

  const dock = await client.query(
    'SELECT id FROM docks WHERE id = ? AND is_active = 1 FOR UPDATE',
    [dockId]
  );
  if (!dock.rows[0]) return { error: 'dock_not_available' };
  if (!requireFree) return null;

  const occupied = await client.query(
    `SELECT id FROM appointments
      WHERE dock_id = ? AND status = 'at_dock' AND id <> ?
      FOR UPDATE`,
    [dockId, appointmentId || 0]
  );
  return occupied.rows[0]
    ? { error: 'dock_occupied', appointmentId: occupied.rows[0].id }
    : null;
}

async function checkReservationSlot(client, dockId, plannedAt, handlingMinutes, appointmentId = null) {
  if (!dockId || !plannedAt) return null;
  const start = new Date(plannedAt);
  const endWindow = new Date(start.getTime() + (Number(handlingMinutes) || 30) * 60 * 1000);
  const occupied = await client.query(
    `SELECT id FROM appointments
      WHERE dock_id = ? AND status <> 'cancelled' AND planned_at < ?
        AND DATE_ADD(planned_at, INTERVAL handling_minutes MINUTE) > ? AND id <> ?
      FOR UPDATE`,
    [dockId, endWindow, start, appointmentId || 0]
  );
  return occupied.rows[0] ? { error: 'reservation_occupied', appointmentId: occupied.rows[0].id } : null;
}

async function addDocument(client, appointmentId, file, userId) {
  await client.query(
    `INSERT INTO appointment_documents
       (appointment_id, storage_name, original_name, mime_type, size_bytes, uploaded_by, created_at)
     VALUES (?, ?, ?, ?, ?, ?, UTC_TIMESTAMP())`,
    [appointmentId, file.filename, String(file.originalname || 'document').slice(0, 255), file.mimetype, file.size, userId]
  );
}

// ---------------------------------------------------------------------
// GET /api/appointments/options - reiksmes filtru sarasams
// (turi buti pries /:id)
// ---------------------------------------------------------------------
router.get('/options', async (req, res) => {
  try {
    const [docks, customers, carriers] = await Promise.all([
      db.query('SELECT id, code, name, is_active FROM docks ORDER BY sort_order, code'),
      isCustomer(req)
        ? Promise.resolve({ rows: [] })
        : db.query(`SELECT DISTINCT customer AS value FROM appointments
                    WHERE customer IS NOT NULL AND customer <> '' ORDER BY customer`),
      isCustomer(req)
        ? Promise.resolve({ rows: [] })
        : db.query(`SELECT DISTINCT carrier AS value FROM appointments
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
      timeZone: process.env.APP_TIMEZONE || 'Europe/Vilnius',
    });
  } catch (err) {
    console.error('[appointments] options klaida:', err);
    res.status(500).json({ error: 'server_error' });
  }
});

// GET /api/appointments/availability - klientui tik uzimtumo faktas, be kitu vežėjų duomenų
router.get('/availability', async (req, res) => {
  const date = String(req.query.date || '');
  const { whereSql, params } = A.buildFilters({ date });
  if (!whereSql) return res.status(400).json({ error: 'invalid_date' });
  try {
    const { rows } = await db.query(
      `SELECT a.dock_id, a.planned_at, a.handling_minutes
         FROM appointments a
        ${whereSql} AND a.status <> 'cancelled' AND a.dock_id IS NOT NULL
        ORDER BY a.planned_at ASC`,
      params
    );
    const docks = await db.query('SELECT id, code, name FROM docks WHERE is_active = 1 ORDER BY sort_order, code');
    res.json({ docks: docks.rows, busy: rows });
  } catch (err) {
    console.error('[appointments] availability klaida:', err.message);
    res.status(500).json({ error: 'server_error' });
  }
});

// ---------------------------------------------------------------------
// GET /api/appointments - sarasas su filtrais
// ---------------------------------------------------------------------
router.get('/', async (req, res) => {
  try {
    const { whereSql, params } = scopedFilters(req, req.query);
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
      timeZone: process.env.APP_TIMEZONE || 'Europe/Vilnius',
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
    const { whereSql, params } = scopedFilters(req, req.query);
    // Reiksmes gaunamos is validuotu aplinkos kintamuju (sveiki skaiciai),
    // todel jas saugu iterpti. Taip apeiname kai kuriu MariaDB hostingu
    // prepared-statement klaida su ? TIMESTAMPADD intervalo argumente.
    const grace = A.lateGraceMinutes();
    const sql = `
      SELECT
        COUNT(*) AS total,
        COALESCE(SUM(CASE WHEN a.operation = 'loading' THEN 1 ELSE 0 END), 0) AS loading,
        COALESCE(SUM(CASE WHEN a.operation = 'unloading' THEN 1 ELSE 0 END), 0) AS unloading,
        COALESCE(SUM(CASE WHEN a.status IN ('planned','arrived','at_dock') THEN 1 ELSE 0 END), 0) AS active,
        COALESCE(SUM(CASE WHEN a.status = 'planned' THEN 1 ELSE 0 END), 0) AS planned,
        COALESCE(SUM(CASE WHEN a.status = 'arrived' THEN 1 ELSE 0 END), 0) AS arrived,
        COALESCE(SUM(CASE WHEN a.status = 'at_dock' THEN 1 ELSE 0 END), 0) AS at_dock,
        COALESCE(SUM(CASE WHEN a.status = 'completed' THEN 1 ELSE 0 END), 0) AS completed,
        COALESCE(SUM(CASE WHEN a.status = 'cancelled' THEN 1 ELSE 0 END), 0) AS cancelled,
        COALESCE(SUM(CASE WHEN a.status IN ('planned','arrived')
                    AND UTC_TIMESTAMP() > a.planned_at + INTERVAL ${grace} MINUTE
                   THEN 1 ELSE 0 END), 0) AS delayed,
        0 AS waiting_long
      FROM appointments a
      LEFT JOIN docks d ON d.id = a.dock_id
      ${whereSql}
    `;

    const { rows } = await db.query(sql, params);
    const stats = {};
    for (const [k, v] of Object.entries(rows[0])) stats[k] = Number(v);
    res.json({ stats });
  } catch (err) {
    console.error('[appointments] stats klaida:', err.code || err.errno || '', err.message);
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
    if (!canAccessAppointment(req, appointment)) return res.status(404).json({ error: 'not_found' });

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
    const documents = await db.query(
      `SELECT id, original_name, mime_type, size_bytes, created_at
         FROM appointment_documents
        WHERE appointment_id = ?
        ORDER BY created_at ASC, id ASC`,
      [id]
    );

    res.json({
      appointment,
      events: events.rows,
      audit: isCustomer(req) ? [] : audit.rows.map((r) => ({ ...r, details: db.parseDetails(r.details) })),
      documents: documents.rows,
    });
  } catch (err) {
    console.error('[appointments] detalu klaida:', err);
    res.status(500).json({ error: 'server_error' });
  }
});

// ---------------------------------------------------------------------
// POST /api/appointments - naujas vizitas
// ---------------------------------------------------------------------
router.post('/booking', uploadSingle, async (req, res) => {
  if (!isCustomer(req)) {
    removeUploadedFile(req.file);
    return res.status(403).json({ error: 'customer_only' });
  }
  if (!req.file) return res.status(400).json({ error: 'attachment_required' });

  const { errors, data } = validateBody(req.body || {});
  if (errors.length) {
    removeUploadedFile(req.file);
    return res.status(400).json({ error: 'validation_failed', fields: errors });
  }

  try {
    const created = await db.withTransaction(async (client) => {
      const dockProblem = await checkDock(client, data.dock_id);
      if (dockProblem) return { conflict: dockProblem };
      const reservationProblem = await checkReservationSlot(client, data.dock_id, data.planned_at, data.handling_minutes);
      if (reservationProblem) return { conflict: reservationProblem };

      const insert = await client.query(
        `INSERT INTO appointments
           (planned_at, operation, truck_plate, trailer_plate, driver_name, driver_phone,
           carrier, customer, reference, pallet_count, handling_minutes, origin_country, destination_country, dock_id, notes, status,
            created_by, updated_by, created_at, updated_at)
         VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,'planned',?,?,UTC_TIMESTAMP(),UTC_TIMESTAMP())`,
        [
          data.planned_at, data.operation, data.truck_plate, data.trailer_plate ?? null,
          data.driver_name ?? null, data.driver_phone ?? null, data.carrier ?? null,
          data.customer ?? null, data.reference ?? null, data.pallet_count, data.handling_minutes,
          data.origin_country, data.destination_country, data.dock_id,
          data.notes ?? null, req.user.id, req.user.id,
        ]
      );
      const appointmentId = insert.insertId;
      await client.query(
        `INSERT INTO status_events (appointment_id, from_status, to_status, note, changed_by, changed_at)
         VALUES (?, NULL, 'planned', ?, ?, UTC_TIMESTAMP())`,
        [appointmentId, 'Kliento rezervacija', req.user.id]
      );
      await addDocument(client, appointmentId, req.file, req.user.id);
      await db.writeAudit({
        entity: 'appointment', entityId: appointmentId, action: 'create',
        details: { truckPlate: data.truck_plate, plannedAt: data.planned_at, operation: data.operation, customerBooking: true },
        userId: req.user.id, ip: clientIp(req),
      }, client);
      return { appointment: await fetchOne(appointmentId, client) };
    });

    if (created.conflict) {
      removeUploadedFile(req.file);
      return res.status(409).json(created.conflict);
    }
    return res.status(201).json(created);
  } catch (err) {
    removeUploadedFile(req.file);
    console.error('[appointments] kliento rezervacijos klaida:', err.message);
    return res.status(500).json({ error: 'server_error' });
  }
});

router.post('/', async (req, res) => {
  if (isCustomer(req)) return res.status(403).json({ error: 'use_booking_endpoint' });
  const { errors, data } = validateBody(req.body || {});
  if (errors.length) return res.status(400).json({ error: 'validation_failed', fields: errors });

  try {
    const created = await db.withTransaction(async (client) => {
      if (data.dock_id) {
        const dockProblem = await checkDock(client, data.dock_id);
        if (dockProblem) return { conflict: dockProblem };
        const reservationProblem = await checkReservationSlot(client, data.dock_id, data.planned_at, data.handling_minutes);
        if (reservationProblem) return { conflict: reservationProblem };
      }
      const insert = await client.query(
        `INSERT INTO appointments
           (planned_at, operation, truck_plate, trailer_plate, driver_name, driver_phone,
            carrier, customer, reference, pallet_count, handling_minutes, origin_country, destination_country, dock_id, notes, status,
            created_by, updated_by, created_at, updated_at)
         VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,'planned',?,?,UTC_TIMESTAMP(),UTC_TIMESTAMP())`,
        [
          data.planned_at, data.operation, data.truck_plate, data.trailer_plate ?? null,
          data.driver_name ?? null, data.driver_phone ?? null, data.carrier ?? null,
          data.customer ?? null, data.reference ?? null, data.pallet_count, data.handling_minutes,
          data.origin_country, data.destination_country, data.dock_id ?? null,
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

      return { appointment: await fetchOne(newId, client) };
    });

    if (created.conflict) return res.status(409).json(created.conflict);
    res.status(201).json(created);
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
  // Vadybininkas savo rezervacijoje gali koreguoti duomenis, bet ne priskirtus vartus.
  if (isCustomer(req)) delete data.dock_id;

  const keys = Object.keys(data);
  if (!keys.length) return res.status(400).json({ error: 'nothing_to_update' });

  try {
    const updated = await db.withTransaction(async (client) => {
      const before = await client.query('SELECT * FROM appointments WHERE id = ? FOR UPDATE', [id]);
      if (!before.rows[0]) return null;
      if (isCustomer(req) && Number(before.rows[0].created_by) !== Number(req.user.id)) {
        return { notFound: true };
      }
      if (isCustomer(req) && before.rows[0].status !== 'planned') {
        return { conflict: { error: 'customer_edit_not_allowed' } };
      }

      const nextDockId = Object.prototype.hasOwnProperty.call(data, 'dock_id')
        ? data.dock_id
        : before.rows[0].dock_id;
      if (DOCK_OCCUPYING_STATUSES.includes(before.rows[0].status)) {
        const dockProblem = await checkDock(
          client,
          nextDockId,
          id,
          true
        );
        if (dockProblem) return { conflict: dockProblem };
      } else if (Object.prototype.hasOwnProperty.call(data, 'dock_id') && nextDockId) {
        const dockProblem = await checkDock(client, nextDockId);
        if (dockProblem) return { conflict: dockProblem };
      }
      const reservationFieldsChanged = ['dock_id', 'planned_at', 'handling_minutes'].some((key) =>
        Object.prototype.hasOwnProperty.call(data, key)
      );
      if (reservationFieldsChanged) {
        const nextPlannedAt = data.planned_at || before.rows[0].planned_at;
        const nextHandlingMinutes = data.handling_minutes || before.rows[0].handling_minutes;
        const reservationProblem = await checkReservationSlot(client, nextDockId, nextPlannedAt, nextHandlingMinutes, id);
        if (reservationProblem) return { conflict: reservationProblem };
      }

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

      return { appointment: await fetchOne(id, client) };
    });

    if (!updated || updated.notFound) return res.status(404).json({ error: 'not_found' });
    if (updated.conflict) return res.status(409).json(updated.conflict);
    res.json(updated);
  } catch (err) {
    console.error('[appointments] atnaujinimo klaida:', err);
    res.status(500).json({ error: 'server_error' });
  }
});

// POST /api/appointments/:id/documents - papildomas dokumentas (pvz. iškrovimo PDF)
router.post('/:id/documents', uploadSingle, async (req, res) => {
  const id = Number(req.params.id);
  if (!Number.isInteger(id)) {
    removeUploadedFile(req.file);
    return res.status(400).json({ error: 'bad_id' });
  }
  if (!req.file) return res.status(400).json({ error: 'attachment_required' });

  try {
    const appointment = await fetchOne(id);
    if (!appointment || !canAccessAppointment(req, appointment)) {
      removeUploadedFile(req.file);
      return res.status(404).json({ error: 'not_found' });
    }
    await db.withTransaction(async (client) => {
      await addDocument(client, id, req.file, req.user.id);
      await db.writeAudit({
        entity: 'appointment', entityId: id, action: 'document_upload',
        details: { fileName: req.file.originalname, truckPlate: appointment.truck_plate },
        userId: req.user.id, ip: clientIp(req),
      }, client);
    });
    return res.status(201).json({ ok: true });
  } catch (err) {
    removeUploadedFile(req.file);
    console.error('[appointments] dokumento ikelimo klaida:', err.message);
    return res.status(500).json({ error: 'server_error' });
  }
});

// POST /api/appointments/:id/cancel - vadybininkas gali atsaukti savo dar nepradeta vizita.
router.post('/:id/cancel', async (req, res) => {
  if (!isCustomer(req)) return res.status(403).json({ error: 'manager_only' });
  const id = Number(req.params.id);
  if (!Number.isInteger(id)) return res.status(400).json({ error: 'bad_id' });

  try {
    const result = await db.withTransaction(async (client) => {
      const current = await client.query('SELECT * FROM appointments WHERE id = ? FOR UPDATE', [id]);
      const appointment = current.rows[0];
      if (!appointment || Number(appointment.created_by) !== Number(req.user.id)) return { notFound: true };
      if (!['planned', 'arrived'].includes(appointment.status)) return { conflict: true };

      await client.query(
        `UPDATE appointments
            SET status = 'cancelled', cancelled_at = COALESCE(cancelled_at, UTC_TIMESTAMP()),
                updated_by = ?, updated_at = UTC_TIMESTAMP()
          WHERE id = ?`,
        [req.user.id, id]
      );
      await client.query(
        `INSERT INTO status_events (appointment_id, from_status, to_status, note, changed_by, changed_at)
         VALUES (?, ?, 'cancelled', 'Vadybininkas atšaukė rezervaciją', ?, UTC_TIMESTAMP())`,
        [id, appointment.status, req.user.id]
      );
      await db.writeAudit({
        entity: 'appointment', entityId: id, action: 'status',
        details: { from: appointment.status, to: 'cancelled', managerCancellation: true, truckPlate: appointment.truck_plate },
        userId: req.user.id, ip: clientIp(req),
      }, client);
      return { appointment: await fetchOne(id, client) };
    });
    if (result.notFound) return res.status(404).json({ error: 'not_found' });
    if (result.conflict) return res.status(409).json({ error: 'cancellation_not_allowed' });
    return res.json(result);
  } catch (err) {
    console.error('[appointments] rezervacijos atsaukimo klaida:', err.message);
    return res.status(500).json({ error: 'server_error' });
  }
});

// GET /api/appointments/:id/documents/:documentId/download
router.get('/:id/documents/:documentId/download', async (req, res) => {
  const id = Number(req.params.id);
  const documentId = Number(req.params.documentId);
  if (!Number.isInteger(id) || !Number.isInteger(documentId)) return res.status(400).json({ error: 'bad_id' });
  try {
    const appointment = await fetchOne(id);
    if (!appointment || !canAccessAppointment(req, appointment)) return res.status(404).json({ error: 'not_found' });
    const { rows } = await db.query(
      'SELECT storage_name, original_name FROM appointment_documents WHERE id = ? AND appointment_id = ?',
      [documentId, id]
    );
    const document = rows[0];
    if (!document || path.basename(document.storage_name) !== document.storage_name) {
      return res.status(404).json({ error: 'not_found' });
    }
    const filePath = path.join(UPLOAD_DIR, document.storage_name);
    if (!fs.existsSync(filePath)) return res.status(404).json({ error: 'file_missing' });
    return res.download(filePath, document.original_name);
  } catch (err) {
    console.error('[appointments] dokumento parsisiuntimo klaida:', err.message);
    return res.status(500).json({ error: 'server_error' });
  }
});

// ---------------------------------------------------------------------
// POST /api/appointments/:id/status - busenos keitimas + laiko zyma
// ---------------------------------------------------------------------
router.post('/:id/status', async (req, res) => {
  if (isCustomer(req)) return res.status(403).json({ error: 'customer_cannot_change_status' });
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

      if (DOCK_OCCUPYING_STATUSES.includes(nextStatus)) {
        const dockProblem = await checkDock(client, appt.dock_id, id, true);
        if (dockProblem) return { conflict: dockProblem.error, occupiedAppointmentId: dockProblem.appointmentId };
      }

      // Kiekvienos likusios busenos pirmoji laiko zyma fiksuojama viena karta.
      const column = A.STATUS_TIMESTAMP[nextStatus];
      let timestampSql = '';
      if (column) {
        timestampSql = A.OVERWRITE_TIMESTAMP.has(nextStatus)
          ? `, ${column} = UTC_TIMESTAMP()`
          : `, ${column} = COALESCE(${column}, UTC_TIMESTAMP())`;
      }
      // Siame supaprastintame sraute "Prie vartu" reiskia, kad krova prasideda.
      if (nextStatus === 'at_dock') timestampSql += ', work_started_at = COALESCE(work_started_at, UTC_TIMESTAMP())';
      if (nextStatus === 'completed') timestampSql += ', departed_at = COALESCE(departed_at, UTC_TIMESTAMP())';

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
  // Fizinis trynimas panaikintu busenu istorija. Klaidinga registracija turi
  // buti pazymeta busena "cancelled" ir likti audite.
  return res.status(405).json({ error: 'use_cancelled_status' });
});

module.exports = router;
