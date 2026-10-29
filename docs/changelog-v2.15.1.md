# Changelog — v2.15.1

BB-112: the system-admin **Performance → Capacity** page explains its numbers. It needs server
**v2.11.1**. Against an older server, the page looks and works as it did in v2.15.0.

BB-113: a new **Performance → Reports** tab. A **Baseline** (the 30 days before production's database
connection moved to Render's Internal URL) and a report for every 30 days after it. Each one
downloads as a PDF compared with the period before and with the Baseline.

---

## BB-112 — Capacity: bands, coverage, plans

**Why:** the page showed a red "Upgrade" with no reference numbers and no way to tell how much data
was behind it. The red Database gauge also showed a healthy 35% connections figure, because the
colour came from the card's verdict and not from the number itself.

**What changes:**
- **Banner:** history coverage, the current Render plans with any suggested upgrade, the disk and the
  monthly cost. They're shown as tiles under the recommendation; see *Friendlier Performance page*
  below.
- **Gauges:** the arc colour and a "· Good / Watch / …" label come from the band of the number the
  gauge shows. The Database gauge is coloured by its connections figure.
- **Figures:**
  - Each row shows its band as a scale bar (see below), or as a dot when the server sends no ranges.
    The value is coloured by its band.
  - Hovering a row shows its ranges, e.g. "Excellent < 5 ms · Good < 20 ms · Watch < 50 ms ·
    Terrible ≥ 50 ms".
  - The Size row notes that Render's disk figure also counts logs.
- **Provisional verdicts:** when the server holds back an Upgrade for lack of history, the card shows
  Watch with "Would be Upgrade — not enough history yet".
- **Legend:** a collapsible "What the colours mean" section under the cards shows every metric's
  ranges from the server's `thresholds`.
- **API hotspots:**
  - The table gets a **Kind** column (Light / Heavy / Long).
  - p95 is coloured by its band for that kind, with the ranges in a tooltip. Change is coloured by
    its band.
  - "Flagged" now means slow for its kind or 50%+ slower (20+ calls), the same rule the server uses.

## BB-113 — Reports tab

- **Tab:** Performance gets a third tab, **Reports**.
- **How reports work:**
  - **Report 0 is the Baseline,** saved once by an admin.
  - **Periods 1, 2, 3…** are consecutive 30-day windows from the Baseline's end. The server saves
    each one the day after it ends.
  - **Finished reports don't change,** so they stay comparable.
- **No Baseline yet:** a **Set the Baseline** panel replaces the table.
  - **Switch time:** a date-time input in the admin's local time, sent as ISO UTC (`endsAt`). It
    can't be in the future.
  - **Save Baseline** saves it.
- **Once the Baseline exists:**
  - **Save / Update ⟨Period N⟩ to date** saves the running period as a preview. The label says
    "Update" once that period is saved as partial.
  - **Save ⟨Period N−1⟩** appears only when the last finished period is missing or was only saved to
    date. The server's daily job normally saves it, but that job only runs where sampling runs (on
    Render, or with `CAPACITY_SAMPLING=true`).
  - **Saved reports table:**

    | Column | Shows |
    |---|---|
    | Report | "Baseline" with a small *reference* tag, or "Period N" |
    | Dates | e.g. "Oct 29 – Nov 28, 2026", in Los Angeles time |
    | Status | **To date** or **Final** |
    | Verdict | OK / Watch / Upgrade |
    | Saved | time and by whom; "Scheduled job" for automatic saves |
    | Report | a **PDF** button |

  - **Sample count:** hovering a row shows how many server samples the report holds. A report with
    none says "No server samples" under its dates, so a thin report isn't mistaken for a full one.
    Samples are kept 35 days and only started in late October 2026, so the Baseline should be saved
    before about 2026-12-01.
- **Errors:** the server's message is shown, e.g. "Save the Baseline first…" or a report that can no
  longer be rebuilt.
- **Downloads:** a new `systemAdminDownload(path, fallbackName)` in `lib/systemAdminFetch.js` sends
  the session token and saves the file. It uses the server's `Content-Disposition` filename and shows
  JSON errors like every other call.

## Friendlier Performance page (BB-112 / BB-113)

**Why:** the page explained too much in sentences and too little at a glance.

