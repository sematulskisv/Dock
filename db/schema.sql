-- =====================================================================
--  Warehouse Ops - MySQL / MariaDB schema
--  Paleidziama automatiskai serverio starte (db.js -> initDb) ir
--  rankiniu budu per `npm run migrate`.
--  Visi sakiniai idempotentiski (CREATE TABLE IF NOT EXISTS), todel
--  saugu kartoti. Indeksai aprasyti TIESIOG lenteleje, nes MySQL 8
--  nepalaiko `CREATE INDEX IF NOT EXISTS`.
--
--  SVARBU: visos DATETIME reiksmes saugomos UTC. Rysio laiko juosta
--  nustatoma i +00:00 (zr. db.js), o vartotojo laiko juosta
--  (APP_TIMEZONE) taikoma tik formatuojant ir skaiciuojant dienos ribas.
-- =====================================================================

-- ---------------------------------------------------------------------
-- Naudotojai (dvi roles: admin ir operator)
-- ---------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS users (
  id            INT UNSIGNED NOT NULL AUTO_INCREMENT,
  email         VARCHAR(190) NOT NULL,
  full_name     VARCHAR(160) NOT NULL,
  role          VARCHAR(16)  NOT NULL DEFAULT 'operator',
  password_hash VARCHAR(255) NOT NULL,
  password_salt VARCHAR(64)  NOT NULL,
  is_active     TINYINT(1)   NOT NULL DEFAULT 1,
  last_login_at DATETIME     NULL,
  created_at    DATETIME     NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at    DATETIME     NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  UNIQUE KEY uq_users_email (email),
  KEY idx_users_active (is_active)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ---------------------------------------------------------------------
-- Sesijos (httpOnly slapukas; DB laikomas tik SHA-256 hash'as)
-- ---------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS sessions (
  token_hash CHAR(64)     NOT NULL,
  user_id    INT UNSIGNED NOT NULL,
  user_agent VARCHAR(300) NULL,
  ip         VARCHAR(64)  NULL,
  expires_at DATETIME     NOT NULL,
  created_at DATETIME     NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (token_hash),
  KEY idx_sessions_user (user_id),
  KEY idx_sessions_expires (expires_at),
  CONSTRAINT fk_sessions_user FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ---------------------------------------------------------------------
-- Sandelio vartai (dokai)
-- ---------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS docks (
  id         INT UNSIGNED NOT NULL AUTO_INCREMENT,
  code       VARCHAR(32)  NOT NULL,
  name       VARCHAR(120) NULL,
  is_active  TINYINT(1)   NOT NULL DEFAULT 1,
  sort_order INT          NOT NULL DEFAULT 0,
  created_at DATETIME     NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  UNIQUE KEY uq_docks_code (code),
  KEY idx_docks_sort (sort_order)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ---------------------------------------------------------------------
-- Vizitai / krovos operacijos
-- ---------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS appointments (
  id              INT UNSIGNED NOT NULL AUTO_INCREMENT,

  planned_at      DATETIME     NOT NULL,
  operation       VARCHAR(16)  NOT NULL,

  truck_plate     VARCHAR(32)  NOT NULL,
  trailer_plate   VARCHAR(32)  NULL,
  driver_name     VARCHAR(120) NULL,
  driver_phone    VARCHAR(40)  NULL,

  carrier         VARCHAR(160) NULL,
  customer        VARCHAR(160) NULL,
  reference       VARCHAR(120) NULL,
  pallet_count    TINYINT UNSIGNED NOT NULL DEFAULT 1,
  handling_minutes SMALLINT UNSIGNED NOT NULL DEFAULT 30,
  origin_country  CHAR(2)       NULL,
  destination_country CHAR(2)   NULL,
  dock_id         INT UNSIGNED NULL,
  notes           TEXT         NULL,

  status          VARCHAR(20)  NOT NULL DEFAULT 'planned',

  arrived_at      DATETIME     NULL,
  waiting_since   DATETIME     NULL,
  at_dock_at      DATETIME     NULL,
  work_started_at DATETIME     NULL,
  completed_at    DATETIME     NULL,
  departed_at     DATETIME     NULL,
  cancelled_at    DATETIME     NULL,

  created_by      INT UNSIGNED NULL,
  updated_by      INT UNSIGNED NULL,
  created_at      DATETIME     NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at      DATETIME     NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,

  PRIMARY KEY (id),
  KEY idx_appt_planned   (planned_at),
  KEY idx_appt_status    (status),
  KEY idx_appt_dock      (dock_id),
  KEY idx_appt_operation (operation),
  KEY idx_appt_customer  (customer),
  KEY idx_appt_carrier   (carrier),
  KEY idx_appt_truck     (truck_plate),
  CONSTRAINT fk_appt_dock    FOREIGN KEY (dock_id)    REFERENCES docks(id) ON DELETE SET NULL,
  CONSTRAINT fk_appt_creator FOREIGN KEY (created_by) REFERENCES users(id) ON DELETE SET NULL,
  CONSTRAINT fk_appt_editor  FOREIGN KEY (updated_by) REFERENCES users(id) ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ---------------------------------------------------------------------
-- Busenu istorija (kas ir kada pakeite busena)
-- ---------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS status_events (
  id             INT UNSIGNED NOT NULL AUTO_INCREMENT,
  appointment_id INT UNSIGNED NOT NULL,
  from_status    VARCHAR(20)  NULL,
  to_status      VARCHAR(20)  NOT NULL,
  note           VARCHAR(500) NULL,
  changed_by     INT UNSIGNED NULL,
  changed_at     DATETIME     NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  KEY idx_status_events_appt (appointment_id, changed_at),
  KEY idx_status_events_time (changed_at),
  KEY idx_status_events_user (changed_by),
  CONSTRAINT fk_events_appt FOREIGN KEY (appointment_id) REFERENCES appointments(id) ON DELETE CASCADE,
  CONSTRAINT fk_events_user FOREIGN KEY (changed_by)     REFERENCES users(id)        ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ---------------------------------------------------------------------
-- Prisegti krovinio / pakrovimo dokumentai
-- ---------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS appointment_documents (
  id             INT UNSIGNED NOT NULL AUTO_INCREMENT,
  appointment_id INT UNSIGNED NOT NULL,
  storage_name   VARCHAR(120) NOT NULL,
  original_name  VARCHAR(255) NOT NULL,
  mime_type      VARCHAR(100) NOT NULL,
  size_bytes     INT UNSIGNED NOT NULL,
  uploaded_by    INT UNSIGNED NULL,
  created_at     DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  UNIQUE KEY uq_document_storage_name (storage_name),
  KEY idx_documents_appointment (appointment_id, created_at),
  CONSTRAINT fk_documents_appointment FOREIGN KEY (appointment_id) REFERENCES appointments(id) ON DELETE CASCADE,
  CONSTRAINT fk_documents_user FOREIGN KEY (uploaded_by) REFERENCES users(id) ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ---------------------------------------------------------------------
-- Bendras audito zurnalas (sukurimas, redagavimas, trynimas, prisijungimai)
-- ---------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS audit_log (
  id         INT UNSIGNED NOT NULL AUTO_INCREMENT,
  entity     VARCHAR(32)  NOT NULL,   -- 'appointment' | 'user' | 'dock' | 'auth'
  entity_id  INT UNSIGNED NULL,
  action     VARCHAR(32)  NOT NULL,   -- 'create' | 'update' | 'delete' | 'status' | 'login' ...
  details    JSON         NULL,
  user_id    INT UNSIGNED NULL,
  ip         VARCHAR(64)  NULL,
  created_at DATETIME     NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  KEY idx_audit_created (created_at),
  KEY idx_audit_entity  (entity, entity_id),
  KEY idx_audit_user    (user_id),
  CONSTRAINT fk_audit_user FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
