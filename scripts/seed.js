'use strict';

// Uzpildo baze demonstraciniais duomenimis:
//  - administratorius (is .env SEED_ADMIN_*)
//  - du sandelio operatoriai
//  - siandienos vizitai su ivairiomis busenomis (tarp ju veluojantys ir ilgai laukiantys)
require('dotenv').config();

const db = require('../db');
const { localDayStart, localDayEnd } = require('../lib/timezone');

const OPERATORS = [
  { email: 'operatorius@sandelis.lt', fullName: 'Jonas Petraitis', password: 'Operator123!' },
  { email: 'operatorius2@sandelis.lt', fullName: 'Rasa Kazlauskienė', password: 'Operator123!' },
];

/** Siandien nurodyta vietine valanda / minute (grazina UTC momenta). */
function today(hour, minute = 0) {
  const d = new Date();
  d.setHours(hour, minute, 0, 0);
  return d;
}

function minutesAgo(n) {
  return new Date(Date.now() - n * 60 * 1000);
}

/** 'YYYY-MM-DD' siandienai vietineje juostoje. */
function todayIso() {
  const d = new Date();
  d.setMinutes(d.getMinutes() - d.getTimezoneOffset());
  return d.toISOString().slice(0, 10);
}

async function upsertUser({ email, fullName, password, role }) {
  const normalized = email.toLowerCase();
  const { hash, salt } = db.hashPassword(password);

  await db.query(
    `INSERT INTO users (email, full_name, role, password_hash, password_salt, created_at, updated_at)
     VALUES (?, ?, ?, ?, ?, UTC_TIMESTAMP(), UTC_TIMESTAMP())
     ON DUPLICATE KEY UPDATE full_name = VALUES(full_name), updated_at = UTC_TIMESTAMP()`,
    [normalized, fullName, role, hash, salt]
  );

  const { rows } = await db.query('SELECT id, email, role FROM users WHERE email = ?', [normalized]);
  return rows[0];
}

