// lib/dateTimeFormatter.js

export const NA = "—";

const toDate = (value) => {
  if (!value) return null;
  return value instanceof Date ? value : new Date(value);
};

/**
 * MM/DD/YYYY, hh:mm AM/PM
 * Example → "07/09/2025, 02:05 PM"
 */
export const fmtMMDDYYYY_hhmma = (value) => {
  const date = toDate(value);
  if (!date || isNaN(date)) return NA;

  const datePart = date.toLocaleDateString("en-US", {
    month: "2-digit",
    day: "2-digit",
    year: "numeric",
    timeZone: "UTC",
  });

  const timePart = date.toLocaleTimeString("en-US", {
    hour: "2-digit",
    minute: "2-digit",
    hour12: true,
    timeZone: "UTC",
  });

  return `${datePart}, ${timePart}`;
};

/**
 * MM/DD/YYYY  (pure date, no time)
 * Example → "07/09/2025"
 */
export const fmtMMDDYYYY = (value) => {
  const date = toDate(value);
  if (!date || isNaN(date)) return NA;

  return date.toLocaleDateString("en-US", {
    month: "2-digit",
    day: "2-digit",
    year: "numeric",
    timeZone: "UTC", // remove if you prefer device-local
  });
};

/**
 * hh:mm AM/PM  (time only, 12-hour clock)
 * Example → "02:05 PM"
 */
export const fmt_hhmma = (value) => {
  const date = toDate(value);
  if (!date || isNaN(date)) return NA;

  return date.toLocaleTimeString("en-US", {
    hour: "2-digit",
    minute: "2-digit",
    hour12: true,
    timeZone: "UTC",
  });
};
