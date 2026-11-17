// components/system-admin/subscription-plans/format.js
//
// BB-132: display helpers for the read-only Subscription Plans page.

const usd = new Intl.NumberFormat("en-US", { style: "currency", currency: "USD" });

// 25.99 → "$25.99", 0 → "Free"
export function formatPrice(price) {
  const n = Number(price);
  if (price == null || !Number.isFinite(n)) return "—";
  return n === 0 ? "Free" : usd.format(n);
}

const capitalize = (s) => (s ? s[0].toUpperCase() + s.slice(1) : s);

// Feature keys come from the server (featureKeys), so none are hard-coded here.
// "timekeeping-punch-offline" → "Timekeeping: punch offline", "leaves" → "Leaves"
export function featureLabel(key = "") {
  const [head, ...rest] = String(key).split("-");
  const words = (part) => part.replace(/_/g, " ").trim();
  const title = capitalize(words(head));
  return rest.length ? `${title}: ${words(rest.join(" "))}` : title;
}

// "1" → "1 user", "2-9" → "2–9 users"
export function formatUserRange(range) {
  if (range == null || range === "") return "";
  const text = String(range).replace(/-/g, "–");
  return `${text} ${text === "1" ? "user" : "users"}`;
}
