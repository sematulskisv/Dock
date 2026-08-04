/* =====================================================================
   Sandėlio krovos operacijos — visa kliento logika.
   Be karkasų ir be build žingsnio.
   ===================================================================== */
'use strict';

/* ------------------------------------------------------------------ i18n */

const I18N = {
  lt: {
    'login.subtitle': 'Pakrovimo ir iškrovimo registras',
    'login.email': 'El. paštas',
    'login.password': 'Slaptažodis',
    'login.submit': 'Prisijungti',
    'login.failed': 'Neteisingas el. paštas arba slaptažodis',
    'login.rateLimited': 'Per daug bandymų. Pabandykite vėliau.',

    'nav.dashboard': 'Šiandien',
    'nav.history': 'Istorija',
    'nav.audit': 'Auditas',
    'nav.admin': 'Nustatymai',

    'role.admin': 'Administratorius',
    'role.operator': 'Sandėlio operatorius',

    'op.loading': 'Pakrovimas',
    'op.unloading': 'Iškrovimas',

    'status.planned': 'Suplanuota',
    'status.arrived': 'Atvyko',
    'status.waiting': 'Laukia',
    'status.at_dock': 'Prie vartų',
    'status.in_progress': 'Vyksta krova',
    'status.completed': 'Baigta',
    'status.departed': 'Išvyko',
    'status.cancelled': 'Atšaukta',
    'status.changeTitle': 'Keisti būseną',
    'status.note': 'Pastaba (nebūtina)',
    'status.noteShort': 'Pastaba',
    'status.changed': 'Būsena pakeista',
    'status.notAllowed': 'Toks būsenos perėjimas neleidžiamas',

    'stat.total': 'Iš viso',
    'stat.active': 'Vykdoma',
    'stat.loading': 'Pakrovimai',
    'stat.unloading': 'Iškrovimai',
    'stat.completed': 'Baigta',
    'stat.delayed': 'Vėluoja',
    'stat.waitingLong': 'Laukia >{n} min',

    'filter.date': 'Data',
    'filter.dateFrom': 'Nuo',
    'filter.dateTo': 'Iki',
    'filter.operation': 'Operacija',
    'filter.status': 'Būsena',
    'filter.dock': 'Vartai',
    'filter.customer': 'Klientas',
    'filter.carrier': 'Vežėjas',
    'filter.search': 'Paieška',
    'filter.searchPlaceholder': 'Nr., vairuotojas, užsakymas…',
    'filter.all': 'Visi',
    'filter.noDock': 'Nepriskirti',
    'filter.onlyAlerts': 'Tik problemos',
    'filter.user': 'Naudotojas',
    'filter.reset': 'Išvalyti',

    'col.time': 'Laikas',
    'col.operation': 'Operacija',
    'col.truck': 'Vilkikas / priekaba',
    'col.driver': 'Vairuotojas',
    'col.carrier': 'Vežėjas',
    'col.customer': 'Klientas',
    'col.reference': 'Užsakymas',
    'col.dock': 'Vartai',
    'col.status': 'Būsena',
    'col.actions': 'Veiksmai',

    'action.new': 'Naujas vizitas',
    'action.save': 'Išsaugoti',
    'action.cancel': 'Atšaukti',
    'action.edit': 'Redaguoti',
    'action.delete': 'Ištrinti',
    'action.details': 'Detalės',
    'action.exportCsv': 'CSV',
    'action.status': 'Būsena',
    'action.more': 'Daugiau',
    'action.close': 'Uždaryti',
    'action.prev': 'Ankstesni',
    'action.next': 'Tolesni',
    'action.logout': 'Atsijungti',

    'form.newTitle': 'Naujas vizitas',
    'form.editTitle': 'Redaguoti vizitą',
    'form.plannedAt': 'Planuojamas atvykimas',
    'form.operation': 'Operacija',
    'form.truckPlate': 'Vilkiko valst. nr.',
    'form.trailerPlate': 'Priekabos valst. nr.',
    'form.driverName': 'Vairuotojas',
    'form.driverPhone': 'Vairuotojo telefonas',
    'form.carrier': 'Vežėjas',
    'form.customer': 'Klientas',
    'form.reference': 'Užsakymo / siuntos nr.',
    'form.dock': 'Sandėlio vartai',
    'form.notes': 'Pastabos',
    'form.required': 'Užpildykite privalomus laukus',
    'form.saved': 'Išsaugota',
    'form.deleted': 'Ištrinta',
    'form.confirmDelete': 'Tikrai ištrinti šį vizitą? Veiksmo atšaukti negalima.',

    'detail.timeline': 'Būsenų istorija',
    'detail.info': 'Informacija',
    'detail.created': 'Sukūrė',
    'detail.updated': 'Paskutinis keitė',
    'detail.workTime': 'Krovos trukmė',
    'detail.onsiteTime': 'Laikas teritorijoje',
    'detail.minutes': 'min',
    'detail.noEvents': 'Būsenų pakeitimų nėra',
    'detail.by': 'Keitė',

    'audit.statusChanges': 'Būsenų keitimai',
    'audit.allActions': 'Visi veiksmai',
    'audit.when': 'Kada',
    'audit.who': 'Kas',
    'audit.what': 'Ką pakeitė',
    'audit.object': 'Objektas',
    'audit.action.create': 'Sukurta',
    'audit.action.update': 'Redaguota',
    'audit.action.delete': 'Ištrinta',
    'audit.action.status': 'Būsenos keitimas',
    'audit.action.export': 'CSV eksportas',
    'audit.action.login': 'Prisijungimas',
    'audit.action.logout': 'Atsijungimas',
    'audit.action.login_failed': 'Nepavykęs prisijungimas',
    'audit.action.password_change': 'Slaptažodžio keitimas',
    'audit.action.password_reset': 'Slaptažodžio atstatymas',
    'audit.entity.appointment': 'Vizitas',
    'audit.entity.user': 'Naudotojas',
    'audit.entity.dock': 'Vartai',
    'audit.entity.auth': 'Prisijungimai',

    'admin.users': 'Naudotojai',
    'admin.docks': 'Sandėlio vartai',
    'admin.addUser': 'Pridėti naudotoją',
    'admin.editUser': 'Redaguoti naudotoją',
    'admin.addDock': 'Pridėti vartus',
    'admin.editDock': 'Redaguoti vartus',
    'admin.fullName': 'Vardas ir pavardė',
    'admin.role': 'Rolė',
    'admin.password': 'Slaptažodis',
    'admin.passwordHint': 'Redaguojant palikite tuščią, jei slaptažodžio keisti nereikia. Mažiausiai 8 simboliai.',
    'admin.dockCode': 'Kodas',
    'admin.dockName': 'Pavadinimas',
    'admin.dockOrder': 'Eiliškumas',
    'admin.active': 'Aktyvus',
    'admin.inactive': 'Neaktyvus',
    'admin.disable': 'Išjungti',
    'admin.enable': 'Įjungti',
    'admin.neverLoggedIn': 'Neprisijungė',
    'admin.lastLogin': 'Paskutinis prisijungimas',
    'admin.confirmDeleteUser': 'Ištrinti šį naudotoją?',
    'admin.confirmDeleteDock': 'Ištrinti šiuos vartus? Vizitai išliks, tik nebeturės priskirtų vartų.',

    'empty.title': 'Įrašų nėra',
    'empty.body': 'Pakeiskite filtrus arba sukurkite naują vizitą.',
    'empty.audit': 'Audito įrašų pagal šiuos filtrus nėra.',

    'alert.late': 'Vėluoja {n} min',
    'alert.waiting': 'Laukia {n} min',
    'alert.waitingShort': 'Laukia {n} min',

    'error.generic': 'Įvyko klaida. Bandykite dar kartą.',
    'error.network': 'Nepavyko susisiekti su serveriu',
    'error.forbidden': 'Neturite teisių šiam veiksmui',
    'error.emailExists': 'Toks el. paštas jau naudojamas',
    'error.codeExists': 'Toks vartų kodas jau yra',
    'error.weakPassword': 'Slaptažodis per trumpas (min. 8 simboliai)',

    'common.of': 'iš',
    'common.results': 'įrašų',
    'common.yes': 'Taip',
    'common.no': 'Ne',
    'common.none': '—',
  },

  en: {
    'login.subtitle': 'Loading & unloading register',
    'login.email': 'Email',
    'login.password': 'Password',
    'login.submit': 'Sign in',
    'login.failed': 'Invalid email or password',
    'login.rateLimited': 'Too many attempts. Try again later.',

    'nav.dashboard': 'Today',
    'nav.history': 'History',
    'nav.audit': 'Audit',
    'nav.admin': 'Settings',

    'role.admin': 'Administrator',
    'role.operator': 'Warehouse operator',

    'op.loading': 'Loading',
    'op.unloading': 'Unloading',

    'status.planned': 'Planned',
    'status.arrived': 'Arrived',
    'status.waiting': 'Waiting',
    'status.at_dock': 'At dock',
    'status.in_progress': 'In progress',
    'status.completed': 'Completed',
    'status.departed': 'Departed',
    'status.cancelled': 'Cancelled',
    'status.changeTitle': 'Change status',
    'status.note': 'Note (optional)',
    'status.noteShort': 'Note',
    'status.changed': 'Status updated',
    'status.notAllowed': 'That status transition is not allowed',

    'stat.total': 'Total',
    'stat.active': 'In progress',
    'stat.loading': 'Loadings',
    'stat.unloading': 'Unloadings',
    'stat.completed': 'Completed',
    'stat.delayed': 'Delayed',
    'stat.waitingLong': 'Waiting >{n} min',

    'filter.date': 'Date',
    'filter.dateFrom': 'From',
    'filter.dateTo': 'To',
    'filter.operation': 'Operation',
    'filter.status': 'Status',
    'filter.dock': 'Dock',
    'filter.customer': 'Customer',
    'filter.carrier': 'Carrier',
    'filter.search': 'Search',
    'filter.searchPlaceholder': 'Plate, driver, order…',
    'filter.all': 'All',
    'filter.noDock': 'Unassigned',
    'filter.onlyAlerts': 'Alerts only',
    'filter.user': 'User',
    'filter.reset': 'Clear',

    'col.time': 'Time',
    'col.operation': 'Operation',
    'col.truck': 'Truck / trailer',
    'col.driver': 'Driver',
    'col.carrier': 'Carrier',
    'col.customer': 'Customer',
    'col.reference': 'Reference',
    'col.dock': 'Dock',
    'col.status': 'Status',
    'col.actions': 'Actions',

    'action.new': 'New appointment',
    'action.save': 'Save',
    'action.cancel': 'Cancel',
    'action.edit': 'Edit',
    'action.delete': 'Delete',
    'action.details': 'Details',
    'action.exportCsv': 'CSV',
    'action.status': 'Status',
    'action.more': 'More',
    'action.close': 'Close',
    'action.prev': 'Previous',
    'action.next': 'Next',
    'action.logout': 'Sign out',

    'form.newTitle': 'New appointment',
    'form.editTitle': 'Edit appointment',
    'form.plannedAt': 'Planned arrival',
    'form.operation': 'Operation',
    'form.truckPlate': 'Truck plate',
    'form.trailerPlate': 'Trailer plate',
    'form.driverName': 'Driver',
    'form.driverPhone': 'Driver phone',
    'form.carrier': 'Carrier',
    'form.customer': 'Customer',
    'form.reference': 'Order / shipment ref.',
    'form.dock': 'Warehouse dock',
    'form.notes': 'Notes',
    'form.required': 'Please fill in the required fields',
    'form.saved': 'Saved',
    'form.deleted': 'Deleted',
    'form.confirmDelete': 'Delete this appointment? This cannot be undone.',

    'detail.timeline': 'Status history',
    'detail.info': 'Details',
    'detail.created': 'Created by',
    'detail.updated': 'Last edited by',
    'detail.workTime': 'Handling time',
    'detail.onsiteTime': 'Time on site',
    'detail.minutes': 'min',
    'detail.noEvents': 'No status changes yet',
    'detail.by': 'Changed by',

    'audit.statusChanges': 'Status changes',
    'audit.allActions': 'All actions',
    'audit.when': 'When',
    'audit.who': 'Who',
    'audit.what': 'Change',
    'audit.object': 'Object',
    'audit.action.create': 'Created',
    'audit.action.update': 'Updated',
    'audit.action.delete': 'Deleted',
    'audit.action.status': 'Status change',
    'audit.action.export': 'CSV export',
    'audit.action.login': 'Sign in',
    'audit.action.logout': 'Sign out',
    'audit.action.login_failed': 'Failed sign in',
    'audit.action.password_change': 'Password change',
    'audit.action.password_reset': 'Password reset',
    'audit.entity.appointment': 'Appointment',
    'audit.entity.user': 'User',
    'audit.entity.dock': 'Dock',
    'audit.entity.auth': 'Authentication',

    'admin.users': 'Users',
    'admin.docks': 'Warehouse docks',
    'admin.addUser': 'Add user',
    'admin.editUser': 'Edit user',
    'admin.addDock': 'Add dock',
    'admin.editDock': 'Edit dock',
    'admin.fullName': 'Full name',
    'admin.role': 'Role',
    'admin.password': 'Password',
    'admin.passwordHint': 'Leave empty when editing to keep the current password. Minimum 8 characters.',
    'admin.dockCode': 'Code',
    'admin.dockName': 'Name',
    'admin.dockOrder': 'Order',
    'admin.active': 'Active',
    'admin.inactive': 'Inactive',
    'admin.disable': 'Disable',
    'admin.enable': 'Enable',
    'admin.neverLoggedIn': 'Never signed in',
    'admin.lastLogin': 'Last sign in',
    'admin.confirmDeleteUser': 'Delete this user?',
    'admin.confirmDeleteDock': 'Delete this dock? Appointments stay, but lose the dock assignment.',

    'empty.title': 'Nothing here',
    'empty.body': 'Adjust the filters or create a new appointment.',
    'empty.audit': 'No audit entries match these filters.',

    'alert.late': 'Late {n} min',
    'alert.waiting': 'Waiting {n} min',
    'alert.waitingShort': 'Waiting {n} min',

    'error.generic': 'Something went wrong. Please try again.',
    'error.network': 'Cannot reach the server',
    'error.forbidden': 'You do not have permission for this action',
    'error.emailExists': 'That email is already in use',
    'error.codeExists': 'That dock code already exists',
    'error.weakPassword': 'Password too short (min. 8 characters)',

    'common.of': 'of',
    'common.results': 'entries',
    'common.yes': 'Yes',
    'common.no': 'No',
    'common.none': '—',
  },
};

