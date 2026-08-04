'use strict';

// Bendra vizitu logika: busenos, SQL filtrai ir apskaiciuoti laukai.
// Naudoja ir /api/appointments, ir CSV eksportas - kad rezultatai sutaptu.
//
// Laikas: DB saugo UTC, todel visur naudojam UTC_TIMESTAMP() (ne NOW(), kuris
// priklauso nuo rysio laiko juostos). Dienos ribos verciamos is sandelio
// laiko juostos per lib/timezone.js.

const { localDayStart, localDayEnd } = require('./timezone');

const STATUSES = [
  'planned',
  'arrived',
  'waiting',
  'at_dock',
  'in_progress',
  'completed',
  'departed',
  'cancelled',
];

const OPERATIONS = ['loading', 'unloading'];

// Busenos -> laiko zymos stulpelis
const STATUS_TIMESTAMP = {
  arrived: 'arrived_at',
  waiting: 'waiting_since',
  at_dock: 'at_dock_at',
  in_progress: 'work_started_at',
  completed: 'completed_at',
  departed: 'departed_at',
  cancelled: 'cancelled_at',
};

// Busenos, kuriu zyma perrasoma kiekviena karta (kad laukimo skaitiklis butu teisingas)
const OVERWRITE_TIMESTAMP = new Set(['waiting']);

// Leidziami perejimai operatoriui. Administratorius gali nustatyti bet kuria busena.
const ALLOWED_TRANSITIONS = {
  planned: ['arrived', 'waiting', 'cancelled'],
  arrived: ['waiting', 'at_dock', 'cancelled'],
  waiting: ['at_dock', 'cancelled'],
  at_dock: ['in_progress', 'waiting', 'cancelled'],
  in_progress: ['completed', 'waiting', 'cancelled'],
  completed: ['departed', 'in_progress'],
  departed: [],
  cancelled: ['planned'],
};

const ACTIVE_STATUSES = ['planned', 'arrived', 'waiting', 'at_dock', 'in_progress'];
const CLOSED_STATUSES = ['completed', 'departed'];

function waitingAlertMinutes() {
  const n = Number(process.env.WAITING_ALERT_MINUTES);
  return Number.isFinite(n) && n > 0 ? Math.floor(n) : 30;
}

function lateGraceMinutes() {
  const n = Number(process.env.LATE_GRACE_MINUTES);
  return Number.isFinite(n) && n >= 0 ? Math.floor(n) : 0;
}

// ---------------------------------------------------------------------
// SELECT su apskaiciuotais laukais.
// Ribos (minutes) idedamos tiesiai i SQL - tai visada validuoti sveikieji
// skaiciai is aplinkos kintamuju, ne naudotojo ivestis.
// ---------------------------------------------------------------------
function baseSelect() {
  const wait = waitingAlertMinutes();
  const grace = lateGraceMinutes();

  return `
  SELECT
    a.*,
    d.code AS dock_code,
    d.name AS dock_name,
    cu.full_name AS created_by_name,
    uu.full_name AS updated_by_name,

    -- kiek minuciu vilkikas jau laukia (tik aktyviose laukimo busenose)
    CASE WHEN a.status IN ('arrived', 'waiting')
              AND COALESCE(a.waiting_since, a.arrived_at) IS NOT NULL
         THEN GREATEST(0, TIMESTAMPDIFF(MINUTE, COALESCE(a.waiting_since, a.arrived_at), UTC_TIMESTAMP()))
    END AS waiting_minutes,

    -- kiek minuciu velavimas nuo planuoto laiko (tik dar neapdorotiems)
    CASE WHEN a.status IN ('planned', 'arrived', 'waiting')
         THEN GREATEST(0, TIMESTAMPDIFF(MINUTE, a.planned_at, UTC_TIMESTAMP()))
    END AS delay_minutes,

    (a.status IN ('arrived', 'waiting')
      AND COALESCE(a.waiting_since, a.arrived_at) IS NOT NULL
      AND UTC_TIMESTAMP() > COALESCE(a.waiting_since, a.arrived_at) + INTERVAL ${wait} MINUTE
    ) AS is_waiting_long,

    (a.status IN ('planned', 'arrived', 'waiting')
      AND UTC_TIMESTAMP() > a.planned_at + INTERVAL ${grace} MINUTE
    ) AS is_delayed,

    -- faktine krovos trukme ir bendras laikas teritorijoje (minutemis)
    CASE WHEN a.completed_at IS NOT NULL AND a.work_started_at IS NOT NULL
         THEN TIMESTAMPDIFF(MINUTE, a.work_started_at, a.completed_at)
    END AS work_minutes,
    CASE WHEN a.departed_at IS NOT NULL AND a.arrived_at IS NOT NULL
         THEN TIMESTAMPDIFF(MINUTE, a.arrived_at, a.departed_at)
    END AS onsite_minutes

  FROM appointments a
  LEFT JOIN docks d  ON d.id = a.dock_id
  LEFT JOIN users cu ON cu.id = a.created_by
  LEFT JOIN users uu ON uu.id = a.updated_by
  `;
}

