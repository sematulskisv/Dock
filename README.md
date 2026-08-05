# Warehouse Ops — sandėlio krovos operacijų registras

Responsive web application for registering warehouse truck **loading and unloading**
operations: daily dock schedule, live statuses with automatic timestamps, delay and
long-wait alerts, full history, audit log and CSV export.

Built to be used on a **warehouse tablet** as well as on a desk browser.

- **Backend:** Node.js + Express
- **Database:** MySQL 8 / MariaDB 10.4+ (works on standard Hostinger hosting)
- **Frontend:** vanilla JS / CSS, no build step, no framework
- **UI languages:** Lithuanian (default) and English, switchable in the header

---

## Table of contents

1. [Features](#features)
2. [Quick start](#quick-start)
3. [Configuration](#configuration)
4. [Database structure](#database-structure)
5. [Business rules](#business-rules)
6. [Time and timezones](#time-and-timezones)
7. [API reference](#api-reference)
8. [CSV export](#csv-export)
9. [Project layout](#project-layout)
10. [Deployment](#deployment)
11. [Security notes](#security-notes)

---

## Features

| Requirement | Where |
|---|---|
| Login with three roles (administrator / warehouse operator / customer) | `routes/auth.js`, `middleware/auth.js` |
| Customer self-service booking | Customer selects a free 30-minute dock slot, fills in vehicle data and must attach a PDF, image or Excel document |
| Customer booking tracking | "Mano rezervacijos" shows only the customer's own visits, their live status timeline and available documents |
| Driver self check-in | QR code opens a public form; matching truck and order numbers mark today's appointment as arrived |
| Dashboard with today's truck appointments | "Šiandien" tab |
| Full appointment record (arrival time, operation, plates, driver, carrier, customer, reference, dock, notes) | `appointments` table |
| Pallet-based booking duration | 1–8 pallets: 30 min; 9–16: 60 min; 17–26: 90 min; 27–33: 120 min |
| EU route | Required origin and destination country selectors for all 27 EU countries |
| Five statuses | Planned, Arrived, At dock, Completed, Cancelled |
| Automatic timestamps on every status change | `POST /api/appointments/:id/status` |
| Filters: date, operation, status, dock, customer, carrier (+ free text search) | filter bar on every list view |
| Highlight delayed trucks and trucks waiting over 30 min | red / amber rows + alert counters |
| History page | "Istorija" tab (date range + pagination) |
| Audit log showing who changed each status | "Auditas" tab (`status_events` + `audit_log`) |
| MySQL database | `db.js`, `db/schema.sql` |
| Mobile / tablet friendly | table on desktop, cards + 40 px touch targets under 900 px |
| CSV export of completed operations | `GET /api/export/appointments.csv` |
| Git + README | this repository |

Extra: dock management, user management, live auto-refresh every 30 s, dark mode
that follows the OS setting, printable list view.

---

## Quick start

### 1. Requirements

- Node.js **18+**
- MySQL **8.0+** or MariaDB **10.4+**

### 2. Get a database

Either use an existing MySQL server (e.g. the one in your hosting panel), or start one
with Docker:

```bash
docker compose up -d
```

That gives you `warehouse_ops` on `localhost:3306` with user `warehouse` / `warehouse`.

To create it manually instead:

```bash
mysql -u root -p -e "CREATE DATABASE warehouse_ops CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;"
```

```bash
mysql -u root -p -e "CREATE USER 'warehouse'@'localhost' IDENTIFIED BY 'warehouse'; GRANT ALL ON warehouse_ops.* TO 'warehouse'@'localhost';"
```

### 3. Configure and install

```bash
cp .env.example .env
```

```bash
npm install
```

Edit `.env` and set `DB_HOST`, `DB_USER`, `DB_PASSWORD`, `DB_NAME`.

### 4. Create the schema

```bash
npm run migrate
```

The schema is idempotent — it is also applied automatically on every server start,
so upgrading is just "pull and restart".

### 5. Create the first administrator

```bash
npm run create-admin -- admin@sandelis.lt "Vardas Pavarde" "StrongPassword123"
```

Or load the full demo dataset (admin + 2 operators + today's sample appointments,
including a delayed truck and one waiting over 30 minutes):

```bash
npm run seed
```

Demo credentials created by `npm run seed`:

| Role | Email | Password |
|---|---|---|
| Administrator | `admin@sandelis.lt` | `Admin123!` |
| Operator | `operatorius@sandelis.lt` | `Operator123!` |
| Operator | `operatorius2@sandelis.lt` | `Operator123!` |

> Change these before any real use.

### 6. Run

```bash
npm start
```

Open <http://localhost:3000>. Use `npm run dev` for auto-restart while developing.

---

## Configuration

All settings come from `.env` (see `.env.example`).

| Variable | Default | Meaning |
|---|---|---|
| `PORT` | `3000` | HTTP port |
| `NODE_ENV` | `development` | `production` enables static asset caching |
| `DB_HOST` / `DB_PORT` / `DB_USER` / `DB_PASSWORD` / `DB_NAME` | `127.0.0.1` / `3306` | MySQL connection — see the IPv6 note below |
| `DATABASE_URL` | — | Alternative single-string form, `mysql://user:pass@host:3306/db`; takes priority |
| `DB_SSL` | `false` | `true` when the server requires TLS (usually remote databases) |
| `DB_POOL_SIZE` | `10` | Connection pool size — lower it on shared hosting with a tight connection limit |
| `APP_TIMEZONE` | `Europe/Vilnius` | Warehouse timezone; decides where "today" starts |
| `WAITING_ALERT_MINUTES` | `30` | Waiting longer than this is highlighted |
| `LATE_GRACE_MINUTES` | `0` | Tolerance before a truck counts as delayed |
| `UPLOAD_MAX_MB` | `15` | Maximum size of one attached PDF, image or Excel file (MB) |
| `PUBLIC_BASE_URL` | request URL | Public application URL used in the driver QR code, e.g. `https://dock.cubivo.lt` |
| `COOKIE_SECURE` | `false` | Set `true` when serving over HTTPS |
| `SEED_ADMIN_EMAIL` / `SEED_ADMIN_PASSWORD` / `SEED_ADMIN_NAME` | — | Used only by `npm run seed` |

Both alert thresholds are read per request, so changing them only needs a restart —
no migration and no data change.

> **Use `127.0.0.1`, not `localhost`, for `DB_HOST`.** Since Node 17, `localhost`
> resolves to IPv6 `::1` first, while MySQL grants are normally issued for
> `user@localhost` / `user@127.0.0.1`. MySQL treats those as different hosts, so the
> login is rejected with `ER_ACCESS_DENIED_ERROR` even though the password is correct.
> If you hit that, `GET /api/health` reports the host MySQL saw — `'***'@'::1'` is the
> signature of this exact problem.

Environment variables are read once at startup. **After changing any of them, restart
the app** — a running process keeps the old values.

---

## Database structure

Full DDL: [`db/schema.sql`](db/schema.sql). Every table is created with
`CREATE TABLE IF NOT EXISTS`, and all indexes are declared inside the table definition
(MySQL 8 has no `CREATE INDEX IF NOT EXISTS`), so running it repeatedly is safe.

All tables are `InnoDB`, `utf8mb4` / `utf8mb4_unicode_ci`. That collation is
case-insensitive, which is why email login and customer/carrier filters compare
directly with `=` and need no `LOWER()`.

```
users ──< sessions
  │
  ├──< appointments >── docks
  │         │
  │         └──< status_events
  └──< audit_log
```

### `users`
Application accounts.

| Column | Type | Notes |
|---|---|---|
| `id` | `INT UNSIGNED AUTO_INCREMENT` | |
| `email` | `VARCHAR(190)` unique | login identifier, stored lowercase |
| `full_name` | `VARCHAR(160)` | shown in the UI and in the audit log |
| `role` | `VARCHAR(16)` | `admin`, `operator` or `customer` (validated in the app) |
| `password_hash`, `password_salt` | `VARCHAR` | scrypt, 64 bytes, per-user salt |
| `is_active` | `TINYINT(1)` | disabling a user revokes their sessions |
| `last_login_at`, `created_at`, `updated_at` | `DATETIME` (UTC) | |

### `sessions`
Server-side sessions behind an httpOnly cookie (`wops_sid`). Only the SHA-256 hash of
the token is stored, so a database dump cannot be replayed as a login. TTL 14 days.

### `docks`
Warehouse docks: `code` (unique, e.g. `D1`), `name`, `is_active`, `sort_order`.
Six docks are created automatically on first start.

### `appointments`
One row = one truck visit. This is the core table.

| Column | Type | Notes |
|---|---|---|
| `planned_at` | `DATETIME` | planned arrival date **and** time (UTC) |
| `operation` | `VARCHAR(16)` | `loading` or `unloading` |
| `truck_plate` | `VARCHAR(32)` | required, stored uppercase |
| `trailer_plate` | `VARCHAR(32)` | |
| `driver_name`, `driver_phone` | `VARCHAR` | phone is click-to-call in the UI |
| `carrier` | `VARCHAR(160)` | carrier company |
| `customer` | `VARCHAR(160)` | customer |
| `reference` | `VARCHAR(120)` | order / shipment reference |
| `dock_id` | FK → `docks` | `ON DELETE SET NULL` — deleting a dock never deletes history |
| `notes` | `TEXT` | |
| `status` | `VARCHAR(20)` | one of the eight statuses |
| `arrived_at` | `DATETIME` | set when status becomes `arrived` |
| `waiting_since` | `DATETIME` | set when status becomes `waiting`, cleared at `at_dock` |
| `at_dock_at` | `DATETIME` | set when status becomes `at_dock` |
| `work_started_at` | `DATETIME` | set when status becomes `in_progress` |
| `completed_at` | `DATETIME` | set when status becomes `completed` |
| `departed_at` | `DATETIME` | set when status becomes `departed` |
| `cancelled_at` | `DATETIME` | set when status becomes `cancelled` |
| `created_by`, `updated_by` | FK → `users` | `ON DELETE SET NULL` |
| `created_at`, `updated_at` | `DATETIME` | |

Indexes on `planned_at`, `status`, `dock_id`, `operation`, `customer`, `carrier` and
`truck_plate` support every filter without a full table scan.

**Timestamp rule:** all milestone columns except `waiting_since` are written with
`COALESCE(column, UTC_TIMESTAMP())`, so the *first* time a status is entered wins.
`waiting_since` is overwritten every time, so the 30-minute waiting counter always
measures the *current* wait. Entering `at_dock` clears it.

### `status_events`
Append-only history of every status change — this is what the audit page reads.

| Column | Notes |
|---|---|
| `appointment_id` | FK, `ON DELETE CASCADE` |
| `from_status`, `to_status` | `from_status` is `NULL` for the creation event |
| `note` | optional operator comment |
| `changed_by` | FK → `users` — **which user changed the status** |
| `changed_at` | `DATETIME` (UTC) |

### `appointment_documents`
Documents are stored outside the public web directory and are available only through
an authenticated appointment download endpoint. A customer must attach the first
document when creating a booking; warehouse users can add follow-up documents, for
example an unloading confirmation.

| Column | Notes |
|---|---|
| `appointment_id` | FK, `ON DELETE CASCADE` |
| `storage_name` | random server-side filename; never exposed as a public path |
| `original_name`, `mime_type`, `size_bytes` | download metadata |
| `uploaded_by`, `created_at` | uploader and upload time |

### `audit_log`
Wider audit trail: appointment create/update/delete, CSV exports, user and dock
management, logins, failed logins and logouts.

| Column | Notes |
|---|---|
| `entity` | `appointment` \| `user` \| `dock` \| `auth` |
| `entity_id` | affected row id (plain integer, no FK — survives deletion) |
| `action` | `create` \| `update` \| `delete` \| `status` \| `export` \| `login` \| `login_failed` \| `logout` \| `password_change` \| `password_reset` |
| `details` | `JSON`; for `update` it holds a `{field: {from, to}}` diff |
| `user_id`, `ip`, `created_at` | who, from where, when |

> MariaDB returns `JSON` columns as strings while MySQL returns objects.
> `db.parseDetails()` normalises both, so the API response shape is identical.

---

## Business rules

### Status flow

```
planned ──> arrived ──> at_dock ──> completed
   │           │           │
   └───────────┴───────────┴──────────> cancelled ──> planned
```

Operators are limited to the transitions above (enforced server-side in
`lib/appointments.js`). **Administrators may set any status**, which is recorded in the
audit log like any other change.

### Customer bookings

- An administrator creates a user with the **Customer** role.
- Customers see the dock schedule without any other carrier's personal or vehicle data.
- A free slot opens the booking form. The selected dock is required and the slot is
  reserved atomically, so two customers cannot take the same 30-minute slot.
- A booking cannot be submitted without a PDF, JPG, PNG or Excel attachment. The
  maximum file size is `UPLOAD_MAX_MB` (15 MB by default).
- Customers can see and edit only their own planned bookings. They cannot change a
  vehicle status, view audit logs, export CSV or access any other customer's booking.
- Warehouse operators and administrators can add documents after unloading; the
  customer can download documents attached to their own booking.

### Pallets, route and dock availability

Each new appointment records a pallet count from 1 to 33 and a route between two EU
countries. The handling duration is calculated server-side and saved with the visit:

| Pallets | Reserved dock time |
|---|---|
| 1–8 | 30 min |
| 9–16 | 60 min |
| 17–26 | 90 min |
| 27–33 | 120 min |

The schedule marks every 30-minute block in that duration as occupied. Creation and
editing use the same overlap check inside a database transaction, so an occupied dock
interval cannot be double-booked.

### Driver arrival check-in

In **Settings**, the administrator can open or print the QR code for the warehouse
entrance. It leads to `/driver-checkin`, which can also be opened directly without a
QR scan. The driver must enter both the truck plate and the order/reference number.
Only a matching appointment scheduled for the current warehouse day is accepted. Its
status changes from `planned` to `arrived`, writes a status event and is visible in the
warehouse dashboard and the customer's own booking list on the next live refresh.

The public endpoint rate-limits attempts and never returns appointment details when
the supplied data do not match.

### Alerts

Both are computed identically on the server (for filters, counters and CSV) and on the
client (so the counters keep ticking between refreshes):

- **Delayed** — status is `planned` or `arrived` and
  `now > planned_at + LATE_GRACE_MINUTES`. Red row, red left border, `Vėluoja N min` badge.
The `Tik problemos` toggle filters the list down to delayed appointments, and the dashboard
counters show the totals.

### Derived values

`work_minutes` = `completed_at − work_started_at`.
`onsite_minutes` = `completed_at − arrived_at`.
Both are computed in SQL and are also exported to CSV.

---

## Time and timezones

MySQL `DATETIME` carries no timezone, so the rules are explicit:

1. **Everything is stored in UTC.** Every query uses `UTC_TIMESTAMP()`, never `NOW()`,
   so the data never depends on the server's or the connection's timezone setting.
2. The mysql2 pool is opened with `timezone: 'Z'` and issues
   `SET time_zone = '+00:00'` per connection, so `DATETIME` ⇄ JS `Date` conversion is
   exact and the JSON API returns proper ISO-8601 UTC strings.
3. **`APP_TIMEZONE` only decides where a calendar day starts.**
   `lib/timezone.js` converts a local date such as `2026-08-04` into the UTC range
   `[2026-08-03T21:00Z, 2026-08-04T21:00Z)` for the date filters and the CSV export.
   The conversion does two passes so it stays correct across DST changes; it was
   checked against every day of 2025–2027 including both yearly transitions.
4. The browser renders all times in the viewer's own locale and timezone.

If your warehouse is not in Lithuania, set `APP_TIMEZONE` and nothing else changes.

---

## API reference

All endpoints are under `/api`, return JSON, and are sent `Cache-Control: no-store`.
Authentication is the httpOnly cookie `wops_sid`; the frontend uses
`credentials: 'include'`.

### Auth

| Method | Path | Body | Returns |
|---|---|---|---|
| POST | `/api/login` | `{email, password}` | `{user}` — rate limited 15 / 15 min per IP |
| GET | `/api/me` | — | `{user}` or `{user: null}` |
| POST | `/api/logout` | — | `{ok}` |
| POST | `/api/password` | `{currentPassword, newPassword}` | `{ok}` — revokes all other sessions |

### Appointments

| Method | Path | Notes |
|---|---|---|
| GET | `/api/appointments` | filters below; `{appointments, total, limit, offset}` |
| GET | `/api/appointments/stats` | same filters; counters incl. `planned`, `arrived`, `at_dock`, `completed`, `delayed` |
| GET | `/api/appointments/options` | docks, distinct customers/carriers, thresholds |
| GET | `/api/appointments/availability?date=YYYY-MM-DD` | active docks and occupied slots only, without personal data |
| GET | `/api/appointments/:id` | `{appointment, events, audit, documents}` |
| POST | `/api/appointments` | create (status starts as `planned`) |
| POST | `/api/appointments/booking` | customer-only multipart booking; `document` attachment is required |
| PUT | `/api/appointments/:id` | partial update; status is **not** editable here |
| POST | `/api/appointments/:id/documents` | multipart follow-up document (`document`) |
| GET | `/api/appointments/:id/documents/:documentId/download` | authenticated document download |
| POST | `/api/appointments/:id/status` | `{status, note?}` → writes timestamp + `status_events` + audit |
| DELETE | `/api/appointments/:id` | **admin only** |

### Driver check-in

| Method | Path | Notes |
|---|---|---|
| GET | `/driver-checkin` | public mobile-friendly driver check-in form |
| POST | `/api/driver-checkin` | public `{truckPlate, reference}`; marks today's matching planned appointment as `arrived` |
| GET | `/api/driver-checkin/qr.svg` | administrator-only QR code for printing/display |

Query filters accepted by the list, stats and CSV endpoints:

`date` (single day) · `dateFrom` · `dateTo` · `operation` (`loading`/`unloading`) ·
`status` (one or comma-separated) · `statusGroup` (`active`/`closed`) · `dockId`
(numeric or `none`) · `customer` · `carrier` · `q` (free text over plates, driver,
reference, customer, carrier) · `onlyAlerts=1` · `sort` · `dir` · `limit` · `offset`.

`is_delayed` and `is_waiting_long` come back as MySQL booleans (`1`/`0`).

### Audit

| Method | Path | Notes |
|---|---|---|
| GET | `/api/audit/status-changes` | who changed which status, when, with the appointment context |
| GET | `/api/audit` | full action log; operators only see their own `auth` rows |

### Docks and users

| Method | Path | Access |
|---|---|---|
| GET | `/api/docks` | any signed-in user |
| POST / PATCH / DELETE | `/api/docks[/:id]` | admin |
| GET / POST | `/api/users` | admin |
| PATCH / DELETE | `/api/users/:id` | admin — cannot delete or demote yourself, cannot remove the last admin |
| POST | `/api/users/:id/password` | admin — revokes that user's sessions |

### Health

`GET /api/health` → `{status, database, timestamp}`; returns 503 when the database is
unreachable. Useful as a load-balancer / uptime probe.

---

## CSV export

```
GET /api/export/appointments.csv?<same filters as the list>
```

- When no `status` / `statusGroup` is given it defaults to **completed operations**
  (`completed` + `departed`), which is the intended use.
- UTF-8 with BOM, `;` delimiter — opens directly in Lithuanian/EU Excel.
  Add `&sep=comma` for a comma-delimited file.
- Columns: id, planned date, planned time, operation, status, truck, trailer, driver,
  phone, carrier, customer, reference, dock, arrived, at dock, work started, work
  finished, departed, handling minutes, on-site minutes, minutes late, notes, created
  by, last edited by.
- Timestamps are rendered in `APP_TIMEZONE`, not UTC.
- Values starting with `=`, `+`, `-` or `@` are prefixed with `'` to prevent Excel
  formula injection.
- Every export is written to `audit_log`.
- Limit: 50 000 rows per request.

In the UI the **CSV** button exports exactly what the current filters show.

---

## Project layout

```
server.js                Express app, security headers, routing, startup
db.js                    mysql2 pool, schema bootstrap, scrypt passwords, sessions, audit helper
db/schema.sql            full MySQL DDL (idempotent)
lib/appointments.js      statuses, allowed transitions, shared SQL SELECT + filter builder
lib/timezone.js          local calendar day → UTC range (DST-safe)
middleware/auth.js       cookie parsing, attachUser, requireAuth, requireAdmin
middleware/rateLimit.js  dependency-free in-memory rate limiter
routes/auth.js           login, me, logout, own password
routes/appointments.js   list, stats, options, detail, create, update, status, delete
routes/audit.js          status-change log and full action log
routes/docks.js          dock CRUD
routes/users.js          user CRUD (admin)
routes/export.js         CSV export
scripts/migrate.js       apply schema
scripts/seed.js          demo data
scripts/create-admin.js  create/reset an admin account
public/index.html        app shell and all modals
public/app.js            all frontend logic: i18n, state, rendering, API client
public/styles.css        all styles (light theme first, dark mode optional)
docker-compose.yml       local MySQL
```

Code comments are in Lithuanian, matching the team's other projects.

---

## Deployment

### Hostinger (GitHub deploy)

This is the intended target and needs no external services.

1. **Create the MySQL database** in hPanel → *Databases → MySQL*. Note the database
   name, user, password and host (on shared hosting the host is usually `localhost`).
2. **Connect the repository** in hPanel → *Website → GitHub / Deployment*, pointing at
   this repo's `main` branch.
3. **Set the environment variables** for the Node app:
   ```
   NODE_ENV=production
   DB_HOST=localhost
   DB_USER=uXXXXXX_warehouse
   DB_PASSWORD=...
   DB_NAME=uXXXXXX_warehouse_ops
   DB_POOL_SIZE=5
   COOKIE_SECURE=true
   PUBLIC_BASE_URL=https://dock.cubivo.lt
   APP_TIMEZONE=Europe/Vilnius
   WAITING_ALERT_MINUTES=30
   ```
   Shared plans often cap simultaneous MySQL connections — keep `DB_POOL_SIZE` small.
4. **Build / start commands:** `npm install`, then `npm start`. The process must have
   write access to the project's `uploads/` directory for attached documents.
   The schema is created automatically on first start; there is no separate migration
   step and no shell access required.
5. **Create the first admin.** With SSH:
   `npm run create-admin -- admin@yourcompany.lt "Name Surname" "StrongPassword"`.
   Without SSH, set `BOOTSTRAP_ADMIN_EMAIL`, `BOOTSTRAP_ADMIN_PASSWORD` and
   optionally `BOOTSTRAP_ADMIN_NAME` in the Node application environment, then
   restart it. The account is created only while the `users` table is empty; remove
   these variables immediately after the first successful login.

Do **not** deploy `docker-compose.yml` — it is only for local development.

### Behind nginx / a reverse proxy

The app trusts one proxy hop (`app.set('trust proxy', 1)`) so `X-Forwarded-For` is used
for rate limiting and audit IPs. Terminate TLS at the proxy and forward to `PORT`.

```nginx
location / {
    proxy_pass         http://127.0.0.1:3000;
    proxy_set_header   Host $host;
    proxy_set_header   X-Forwarded-For $proxy_add_x_forwarded_for;
    proxy_set_header   X-Forwarded-Proto $scheme;
}
```

### systemd unit (VPS)

```ini
[Unit]
Description=Warehouse Ops
After=network.target mysql.service

[Service]
Type=simple
WorkingDirectory=/opt/warehouse-ops
EnvironmentFile=/opt/warehouse-ops/.env
ExecStart=/usr/bin/node server.js
Restart=always
User=warehouse

[Install]
WantedBy=multi-user.target
```

### Upgrading

```bash
git pull && npm install && npm start
```

`initDb()` re-applies the idempotent schema on every start, so there is no separate
migration step for additive changes.

### Backups

Booking data is stored in MySQL and attached documents are stored in the project's
`uploads/` directory. Back up both:

```bash
mysqldump --single-transaction --routines -u warehouse -p warehouse_ops > warehouse_ops.sql
```

### Cache busting

There is no build step. When you change `public/app.js` or `public/styles.css`, bump the
`?v=` query string in `public/index.html` (both lines) so tablets do not keep stale code.

---

## Security notes

- Passwords: scrypt with a 16-byte per-user salt, compared with `timingSafeEqual`.
- Sessions: 32-byte random token in an httpOnly, SameSite=Lax cookie; only the SHA-256
  hash is stored. Set `COOKIE_SECURE=true` in production.
- Login is rate limited (15 attempts / 15 min per IP) and every attempt — successful or
  not — is written to `audit_log`.
- All SQL uses `?` placeholders escaped by mysql2. The only values interpolated into SQL
  text are validated integers (`LIMIT`/`OFFSET`, the two alert thresholds from `.env`)
  and whitelisted sort columns.
- Server-side validation and length limits on every input; JSON bodies capped at 256 KB.
- Connections run with `STRICT_TRANS_TABLES`, so over-long values raise an error instead
  of being silently truncated.
- Response headers: CSP (`script-src 'self'`), `X-Content-Type-Options`,
  `X-Frame-Options`, `Referrer-Policy`, `Permissions-Policy`.
- All user content is escaped with `escapeHtml()` before rendering.
- Changing a password or disabling a user immediately revokes the affected sessions.
- `.env` is git-ignored — never commit credentials.
