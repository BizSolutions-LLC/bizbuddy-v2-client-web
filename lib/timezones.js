// lib/timezones.js
//
// Time zones offered when a company's time zone is picked: Company
// Configurations and the system-admin Add company form (BB-107).

export const DEFAULT_TIMEZONE = "America/Los_Angeles";

export const TIMEZONES = [
  { value: "America/Los_Angeles", label: "America/Los Angeles (PST/PDT)" },
  { value: "America/New_York",    label: "America/New York (EST/EDT)" },
  { value: "America/Chicago",     label: "America/Chicago (CST/CDT)" },
  { value: "America/Denver",      label: "America/Denver (MST/MDT)" },
  { value: "America/Phoenix",     label: "America/Phoenix (MST)" },
  { value: "America/Anchorage",   label: "America/Anchorage (AKST/AKDT)" },
  { value: "Pacific/Honolulu",    label: "Pacific/Honolulu (HST)" },
  { value: "Europe/London",       label: "Europe/London (GMT/BST)" },
  { value: "Europe/Paris",        label: "Europe/Paris (CET/CEST)" },
  { value: "Europe/Berlin",       label: "Europe/Berlin (CET/CEST)" },
  { value: "Asia/Dubai",          label: "Asia/Dubai (GST)" },
  { value: "Asia/Kolkata",        label: "Asia/Kolkata (IST)" },
  { value: "Asia/Shanghai",       label: "Asia/Shanghai (CST)" },
  { value: "Asia/Tokyo",          label: "Asia/Tokyo (JST)" },
  { value: "Asia/Singapore",      label: "Asia/Singapore (SGT)" },
  { value: "Asia/Hong_Kong",      label: "Asia/Hong Kong (HKT)" },
  { value: "Asia/Manila",         label: "Asia/Manila (PHT)" },
  { value: "Australia/Sydney",    label: "Australia/Sydney (AEDT/AEST)" },
  { value: "Australia/Melbourne", label: "Australia/Melbourne (AEDT/AEST)" },
  { value: "Pacific/Auckland",    label: "Pacific/Auckland (NZDT/NZST)" },
];
