'use strict';

const express = require('express');
const db = require('../db');
const { requireAuth, clientIp } = require('../middleware/auth');
const A = require('../lib/appointments');

const router = express.Router();
router.use(requireAuth);
router.use((req, res, next) => {
  if (req.user.role === 'customer') return res.status(403).json({ error: 'forbidden' });
  return next();
});

const TZ = process.env.APP_TIMEZONE || 'Europe/Vilnius';

const dateTimeFmt = new Intl.DateTimeFormat('lt-LT', {
  timeZone: TZ,
  year: 'numeric', month: '2-digit', day: '2-digit',
  hour: '2-digit', minute: '2-digit', hour12: false,
});

/** 2026-08-04 14:30 */
function fmtDateTime(value) {
  if (!value) return '';
  const d = value instanceof Date ? value : new Date(value);
  if (!Number.isFinite(d.getTime())) return '';
  const parts = Object.fromEntries(dateTimeFmt.formatToParts(d).map((p) => [p.type, p.value]));
  return `${parts.year}-${parts.month}-${parts.day} ${parts.hour}:${parts.minute}`;
}

function fmtDate(value) {
  return fmtDateTime(value).slice(0, 10);
}

const OPERATION_LT = { loading: 'Pakrovimas', unloading: 'Iškrovimas' };
const STATUS_LT = {
  planned: 'Suplanuota',
  arrived: 'Atvyko',
  waiting: 'Laukia',
  at_dock: 'Prie vartų',
  in_progress: 'Vyksta krova',
  completed: 'Baigta',
  departed: 'Išvyko',
  cancelled: 'Atšaukta',
};

/** Vienos CSV celes ekranavimas. */
function csvCell(value, sep) {
  if (value === null || value === undefined) return '';
  let s = String(value);
  // Apsauga nuo CSV formuliu injekcijos i Excel
  if (/^[=+\-@\t\r]/.test(s)) s = `'${s}`;
  if (s.includes(sep) || s.includes('"') || s.includes('\n') || s.includes('\r')) {
    return `"${s.replace(/"/g, '""')}"`;
  }
  return s;
}

const COLUMNS = [
  ['ID', (r) => r.id],
  ['Planuota data', (r) => fmtDate(r.planned_at)],
  ['Planuotas laikas', (r) => fmtDateTime(r.planned_at).slice(11)],
  ['Operacija', (r) => OPERATION_LT[r.operation] || r.operation],
  ['Būsena', (r) => STATUS_LT[r.status] || r.status],
  ['Vilkiko nr.', (r) => r.truck_plate],
  ['Priekabos nr.', (r) => r.trailer_plate],
  ['Vairuotojas', (r) => r.driver_name],
  ['Telefonas', (r) => r.driver_phone],
  ['Vežėjas', (r) => r.carrier],
  ['Klientas', (r) => r.customer],
  ['Užsakymo nr.', (r) => r.reference],
  ['Vartai', (r) => r.dock_code],
  ['Atvyko', (r) => fmtDateTime(r.arrived_at)],
  ['Prie vartų', (r) => fmtDateTime(r.at_dock_at)],
  ['Krova pradėta', (r) => fmtDateTime(r.work_started_at)],
  ['Krova baigta', (r) => fmtDateTime(r.completed_at)],
  ['Išvyko', (r) => fmtDateTime(r.departed_at)],
  ['Krovos trukmė, min', (r) => (r.work_minutes ?? '')],
  ['Laikas teritorijoje, min', (r) => (r.onsite_minutes ?? '')],
  ['Vėlavo, min', (r) => {
    if (!r.arrived_at || !r.planned_at) return '';
    const diff = Math.round((new Date(r.arrived_at) - new Date(r.planned_at)) / 60000);
    return diff > 0 ? diff : 0;
  }],
  ['Pastabos', (r) => r.notes],
  ['Sukūrė', (r) => r.created_by_name],
  ['Paskutinis keitė', (r) => r.updated_by_name],
];

// ---------------------------------------------------------------------
// GET /api/export/appointments.csv
// Pagal nutylejima eksportuojamos tik uzbaigtos operacijos.
// Palaiko tuos pacius filtrus kaip /api/appointments.
// sep=comma | semicolon (numatytasis - kabliataskis, tinka Excel LT)
// ---------------------------------------------------------------------
router.get('/appointments.csv', async (req, res) => {
  try {
    const query = { ...req.query };
    // Jei busena nenurodyta - imam uzbaigtas operacijas
    if (!query.status && !query.statusGroup) query.statusGroup = 'closed';

    const { whereSql, params } = A.buildFilters(query);
    const sql = `
      ${A.baseSelect()}
      ${whereSql}
      ORDER BY a.planned_at ASC, a.id ASC
      LIMIT 50000
    `;
    const { rows } = await db.query(sql, params);

    const sep = String(req.query.sep).toLowerCase() === 'comma' ? ',' : ';';
    const lines = [COLUMNS.map(([title]) => csvCell(title, sep)).join(sep)];
    for (const row of rows) {
      lines.push(COLUMNS.map(([, get]) => csvCell(get(row), sep)).join(sep));
    }

    const stamp = fmtDate(new Date()) || 'export';
    const filename = `krovos-operacijos_${stamp}.csv`;

    await db.writeAudit({
      entity: 'appointment', action: 'export',
      details: { rows: rows.length, filters: query },
      userId: req.user.id, ip: clientIp(req),
    });

    res.setHeader('Content-Type', 'text/csv; charset=utf-8');
    res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
    res.setHeader('Cache-Control', 'no-store');
    // BOM - kad Excel atpazintu UTF-8 ir lietuviskas raides
    res.send(`﻿${lines.join('\r\n')}\r\n`);
  } catch (err) {
    console.error('[export] CSV klaida:', err);
    res.status(500).json({ error: 'server_error' });
  }
});

module.exports = router;