let LANG = localStorage.getItem('wops.lang') || 'lt';
if (!I18N[LANG]) LANG = 'lt';

function t(key, vars) {
  let s = (I18N[LANG] && I18N[LANG][key]) || I18N.lt[key] || key;
  if (vars) {
    for (const [k, v] of Object.entries(vars)) s = s.replace(`{${k}}`, v);
  }
  return s;
}

function applyStaticTranslations() {
  document.documentElement.lang = LANG;
  document.querySelectorAll('[data-i18n]').forEach((el) => {
    el.textContent = t(el.dataset.i18n);
  });
  document.querySelectorAll('.lang-btn').forEach((b) => {
    b.classList.toggle('is-active', b.dataset.lang === LANG);
  });
}

/* ------------------------------------------------------------- konstantos */

const STATUSES = ['planned', 'arrived', 'waiting', 'at_dock', 'in_progress', 'completed', 'departed', 'cancelled'];

// Leidžiami perėjimai (turi atitikti lib/appointments.js serveryje)
const TRANSITIONS = {
  planned: ['arrived', 'waiting', 'cancelled'],
  arrived: ['waiting', 'at_dock', 'cancelled'],
  waiting: ['at_dock', 'cancelled'],
  at_dock: ['in_progress', 'waiting', 'cancelled'],
  in_progress: ['completed', 'waiting', 'cancelled'],
  completed: ['departed', 'in_progress'],
  departed: [],
  cancelled: ['planned'],
};

// Pagrindinis "kitas žingsnis" greitajam mygtukui
const PRIMARY_NEXT = {
  planned: 'arrived',
  arrived: 'at_dock',
  waiting: 'at_dock',
  at_dock: 'in_progress',
  in_progress: 'completed',
  completed: 'departed',
};

const CLOSED = new Set(['completed', 'departed', 'cancelled']);

/* ------------------------------------------------------------------ būsena */

const state = {
  user: null,
  view: 'dashboard',
  options: { docks: [], customers: [], carriers: [], waitingAlertMinutes: 30, lateGraceMinutes: 0 },
  users: [],
  dashboard: { rows: [], stats: null, filters: {} },
  history: { rows: [], stats: null, total: 0, offset: 0, limit: 50, filters: {} },
  audit: { mode: 'status', rows: [], total: 0, offset: 0, limit: 100, filters: {} },
  statusTarget: null,
  refreshTimer: null,
};

/* ------------------------------------------------------------------ utils */

const $ = (sel, root = document) => root.querySelector(sel);
const $$ = (sel, root = document) => Array.from(root.querySelectorAll(sel));

