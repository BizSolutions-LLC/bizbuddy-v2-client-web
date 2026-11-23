# Changelog — v2.17.0

BB-144: **The landing page's download pop-ups use the new App Store and Google Play QR codes** (the orange versions from `docs/app-qr/`). The fake "Or visit directly" store links are gone.

BB-145: **The public site is redesigned** from the designer's handoff (`docs/BizBuddy-landing-page.zip`). It has a new landing page:
- header with "Download free";
- hero with six features that rotate every 7 s;
- black highlights band;
- overtime section;
- pricing without prices;
- download section with QR codes;
- FAQ (7 on the landing page, 15 on `/faq`);
- contact form;
- new footer.

The Privacy Policy and Terms of Service are rewritten:
- general wording;
- the Terms corrected to match the app;
- the new address (1900 Camden Avenue, Suite 101, San Jose, CA 95124);
- 24-hour support.

The contact form now sends through the server instead of opening the visitor's email app.

BB-146: **Security fixes.**
- Leave type names can no longer inject script into Cutoff Review.
- Every page now sends security headers. The script policy (CSP) is in report-only mode for now.

**Needs the server release that carries BB-145's `POST /api/public/contact` (number to confirm).** The client is safe to ship first. Until the endpoint is live, the form shows "We couldn't send your message" with an "Email us directly" link that opens the visitor's email app with the message filled in. BB-144 and BB-146 need no server change.

**Mobile:** no change.

---

## BB-144 — Landing QR codes

**Status:** Done; confirmed by Carlo.

**Why:** the landing page showed old QR images, and its store links (`apps.apple.com/bizbuddy`, `play.google.com/store/apps/bizbuddy`) went nowhere.

### Changes
- `public/app-qr/`: the orange App Store and Google Play QR images. The originals, including black and SVG versions, are in `docs/app-qr/`.
- The download pop-up (now in `components/Home/landing/DownloadSection.jsx`) uses them. There's no "Open the store" button until real store URLs exist.
- Removed `public/bizbuddy-appstore.png` and `public/bizbuddy-playstore.png`.

---

## BB-145 — Public site redesign, legal pages, contact form

**Status:** Landing, legal pages and contact form built and checked by Carlo in the browser (console clean on the landing page). The contact endpoint is built on the server, not deployed.

**Why:**
- The landing page was out of date.
- The Privacy Policy no longer matched what the app does.
- The Terms had wrong facts (paid-only, annual billing, cancel in settings, 60-day retention, help desk, Cupertino address).
- The contact form only opened the visitor's email app, which loses leads on webmail.

**Server contract used** (`docs/server-request-BB-145-contact-form.md`, accepted by the server):
- `POST /api/public/contact`, public.
- **Body:**
  - `name`, `email`, `phone` (optional), `company` (optional), `teamSize` (optional), `message`;
  - honeypot `website`;
  - `startedAt` + `elapsedMs`.
- **Responses:** `202 { ok: true }`, `400 VALIDATION_ERROR` + `fields`, `429 RATE_LIMITED`, `500 CONTACT_FAILED`.
- **Server-side protections:**
  - bots are dropped silently;
  - rate limits of 5 per hour and 20 per day per IP, and 200 per day overall;
  - the email shows in System Admin → Emails as `CONTACT_FORM`.
- No auto-reply to the visitor.

### Changes
**Design tokens:**
- **`tailwind.config.js`**, for the public site only:
  - `brand` colors;
  - `font-landing` (Inter) and `font-display` (Inter Tight);
  - `rounded-brand` (2 px);
  - `animate-rail-fill`.
- **`app/layout.jsx`**: loads both fonts with `next/font`, with no weight list. Listing weights breaks Turbopack's font loader.

**Landing (`components/Home/landing/`):**
- `content.js`: all copy (hero features, highlights, plans, 15 FAQs, contact details, links, QR images).
- `PublicNav.jsx`: the header for signed-out visitors. It folds into a menu under 900 px, and has no search and no theme toggle. `components/Partial/Navbar.jsx` shows it whenever there is no token and the page isn't `/dashboard`. The dashboard header is unchanged.
- `HeroRail.jsx`:
  - six features that rotate every 7 s or on click, with no autoplay for reduced motion;
  - screenshots through `next/image` (quality 90, early loading);
  - phone frames use Carlo's own screenshots;
  - the browser bar reads `mybizbuddy.co`.
- `Sections.jsx`: highlights band, overtime section, and pricing. Basic and Pro have features but **no prices**, with "Get a quote". `ScreenCaption` shows "… | *Demo data*".
- `DownloadSection.jsx`: iPhone and Android buttons, both QR codes, "Open in the browser" → `/sign-in`, and the QR pop-up with three steps.
- `FAQSection.jsx` (with a `full` prop for `/faq`) and `ContactSection.jsx`.
- `public/landing/`: the designer's screenshots (demo data) and logo.

