'use strict';

// Sukuria / atnaujina duomenu bazes schema. Saugu paleisti kartotinai.
require('dotenv').config();

const db = require('../db');

(async () => {
  try {
    await db.initDb();
    console.log('Schema sekmingai pritaikyta.');
    process.exit(0);
  } catch (err) {
    console.error('Migracijos klaida:', err.message);
    process.exit(1);
  }
})();