/** Ta pati salyga, kaip ir is_delayed / is_waiting_long virsuje. */
function alertCondition() {
  const wait = waitingAlertMinutes();
  const grace = lateGraceMinutes();
  return `(
    (a.status IN ('planned','arrived','waiting')
      AND UTC_TIMESTAMP() > a.planned_at + INTERVAL ${grace} MINUTE)
    OR (a.status IN ('arrived','waiting')
      AND COALESCE(a.waiting_since, a.arrived_at) IS NOT NULL
      AND UTC_TIMESTAMP() > COALESCE(a.waiting_since, a.arrived_at) + INTERVAL ${wait} MINUTE)
  )`;
}

/**
 * Sudeda WHERE salygas is uzklausos parametru.
 * Grazina { whereSql, params } su `?` vietos zymomis.
 */
function buildFilters(q = {}) {
  const params = [];
  const where = [];

  // Data: viena diena arba intervalas (sandelio laiko juosta -> UTC ribos)
  if (q.date) {
    const start = localDayStart(q.date);
    const end = localDayEnd(q.date);
    if (start && end) {
      where.push('a.planned_at >= ? AND a.planned_at < ?');
      params.push(start, end);
    }
  } else {
    if (q.dateFrom) {
      const start = localDayStart(q.dateFrom);
      if (start) { where.push('a.planned_at >= ?'); params.push(start); }
    }
    if (q.dateTo) {
      const end = localDayEnd(q.dateTo);
      if (end) { where.push('a.planned_at < ?'); params.push(end); }
    }
  }

  if (q.operation && OPERATIONS.includes(q.operation)) {
    where.push('a.operation = ?');
    params.push(q.operation);
  }

  // status gali buti kelios reiksmes per kableli
  const statusList = String(q.status || '')
    .split(',')
    .map((s) => s.trim())
    .filter((s) => STATUSES.includes(s));
  if (statusList.length) {
    where.push(`a.status IN (${statusList.map(() => '?').join(', ')})`);
    params.push(...statusList);
  }

  // Greitieji rinkiniai
  if (q.statusGroup === 'active') {
    where.push(`a.status IN (${ACTIVE_STATUSES.map(() => '?').join(', ')})`);
    params.push(...ACTIVE_STATUSES);
  }
  if (q.statusGroup === 'closed') {
    where.push(`a.status IN (${CLOSED_STATUSES.map(() => '?').join(', ')})`);
    params.push(...CLOSED_STATUSES);
  }

  if (q.dockId) {
    if (String(q.dockId) === 'none') {
      where.push('a.dock_id IS NULL');
    } else {
      const id = Number(q.dockId);
      if (Number.isInteger(id) && id > 0) { where.push('a.dock_id = ?'); params.push(id); }
    }
  }

  // Palyginimai case-insensitive del utf8mb4_unicode_ci palyginimo taisykliu
  if (q.customer) { where.push('a.customer = ?'); params.push(String(q.customer).trim()); }
  if (q.carrier) { where.push('a.carrier = ?'); params.push(String(q.carrier).trim()); }

  // Laisva paieska
  if (q.q && String(q.q).trim()) {
    const term = `%${String(q.q).trim()}%`;
    where.push(`(
      a.truck_plate LIKE ? OR
      COALESCE(a.trailer_plate, '') LIKE ? OR
      COALESCE(a.driver_name, '')   LIKE ? OR
      COALESCE(a.reference, '')     LIKE ? OR
      COALESCE(a.customer, '')      LIKE ? OR
      COALESCE(a.carrier, '')       LIKE ?
    )`);
    params.push(term, term, term, term, term, term);
  }

  // Tik problemines eilutes
  if (String(q.onlyAlerts) === '1' || q.onlyAlerts === 'true') {
    where.push(alertCondition());
  }

  return {
    whereSql: where.length ? `WHERE ${where.join(' AND ')}` : '',
    params,
  };
}

/** Ar galima pereiti is vienos busenos i kita. */
function canTransition(from, to, role) {
  if (!STATUSES.includes(to)) return false;
  if (role === 'admin') return true;
  if (from === to) return false;
  return (ALLOWED_TRANSITIONS[from] || []).includes(to);
}

module.exports = {
  STATUSES,
  OPERATIONS,
  STATUS_TIMESTAMP,
  OVERWRITE_TIMESTAMP,
  ALLOWED_TRANSITIONS,
  ACTIVE_STATUSES,
  CLOSED_STATUSES,
  baseSelect,
  alertCondition,
  buildFilters,
  canTransition,
  waitingAlertMinutes,
  lateGraceMinutes,
};
