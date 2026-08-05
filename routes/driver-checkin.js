'use strict';

const express = require('express');
const QRCode = require('qrcode');
const db = require('../db');
const { requireAdmin, clientIp } = require('../middleware/auth');
const { rateLimit } = require('../middleware/rateLimit');
const { localDayStart, localDayEnd } = require('../lib/timezone');

const router = express.Router();

function value(input, max) {
  const text = String(input || '').trim();
  return text ? text.slice(0, max) : null;
}

function normalizePlate(input) {
  return value(input, 32)?.toUpperCase().replace(/[\s-]+/g, '') || null;
}

function normalizeReference(input) {
  return value(input, 120)?.toUpperCase() || null;
}

function checkinUrl(req) {
  const configured = String(process.env.PUBLIC_BASE_URL || '').trim().replace(/\/+$/, '');
  if (configured) return `${configured}/driver-checkin`;
  return `${req.protocol}://${req.get('host')}/driver-checkin`;
}

// GET /api/driver-checkin/qr.svg - administratoriaus rodomas / spausdinamas QR kodas.
router.get('/qr.svg', requireAdmin, async (req, res) => {
  try {
    const svg = await QRCode.toString(checkinUrl(req), {
      type: 'svg', margin: 1, width: 360, errorCorrectionLevel: 'M',
    });
    res.type('image/svg+xml').send(svg);
  } catch (err) {
    console.error('[driver-checkin] QR generavimo klaida:', err.message);
    res.status(500).json({ error: 'server_error' });
  }
});

// POST /api/driver-checkin - viesas vairuotojo atvykimo patvirtinimas.
router.post('/', rateLimit({ windowMs: 15 * 60 * 1000, max: 20, key: (req) => `driver-checkin:${clientIp(req)}` }), async (req, res) => {
  const truckPlate = normalizePlate(req.body?.truckPlate);
  const reference = normalizeReference(req.body?.reference);
  if (!truckPlate || !reference) return res.status(400).json({ error: 'validation_failed' });

  const today = new Intl.DateTimeFormat('en-CA', {
    timeZone: process.env.APP_TIMEZONE || 'Europe/Vilnius', year: 'numeric', month: '2-digit', day: '2-digit',
  }).format(new Date());
  const start = localDayStart(today);
  const end = localDayEnd(today);
  if (!start || !end) return res.status(500).json({ error: 'server_error' });

  try {
    const result = await db.withTransaction(async (client) => {
      // Neradus nieko neatskleidziame - viesas puslapis negali buti naudojamas
      // kitu rezervaciju duomenims spelioti.
      const matches = await client.query(
        `SELECT id, status, truck_plate, reference
           FROM appointments
          WHERE REPLACE(REPLACE(UPPER(truck_plate), ' ', ''), '-', '') = ?
            AND UPPER(TRIM(COALESCE(reference, ''))) = ?
            AND planned_at >= ? AND planned_at < ?
            AND status IN ('planned', 'arrived', 'waiting')
          ORDER BY planned_at ASC
          LIMIT 2
          FOR UPDATE`,
        [truckPlate, reference, start, end]
      );

      if (matches.rows.length === 0 || matches.rows.length > 1) return { error: 'not_found' };

      const appointment = matches.rows[0];
      if (appointment.status !== 'planned') return { result: 'already_checked_in' };

      await client.query(
        `UPDATE appointments
            SET status = 'arrived', arrived_at = COALESCE(arrived_at, UTC_TIMESTAMP()),
                updated_by = NULL, updated_at = UTC_TIMESTAMP()
          WHERE id = ?`,
        [appointment.id]
      );
      await client.query(
        `INSERT INTO status_events (appointment_id, from_status, to_status, note, changed_by, changed_at)
         VALUES (?, 'planned', 'arrived', 'Vairuotojo savitarna (QR)', NULL, UTC_TIMESTAMP())`,
        [appointment.id]
      );
      await db.writeAudit({
        entity: 'appointment', entityId: appointment.id, action: 'driver_checkin',
        details: { truckPlate: appointment.truck_plate, reference: appointment.reference },
        ip: clientIp(req),
      }, client);
      return { result: 'checked_in' };
    });

    if (result.error) return res.status(404).json({ error: 'not_found' });
    return res.json(result);
  } catch (err) {
    console.error('[driver-checkin] registracijos klaida:', err.message);
    return res.status(500).json({ error: 'server_error' });
  }
});

module.exports = router;