**Contact form (`ContactSection.jsx`):**
- **Fields:** Name (full width), Work email | Phone (optional), Company (optional) | Team size (optional), Message.
- **Before sending:** checks the fields (phone uses the server's rule: 7–15 digits, optional extension).
- **While sending and after:** "Sending…", then a confirmation, or field errors from the server. A 429, a 5xx or no endpoint shows "Email us directly" with the message filled in.
- **Spam protection:** hidden honeypot field, `startedAt` / `elapsedMs`.

**Legal pages:**
- `components/Home/legal/LegalDocument.jsx`: the shared layout (grey title band, "On this page" sidebar, numbered sections).
- `PrivacyPolicy.jsx`:
  - general wording: types of information, purposes, sharing, rights, cookies, children, changes, contact;
  - no provider names, no face capture, no security or detection details.
- `Terms.jsx`:
  - a free plan and paid plans;
  - billed monthly, auto-renewing, non-refundable;
  - cancel by contacting us, and company deletion in Settings is permanent;
  - 24-hour support;
  - California law, Santa Clara County;
  - the new address.

**Pages:** `app/page.jsx`, `app/(home)/faq`, `/contact`, `/privacy-policy` and `/terms` use the new components and the new dark footer (`components/Partial/Footer.jsx`, with `flush` for full-width pages).

**Removed:**
- `app/api/contact/route.js`: a copy of a component, not a working route.
- The old landing sections (`LandingHero`, `FeaturesIcon`, `KeyFeatures`, `Testimonials`, `DataDisplay`, `TrustedPartners`, `Home/Contact`, `Home/Accordion`).
- `lib/data.js` and `Partial/Navbar/MobileMenu.jsx`.

**Images (`next.config.mjs`):** `images.qualities: [75, 90]`, which Next 16 will require.

### Not changed
- `/pricing` still shows server prices in the old style. The landing page no longer links to it.
- The dashboard header and everything signed-in.

**To test:**
1. **Signed out:** check `/` at 1440, 1024, 768 and 390 px.
   - The hero rotates, and clicking a feature switches it.
   - The phone menu opens.
   - The iPhone and Android buttons open the QR pop-up, and both QR codes scan.
2. **Pages:** check `/faq` (15 questions), `/contact`, `/privacy-policy` and `/terms`, plus the sign-in and sign-up pages (new header and footer).
3. **Contact form, before the server deploy:** submit → "We couldn't send your message" + "Email us directly", which opens your email app filled in.
4. **Contact form, after the server deploy:**
   - Send a message → confirmation, and the email shows in System Admin → Emails (`CONTACT_FORM`); Reply goes to the visitor.
   - A bad email or phone → the error appears under that field.
   - The 6th message in an hour → the "try again later" message.

---

## BB-146 — Security fixes

**Status:** Built. The landing page console is clean, with no CSP reports. The logged-in pages haven't been checked yet.

**Why:** found during the BB-145 security check.
- Cutoff Review rendered admin-typed leave type names as raw HTML, so a crafted name could run script in approvers' browsers.
- The app sent no security headers.

### Changes
- **`cutoffReviewShared.jsx`:** a new `escapeHtml()`. Leave type names, and the edited-times text, go through it before they're placed in record `detail` HTML. Normal names look the same.
- **`next.config.mjs`, headers on every path:**
  - **Enforced:**
    - `X-Frame-Options: DENY`;
    - `X-Content-Type-Options: nosniff`;
    - `Referrer-Policy: strict-origin-when-cross-origin`;
    - `Permissions-Policy: camera=(), microphone=(), geolocation=(self)`;
    - `Strict-Transport-Security: max-age=31536000`.
  - **Report-only:** `Content-Security-Policy-Report-Only`. It allows our API (https + wss), Stripe, OpenStreetMap tiles and Nominatim, unpkg marker icons, https images and `blob:` PDF frames.

**To test:**
1. **Cutoff Review:** a leave type named `<b>Test</b>` shows literally, not in bold.
2. **Logged-in pages:** with the console open, check web Punch (location prompt), subscription/payment (Stripe card form), payment proof and system-admin report PDF previews.
   - They must work.
   - There must be no "[Report Only] Refused to…" messages.
3. **Embedding:** the site can no longer be embedded in another site's frame.

---

## Open items
- **Server version:** the release that carries `POST /api/public/contact` (BB-145).
- **Server team notes:**
  - The contact rate limit must use the visitor's real IP behind the proxy (`trust proxy`).
  - The counters reset on restart.
  - New preview domains must be added to CORS.
- **CSP:** after the logged-in click-through shows no reports, rename the header to `Content-Security-Policy` to enforce it.
- **Tokens in localStorage** (user and system-admin): move to httpOnly cookies later. That's a roadmap item and needs the server.
- **Store URLs:** when the App Store and Google Play links exist, add an "Open the store" button to the QR pop-up.
- **`/pricing`:** restyle or hide it. It still shows prices.
- **"CC" initials** in the phone screenshots: swap them for clean screenshots if those are a real person's.