function escapeHtml(value) {
  if (value === null || value === undefined) return '';
  return String(value)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

function localeTag() {
  return LANG === 'en' ? 'en-GB' : 'lt-LT';
}

function fmtTime(value) {
  if (!value) return '';
  const d = new Date(value);
  if (!Number.isFinite(d.getTime())) return '';
  return d.toLocaleTimeString(localeTag(), { hour: '2-digit', minute: '2-digit', hour12: false });
}

function fmtDate(value) {
  if (!value) return '';
  const d = new Date(value);
  if (!Number.isFinite(d.getTime())) return '';
  return d.toLocaleDateString(localeTag(), { year: 'numeric', month: '2-digit', day: '2-digit' });
}

function fmtDateTime(value) {
  if (!value) return '';
  return `${fmtDate(value)} ${fmtTime(value)}`;
}

/** YYYY-MM-DD vietiniu laiku (input[type=date] reikšmei). */
function isoDate(date = new Date()) {
  const d = new Date(date);
  d.setMinutes(d.getMinutes() - d.getTimezoneOffset());
  return d.toISOString().slice(0, 10);
}

/** YYYY-MM-DDTHH:MM vietiniu laiku (input[type=datetime-local] reikšmei). */
function isoLocalDateTime(date = new Date()) {
  const d = new Date(date);
  d.setMinutes(d.getMinutes() - d.getTimezoneOffset());
  return d.toISOString().slice(0, 16);
}

function daysAgo(n) {
  const d = new Date();
  d.setDate(d.getDate() - n);
  return isoDate(d);
}

function debounce(fn, ms = 300) {
  let timer = null;
  return (...args) => {
    clearTimeout(timer);
    timer = setTimeout(() => fn(...args), ms);
  };
}

function toast(message, kind = '') {
  const host = $('#toastHost');
  const el = document.createElement('div');
  el.className = `toast ${kind ? `is-${kind}` : ''}`;
  el.textContent = message;
  host.appendChild(el);
  setTimeout(() => {
    el.style.opacity = '0';
    el.style.transition = 'opacity .25s';
    setTimeout(() => el.remove(), 260);
  }, 3200);
}

function setLive(kind) {
  const dot = $('#liveDot');
  dot.classList.toggle('is-loading', kind === 'loading');
  dot.classList.toggle('is-error', kind === 'error');
}

/* -------------------------------------------------------------------- API */

async function api(path, { method = 'GET', body = null } = {}) {
  let res;
  try {
    res = await fetch(path, {
      method,
      credentials: 'include',
      headers: body ? { 'Content-Type': 'application/json' } : undefined,
      body: body ? JSON.stringify(body) : undefined,
    });
  } catch {
    const err = new Error('network');
    err.code = 'network';
    throw err;
  }

  if (res.status === 401) {
    if (state.user) showLogin();
    const err = new Error('unauthorized');
    err.code = 'unauthorized';
    throw err;
  }

  let data = null;
  const type = res.headers.get('content-type') || '';
  if (type.includes('application/json')) {
    data = await res.json().catch(() => null);
  }

  if (!res.ok) {
    const err = new Error((data && data.error) || `http_${res.status}`);
    err.code = (data && data.error) || `http_${res.status}`;
    err.status = res.status;
    err.data = data;
    throw err;
  }
  return data;
}

function errorMessage(err) {
  switch (err && err.code) {
    case 'network': return t('error.network');
    case 'forbidden': return t('error.forbidden');
    case 'email_exists': return t('error.emailExists');
    case 'code_exists': return t('error.codeExists');
    case 'weak_password': return t('error.weakPassword');
    case 'transition_not_allowed': return t('status.notAllowed');
    case 'validation_failed': return t('form.required');
    case 'rate_limited': return t('login.rateLimited');
    default: return t('error.generic');
  }
}

/* -------------------------------------------------------- įspėjimų logika */

/** Skaičiuojama kliente, kad laukimo laikmatis tiksėtų tarp atnaujinimų. */
function computeAlerts(a) {
  const now = Date.now();
  const waitLimit = state.options.waitingAlertMinutes || 30;
  const grace = state.options.lateGraceMinutes || 0;

  let waitingMinutes = null;
  if (a.status === 'arrived' || a.status === 'waiting') {
    const ref = a.waiting_since || a.arrived_at;
    if (ref) waitingMinutes = Math.max(0, Math.floor((now - new Date(ref).getTime()) / 60000));
  }

  let delayMinutes = null;
  if (a.status === 'planned' || a.status === 'arrived' || a.status === 'waiting') {
    delayMinutes = Math.max(0, Math.floor((now - new Date(a.planned_at).getTime()) / 60000));
  }

  return {
    waitingMinutes,
    delayMinutes,
    isWaitingLong: waitingMinutes !== null && waitingMinutes > waitLimit,
    isDelayed: delayMinutes !== null && delayMinutes > grace,
  };
}

function statusBadge(status) {
  return `<span class="badge badge-${status} badge-dot">${escapeHtml(t(`status.${status}`))}</span>`;
}

function operationBadge(op) {
  return `<span class="badge badge-op-${op}">${escapeHtml(t(`op.${op}`))}</span>`;
}

function alertBadges(alerts) {
  const out = [];
  if (alerts.isDelayed) {
    out.push(`<span class="badge badge-alert">${escapeHtml(t('alert.late', { n: alerts.delayMinutes }))}</span>`);
  }
  if (alerts.isWaitingLong) {
    out.push(`<span class="badge badge-wait">${escapeHtml(t('alert.waiting', { n: alerts.waitingMinutes }))}</span>`);
  }
  return out.join('');
}

/* ------------------------------------------------------------- filtrų UI */

function optionList(values, selected, allLabel) {
  const opts = [`<option value="">${escapeHtml(allLabel)}</option>`];
  for (const v of values) {
    const value = typeof v === 'object' ? v.value : v;
    const label = typeof v === 'object' ? v.label : v;
    opts.push(
      `<option value="${escapeHtml(value)}"${String(selected) === String(value) ? ' selected' : ''}>${escapeHtml(label)}</option>`
    );
  }
  return opts.join('');
}

function dockOptions(selected) {
  const items = state.options.docks.map((d) => ({
    value: String(d.id),
    label: d.name ? `${d.code} · ${d.name}` : d.code,
  }));
  items.push({ value: 'none', label: t('filter.noDock') });
  return optionList(items, selected, t('filter.all'));
}

function sharedFilterFields(f) {
  return `
    <div class="filter">
      <label for="fltOperation">${escapeHtml(t('filter.operation'))}</label>
      <select id="fltOperation" data-filter="operation">
        ${optionList([{ value: 'loading', label: t('op.loading') }, { value: 'unloading', label: t('op.unloading') }], f.operation, t('filter.all'))}
      </select>
    </div>
    <div class="filter">
      <label for="fltStatus">${escapeHtml(t('filter.status'))}</label>
      <select id="fltStatus" data-filter="status">
        ${optionList(STATUSES.map((s) => ({ value: s, label: t(`status.${s}`) })), f.status, t('filter.all'))}
      </select>
    </div>
    <div class="filter">
      <label for="fltDock">${escapeHtml(t('filter.dock'))}</label>
      <select id="fltDock" data-filter="dockId">${dockOptions(f.dockId)}</select>
    </div>
    <div class="filter">
      <label for="fltCustomer">${escapeHtml(t('filter.customer'))}</label>
      <select id="fltCustomer" data-filter="customer">${optionList(state.options.customers, f.customer, t('filter.all'))}</select>
    </div>
    <div class="filter">
      <label for="fltCarrier">${escapeHtml(t('filter.carrier'))}</label>
      <select id="fltCarrier" data-filter="carrier">${optionList(state.options.carriers, f.carrier, t('filter.all'))}</select>
    </div>
    <div class="filter filter-search">
      <label for="fltSearch">${escapeHtml(t('filter.search'))}</label>
      <input type="search" id="fltSearch" data-filter="q" value="${escapeHtml(f.q || '')}"
             placeholder="${escapeHtml(t('filter.searchPlaceholder'))}" />
    </div>
  `;
}

function renderDashboardFilters() {
  const f = state.dashboard.filters;
  $('#filtersDashboard').innerHTML = `
    <div class="filter filter-date">
      <label for="fltDate">${escapeHtml(t('filter.date'))}</label>
      <input type="date" id="fltDate" data-filter="date" value="${escapeHtml(f.date || '')}" />
    </div>
    ${sharedFilterFields(f)}
    <label class="filter-toggle${f.onlyAlerts ? ' is-on' : ''}">
      <input type="checkbox" data-filter="onlyAlerts"${f.onlyAlerts ? ' checked' : ''} />
      ${escapeHtml(t('filter.onlyAlerts'))}
    </label>
    <button type="button" class="btn btn-ghost btn-sm" data-action="reset-filters">${escapeHtml(t('filter.reset'))}</button>
  `;
}

function renderHistoryFilters() {
  const f = state.history.filters;
  $('#filtersHistory').innerHTML = `
    <div class="filter filter-date">
      <label for="fltDateFrom">${escapeHtml(t('filter.dateFrom'))}</label>
      <input type="date" id="fltDateFrom" data-filter="dateFrom" value="${escapeHtml(f.dateFrom || '')}" />
    </div>
    <div class="filter filter-date">
      <label for="fltDateTo">${escapeHtml(t('filter.dateTo'))}</label>
      <input type="date" id="fltDateTo" data-filter="dateTo" value="${escapeHtml(f.dateTo || '')}" />
    </div>
    ${sharedFilterFields(f)}
    <button type="button" class="btn btn-ghost btn-sm" data-action="reset-filters">${escapeHtml(t('filter.reset'))}</button>
  `;
}

function renderAuditFilters() {
  const f = state.audit.filters;
  const isStatusMode = state.audit.mode === 'status';
  const userSelect = state.user && state.user.role === 'admin'
    ? `<div class="filter">
         <label for="fltUser">${escapeHtml(t('filter.user'))}</label>
         <select id="fltUser" data-filter="userId">
           ${optionList(state.users.map((u) => ({ value: String(u.id), label: u.fullName })), f.userId, t('filter.all'))}
         </select>
       </div>`
    : '';

  const statusSelect = isStatusMode
    ? `<div class="filter">
         <label for="fltAuditStatus">${escapeHtml(t('filter.status'))}</label>
         <select id="fltAuditStatus" data-filter="status">
           ${optionList(STATUSES.map((s) => ({ value: s, label: t(`status.${s}`) })), f.status, t('filter.all'))}
         </select>
       </div>`
    : `<div class="filter">
         <label for="fltAuditEntity">${escapeHtml(t('audit.object'))}</label>
         <select id="fltAuditEntity" data-filter="entity">
           ${optionList(
    ['appointment', 'user', 'dock', 'auth'].map((e) => ({ value: e, label: t(`audit.entity.${e}`) })),
    f.entity, t('filter.all')
  )}
         </select>
       </div>`;

  const search = isStatusMode
    ? `<div class="filter filter-search">
         <label for="fltAuditSearch">${escapeHtml(t('filter.search'))}</label>
         <input type="search" id="fltAuditSearch" data-filter="q" value="${escapeHtml(f.q || '')}"
                placeholder="${escapeHtml(t('filter.searchPlaceholder'))}" />
       </div>`
    : '';

  $('#filtersAudit').innerHTML = `
    <div class="filter filter-date">
      <label for="fltAuditFrom">${escapeHtml(t('filter.dateFrom'))}</label>
      <input type="date" id="fltAuditFrom" data-filter="dateFrom" value="${escapeHtml(f.dateFrom || '')}" />
    </div>
    <div class="filter filter-date">
      <label for="fltAuditTo">${escapeHtml(t('filter.dateTo'))}</label>
      <input type="date" id="fltAuditTo" data-filter="dateTo" value="${escapeHtml(f.dateTo || '')}" />
    </div>
    ${statusSelect}
    ${userSelect}
    ${search}
    <button type="button" class="btn btn-ghost btn-sm" data-action="reset-filters">${escapeHtml(t('filter.reset'))}</button>
  `;
}

/* --------------------------------------------------------- vizitų sąrašas */

function isNarrow() {
  return window.matchMedia('(max-width: 900px)').matches;
}

function apptRowHtml(a) {
  const alerts = computeAlerts(a);
  const classes = ['appt-row'];
  if (alerts.isDelayed) classes.push('row-alert-late');
  if (alerts.isWaitingLong) classes.push('row-alert-wait');
  if (CLOSED.has(a.status)) classes.push('row-done');

  const dock = a.dock_code ? escapeHtml(a.dock_code) : '<span class="muted">—</span>';
  const next = PRIMARY_NEXT[a.status];

  return `
    <tr class="${classes.join(' ')}" data-id="${a.id}">
      <td class="col-time">
        <div class="cell-strong">${escapeHtml(fmtTime(a.planned_at))}</div>
        <div class="cell-sub">${escapeHtml(fmtDate(a.planned_at))}</div>
      </td>
      <td>${operationBadge(a.operation)}</td>
      <td>
        <div class="plate">${escapeHtml(a.truck_plate)}</div>
        ${a.trailer_plate ? `<div class="cell-sub plate">${escapeHtml(a.trailer_plate)}</div>` : ''}
      </td>
      <td>
        <div>${escapeHtml(a.driver_name || '—')}</div>
        ${a.driver_phone ? `<div class="cell-sub"><a href="tel:${escapeHtml(a.driver_phone)}">${escapeHtml(a.driver_phone)}</a></div>` : ''}
      </td>
      <td>${escapeHtml(a.carrier || '—')}</td>
      <td>${escapeHtml(a.customer || '—')}</td>
      <td>${escapeHtml(a.reference || '—')}</td>
      <td>${dock}</td>
      <td>
        <div class="card-badges">
          ${statusBadge(a.status)}
          ${alertBadges(alerts)}
        </div>
      </td>
      <td class="col-actions">
        ${next ? `<button class="btn btn-primary btn-sm" data-action="quick-status" data-id="${a.id}" data-next="${next}">${escapeHtml(t(`status.${next}`))}</button>` : ''}
        <button class="btn btn-sm" data-action="status" data-id="${a.id}">${escapeHtml(t('action.status'))}</button>
        <button class="btn btn-ghost btn-sm" data-action="detail" data-id="${a.id}">${escapeHtml(t('action.details'))}</button>
      </td>
    </tr>
  `;
}

function apptCardHtml(a) {
  const alerts = computeAlerts(a);
  const classes = ['appt-card'];
  if (alerts.isDelayed) classes.push('is-late');
  else if (alerts.isWaitingLong) classes.push('is-waiting');

  const next = PRIMARY_NEXT[a.status];
  const meta = [
    [t('col.driver'), a.driver_name],
    [t('filter.carrier'), a.carrier],
    [t('filter.customer'), a.customer],
    [t('col.reference'), a.reference],
    [t('col.dock'), a.dock_code],
  ];

  return `
    <article class="${classes.join(' ')}" data-id="${a.id}">
      <div class="card-top">
        <div>
          <div class="card-time">${escapeHtml(fmtTime(a.planned_at))}</div>
          <div class="card-date">${escapeHtml(fmtDate(a.planned_at))}</div>
        </div>
        <div class="card-head-main">
          <div class="card-plate">${escapeHtml(a.truck_plate)}${a.trailer_plate ? ` <span class="muted">/ ${escapeHtml(a.trailer_plate)}</span>` : ''}</div>
          <div class="card-badges">
            ${operationBadge(a.operation)}
            ${statusBadge(a.status)}
            ${alertBadges(alerts)}
          </div>
        </div>
      </div>

      <div class="card-meta">
        ${meta.map(([label, value]) => `
          <div class="meta-item">
            <div class="meta-label">${escapeHtml(label)}</div>
            <div class="meta-value">${escapeHtml(value || '—')}</div>
          </div>`).join('')}
        ${a.driver_phone ? `
          <div class="meta-item">
            <div class="meta-label">${escapeHtml(t('form.driverPhone'))}</div>
            <div class="meta-value"><a href="tel:${escapeHtml(a.driver_phone)}">${escapeHtml(a.driver_phone)}</a></div>
          </div>` : ''}
      </div>

      ${a.notes ? `<div class="cell-sub">${escapeHtml(a.notes)}</div>` : ''}

      <div class="card-actions">
        ${next ? `<button class="btn btn-primary" data-action="quick-status" data-id="${a.id}" data-next="${next}">${escapeHtml(t(`status.${next}`))}</button>` : ''}
        <button class="btn" data-action="status" data-id="${a.id}">${escapeHtml(t('action.status'))}</button>
        <button class="btn btn-ghost" data-action="detail" data-id="${a.id}">${escapeHtml(t('action.details'))}</button>
      </div>
    </article>
  `;
}

function renderAppointmentList(hostId, rows) {
  const host = $(`#${hostId}`);
  if (!rows.length) {
    host.innerHTML = `
      <div class="empty-state">
        <strong>${escapeHtml(t('empty.title'))}</strong>
        <span>${escapeHtml(t('empty.body'))}</span>
      </div>`;
    return;
  }

  if (isNarrow()) {
    host.innerHTML = `<div class="card-list">${rows.map(apptCardHtml).join('')}</div>`;
    return;
  }

  host.innerHTML = `
    <div class="table-wrap">
      <table class="data">
        <thead>
          <tr>
            <th>${escapeHtml(t('col.time'))}</th>
            <th>${escapeHtml(t('col.operation'))}</th>
            <th>${escapeHtml(t('col.truck'))}</th>
            <th>${escapeHtml(t('col.driver'))}</th>
            <th>${escapeHtml(t('col.carrier'))}</th>
            <th>${escapeHtml(t('col.customer'))}</th>
            <th>${escapeHtml(t('col.reference'))}</th>
            <th>${escapeHtml(t('col.dock'))}</th>
            <th>${escapeHtml(t('col.status'))}</th>
            <th class="col-actions">${escapeHtml(t('col.actions'))}</th>
          </tr>
        </thead>
        <tbody>${rows.map(apptRowHtml).join('')}</tbody>
      </table>
    </div>`;
}

function renderStats(hostId, stats) {
  const host = $(`#${hostId}`);
  if (!stats) { host.innerHTML = ''; return; }

  const cards = [
    { label: t('stat.total'), value: stats.total },
    { label: t('stat.active'), value: stats.active },
    { label: t('stat.loading'), value: stats.loading },
    { label: t('stat.unloading'), value: stats.unloading },
    { label: t('stat.completed'), value: stats.completed },
    { label: t('stat.delayed'), value: stats.delayed, cls: stats.delayed > 0 ? 'is-alert' : '' },
    {
      label: t('stat.waitingLong', { n: state.options.waitingAlertMinutes }),
      value: stats.waiting_long,
      cls: stats.waiting_long > 0 ? 'is-warn' : '',
    },
  ];

  host.innerHTML = cards.map((c) => `
    <div class="stat ${c.cls || ''}">
      <div class="stat-label">${escapeHtml(c.label)}</div>
      <div class="stat-value">${escapeHtml(c.value ?? 0)}</div>
    </div>`).join('');
}

/* ------------------------------------------------------------ užklausos */

function queryString(filters) {
  const params = new URLSearchParams();
  for (const [k, v] of Object.entries(filters)) {
    if (v === '' || v === null || v === undefined || v === false) continue;
    params.set(k, v === true ? '1' : String(v));
  }
  return params.toString();
}

async function loadDashboard() {
  setLive('loading');
  try {
    const qs = queryString(state.dashboard.filters);
    const [list, stats] = await Promise.all([
      api(`/api/appointments?${qs}&limit=500&sort=planned_at&dir=asc`),
      api(`/api/appointments/stats?${qs}`),
    ]);
    state.dashboard.rows = list.appointments;
    state.dashboard.stats = stats.stats;
    state.options.waitingAlertMinutes = list.waitingAlertMinutes;
    state.options.lateGraceMinutes = list.lateGraceMinutes;

    renderStats('statsRow', stats.stats);
    renderAppointmentList('listDashboard', list.appointments);
    setLive('');
  } catch (err) {
    setLive('error');
    if (err.code !== 'unauthorized') toast(errorMessage(err), 'error');
  }
}

async function loadHistory() {
  setLive('loading');
  try {
    const h = state.history;
    const qs = queryString(h.filters);
    const [list, stats] = await Promise.all([
      api(`/api/appointments?${qs}&limit=${h.limit}&offset=${h.offset}&sort=planned_at&dir=desc`),
      api(`/api/appointments/stats?${qs}`),
    ]);
    h.rows = list.appointments;
    h.total = list.total;
    state.history.stats = stats.stats;

    renderStats('statsRowHistory', stats.stats);
    renderAppointmentList('listHistory', list.appointments);
    renderPager('pagerHistory', h.offset, h.limit, h.total, (offset) => {
      h.offset = offset;
      loadHistory();
      window.scrollTo({ top: 0, behavior: 'smooth' });
    });
    setLive('');
  } catch (err) {
    setLive('error');
    if (err.code !== 'unauthorized') toast(errorMessage(err), 'error');
  }
}

function renderPager(hostId, offset, limit, total, onGo) {
  const host = $(`#${hostId}`);
  if (total <= limit) { host.innerHTML = ''; return; }

  const from = total === 0 ? 0 : offset + 1;
  const to = Math.min(offset + limit, total);
  host.innerHTML = `
    <button class="btn btn-sm" data-page="prev"${offset === 0 ? ' disabled' : ''}>${escapeHtml(t('action.prev'))}</button>
    <span>${from}–${to} ${escapeHtml(t('common.of'))} ${total} ${escapeHtml(t('common.results'))}</span>
    <button class="btn btn-sm" data-page="next"${to >= total ? ' disabled' : ''}>${escapeHtml(t('action.next'))}</button>
  `;
  host.onclick = (e) => {
    const btn = e.target.closest('[data-page]');
    if (!btn || btn.disabled) return;
    onGo(btn.dataset.page === 'prev' ? Math.max(0, offset - limit) : offset + limit);
  };
}

/* ----------------------------------------------------------- audito rodinys */

function auditStatusRowHtml(e) {
  const change = e.from_status
    ? `${escapeHtml(t(`status.${e.from_status}`))} → <strong>${escapeHtml(t(`status.${e.to_status}`))}</strong>`
    : `<strong>${escapeHtml(t(`status.${e.to_status}`))}</strong>`;

  return `
    <tr>
      <td class="col-time">
        <div class="cell-strong">${escapeHtml(fmtTime(e.changed_at))}</div>
        <div class="cell-sub">${escapeHtml(fmtDate(e.changed_at))}</div>
      </td>
      <td>
        <div class="cell-strong">${escapeHtml(e.user_name || '—')}</div>
        <div class="cell-sub">${escapeHtml(e.user_email || '')}</div>
      </td>
      <td>${change}</td>
      <td>
        <div class="plate">${escapeHtml(e.truck_plate || '—')}</div>
        <div class="cell-sub">${escapeHtml(e.operation ? t(`op.${e.operation}`) : '')}${e.reference ? ` · ${escapeHtml(e.reference)}` : ''}</div>
      </td>
      <td>${escapeHtml(e.customer || '—')}</td>
      <td>${escapeHtml(e.note || '')}</td>
      <td class="col-actions">
        ${e.appointment_id ? `<button class="btn btn-ghost btn-sm" data-action="detail" data-id="${e.appointment_id}">${escapeHtml(t('action.details'))}</button>` : ''}
      </td>
    </tr>`;
}

function auditDetailsText(entry) {
  const d = entry.details || {};
  if (entry.action === 'status') {
    const from = d.from ? t(`status.${d.from}`) : '';
    const to = d.to ? t(`status.${d.to}`) : '';
    return `${from ? `${from} → ` : ''}${to}${d.truckPlate ? ` · ${d.truckPlate}` : ''}`;
  }
  if (entry.action === 'update' && d.changes) {
    return Object.keys(d.changes).join(', ');
  }
  if (entry.action === 'create' || entry.action === 'delete') {
    return [d.truckPlate, d.email, d.code].filter(Boolean).join(' · ');
  }
  if (entry.action === 'export') return `${d.rows ?? 0} ${t('common.results')}`;
  if (entry.action === 'login_failed') return d.email || '';
  return '';
}

function auditAllRowHtml(entry) {
  return `
    <tr>
      <td class="col-time">
        <div class="cell-strong">${escapeHtml(fmtTime(entry.created_at))}</div>
        <div class="cell-sub">${escapeHtml(fmtDate(entry.created_at))}</div>
      </td>
      <td>
        <div class="cell-strong">${escapeHtml(entry.user_name || '—')}</div>
        <div class="cell-sub">${escapeHtml(entry.user_email || '')}</div>
      </td>
      <td>${escapeHtml(t(`audit.action.${entry.action}`) || entry.action)}</td>
      <td>
        ${escapeHtml(t(`audit.entity.${entry.entity}`) || entry.entity)}
        ${entry.entity_id ? `<span class="cell-sub">#${entry.entity_id}</span>` : ''}
      </td>
      <td>${escapeHtml(auditDetailsText(entry))}</td>
      <td class="cell-sub">${escapeHtml(entry.ip || '')}</td>
      <td class="col-actions">
        ${entry.entity === 'appointment' && entry.entity_id && entry.action !== 'delete'
    ? `<button class="btn btn-ghost btn-sm" data-action="detail" data-id="${entry.entity_id}">${escapeHtml(t('action.details'))}</button>` : ''}
      </td>
    </tr>`;
}

async function loadAudit() {
  setLive('loading');
  const a = state.audit;
  try {
    const qs = queryString(a.filters);
    const path = a.mode === 'status' ? '/api/audit/status-changes' : '/api/audit';
    const data = await api(`${path}?${qs}&limit=${a.limit}&offset=${a.offset}`);
    const rows = a.mode === 'status' ? data.events : data.entries;
    a.rows = rows;
    a.total = data.total;

    const host = $('#listAudit');
    if (!rows.length) {
      host.innerHTML = `<div class="empty-state"><strong>${escapeHtml(t('empty.title'))}</strong><span>${escapeHtml(t('empty.audit'))}</span></div>`;
    } else if (a.mode === 'status') {
      host.innerHTML = `
        <div class="table-wrap">
          <table class="data">
            <thead><tr>
              <th>${escapeHtml(t('audit.when'))}</th>
              <th>${escapeHtml(t('audit.who'))}</th>
              <th>${escapeHtml(t('audit.what'))}</th>
              <th>${escapeHtml(t('col.truck'))}</th>
              <th>${escapeHtml(t('col.customer'))}</th>
              <th>${escapeHtml(t('status.noteShort'))}</th>
              <th class="col-actions"></th>
            </tr></thead>
            <tbody>${rows.map(auditStatusRowHtml).join('')}</tbody>
          </table>
        </div>`;
    } else {
      host.innerHTML = `
        <div class="table-wrap">
          <table class="data">
            <thead><tr>
              <th>${escapeHtml(t('audit.when'))}</th>
              <th>${escapeHtml(t('audit.who'))}</th>
              <th>${escapeHtml(t('audit.what'))}</th>
              <th>${escapeHtml(t('audit.object'))}</th>
              <th>${escapeHtml(t('detail.info'))}</th>
              <th>IP</th>
              <th class="col-actions"></th>
            </tr></thead>
            <tbody>${rows.map(auditAllRowHtml).join('')}</tbody>
          </table>
        </div>`;
    }

    renderPager('pagerAudit', a.offset, a.limit, a.total, (offset) => {
      a.offset = offset;
      loadAudit();
      window.scrollTo({ top: 0, behavior: 'smooth' });
    });
    setLive('');
  } catch (err) {
    setLive('error');
    if (err.code !== 'unauthorized') toast(errorMessage(err), 'error');
  }
}

/* --------------------------------------------------------- vizito modalas */

function openModal(id) {
  $(`#${id}`).hidden = false;
  document.body.style.overflow = 'hidden';
}

function closeModal(id) {
  $(`#${id}`).hidden = true;
  if (!$$('.modal:not([hidden])').length) document.body.style.overflow = '';
}

function fillFormSelects(selectedDockId) {
  const dockSel = $('#fDock');
  dockSel.innerHTML = [`<option value="">${escapeHtml(t('common.none'))}</option>`]
    .concat(state.options.docks
      .filter((d) => d.is_active || String(d.id) === String(selectedDockId))
      .map((d) => `<option value="${d.id}"${String(d.id) === String(selectedDockId) ? ' selected' : ''}>${escapeHtml(d.name ? `${d.code} · ${d.name}` : d.code)}</option>`))
    .join('');

  $('#carrierOptions').innerHTML = state.options.carriers.map((c) => `<option value="${escapeHtml(c)}"></option>`).join('');
  $('#customerOptions').innerHTML = state.options.customers.map((c) => `<option value="${escapeHtml(c)}"></option>`).join('');
}

function openApptForm(appt) {
  $('#apptModalTitle').textContent = appt ? t('form.editTitle') : t('form.newTitle');
  $('#apptFormError').hidden = true;
  $('#apptId').value = appt ? appt.id : '';

  const defaultPlanned = state.dashboard.filters.date && state.dashboard.filters.date !== isoDate()
    ? `${state.dashboard.filters.date}T08:00`
    : isoLocalDateTime(new Date(Math.ceil(Date.now() / (15 * 60000)) * 15 * 60000));

  $('#fPlannedAt').value = appt ? isoLocalDateTime(appt.planned_at) : defaultPlanned;
  $('#fOperation').value = appt ? appt.operation : 'unloading';
  $('#fTruckPlate').value = appt ? (appt.truck_plate || '') : '';
  $('#fTrailerPlate').value = appt ? (appt.trailer_plate || '') : '';
  $('#fDriverName').value = appt ? (appt.driver_name || '') : '';
  $('#fDriverPhone').value = appt ? (appt.driver_phone || '') : '';
  $('#fCarrier').value = appt ? (appt.carrier || '') : '';
  $('#fCustomer').value = appt ? (appt.customer || '') : '';
  $('#fReference').value = appt ? (appt.reference || '') : '';
  $('#fNotes').value = appt ? (appt.notes || '') : '';

  fillFormSelects(appt ? appt.dock_id : '');
  openModal('apptModal');
  setTimeout(() => $('#fTruckPlate').focus(), 60);
}

async function saveAppointment() {
  const id = $('#apptId').value;
  const body = {
    plannedAt: $('#fPlannedAt').value ? new Date($('#fPlannedAt').value).toISOString() : null,
    operation: $('#fOperation').value,
    truckPlate: $('#fTruckPlate').value.trim(),
    trailerPlate: $('#fTrailerPlate').value.trim(),
    driverName: $('#fDriverName').value.trim(),
    driverPhone: $('#fDriverPhone').value.trim(),
    carrier: $('#fCarrier').value.trim(),
    customer: $('#fCustomer').value.trim(),
    reference: $('#fReference').value.trim(),
    dockId: $('#fDock').value || null,
    notes: $('#fNotes').value.trim(),
  };

  const errBox = $('#apptFormError');
  if (!body.plannedAt || !body.truckPlate) {
    errBox.textContent = t('form.required');
    errBox.hidden = false;
    return;
  }

  const btn = $('#apptSaveBtn');
  btn.disabled = true;
  try {
    if (id) await api(`/api/appointments/${id}`, { method: 'PUT', body });
    else await api('/api/appointments', { method: 'POST', body });

    closeModal('apptModal');
    toast(t('form.saved'), 'ok');
    await refreshOptions();
    await refreshCurrentView();
  } catch (err) {
    errBox.textContent = errorMessage(err);
    errBox.hidden = false;
  } finally {
    btn.disabled = false;
  }
}

/* ------------------------------------------------------- būsenos modalas */

function openStatusModal(appt) {
  state.statusTarget = appt;
  $('#statusError').hidden = true;
  $('#statusNote').value = '';
  $('#statusModalSummary').textContent =
    `${appt.truck_plate} · ${fmtDateTime(appt.planned_at)} · ${t(`status.${appt.status}`)}`;

  const isAdmin = state.user.role === 'admin';
  const allowed = isAdmin ? STATUSES : (TRANSITIONS[appt.status] || []);

  $('#statusChoices').innerHTML = STATUSES
    .filter((s) => s !== appt.status)
    .map((s) => `
      <button type="button" class="status-choice" data-status="${s}"${allowed.includes(s) ? '' : ' disabled'}>
        ${statusBadge(s)}
      </button>`).join('');

  openModal('statusModal');
}

async function changeStatus(id, nextStatus, note) {
  try {
    await api(`/api/appointments/${id}/status`, {
      method: 'POST',
      body: { status: nextStatus, note: note || undefined },
    });
    toast(t('status.changed'), 'ok');
    await refreshCurrentView();
    return true;
  } catch (err) {
    toast(errorMessage(err), 'error');
    return false;
  }
}

/* -------------------------------------------------------- detalių modalas */

async function openDetail(id) {
  try {
    const data = await api(`/api/appointments/${id}`);
    const a = data.appointment;
    const alerts = computeAlerts(a);

    $('#detailTitle').innerHTML =
      `<span class="plate">${escapeHtml(a.truck_plate)}</span> ${statusBadge(a.status)} ${alertBadges(alerts)}`;

    const info = [
      [t('form.plannedAt'), fmtDateTime(a.planned_at)],
      [t('form.operation'), t(`op.${a.operation}`)],
      [t('form.trailerPlate'), a.trailer_plate],
      [t('form.driverName'), a.driver_name],
      [t('form.driverPhone'), a.driver_phone],
      [t('form.carrier'), a.carrier],
      [t('form.customer'), a.customer],
      [t('form.reference'), a.reference],
      [t('form.dock'), a.dock_code ? (a.dock_name ? `${a.dock_code} · ${a.dock_name}` : a.dock_code) : null],
      [t('detail.workTime'), a.work_minutes != null ? `${a.work_minutes} ${t('detail.minutes')}` : null],
      [t('detail.onsiteTime'), a.onsite_minutes != null ? `${a.onsite_minutes} ${t('detail.minutes')}` : null],
      [t('detail.created'), a.created_by_name],
      [t('detail.updated'), a.updated_by_name],
    ].filter(([, v]) => v);

    const timeline = data.events.length
      ? data.events.map((e) => `
          <div class="tl-item">
            <div class="tl-time">${escapeHtml(fmtTime(e.changed_at))}<br /><span class="cell-sub">${escapeHtml(fmtDate(e.changed_at))}</span></div>
            <div class="tl-marker"></div>
            <div class="tl-body">
              <div class="tl-title">${escapeHtml(t(`status.${e.to_status}`))}</div>
              <div class="tl-sub">${escapeHtml(t('detail.by'))}: ${escapeHtml(e.changed_by_name || '—')}${e.note ? ` · ${escapeHtml(e.note)}` : ''}</div>
            </div>
          </div>`).join('')
      : `<p class="muted">${escapeHtml(t('detail.noEvents'))}</p>`;

    $('#detailBody').innerHTML = `
      <div class="detail-grid">
        ${info.map(([label, value]) => `
          <div class="meta-item">
            <div class="meta-label">${escapeHtml(label)}</div>
            <div class="meta-value">${escapeHtml(value)}</div>
          </div>`).join('')}
      </div>
      ${a.notes ? `<div><div class="detail-section-title">${escapeHtml(t('form.notes'))}</div><p>${escapeHtml(a.notes)}</p></div>` : ''}
      <div>
        <div class="detail-section-title">${escapeHtml(t('detail.timeline'))}</div>
        <div class="timeline">${timeline}</div>
      </div>`;

    $('#detailFoot').innerHTML = `
      ${state.user.role === 'admin' ? `<button class="btn btn-danger" data-action="delete-appt" data-id="${a.id}">${escapeHtml(t('action.delete'))}</button>` : ''}
      <button class="btn" data-action="edit-appt" data-id="${a.id}">${escapeHtml(t('action.edit'))}</button>
      <button class="btn btn-primary" data-action="status" data-id="${a.id}">${escapeHtml(t('action.status'))}</button>`;

    state.detailAppt = a;
    openModal('detailModal');
  } catch (err) {
    toast(errorMessage(err), 'error');
  }
}

/* ------------------------------------------------------------ admin UI */

async function loadAdmin() {
  if (!state.user || state.user.role !== 'admin') return;
  try {
    const [usersData, docksData] = await Promise.all([
      api('/api/users'),
      api('/api/docks'),
    ]);
    state.users = usersData.users;
    state.options.docks = docksData.docks;

    $('#usersList').innerHTML = usersData.users.map((u) => `
      <div class="row-item${u.isActive ? '' : ' is-inactive'}">
        <div class="row-item-main">
          <div class="row-item-title">${escapeHtml(u.fullName)}</div>
          <div class="row-item-sub">
            ${escapeHtml(u.email)} ·
            <span class="badge badge-${u.role === 'admin' ? 'in_progress' : 'planned'}">${escapeHtml(t(`role.${u.role}`))}</span>
          </div>
          <div class="row-item-sub">
            ${u.lastLoginAt
    ? `${escapeHtml(t('admin.lastLogin'))}: ${escapeHtml(fmtDateTime(u.lastLoginAt))}`
    : escapeHtml(t('admin.neverLoggedIn'))}
          </div>
        </div>
        <div class="row-item-actions">
          <button class="btn btn-sm" data-action="edit-user" data-id="${u.id}">${escapeHtml(t('action.edit'))}</button>
          <button class="btn btn-sm" data-action="toggle-user" data-id="${u.id}" data-active="${u.isActive}">
            ${escapeHtml(u.isActive ? t('admin.disable') : t('admin.enable'))}
          </button>
          <button class="btn btn-danger btn-sm" data-action="delete-user" data-id="${u.id}">×</button>
        </div>
      </div>`).join('');

    $('#docksList').innerHTML = docksData.docks.map((d) => `
      <div class="row-item${d.is_active ? '' : ' is-inactive'}">
        <div class="row-item-main">
          <div class="row-item-title">${escapeHtml(d.code)}</div>
          <div class="row-item-sub">${escapeHtml(d.name || '—')}</div>
        </div>
        <div class="row-item-actions">
          <button class="btn btn-sm" data-action="edit-dock" data-id="${d.id}">${escapeHtml(t('action.edit'))}</button>
          <button class="btn btn-sm" data-action="toggle-dock" data-id="${d.id}" data-active="${d.is_active}">
            ${escapeHtml(d.is_active ? t('admin.disable') : t('admin.enable'))}
          </button>
          <button class="btn btn-danger btn-sm" data-action="delete-dock" data-id="${d.id}">×</button>
        </div>
      </div>`).join('');
  } catch (err) {
    toast(errorMessage(err), 'error');
  }
}

function openUserForm(user) {
  $('#userModalTitle').textContent = user ? t('admin.editUser') : t('admin.addUser');
  $('#userFormError').hidden = true;
  $('#userId').value = user ? user.id : '';
  $('#uFullName').value = user ? user.fullName : '';
  $('#uEmail').value = user ? user.email : '';
  $('#uRole').value = user ? user.role : 'operator';
  $('#uPassword').value = '';
  $('#uPassword').required = !user;
  openModal('userModal');
}

async function saveUser() {
  const id = $('#userId').value;
  const body = {
    fullName: $('#uFullName').value.trim(),
    email: $('#uEmail').value.trim(),
    role: $('#uRole').value,
  };
  const password = $('#uPassword').value;
  const errBox = $('#userFormError');

  if (!body.fullName || !body.email || (!id && password.length < 8)) {
    errBox.textContent = id ? t('form.required') : t('error.weakPassword');
    errBox.hidden = false;
    return;
  }

  try {
    if (id) {
      await api(`/api/users/${id}`, { method: 'PATCH', body });
      if (password) await api(`/api/users/${id}/password`, { method: 'POST', body: { password } });
    } else {
      await api('/api/users', { method: 'POST', body: { ...body, password } });
    }
    closeModal('userModal');
    toast(t('form.saved'), 'ok');
    loadAdmin();
  } catch (err) {
    errBox.textContent = errorMessage(err);
    errBox.hidden = false;
  }
}

function openDockForm(dock) {
  $('#dockModalTitle').textContent = dock ? t('admin.editDock') : t('admin.addDock');
  $('#dockFormError').hidden = true;
  $('#dockId').value = dock ? dock.id : '';
  $('#dCode').value = dock ? dock.code : '';
  $('#dName').value = dock ? (dock.name || '') : '';
  $('#dSortOrder').value = dock ? dock.sort_order : 0;
  openModal('dockModal');
}

async function saveDock() {
  const id = $('#dockId').value;
  const body = {
    code: $('#dCode').value.trim(),
    name: $('#dName').value.trim(),
    sortOrder: Number($('#dSortOrder').value) || 0,
  };
  const errBox = $('#dockFormError');
  if (!body.code) {
    errBox.textContent = t('form.required');
    errBox.hidden = false;
    return;
  }
  try {
    if (id) await api(`/api/docks/${id}`, { method: 'PATCH', body });
    else await api('/api/docks', { method: 'POST', body });
    closeModal('dockModal');
    toast(t('form.saved'), 'ok');
    await refreshOptions();
    loadAdmin();
  } catch (err) {
    errBox.textContent = errorMessage(err);
    errBox.hidden = false;
  }
}

/* -------------------------------------------------------------- navigacija */

function setView(view) {
  state.view = view;
  $$('#mainTabs .tab').forEach((tab) => tab.classList.toggle('is-active', tab.dataset.view === view));
  $$('.view').forEach((v) => v.classList.toggle('is-active', v.id === `view-${view}`));

  if (view === 'dashboard') { renderDashboardFilters(); loadDashboard(); }
  if (view === 'history') { renderHistoryFilters(); loadHistory(); }
  if (view === 'audit') { renderAuditFilters(); loadAudit(); }
  if (view === 'admin') loadAdmin();

  startAutoRefresh();
}

function refreshCurrentView() {
  if (state.view === 'dashboard') return loadDashboard();
  if (state.view === 'history') return loadHistory();
  if (state.view === 'audit') return loadAudit();
  if (state.view === 'admin') return loadAdmin();
  return Promise.resolve();
}

function startAutoRefresh() {
  clearInterval(state.refreshTimer);
  // Automatiškai atnaujinam tik gyvą "Šiandien" rodinį
  if (state.view !== 'dashboard') return;
  state.refreshTimer = setInterval(() => {
    if (document.visibilityState === 'visible' && !$$('.modal:not([hidden])').length) loadDashboard();
  }, 30000);
}

async function refreshOptions() {
  try {
    const data = await api('/api/appointments/options');
    state.options = { ...state.options, ...data };
  } catch { /* nekritiška */ }
}

/* ------------------------------------------------------------- eksportas */

function exportCsv(filters) {
  const qs = queryString(filters);
  window.location.href = `/api/export/appointments.csv?${qs}`;
}

/* ------------------------------------------------------------------ auth */

function showLogin() {
  clearInterval(state.refreshTimer);
  state.user = null;
  $('#appShell').hidden = true;
  $('#loginView').hidden = false;
  $('#loginPassword').value = '';
}

async function showApp(user) {
  state.user = user;
  $('#loginView').hidden = true;
  $('#appShell').hidden = false;

  $('#userName').textContent = user.fullName;
  $('#userRole').textContent = t(`role.${user.role}`);
  $('#userRole').className = `user-role badge badge-${user.role === 'admin' ? 'in_progress' : 'planned'}`;
  $$('.admin-only').forEach((el) => { el.hidden = user.role !== 'admin'; });

  // Numatytieji filtrai
  state.dashboard.filters = { date: isoDate() };
  state.history.filters = { dateFrom: daysAgo(7), dateTo: isoDate(), statusGroup: 'closed' };
  state.audit.filters = { dateFrom: daysAgo(7), dateTo: isoDate() };

  await refreshOptions();
  if (user.role === 'admin') {
    try { state.users = (await api('/api/users')).users; } catch { /* nekritiška */ }
  }
  setView('dashboard');
}

async function boot() {
  applyStaticTranslations();
  try {
    const data = await api('/api/me');
    if (data && data.user) await showApp(data.user);
    else showLogin();
  } catch {
    showLogin();
  }
}

/* ---------------------------------------------------------- įvykių rišimas */

function findAppt(id) {
  const numId = Number(id);
  return state.dashboard.rows.find((a) => a.id === numId)
    || state.history.rows.find((a) => a.id === numId)
    || (state.detailAppt && state.detailAppt.id === numId ? state.detailAppt : null);
}

async function handleAction(action, el) {
  const id = el.dataset.id;

  switch (action) {
    case 'quick-status': {
      el.disabled = true;
      const ok = await changeStatus(id, el.dataset.next);
      if (!ok) el.disabled = false;
      break;
    }

    case 'status': {
      let appt = findAppt(id);
      if (!appt) {
        try { appt = (await api(`/api/appointments/${id}`)).appointment; } catch { return; }
      }
      closeModal('detailModal');
      openStatusModal(appt);
      break;
    }

    case 'detail':
      closeModal('statusModal');
      openDetail(id);
      break;

    case 'edit-appt': {
      let appt = findAppt(id);
      if (!appt) {
        try { appt = (await api(`/api/appointments/${id}`)).appointment; } catch { return; }
      }
      closeModal('detailModal');
      openApptForm(appt);
      break;
    }

    case 'delete-appt':
      if (!confirm(t('form.confirmDelete'))) return;
      try {
        await api(`/api/appointments/${id}`, { method: 'DELETE' });
        closeModal('detailModal');
        toast(t('form.deleted'), 'ok');
        refreshCurrentView();
      } catch (err) { toast(errorMessage(err), 'error'); }
      break;

    case 'edit-user':
      openUserForm(state.users.find((u) => String(u.id) === String(id)));
      break;

    case 'toggle-user':
      try {
        await api(`/api/users/${id}`, { method: 'PATCH', body: { isActive: el.dataset.active !== 'true' } });
        loadAdmin();
      } catch (err) { toast(errorMessage(err), 'error'); }
      break;

    case 'delete-user':
      if (!confirm(t('admin.confirmDeleteUser'))) return;
      try {
        await api(`/api/users/${id}`, { method: 'DELETE' });
        toast(t('form.deleted'), 'ok');
        loadAdmin();
      } catch (err) { toast(errorMessage(err), 'error'); }
      break;

    case 'edit-dock':
      openDockForm(state.options.docks.find((d) => String(d.id) === String(id)));
      break;

    case 'toggle-dock':
      try {
        await api(`/api/docks/${id}`, { method: 'PATCH', body: { isActive: el.dataset.active !== 'true' } });
        await refreshOptions();
        loadAdmin();
      } catch (err) { toast(errorMessage(err), 'error'); }
      break;

    case 'delete-dock':
      if (!confirm(t('admin.confirmDeleteDock'))) return;
      try {
        await api(`/api/docks/${id}`, { method: 'DELETE' });
        toast(t('form.deleted'), 'ok');
        await refreshOptions();
        loadAdmin();
      } catch (err) { toast(errorMessage(err), 'error'); }
      break;

    case 'reset-filters':
      if (state.view === 'dashboard') {
        state.dashboard.filters = { date: isoDate() };
        renderDashboardFilters();
        loadDashboard();
      } else if (state.view === 'history') {
        state.history.filters = { dateFrom: daysAgo(7), dateTo: isoDate(), statusGroup: 'closed' };
        state.history.offset = 0;
        renderHistoryFilters();
        loadHistory();
      } else if (state.view === 'audit') {
        state.audit.filters = { dateFrom: daysAgo(7), dateTo: isoDate() };
        state.audit.offset = 0;
        renderAuditFilters();
        loadAudit();
      }
      break;

    default:
      break;
  }
}

function bindEvents() {
  // Prisijungimas
  $('#loginForm').addEventListener('submit', async (e) => {
    e.preventDefault();
    const btn = $('#loginSubmit');
    const errBox = $('#loginError');
    errBox.hidden = true;
    btn.disabled = true;
    try {
      const data = await api('/api/login', {
        method: 'POST',
        body: { email: $('#loginEmail').value.trim(), password: $('#loginPassword').value },
      });
      await showApp(data.user);
    } catch (err) {
      errBox.textContent = err.code === 'invalid_credentials' || err.code === 'unauthorized'
        ? t('login.failed')
        : errorMessage(err);
      errBox.hidden = false;
    } finally {
      btn.disabled = false;
    }
  });

  $('#logoutBtn').addEventListener('click', async () => {
    try { await api('/api/logout', { method: 'POST' }); } catch { /* vis tiek išeinam */ }
    showLogin();
  });

  // Kalbos perjungimas
  document.addEventListener('click', (e) => {
    const langBtn = e.target.closest('.lang-btn');
    if (!langBtn) return;
    LANG = langBtn.dataset.lang;
    localStorage.setItem('wops.lang', LANG);
    applyStaticTranslations();
    if (state.user) {
      $('#userRole').textContent = t(`role.${state.user.role}`);
      setView(state.view);
    }
  });

  // Skirtukai
  $('#mainTabs').addEventListener('click', (e) => {
    const tab = e.target.closest('.tab');
    if (tab) setView(tab.dataset.view);
  });

  // Audito režimas
  $('#auditModeSwitch').addEventListener('click', (e) => {
    const seg = e.target.closest('.seg');
    if (!seg) return;
    $$('#auditModeSwitch .seg').forEach((s) => s.classList.toggle('is-active', s === seg));
    state.audit.mode = seg.dataset.mode;
    state.audit.offset = 0;
    state.audit.filters = { dateFrom: state.audit.filters.dateFrom, dateTo: state.audit.filters.dateTo };
    renderAuditFilters();
    loadAudit();
  });

  // Naujas vizitas / eksportas
  $('#newApptBtn').addEventListener('click', () => openApptForm(null));
  $('#exportBtnDash').addEventListener('click', () => exportCsv(state.dashboard.filters));
  $('#exportBtnHistory').addEventListener('click', () => exportCsv(state.history.filters));
  $('#newUserBtn').addEventListener('click', () => openUserForm(null));
  $('#newDockBtn').addEventListener('click', () => openDockForm(null));

  $('#apptSaveBtn').addEventListener('click', saveAppointment);
  $('#apptForm').addEventListener('submit', (e) => { e.preventDefault(); saveAppointment(); });
  $('#userSaveBtn').addEventListener('click', saveUser);
  $('#userForm').addEventListener('submit', (e) => { e.preventDefault(); saveUser(); });
  $('#dockSaveBtn').addEventListener('click', saveDock);
  $('#dockForm').addEventListener('submit', (e) => { e.preventDefault(); saveDock(); });

  // Būsenos pasirinkimas
  $('#statusChoices').addEventListener('click', async (e) => {
    const btn = e.target.closest('.status-choice');
    if (!btn || btn.disabled || !state.statusTarget) return;
    btn.disabled = true;
    const ok = await changeStatus(state.statusTarget.id, btn.dataset.status, $('#statusNote').value.trim());
    if (ok) closeModal('statusModal');
    else btn.disabled = false;
  });

  // Modalų uždarymas
  document.addEventListener('click', (e) => {
    const closer = e.target.closest('[data-close]');
    if (closer) {
      const modal = closer.closest('.modal');
      if (modal) closeModal(modal.id);
    }
  });

  document.addEventListener('keydown', (e) => {
    if (e.key !== 'Escape') return;
    const open = $$('.modal:not([hidden])').pop();
    if (open) closeModal(open.id);
  });

  // Filtrų pakeitimai (vienas delegatas visiems rodiniams)
  document.addEventListener('change', (e) => {
    const el = e.target.closest('[data-filter]');
    if (!el) return;
    const key = el.dataset.filter;
    const value = el.type === 'checkbox' ? el.checked : el.value;

    if (state.view === 'dashboard') {
      state.dashboard.filters[key] = value;
      if (key === 'onlyAlerts') el.closest('.filter-toggle').classList.toggle('is-on', value);
      loadDashboard();
    } else if (state.view === 'history') {
      state.history.filters[key] = value;
      // Rankiniu būdu pasirinkus būseną, greitasis "closed" rinkinys nebetaikomas
      if (key === 'status' && value) delete state.history.filters.statusGroup;
      if (key === 'status' && !value) state.history.filters.statusGroup = 'closed';
      state.history.offset = 0;
      loadHistory();
    } else if (state.view === 'audit') {
      state.audit.filters[key] = value;
      state.audit.offset = 0;
      loadAudit();
    }
  });

  const debouncedSearch = debounce(() => {
    if (state.view === 'dashboard') loadDashboard();
    else if (state.view === 'history') { state.history.offset = 0; loadHistory(); }
    else if (state.view === 'audit') { state.audit.offset = 0; loadAudit(); }
  }, 350);

  document.addEventListener('input', (e) => {
    const el = e.target.closest('input[type="search"][data-filter]');
    if (!el) return;
    const target = state.view === 'dashboard' ? state.dashboard
      : state.view === 'history' ? state.history : state.audit;
    target.filters[el.dataset.filter] = el.value;
    debouncedSearch();
  });

  // Veiksmų delegatas
  document.addEventListener('click', (e) => {
    const el = e.target.closest('[data-action]');
    if (!el) return;
    handleAction(el.dataset.action, el);
  });

  // Perjungiant tarp lentelės ir kortelių
  let lastNarrow = isNarrow();
  window.addEventListener('resize', debounce(() => {
    if (isNarrow() === lastNarrow) return;
    lastNarrow = isNarrow();
    if (state.view === 'dashboard') renderAppointmentList('listDashboard', state.dashboard.rows);
    if (state.view === 'history') renderAppointmentList('listHistory', state.history.rows);
  }, 200));

  // Grįžus į skirtuką – iškart atnaujinam
  document.addEventListener('visibilitychange', () => {
    if (document.visibilityState === 'visible' && state.view === 'dashboard' && state.user) loadDashboard();
  });
}

/* ------------------------------------------------------------------ start */

bindEvents();
boot();
