// lib/contestTimes.js
//
// BB-123: shared time-zone math for contest requests — used by the employee
// "Contest clock in/out times" dialog and the company Contest Requests page.
// Every wall-clock time here is in the COMPANY time zone, never the viewer's browser zone.

import { fromZonedTime, formatInTimeZone } from "date-fns-tz";

const HOUR_MS = 3600 * 1000;

/** Contests that move the clock-in by this many hours (or to another date) get a warning. */
export const LARGE_SHIFT_HOURS = 12;

/** "America/Los_Angeles" → "Los Angeles" */
export function zoneCity(tz) {
  const parts = (tz || "UTC").split("/");
  return parts[parts.length - 1].replace(/_/g, " ");
}

/**
 * "Los Angeles (PST)" — city from the IANA name plus the abbreviation in effect at `at`
 * (so PST vs PDT is right for the punch's own date). Built from `tz`, never hard-coded.
 */
export function zoneLabel(tz, at = new Date()) {
  const zone = tz || "UTC";
  let abbr = "";
  try {
    abbr = formatInTimeZone(at ? new Date(at) : new Date(), zone, "zzz");
  } catch {
    /* invalid zone — fall back to the city alone */
  }
  const city = zoneCity(zone);
  return abbr && abbr !== city ? `${city} (${abbr})` : city;
}

/** Calendar date ("YYYY-MM-DD") of an instant in the given zone. */
export function dateInZone(iso, tz) {
  if (!iso) return null;
  const d = new Date(iso);
  if (isNaN(d.getTime())) return null;
  return formatInTimeZone(d, tz || "UTC", "yyyy-MM-dd");
}

/** Pure calendar arithmetic on a "YYYY-MM-DD" string (no zone involved). */
export function addDaysToDateStr(dateStr, days) {
  const [y, m, d] = dateStr.split("-").map(Number);
  const dt = new Date(Date.UTC(y, m - 1, d + days));
  return dt.toISOString().slice(0, 10);
}

/** Wall-clock "YYYY-MM-DD" + "HH:MM" in `tz` → UTC ISO string. */
export function wallTimeToISO(dateStr, timeStr, tz) {
  if (!dateStr || !/^\d{2}:\d{2}$/.test(timeStr || "")) return null;
  return fromZonedTime(`${dateStr}T${timeStr}:00`, tz || "UTC").toISOString();
}

/**
 * Build the requested clock-in/out instants for a contest.
 * - Both times are wall-clock times in the company zone, on the recorded clock-in's date.
 * - If clock-out ≤ clock-in, the clock-out is on the NEXT day (overnight shift).
 * Returns { clockIn, clockOut, hours } (ISO strings + shift length in hours), or nulls.
 */
export function buildContestTimes(recordedClockIn, inTime, outTime, tz) {
  const baseDate = dateInZone(recordedClockIn, tz);
  if (!baseDate || !inTime || !outTime) return { clockIn: null, clockOut: null, hours: null };

  const clockIn = wallTimeToISO(baseDate, inTime, tz);
  let clockOut = wallTimeToISO(baseDate, outTime, tz);
  if (!clockIn || !clockOut) return { clockIn: null, clockOut: null, hours: null };

  if (new Date(clockOut) <= new Date(clockIn)) {
    clockOut = wallTimeToISO(addDaysToDateStr(baseDate, 1), outTime, tz);
  }
  const hours = (new Date(clockOut) - new Date(clockIn)) / HOUR_MS;
  return { clockIn, clockOut, hours };
}

/**
 * Instant truncated to the whole minute (ms), or null. Recorded punches carry seconds
 * (e.g. 17:00:36) while requested times are whole minutes, so every comparison is done
 * at minute precision — otherwise a 9h vs 9h shift reads as "+0.01h".
 */
function toMinute(iso) {
  if (!iso) return null;
  const t = new Date(iso).getTime();
  if (isNaN(t)) return null;
  return Math.floor(t / 60000) * 60000;
}

/** Shift length in hours between two instants (minute precision), or null. */
export function lengthHours(inIso, outIso) {
  const a = toMinute(inIso), b = toMinute(outIso);
  if (a == null || b == null) return null;
  return (b - a) / HOUR_MS;
}

/**
 * How much a contest moves a punch. All values in hours; null where a side is missing.
 * - movesDate:  requested clock-in is on a different calendar date (company zone)
 * - large:      clock-in moves LARGE_SHIFT_HOURS+ or to another date
 * - zoneShift:  both times moved by the same amount (≥ 1h) and the length is unchanged —
 *               the signature of times typed in the wrong time zone
 * The clock-out landing on the next day is NOT a signal by itself (normal overnight shift).
 */
export function contestChange({ origIn, origOut, reqIn, reqOut }, tz) {
  const diff = (a, b) => {
    const x = toMinute(a), y = toMinute(b);
    return x == null || y == null ? null : (y - x) / HOUR_MS;
  };
  const inShift  = diff(origIn, reqIn);
  const outShift = diff(origOut, reqOut);
  const oldLen = lengthHours(origIn, origOut);
  const newLen = lengthHours(reqIn, reqOut);

  const origDate = dateInZone(origIn, tz);
  const reqDate  = dateInZone(reqIn, tz);
  const movesDate = !!(origDate && reqDate && origDate !== reqDate);
  const large = movesDate || (inShift != null && Math.abs(inShift) >= LARGE_SHIFT_HOURS);

  const ONE_MIN = 1 / 60;
  const zoneShift =
    inShift != null && outShift != null && oldLen != null && newLen != null &&
    Math.abs(inShift) >= 1 &&
    Math.abs(inShift - outShift) < ONE_MIN &&
    Math.abs(newLen - oldLen) < ONE_MIN;

  return { inShift, outShift, oldLen, newLen, movesDate, large, zoneShift };
}

/** +16h, −0.25h, 0h — signed, at most 2 decimals. */
export function fmtSignedHours(h) {
  if (h == null || isNaN(h)) return "—";
  const r = Number(h.toFixed(2));
  if (r === 0) return "0h";
  return `${r > 0 ? "+" : "−"}${Math.abs(r)}h`;
}

/** 9h, 8.5h — unsigned, at most 2 decimals. */
export function fmtHours(h) {
  if (h == null || isNaN(h)) return "—";
  return `${Number(h.toFixed(2))}h`;
}

/** Cutoff period statuses the server treats as closed for contests. */
export const LOCKED_CUTOFF_STATUSES = ["locked", "processed"];

/**
 * True when a punch-logs row is already reviewed in a locked/processed cutoff
 * (`cutoffApproval.cutoffPeriod.status`, the field V3CutoffBox shows). A log in a locked
 * period with no cutoffApproval yet can't be detected here — the server still refuses it
 * with CUTOFF_LOCKED.
 */
export function isLogInLockedCutoff(log) {
  return LOCKED_CUTOFF_STATUSES.includes(log?.cutoffApproval?.cutoffPeriod?.status);
}
