# Changelog — v2.17.1

BB-145 (follow-up): **Search engines get a proper site icon, a `robots.txt` and a sitemap.**
- On Bing, mybizbuddy.co showed a grey globe instead of the BizBuddy icon, and its description dated from before the v2.17.0 redesign. Google was fine.
- The site now has a large square icon and an Apple touch icon.
- `/robots.txt` keeps crawlers out of `/system-admin`, `/dashboard` and the payment and password-reset pages.
- `/sitemap.xml` lists only the public pages.

Also: a new `/version-of` command for Claude Code looks up which release each ticket shipped in. It's tooling only.

**No server change.** **Mobile:** no change.

---

## BB-145 — Site icon, robots.txt and sitemap (follow-up)

**Status:** Built (client), untested.

**Why:**
- The only icon was `app/favicon.ico`, which has 16 and 32 px images. Search engines prefer at least 48 px.
- There was no `robots.txt` or sitemap, so nothing pointed Bing to the public pages or brought it back after the redesign.

### Changes
- **`app/icon.png`** (512×512, transparent) and **`app/apple-icon.png`** (180×180, white background): the orange BizBuddy mark, cropped from `public/images/bizbuddy-logo.png` without the "BIZ BUDDY" text.
  - Next.js adds the `<link rel="icon">` and `<link rel="apple-touch-icon">` tags itself.
  - `favicon.ico` stays for older browsers.
- **`app/robots.js`** → `/robots.txt`:
  - allows `/`;
  - disallows `/system-admin`, `/dashboard`, `/payment` and `/reset-password`;
  - points to the sitemap.
- **`app/sitemap.js`** → `/sitemap.xml`. It lists `/`, `/faq`, `/contact`, `/sign-in`, `/sign-up`, `/privacy-policy`, `/terms` and `/account-deletion`.
  - It leaves out every `/system-admin` and `/dashboard` URL (Carlo, 2026-11-24).
  - `/pricing` is also left out because it still shows live prices (see the v2.17.0 open item).

### Not changed
- `app/favicon.ico` and the page titles and descriptions.
- Pages aren't marked `noindex`. `robots.txt` only asks crawlers to stay away; it doesn't hide anything. The system-admin login is still protected by its sign-in, as before.

### To test
1. After deploy, these should open: `mybizbuddy.co/icon.png`, `/apple-icon.png`, `/robots.txt` and `/sitemap.xml`.
2. The sitemap has no `/system-admin`, `/dashboard` or `/pricing` URLs.
3. The browser tab still shows the BizBuddy icon. On iPhone, "Add to Home Screen" shows the orange mark on white.
4. **Bing Webmaster Tools (Carlo):** submit `https://mybizbuddy.co/sitemap.xml`, then use URL Inspection on the homepage and click Request indexing. Bing's icon and description can take a few days to a couple of weeks to update.

---

## Tooling — `/version-of`

- New `.claude/commands/version-of.md`: a read-only lookup of the released version for each ticket. It checks the changelogs and the master commits, and reports work delivered under another ticket.
- `CLAUDE.md`:
  - mentions `/version-of` next to `/push`;
  - fixes the server repo URL (`biz-admin-carlo` → `BizSolutions-LLC`).

---

## Open items
- **Bing recrawl:** Carlo submits the sitemap and requests indexing after this deploys.
- **Carried from v2.17.0:**
  - the server release for `POST /api/public/contact`;
  - CSP enforcement;
  - tokens in localStorage;
  - store URLs;
  - `/pricing` restyle or hide;
  - the "CC" initials in the screenshots.