(async () => {
  try {
    await db.initDb();

    const admin = await upsertUser({
      email: process.env.SEED_ADMIN_EMAIL || 'admin@sandelis.lt',
      fullName: process.env.SEED_ADMIN_NAME || 'Sistemos administratorius',
      password: process.env.SEED_ADMIN_PASSWORD || 'Admin123!',
      role: 'admin',
    });
    console.log(`Administratorius: ${admin.email}`);

    const operators = [];
    for (const op of OPERATORS) {
      operators.push(await upsertUser({ ...op, role: 'operator' }));
      console.log(`Operatorius: ${op.email}`);
    }

    const docks = await db.query('SELECT id, code FROM docks ORDER BY sort_order');
    const dockId = (i) => (docks.rows[i] ? docks.rows[i].id : null);

    const iso = todayIso();
    const existing = await db.query(
      'SELECT COUNT(*) AS n FROM appointments WHERE planned_at >= ? AND planned_at < ?',
      [localDayStart(iso), localDayEnd(iso)]
    );
    if (Number(existing.rows[0].n) > 0) {
      console.log('Siandienai vizitu jau yra - demonstraciniai duomenys nekuriami.');
      process.exit(0);
    }

    const samples = [
      {
        planned_at: today(7, 30), operation: 'unloading', truck_plate: 'ABC123', trailer_plate: 'TR456',
        driver_name: 'Marius Jankauskas', driver_phone: '+37060011122', carrier: 'Transekspedicija',
        customer: 'UAB Maistas', reference: 'SO-10241', dock_id: dockId(0),
        notes: 'Šaldyta produkcija, prioritetas.',
        status: 'departed',
        arrived_at: today(7, 25), at_dock_at: today(7, 35), work_started_at: today(7, 40),
        completed_at: today(8, 55), departed_at: today(9, 5),
      },
      {
        planned_at: today(8, 0), operation: 'loading', truck_plate: 'KLM789', trailer_plate: 'PR221',
        driver_name: 'Tomas Balčiūnas', driver_phone: '+37061122233', carrier: 'Girteka',
        customer: 'UAB Statyba', reference: 'ORD-55120', dock_id: dockId(1),
        notes: '12 padėklų.',
        status: 'completed',
        arrived_at: today(7, 55), at_dock_at: today(8, 10), work_started_at: today(8, 15),
        completed_at: today(9, 40),
      },
      {
        planned_at: minutesAgo(95), operation: 'unloading', truck_plate: 'DEF456', trailer_plate: 'TR900',
        driver_name: 'Andrius Vaitkus', driver_phone: '+37062233344', carrier: 'Kuehne+Nagel',
        customer: 'UAB Elektronika', reference: 'INV-88123', dock_id: null,
        notes: 'Laukia laisvų vartų.',
        status: 'waiting',
        arrived_at: minutesAgo(80), waiting_since: minutesAgo(78),
      },
      {
        planned_at: minutesAgo(40), operation: 'loading', truck_plate: 'GHI321', trailer_plate: 'PR555',
        driver_name: 'Egidijus Ramanauskas', driver_phone: '+37063344455', carrier: 'DSV',
        customer: 'UAB Baldai', reference: 'SO-10299', dock_id: dockId(2),
        notes: '',
        status: 'in_progress',
        arrived_at: minutesAgo(35), at_dock_at: minutesAgo(25), work_started_at: minutesAgo(20),
      },
      {
        planned_at: minutesAgo(25), operation: 'unloading', truck_plate: 'JKL654', trailer_plate: null,
        driver_name: 'Vytas Šimkus', driver_phone: '+37064455566', carrier: 'Transekspedicija',
        customer: 'UAB Maistas', reference: 'SO-10305', dock_id: null,
        notes: 'Vėluoja, susisiekta su vairuotoju.',
        status: 'planned',
      },
      {
        planned_at: today(14, 0), operation: 'loading', truck_plate: 'MNO987', trailer_plate: 'PR777',
        driver_name: 'Darius Petrauskas', driver_phone: '+37065566677', carrier: 'Girteka',
        customer: 'UAB Logistika', reference: 'ORD-55198', dock_id: dockId(3),
        notes: '', status: 'planned',
      },
      {
        planned_at: today(15, 30), operation: 'unloading', truck_plate: 'PQR147', trailer_plate: 'TR112',
        driver_name: 'Rimas Adomaitis', driver_phone: '+37066677788', carrier: 'DB Schenker',
        customer: 'UAB Elektronika', reference: 'INV-88190', dock_id: dockId(4),
        notes: 'Reikalingas krautuvas su ilgomis šakėmis.', status: 'planned',
      },
      {
        planned_at: today(16, 45), operation: 'loading', truck_plate: 'STU258', trailer_plate: 'PR333',
        driver_name: 'Gintaras Urbonas', driver_phone: '+37067788899', carrier: 'DSV',
        customer: 'UAB Statyba', reference: 'ORD-55221', dock_id: null,
        notes: 'Atšaukė klientas.', status: 'cancelled', cancelled_at: minutesAgo(200),
      },
    ];

    for (const s of samples) {
      const insert = await db.query(
        `INSERT INTO appointments
           (planned_at, operation, truck_plate, trailer_plate, driver_name, driver_phone,
            carrier, customer, reference, dock_id, notes, status,
            arrived_at, waiting_since, at_dock_at, work_started_at, completed_at, departed_at, cancelled_at,
            created_by, updated_by, created_at, updated_at)
         VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,UTC_TIMESTAMP(),UTC_TIMESTAMP())`,
        [
          s.planned_at, s.operation, s.truck_plate, s.trailer_plate || null,
          s.driver_name || null, s.driver_phone || null, s.carrier || null,
          s.customer || null, s.reference || null, s.dock_id, s.notes || null, s.status,
          s.arrived_at || null, s.waiting_since || null, s.at_dock_at || null,
          s.work_started_at || null, s.completed_at || null, s.departed_at || null,
          s.cancelled_at || null, admin.id, admin.id,
        ]
      );
      const apptId = insert.insertId;

      // Sukuriam atitinkama busenu istorija, kad audito puslapis butu prasmingas
      const chain = [
        ['planned', s.planned_at],
        ['arrived', s.arrived_at],
        ['waiting', s.waiting_since],
        ['at_dock', s.at_dock_at],
        ['in_progress', s.work_started_at],
        ['completed', s.completed_at],
        ['departed', s.departed_at],
        ['cancelled', s.cancelled_at],
      ].filter(([, ts]) => ts);

      let prev = null;
      for (const [status, ts] of chain) {
        const actor = status === 'planned' ? admin.id : operators[apptId % operators.length].id;
        await db.query(
          `INSERT INTO status_events (appointment_id, from_status, to_status, changed_by, changed_at)
           VALUES (?, ?, ?, ?, ?)`,
          [apptId, prev, status, actor, ts]
        );
        prev = status;
      }
    }

    console.log(`Sukurta demonstraciniu vizitu: ${samples.length}`);
    console.log('\nPrisijungimai:');
    console.log(`  admin     ${process.env.SEED_ADMIN_EMAIL || 'admin@sandelis.lt'} / ${process.env.SEED_ADMIN_PASSWORD || 'Admin123!'}`);
    console.log('  operator  operatorius@sandelis.lt / Operator123!');
    process.exit(0);
  } catch (err) {
    console.error('Seed klaida:', err);
    process.exit(1);
  }
})();
