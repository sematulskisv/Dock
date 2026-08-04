'use strict';

// MySQL DATETIME neturi laiko juostos, todel visos reiksmes saugomos UTC.
// Sis modulis vercia vietines (sandelio) kalendorines dienas i UTC momentus,
// kad filtras "siandien" reikstu tikra sandelio para, o ne UTC para.

const DEFAULT_TZ = process.env.APP_TIMEZONE || 'Europe/Vilnius';

/** Kiek milisekundziu zonos laikas skiriasi nuo UTC nurodytu momentu. */
function offsetMs(instant, timeZone = DEFAULT_TZ) {
  const dtf = new Intl.DateTimeFormat('en-US', {
    timeZone,
    hour12: false,
    year: 'numeric', month: '2-digit', day: '2-digit',
    hour: '2-digit', minute: '2-digit', second: '2-digit',
  });

  const parts = {};
  for (const p of dtf.formatToParts(instant)) parts[p.type] = p.value;

  const asUtc = Date.UTC(
    Number(parts.year),
    Number(parts.month) - 1,
    Number(parts.day),
    Number(parts.hour) % 24,
    Number(parts.minute),
    Number(parts.second)
  );
  return asUtc - instant.getTime();
}

/** 'YYYY-MM-DD' -> Date, kai ta vietine diena prasideda (UTC momentas). */
function localDayStart(dateStr, timeZone = DEFAULT_TZ) {
  const m = /^(\d{4})-(\d{2})-(\d{2})/.exec(String(dateStr || ''));
  if (!m) return null;

  const naive = Date.UTC(Number(m[1]), Number(m[2]) - 1, Number(m[3]));
  // Du praejimai - kad teisingai pataikytume ir per vasaros/ziemos laiko riba.
  let ts = naive - offsetMs(new Date(naive), timeZone);
  ts = naive - offsetMs(new Date(ts), timeZone);
  return new Date(ts);
}

/** 'YYYY-MM-DD' -> kitos kalendorines dienos data tuo paciu formatu. */
function nextDay(dateStr) {
  const m = /^(\d{4})-(\d{2})-(\d{2})/.exec(String(dateStr || ''));
  if (!m) return null;
  const d = new Date(Date.UTC(Number(m[1]), Number(m[2]) - 1, Number(m[3]) + 1));
  return d.toISOString().slice(0, 10);
}

/** 'YYYY-MM-DD' -> Date, kai ta vietine diena baigiasi (t. y. kitos pradzia). */
function localDayEnd(dateStr, timeZone = DEFAULT_TZ) {
  const next = nextDay(dateStr);
  return next ? localDayStart(next, timeZone) : null;
}

module.exports = {
  DEFAULT_TZ,
  offsetMs,
  localDayStart,
  localDayEnd,
  nextDay,
};
