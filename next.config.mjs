/** @type {import('next').NextConfig} */

// BB-146 — security headers for every page.
//
// Content-Security-Policy is sent as REPORT-ONLY for now: the browser logs anything that would be
// blocked in the console ("[Report Only] Refused to …") but blocks nothing. Once a full click-through
// shows no warnings, rename the header to "Content-Security-Policy" to enforce it.
//
// Sources the app uses today (keep this list in step with the code):
//   API + live updates  NEXT_PUBLIC_API_URL (https + wss)
//   Stripe              js.stripe.com (script, frames), api.stripe.com, hooks.stripe.com
//   Maps                OpenStreetMap tiles (img), nominatim.openstreetmap.org (address search),
//                       unpkg.com marker icons (img)
//   Face photos, misc   any https image (cloud storage links)
//   PDF previews        blob: frames (payment proof, system-admin reports); email preview uses srcdoc

const isDev = process.env.NODE_ENV !== "production";

function apiSources() {
  try {
    const url = new URL(process.env.NEXT_PUBLIC_API_URL);
    const ws = `${url.protocol === "https:" ? "wss:" : "ws:"}//${url.host}`;
    return [url.origin, ws];
  } catch {
    return [];
  }
}

const csp = [
  "default-src 'self'",
  // Next.js inlines small scripts, so 'unsafe-inline' is needed until we move to nonces.
  `script-src 'self' 'unsafe-inline'${isDev ? " 'unsafe-eval'" : ""} https://js.stripe.com`,
  "style-src 'self' 'unsafe-inline'",
  "img-src 'self' data: blob: https:",
  "font-src 'self' data:",
  [
    "connect-src 'self'",
    ...apiSources(),
    "https://api.stripe.com",
    "https://nominatim.openstreetmap.org",
    ...(isDev ? ["ws://localhost:*", "http://localhost:*"] : []),
  ].join(" "),
  // blob: = PDF previews built in the page (payment proof, system-admin reports)
  "frame-src 'self' blob: https://js.stripe.com https://hooks.stripe.com",
  "object-src 'none'",
  "base-uri 'self'",
  "form-action 'self'",
].join("; ");

const securityHeaders = [
  { key: "Content-Security-Policy-Report-Only", value: csp },
  // The app can't be shown inside another site's frame (stops click-jacking).
  { key: "X-Frame-Options", value: "DENY" },
  // Browsers must use the file type we send, not guess it.
  { key: "X-Content-Type-Options", value: "nosniff" },
  // Other sites see only our domain, never full URLs with IDs in them.
  { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
  // Location is used by web punch; camera and microphone are never used on the web.
  { key: "Permissions-Policy", value: "camera=(), microphone=(), geolocation=(self)" },
  // Always use HTTPS for this domain (ignored on http://localhost).
  { key: "Strict-Transport-Security", value: "max-age=31536000" },
];

const nextConfig = {
  reactStrictMode: false,
  // BB-145: landing screenshots use quality 90 (small UI text); 75 is Next's default.
  images: { qualities: [75, 90] },
  async headers() {
    return [{ source: "/:path*", headers: securityHeaders }];
  },
};

export default nextConfig;
