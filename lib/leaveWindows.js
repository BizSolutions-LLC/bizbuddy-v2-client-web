// BB-124 (added task): a leave day's charged time windows, as sent by the server on
// GET /api/leaves/:id/days (data[].windows) and GET /api/leaves/:id/preview
// (data.days[].windows). `start` / `end` are already formatted in the window's own
// zone (the shift's zone on a shift day) — display-ready, no conversion here.
//
//   kind "shift"     → shift name + "1:30 PM – 2:45 PM"
//   kind "requested" → "6:00 PM – 10:00 PM" (no shift that day, employee's own times)
//   kind "whole_day" → "Whole day"
//
// The zone is shown only when it differs from the company zone (e.g. Manila shifts in
// a Los Angeles company). If the company zone isn't known, it's always shown.
// Missing or empty `windows` (older server, or nothing charged that day) → null / "".

const range = (w) => `${w.start ?? ""} – ${w.end ?? ""}`;

const otherZone = (w, companyTz) =>
  w.kind !== "whole_day" && w.zoneLabel && (!companyTz || !w.timeZone || w.timeZone !== companyTz)
    ? w.zoneLabel
    : null;

// One window as a full line: "Regular Shift · 8:00 AM – 1:30 PM (Manila time)"
const fullLine = (w, companyTz) => {
  if (w.kind === "whole_day") return "Whole day";
  const zone = otherZone(w, companyTz);
  return `${w.shiftName ? `${w.shiftName} · ` : ""}${range(w)}${zone ? ` (${zone} time)` : ""}`;
};

/**
 * Full text for a day's windows, all on one line — used when every day in the list has
 * the same times and they're shown once above the list.
 */
export function fmtLeaveWindows(windows, companyTz) {
  if (!Array.isArray(windows) || windows.length === 0) return "";
  return windows.map((w) => fullLine(w, companyTz)).join(", ");
}

/**
 * Compact form for a narrow day row.
 * @returns {{ short: string, detail: string[] } | null}
 *   short  — under the date: "1:30 PM – 2:45 PM", "3 shifts · 6:45 AM – 2:45 PM", "Whole day"
 *   detail — tooltip lines, one per window, with shift names (and zone when different)
 */
export function leaveWindowsSummary(windows, companyTz) {
  if (!Array.isArray(windows) || windows.length === 0) return null;

  const detail = windows.map((w) => fullLine(w, companyTz));
  const timed  = windows.filter((w) => w.kind !== "whole_day");
  if (timed.length === 0) return { short: "Whole day", detail };

  const zones = [...new Set(timed.map((w) => otherZone(w, companyTz)).filter(Boolean))];
  const zone  = zones.length === 1 ? ` · ${zones[0]}` : "";

  const short = timed.length === 1
    ? `${range(timed[0])}${zone}`
    : `${timed.length} shifts · ${timed[0].start ?? ""} – ${timed[timed.length - 1].end ?? ""}${zone}`;

  return { short, detail };
}

/**
 * When every day (2+) has the same non-empty windows, the shared text to show once above
 * the list; otherwise "". `groups` is the list of per-date entry groups.
 */
export function sharedLeaveWindows(groups, companyTz) {
  if (!Array.isArray(groups) || groups.length < 2) return "";
  const texts = groups.map((entries) => fmtLeaveWindows(entries[0]?.windows, companyTz));
  return texts[0] && texts.every((t) => t === texts[0]) ? texts[0] : "";
}
