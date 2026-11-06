// components/system-admin/bbuddy/api.js
//
// BB-110: system-admin calls for the B. Buddy Activity page
// (server: /api/system-admin/bbuddy/*, same system-admin session as the other pages).

import { systemAdminFetch } from "@/lib/systemAdminFetch";

// Shared system-admin fetch (Bearer token, 401 → sign-in), scoped to /bbuddy
export const bbuddyFetch = (path, options) => systemAdminFetch(`/api/system-admin/bbuddy${path}`, options);

// "YYYY-MM-DD" from a date input → ISO bounds covering the whole local day
export const startOfDayISO = (d) => (d ? new Date(`${d}T00:00:00`).toISOString() : "");
export const endOfDayISO = (d) => (d ? new Date(`${d}T23:59:59.999`).toISOString() : "");

export const toDateInput = (date) => {
  const d = new Date(date);
  const pad = (n) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
};

export const daysAgoInput = (days) => toDateInput(Date.now() - days * 24 * 60 * 60 * 1000);

export const formatDateTime = (value) =>
  value
    ? new Date(value).toLocaleString(undefined, {
        month: "short",
        day: "numeric",
        year: "numeric",
        hour: "numeric",
        minute: "2-digit",
      })
    : "—";
