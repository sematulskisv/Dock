'use strict';

// Sukuria administratoriaus paskyra.
// Naudojimas: node scripts/create-admin.js <el-pastas> "<vardas pavarde>" <slaptazodis> [role]
require('dotenv').config();

const db = require('../db');

(async () => {
  const [emailArg, fullName, password, role = 'admin'] = process.argv.slice(2);

  if (!emailArg || !fullName || !password) {
    console.error('Naudojimas: node scripts/create-admin.js <el-pastas> "<Vardas Pavarde>" <slaptazodis> [admin|operator]');
    process.exit(1);
  }
  if (password.length < 8) {
    console.error('Slaptazodis turi buti bent 8 simboliu.');
    process.exit(1);
  }
  if (!['admin', 'operator'].includes(role)) {
    console.error('Role turi buti "admin" arba "operator".');
    process.exit(1);
  }

  const email = String(emailArg).trim().toLowerCase();

  try {
    await db.initDb();
    const { hash, salt } = db.hashPassword(password);

    await db.query(
      `INSERT INTO users (email, full_name, role, password_hash, password_salt, created_at, updated_at)
       VALUES (?, ?, ?, ?, ?, UTC_TIMESTAMP(), UTC_TIMESTAMP())
       ON DUPLICATE KEY UPDATE
         full_name     = VALUES(full_name),
         role          = VALUES(role),
         password_hash = VALUES(password_hash),
         password_salt = VALUES(password_salt),
         is_active     = 1,
         updated_at    = UTC_TIMESTAMP()`,
      [email, fullName, role, hash, salt]
    );

    const { rows } = await db.query('SELECT id, email, role FROM users WHERE email = ?', [email]);
    console.log(`Paskyra paruosta: ${rows[0].email} (${rows[0].role}), id=${rows[0].id}`);
    process.exit(0);
  } catch (err) {
    console.error('Klaida:', err.message);
    process.exit(1);
  }
})();
