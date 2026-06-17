# Changelog — v2.14.0

BizChat CSS isolation fix + mobile date picker responsiveness in Overview.

---

## Change 1 — BizChat Auth Route Isolation

**Status:** Fully shipped.

**Files:**
- `components/Home/BizChatLoader.jsx`
- `app/layout.jsx`
- `app/globals.css`

---

### Background

The BizChat third-party widget injects a global CSS rule (`button { width: 100% }`) approximately 2 seconds after page load. On auth pages (`/sign-in`, `/sign-up`, `/reset-password`, `/payment`), this caused all `<button>` elements to snap to full width — breaking layout on form submissions and other interactive controls.

Previously, `BizChatLoader` rendered the widget unconditionally on all routes via `app/layout.jsx`.

---

### Client Changes

**`components/Home/BizChatLoader.jsx`:**

- Added `usePathname()` hook to read the current route.
- Defined `AUTH_ROUTES = ['/sign-in', '/sign-up', '/reset-password', '/payment']`.
- `useEffect` that mounts the BizChat script now bails early with `return` if `pathname` starts with any auth route.
- The cleanup function (removing the widget on unmount) only runs when the widget was actually mounted — no-op on auth pages.

**`app/globals.css`:**

- Added `button { -webkit-appearance: none; appearance: none; }` reset to prevent WebKit from applying its default button styles, which were compounding the third-party injection.

**`app/layout.jsx`:**

- No logic changes. `BizChatLoader` is still rendered at the root layout level — the guard is inside the component itself.

---

## Change 2 — Overview Date Picker Mobile Responsiveness

**Status:** Fully shipped.

**Pages:** `/dashboard/employee/overview`, `/dashboard/company/overview`, `/dashboard/superadmin/overview`

**Files:**
- `components/Dashboard/DashboardContent/EmployeePanel/Overview/OverviewEmployee.jsx`
- `components/Dashboard/DashboardContent/EmployeePanel/Overview/OverviewAdmin.jsx`
- `components/Dashboard/DashboardContent/EmployeePanel/Overview/OverviewSuperadmin.jsx`

---

### Background

The date range picker popover in Overview was rendering at full unconstrained width on mobile, causing layout overflow. The "Quick Select" shortcut panel (Last 7 days, This month, etc.) and the two-month calendar side-by-side view were also too wide to fit on small screens.

---

### Client Changes (all three Overview files — same pattern)

**`PopoverContent`:**
- Added `className="max-w-[320px]"` to constrain the popover to 320px on mobile.

**Calendar:**
- `numberOfMonths` changed from `2` to `1` — single-month view on all screens (reduces width significantly).

**Quick Select panel:**
- Wrapped in `<div className="hidden sm:block">` — hidden on mobile, visible on desktop (`sm:` and above).

---

## Files Changed

| File | Changes |
|---|---|
| `components/Home/BizChatLoader.jsx` | Auth route guard; skip BizChat script on `/sign-in`, `/sign-up`, `/reset-password`, `/payment` |
| `app/layout.jsx` | No logic change |
| `app/globals.css` | `appearance: none` reset on `button` elements |
| `components/Dashboard/DashboardContent/EmployeePanel/Overview/OverviewEmployee.jsx` | PopoverContent max-w-320px, 1-month calendar, Quick Select hidden on mobile |
| `components/Dashboard/DashboardContent/EmployeePanel/Overview/OverviewAdmin.jsx` | Same as OverviewEmployee |
| `components/Dashboard/DashboardContent/EmployeePanel/Overview/OverviewSuperadmin.jsx` | Same as OverviewEmployee |