- **Scale bars:** every banded figure (CPU, memory, responsiveness, database speed, connection waits,
  size, reads from memory) has a thin four-band bar with a tick at the value. The legend shows the
  same bars with the bounds under them. Both are built from the server's `thresholds`, and the tick
  always sits inside the band the server gave, so the bar can't contradict the verdict.
- **Plain wording:** labels are plain, e.g. "Responsiveness", "Waiting for a connection", "Reads from
  memory", "Slow calls", "Typical" and "vs before". The technical term (p95, event loop, pool
  timeouts, cache hit) and the ranges are in the tooltip. Descriptions are cut to one line or moved
  into tooltips.
- **Banner:** the verdict and the server's recommendation stay on top. Underneath, a row of up to
  four tiles (2 × 2 on phones):
  - **History:** progress towards the 14 days that Upgrade verdicts need ("0.6 of 14 days", with
    "Upgrades on hold until 14 days"). Once there is enough history, it shows how many days of the
    chosen period have samples.
  - **API server / Database:** the current plan ("0.1 CPU · 256 MB · $6/mo", with the plan code on
    hover) and one status line. It reads "No plan change", or "Suggested: …" with the extra cost. It
    reads "On hold: …" while the card's Upgrade is held back for lack of history. The server works out
    the suggested plan before it holds the verdict back. When the database needs more disk, the
    status says so instead of suggesting a plan. When no bigger plan exists, it says that too.
  - **Disk:** shown in the Database tile as "used of total MB · %".
  - **Monthly cost:** both plans added up, plus the total after the suggested upgrade ("if upgraded"
    while it's on hold). Disk and bandwidth aren't included.
- **Names:** "API hotspots" becomes **Busiest endpoints**, and the tab becomes **Reports**.
- **Endpoints tab, rebuilt on Card / Table and colour tokens:**
  - **Data:** it now reads the endpoint list where the server actually puts it
    (`data.endpoints.endpoints`). Before, the table, the chart and the summary never showed.
  - **Errors:** a failed load shows the red error box with Retry.
  - **Colours:** the green / yellow / red 100 / 500 ms colouring is gone, because it contradicted
    Capacity's per-kind judgement.
  - **Summary:** a row of four cards: Calls, Average response, Errors and a neutral Speed mix bar.
  - **Durations:** all of them have units.
- **Fixes:**
  - An empty band reads "Good —" in the ranges (pool timeouts).
  - Only the database speed's 95th percentile is coloured, not the "now" figure.

---

## Files

- New:
  - `components/system-admin/performance/bands.jsx` (band colours, range text, scale bar, legend)
  - `components/system-admin/performance/ReportsView.jsx` (BB-113)
- Changed:
  - `components/system-admin/performance/CapacityCards.jsx`
  - `components/system-admin/performance/HotspotsTable.jsx`
  - `components/system-admin/performance/CapacityView.jsx`
  - `components/system-admin/performance/CapacityCharts.jsx` (copy only)
  - `components/system-admin/performance/EndpointsView.jsx` (rebuilt)
  - `app/system-admin/performance/page.jsx` (Reports tab)
  - `lib/systemAdminFetch.js` (`systemAdminDownload`)
  - `docs/CLAUDE.md` (Performance entries)

## Server contract

The `GET /api/system-admin/capacity` fields this release reads are all new in server v2.11.1, and
all are optional:
- top level: `coverage`, `thresholds`, `plans.{web,db}`;
- on the server and database gauges: `band` per metric, `poolTimeoutsBand`, `cacheHitBand` and
  `provisional`;
- on each hotspot: `class`, `band` and `changeBand`.

BB-113 uses five new endpoints under `/api/system-admin/capacity/reports`:
- `GET /`: Baseline, current period and saved reports;
- `POST /baseline` with body `{ endsAt }`;
- `POST /current`;
- `POST /periods/:number`;
- `GET /:number/pdf`, where `0` is the Baseline.

**Deploy order:** server first, then client.

**Pre-existing server shape:** `GET /api/system-admin/performance` nests the endpoint list as
`data.endpoints.endpoints`. The Endpoints tab now reads both that shape and a flat array, so the
server can be flattened later without breaking the client.
