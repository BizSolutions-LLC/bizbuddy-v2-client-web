# TODO — Employee Sheet update (quantity×rate, tax-off run, payslip remarks)

**Source PRD:** [`docs/requirements_emp_sheet_update.md`](./requirements_emp_sheet_update.md)  
**Repo:** `bizbuddy-client-web` (existing Next.js app — phases adapt “greenfield init” to a **safe feature baseline** on this codebase)  
**Companion:** `bizbuddy-v2-server` only where marked **SERVER**  
**Build status (2026-11-10):** Phases 1–11 client done. Phase 10 server remark/PDF landed in `bizbuddy-server` (migration `012` not run by agent). `PAYSLIP_REMARK_PERSISTENCE_ENABLED = true`. Manual acceptance still on you.

**Manual test convention (this repo):** Prefer written checklists + `npm test` for pure helpers. Do not assume a browser E2E harness exists. Never commit secrets; never log `Authorization` headers or `.env` values.

---

## Phase 1 — Project initialization, environment check, Hello World baseline

**Goal:** Confirm the workspace is ready and land a tiny, import-safe module so later phases have a home. App remains deployable (no payroll behavior change yet).

### 1.1 Confirm workspace and docs

- [ ] Confirm you are on the client repo root and the PRD exists at `docs/requirements_emp_sheet_update.md`.
- [ ] Create a local feature branch (name example: `feat/emp-sheet-qty-rate-tax-off`). Do **not** `git push` unless you intentionally choose to (this repo may auto-deploy).
- [ ] Confirm Node/npm work: `node -v`, `npm -v`.
- [ ] Confirm `.env` has the usual `NEXT_PUBLIC_*` keys **without reading or pasting their values into chat/docs/commits**.
- [ ] **Security:** Never commit `.env`. Never print token values from `localStorage` while debugging.

### 1.2 Hello World compute baseline module

- [ ] Create `lib/employeeSheetExtensions.js` as the dedicated home for new pure helpers (keeps `payrollCompute.js` changes smaller later).

```js
// lib/employeeSheetExtensions.js
/** Calculation type string for sheet-only quantity × rate columns (PRD D1). */
export const QTY_RATE_CALC_TYPE = "quantity_rate";

/** Empty employee tax object — used later when "Disable taxes for this run" is on. */
export function emptyEmployeeTaxes() {
  return {
    fica: 0,
    medicare: 0,
    sdi: 0,
    federalTax: 0,
    stateTax: 0,
    calSavers: 0,
    additionalFed: 0,
    additionalState: 0,
    totalTaxes: 0,
  };
}

/** Hello World marker — delete or keep as a version comment once real helpers land. */
export const EMP_SHEET_EXTENSIONS_BASELINE = "emp-sheet-extensions:v0";
```

- `QTY_RATE_CALC_TYPE` — one shared string so UI and compute never drift (`"quantity_rate"` vs `"qty_rate"`).
- `emptyEmployeeTaxes` — returns the same keys `calculateTaxes` uses, all `0`, for the tax-off path.
- `EMP_SHEET_EXTENSIONS_BASELINE` — proves the module loads; optional to remove after Phase 3.

### 1.3 Hello World unit test (existing test runner)

- [ ] Add `lib/employeeSheetExtensions.test.js` and register it in `package.json` `"test"` script next to the existing files.

```js
// lib/employeeSheetExtensions.test.js
import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  EMP_SHEET_EXTENSIONS_BASELINE,
  QTY_RATE_CALC_TYPE,
  emptyEmployeeTaxes,
} from "./employeeSheetExtensions.js";

describe("employeeSheetExtensions baseline", () => {
  it("exports the quantity_rate type constant", () => {
    assert.equal(QTY_RATE_CALC_TYPE, "quantity_rate");
  });

  it("emptyEmployeeTaxes totals to zero", () => {
    const t = emptyEmployeeTaxes();
    assert.equal(t.totalTaxes, 0);
    assert.equal(t.federalTax, 0);
  });

  it("baseline marker is present", () => {
    assert.match(EMP_SHEET_EXTENSIONS_BASELINE, /^emp-sheet-extensions:/);
  });
});
```

- Uses Node’s built-in test runner (same pattern as `lib/exportPayrollSummary.test.js`).
- Asserts the constant and empty-tax shape early so later refactors break tests loudly.

```json
// package.json — "scripts.test" (append the new file; keep existing ones)
"test": "node --experimental-default-type=module --test lib/payrollReportPeriod.test.js lib/exportPayrollSummary.test.js lib/employeeSheetExtensions.test.js"
```

- [ ] Run `npm test` and confirm all tests pass.
- [ ] **Checkpoint — Phase 1 deployable:** Dev server still starts; payroll pages unchanged; new module unused by UI yet; tests green.

---

## Phase 2 — UI skeleton with mocked data (no real compute / no API changes)

**Goal:** Visible, behind-the-scenes-safe UI placeholders so you can click through the shape of the feature with fake numbers. No save-payload changes yet.

### 2.1 Mock fixtures

- [ ] Add `lib/mockEmployeeSheetExtensions.js` for Story/dev-only mock rows (do not wire into production save).

```js
// lib/mockEmployeeSheetExtensions.js
import { QTY_RATE_CALC_TYPE } from "./employeeSheetExtensions.js";

/** Fake sheet column — mirrors additionalEarningColumns shape. */
export const MOCK_QTY_RATE_COLUMN = {
  id: "mock-qty-rate-1",
  label: "Calls",
  calculationType: QTY_RATE_CALC_TYPE,
};

/** Fake per-employee inputs for UI sketching. */
export const MOCK_QTY_RATE_INPUTS = {
  // employeeId -> { quantity, rate }
  "emp-ada": { quantity: "120", rate: "2.50" },
  "emp-alan": { quantity: "80", rate: "3.00" },
};
```

- Column shape matches what `EmployeeSheet` already stores for custom earnings.
- Inputs are strings like real `<input>` values (sheet code often parses later).

### 2.2 Add Earnings modal — show the new option (UI only)

- [ ] In `EmployeeSheet.jsx`, extend the Add Earnings value-type `<select>` with **Quantity × rate**.
- [ ] For Phase 2 only: selecting it may add a **mock** column in local state **or** show a toast “Preview only” — prefer adding to `customEarningColumns` with `calculationType: QTY_RATE_CALC_TYPE` but **do not** change amount math yet (treat like fixed `0` until Phase 5).

```jsx
{/* inside Add Earnings Column modal <select> */}
<option value="fixed">Fixed amount ($)</option>
<option value="percent">Percentage of base gross (%)</option>
<option value="quantity_rate">Quantity × rate</option>
```

- Third option is the only new UI string for FR-1.
- Keep `newCustomEarning.calculationType` state able to hold `"quantity_rate"`.

### 2.3 Tax-off toggle — visual only

- [ ] Near Compute / sheet totals in `EmployeeSheet.jsx`, add a checkbox/switch labeled **Disable taxes for this run** with helper text: “This payroll run only. Does not change employee tax-exempt settings.”
- [ ] Store `taxesDisabledForRun` in component state; default `false`.
- [ ] Phase 2: toggling only changes label/badge styling (e.g. “Taxes: OFF”) — **do not** alter `calculateTaxes` or save payload yet.

```jsx
<label className="flex items-center gap-2 text-sm text-gray-700">
  <input
    type="checkbox"
    checked={taxesDisabledForRun}
    onChange={(e) => setTaxesDisabledForRun(e.target.checked)}
  />
  Disable taxes for this run
</label>
<p className="text-xs text-gray-500">
  This payroll run only. Employee exempt flags on the Employees tab are unchanged.
</p>
```

- Checkbox is whole-sheet (PRD D7).
- Copy reduces the risk of admins thinking profile exempts were edited (**security/compliance clarity**).

### 2.4 Disbursement remark field — UI only (per employee)

- [ ] In `RecordPayment.jsx`, when `recipient` is set (per-employee mark paid), add a **Remarks** `<textarea>`.
- [ ] Keep remark in local React state only. **Do not** append to `FormData` yet (server does not accept it — PRD §10.1).
- [ ] Show a muted note: “Payslip PDF persistence requires a server update — remark is not saved yet.”

```jsx
{recipient && (
  <div className="space-y-2">
    <label className="text-sm font-medium">Remarks (optional)</label>
    <textarea
      value={remark}
      onChange={(e) => setRemark(e.target.value)}
      className="w-full min-h-[96px] rounded-md border px-3 py-2 text-sm"
      placeholder="Shown on this employee’s PDF payslip once server support ships"
    />
    <p className="text-xs text-muted-foreground">
      Not saved to the server yet. Do not rely on this field for production payslips.
    </p>
  </div>
)}
```

- Gate on `recipient` so batch mark-paid stays out of scope (FR-23).
- Honest copy avoids shipping a fake “saved” experience (**security/trust**).

### 2.5 Checkpoint — Phase 2

- [ ] Manual: open Employee Sheet → see tax toggle; open Add Earnings → see Quantity × rate.
- [ ] Manual: open Disbursement → Record payment for one recipient → see Remarks + “not saved” note.
- [ ] Confirm Process/save still behaves exactly as before (no new payload fields required yet).
- [ ] **Deployable:** UI-only; no API contract break; existing mark-paid still works.

---

## Phase 3 — Pure computation helpers + automated tests

**Goal:** Correct money math in isolation before wiring the sheet. Deployable: tests only + unused exports until Phase 4–5 import them.

### 3.1 Quantity × rate amount helper

- [ ] Implement in `lib/employeeSheetExtensions.js` (reuse `parseDecimal` / `round2` from `payrollCompute.js`).

```js
import { parseDecimal, round2 } from "./payrollCompute.js";
import { QTY_RATE_CALC_TYPE } from "./employeeSheetExtensions.js"; // if split later, adjust

/** amount = round2(quantity × rate). Empty/invalid → 0. */
export function calculateQuantityRateAmount(quantityInput, rateInput) {
  const quantity = parseDecimal(quantityInput);
  const rate = parseDecimal(rateInput);
  if (!quantity || !rate) return 0;
  return round2(quantity * rate);
}
```

- `parseDecimal` already strips commas and guards `NaN`.
- Returning `0` for missing qty keeps gross stable until the preparer types calls.

### 3.2 Extend `calculateAdditionalEarning` (or wrap it)

- [ ] Prefer a wrapper used by the sheet so fixed/percent stay untouched:

```js
export function calculateSheetAdditionalEarning(column, inputValue, baseGross, qtyRateInput) {
  if (column?.calculationType === QTY_RATE_CALC_TYPE) {
    return calculateQuantityRateAmount(qtyRateInput?.quantity, qtyRateInput?.rate);
  }
  // existing path
  return calculateAdditionalEarning(column, inputValue, baseGross);
}
```

- Qty/rate needs **two** inputs; fixed/percent keep a single `inputValue`.
- Avoids overloading one string field with JSON (clearer and safer).

### 3.3 Tax-off helpers

- [ ] Add helpers that return zeroed employee taxes and zero employer tax amounts without mutating employee profiles.

```js
export function taxesForSheetRun({ employee, grossPay, taxRates, payFrequency, taxesDisabledForRun }) {
  if (taxesDisabledForRun) return emptyEmployeeTaxes();
  return calculateTaxes(employee, grossPay, taxRates, payFrequency);
}

export function employerTaxesForSheetRun({ taxesDisabledForRun, futaAmount, suiAmount, ettAmount }) {
  if (taxesDisabledForRun) return { futaAmount: 0, suiAmount: 0, ettAmount: 0 };
  return { futaAmount, suiAmount, ettAmount };
}
```

- **Security:** These helpers must **never** write `payrollDetails.exempt*` flags — run-scoped only (D7/D8).

### 3.4 Single quantity×rate column guard (pure)

```js
export function sheetHasQuantityRateColumn(columns = []) {
  return columns.some((col) => col.calculationType === QTY_RATE_CALC_TYPE);
}

export function canAddQuantityRateColumn(columns = []) {
  return !sheetHasQuantityRateColumn(columns);
}
```

### 3.5 Rate prefill helper (read-only from profile)

```js
/** Prefill sheet rate from profile pay rate. Does not write back to the employee. */
export function prefillQtyRateFromEmployee(employeeLike) {
  const payRate = employeeLike?.payrollDetails?.payRate ?? employeeLike?.payRate ?? "";
  return { quantity: "", rate: payRate === null || payRate === undefined ? "" : String(payRate) };
}
```

- **Security:** Callers must copy into **sheet state** only — never `PATCH` employee payroll details when the rate cell changes.

### 3.6 Testing checkpoint

- [ ] Expand `lib/employeeSheetExtensions.test.js`:

  - `120 × 2.5 = 300.00`
  - `0 × 2.5 = 0`
  - `"" × 3 = 0`
  - `canAddQuantityRateColumn` false when one exists
  - `taxesForSheetRun` with `taxesDisabledForRun: true` → `totalTaxes === 0`
  - `taxesForSheetRun` with `false` still returns positive taxes for a non-exempt mock employee (smoke)
  - `prefillQtyRateFromEmployee` reads payRate and does not mutate the input object (`assert.deepEqual` clone check)

- [ ] Run `npm test`.
- [ ] **Deployable:** no UI dependency required; production bundle unchanged if nothing imports new helpers yet (or tree-shaken / unused).

---

## Phase 4 — Add Earnings: real column create + one-column rule

**Goal:** Creating a quantity×rate column works for real; second attempt blocked.

### 4.1 Wire modal submit

- [ ] In `handleAddCustomEarningColumn` (`EmployeeSheet.jsx`):

  - If `calculationType === QTY_RATE_CALC_TYPE` and `canAddQuantityRateColumn(customEarningColumns)` is false → `toast.error(...)` and return.
  - Otherwise push column `{ id, label, calculationType }` as today.

```js
if (
  newCustomEarning.calculationType === QTY_RATE_CALC_TYPE &&
  !canAddQuantityRateColumn(customEarningColumns)
) {
  toast.error("Only one Quantity × rate column is allowed on this sheet.");
  return;
}
```

### 4.2 Initialize per-row qty/rate state when column is added

- [ ] Add state map, e.g. `qtyRateInputsByEmployee: { [employeeId]: { quantity, rate } }`.
- [ ] On column add, for each current row call `prefillQtyRateFromEmployee(row)` and store results.
- [ ] On column remove, clear that map and breakdown keys (FR-7).

### 4.3 Checkpoint

- [ ] Manual: add “Calls” as quantity×rate once; second add shows error.
- [ ] Manual: add fixed/percent columns still works alongside one qty×rate column.
- [ ] **Deployable:** column metadata can already flow in `additionalEarningColumns` on save (amounts may still be 0 until Phase 5).

---

## Phase 5 — Sheet cells: enter quantity & rate, recompute gross

**Goal:** Live amount = qty × rate; additive to hours/salary base; profile rate unchanged.

### 5.1 Render editable qty + rate + read-only amount

- [ ] Where custom earning cells render in `EmployeeSheet.jsx`, branch on `col.calculationType === QTY_RATE_CALC_TYPE`:
  - Two small inputs (qty, rate)
  - Display `formatCurrency(calculateQuantityRateAmount(...))`

### 5.2 Hook into existing recompute path

- [ ] Update the function that builds `additionalEarningsBreakdown` (today loops `customEarningColumns` + `calculateAdditionalEarning`) to use `calculateSheetAdditionalEarning` and pass `qtyRateInputsByEmployee[row.id]`.
- [ ] Ensure changing qty/rate triggers the same recompute path as other earning edits (FR-6).
- [ ] Confirm hours columns still load/compute (D5) — no early `return` that skips hourly math for these rows.

### 5.3 Security / data integrity checks

- [ ] Verify rate edits update **only** `qtyRateInputsByEmployee` — grep for accidental writes to `row.payrollDetails.payRate`.
- [ ] **Security:** Do not persist sheet rate into employee profile APIs.

### 5.4 Testing checkpoint (manual)

- [ ] Employee pay rate `$10`; prefill shows `10`; set qty `5` → amount `$50.00`; gross increases by 50 vs baseline without the column.
- [ ] Change profile is **not** requested; refresh employee record elsewhere still shows original pay rate.
- [ ] Salary/hourly hours lines still non-zero when punches/salary compute as before.
- [ ] **Deployable:** Client-only math; save still sends amounts once Phase 6 confirms breakdown inclusion (may already if shared recompute feeds save).

---

## Phase 6 — Process / save / report reflection (existing APIs)

**Goal:** Quantity×rate **amounts** and column definitions survive `save-payroll-run` and appear like other additional earnings on the processed report.

### 6.1 Save payload audit

- [ ] In `savePayrollFromSheet`, confirm:
  - `additionalEarningColumns` includes the qty×rate column (`calculationType: "quantity_rate"`).
  - Each employee `additionalEarningsBreakdown[columnId]` is the **computed amount** (not raw qty).
  - `earningsBreakdown` stays consistent with existing custom columns.

```js
// Conceptual — keep existing map; ensure qty×rate amounts already sit on the row:
additionalEarningsBreakdown: row.additionalEarningsBreakdown || {},
// ...
additionalEarningColumns: customEarningColumns,
```

- Server may ignore unknown `calculationType` but should still store label + amount if it already does for fixed/percent (PRD §10.2).

### 6.2 Do **not** send profile mutations

- [ ] **Security:** Save body must not include a “update employee payRate” side effect from sheet rate cells.

### 6.3 Reopen / round-trip expectations (document in UI if needed)

- [ ] If reopening a run restores column + amounts but not qty/rate inputs, show a short note under the column: “Quantity and rate are sheet-entry fields; re-enter them if you need to edit. Saved amount remains on the report.”
- [ ] Optional: if amount exists and inputs empty, leave amount from server as display-only until edited (product choice — prefer requiring re-entry before edit to avoid silent drift).

### 6.4 Testing checkpoint

- [ ] Manual: Process a run with Calls `100 × 2 = 200`; open processed payroll report; confirm **Calls / $200** (or column label) appears.
- [ ] Manual: Confirm hours/salary lines still present for the same employee.
- [ ] **Deployable:** Uses existing `POST /api/payroll-system/save-payroll-run` only — no new endpoints.

---

## Phase 7 — Wire “Disable taxes for this run” into compute + save

**Goal:** Toggle zeros employee statutory taxes and FUTA/SUI/ETT on the sheet and in the saved payload; deductions remain.

### 7.1 Sheet compute path

- [ ] Replace direct `calculateTaxes(...)` usages **in EmployeeSheet recompute** with `taxesForSheetRun({ ..., taxesDisabledForRun })`.
- [ ] When building FUTA/SUI/ETT row fields, pass through `employerTaxesForSheetRun`.
- [ ] Keep tax **columns visible** at `$0` when off (PRD §8) — do not hide columns.
- [ ] Net = gross − non-tax deductions when taxes disabled (FR-13).

### 7.2 Critical: save path must respect the toggle

- [ ] Today `savePayrollFromSheet` re-calls `calculateTaxes` while building the payload. **Change that** so tax-off runs send zeros:

```js
const taxes = taxesForSheetRun({
  employee,
  grossPay: row.grossPay,
  taxRates,
  payFrequency: companyConfig?.payFrequency,
  taxesDisabledForRun,
});
// suiDeduction / ettDeduction / futa: use 0 when taxesDisabledForRun
```

- Without this, the UI can show `$0` while Process persists real taxes — **payroll integrity bug**.

### 7.3 Do not touch employee exempt flags

- [ ] **Security / compliance:** Grep the toggle handler — zero writes to `exemptFederal`, `exemptPit`, `exemptSocialSecurity`, `exemptMedicare`, `exemptSdi`, `skipFicaMedicare`.
- [ ] Helper text remains visible when checked.

### 7.4 Testing checkpoint

- [ ] Manual: compute with taxes on; note federal/FICA/FUTA; enable toggle; all those show `$0`; deduction column (e.g. benefit) still subtracts; net updates.
- [ ] Manual: Process with toggle on; reopen/report shows `$0` taxes / employer taxes matching the sheet.
- [ ] Manual: Employees tab exempt flags unchanged for a test employee.
- [ ] Extend unit tests for save-oriented pure helpers if you extract payload tax picking into a testable function.
- [ ] **Deployable:** Still existing save API; client sends zeroed tax fields the API already accepts.

---

## Phase 8 — Employee Sheet hardening & regression pass

**Goal:** Stabilize FR-1–FR-17 before remarks work. Potentially shippable client slice for BizSolutions call pay + tax-off.

### 8.1 Regression checklist (manual)

- [ ] Hourly employee, no qty×rate: unchanged vs pre-feature behavior.
- [ ] Salary employee: salary flat still computes; qty×rate additive.
- [ ] Fixed + percent custom earnings still work with qty×rate present.
- [ ] Remove qty×rate column: amounts clear; gross drops accordingly.
- [ ] Tax-off off → on → off: numbers restore to normal computation.
- [ ] Negative net warning (if any) still makes sense with deductions-only.

### 8.2 Security pass

- [ ] Confirm admin-only routes still gate Employee Sheet / Disbursement (no new public routes).
- [ ] Confirm no secrets in new toasts or error strings.
- [ ] Confirm remark placeholder copy does not claim server save (until Phase 10).

### 8.3 Checkpoint

- [ ] `npm test` green.
- [ ] **Deployable slice:** quantity×rate + tax-off usable in production against current APIs; remarks still UI-only.

---

## Phase 9 — Payslip remarks UI complete (client), still gated for persistence

**Goal:** Finish per-employee mark-paid UX; keep persistence behind an explicit flag until SERVER lands.

### 9.1 Feature flag

- [ ] Add a client constant (not a secret):

```js
// lib/employeeSheetExtensions.js (or lib/payslipRemark.js)
/** Flip to true only after server accepts remark on mark-paid + PDF. */
export const PAYSLIP_REMARK_PERSISTENCE_ENABLED = false;
```

### 9.2 `disbursementApi.js` signature ready

- [ ] Extend `markRecipientPaymentSent` to accept optional `remark`:

```js
export async function markRecipientPaymentSent(
  apiUrl,
  token,
  batchId,
  recipientId,
  { paymentMethod, file, remark }
) {
  const form = new FormData();
  form.append("paymentMethod", paymentMethod);
  if (file) form.append("proof", file);
  // Only send when enabled — avoids surprising older servers with unknown fields if needed
  if (PAYSLIP_REMARK_PERSISTENCE_ENABLED && remark != null && String(remark).length > 0) {
    form.append("remark", String(remark));
  }
  // ... existing fetch
}
```

- **Security:** Still uses Bearer token header only; do not put tokens in FormData.
- **Security:** Treat remark as plain text; if any client preview renders it, use text content — **not** `dangerouslySetInnerHTML`.

### 9.3 Wire `RecordPayment.jsx`

- [ ] Pass `remark` only for per-recipient submit.
- [ ] If persistence disabled, keep the warning note; optionally clear remark after navigate.
- [ ] Batch mark-paid: no remark field (FR-23).

### 9.4 Checkpoint

- [ ] Manual: per-employee flow shows textarea; with flag `false`, network FormData has **no** remark (verify in DevTools).
- [ ] **Deployable:** Safe with current server; no hard dependency on §10.1 yet.

---

## Phase 10 — SERVER follow-up + client enablement (remarks PDF)

**Goal:** End-to-end remarks. Work in `bizbuddy-v2-server` first, then flip the client flag.

### 10.1 SERVER — contract (companion repo)

- [ ] **SERVER:** Accept optional `remark` on  
  `POST /api/disbursements/:batchId/recipients/:recipientId/mark-paid` (multipart field).
- [ ] **SERVER:** Persist on recipient/payment/payslip record for that run.
- [ ] **SERVER:** Include remark in PDF generation + any regenerate read path.
- [ ] **SERVER:** Confirm authz unchanged (only users who can mark paid).
- [ ] **SERVER:** Store as plain text; escape when embedding in PDF (**XSS/injection** in PDF text engines).

### 10.2 Optional SERVER — persistence gaps

- [ ] **SERVER (optional):** Persist qty + rate inputs and/or `taxesDisabledForRun` if product wants perfect sheet reopen (PRD §10.2). Not required if amounts + zero taxes already save.

### 10.3 Client enable

- [ ] Set `PAYSLIP_REMARK_PERSISTENCE_ENABLED = true`.
- [ ] Remove or soften the “not saved yet” helper copy.
- [ ] If payslip client receives remark JSON for non-PDF UI later, still render as text.

### 10.4 Testing checkpoint

- [ ] Manual: mark employee paid with remark `"Q4 spiff — thank you"` → download PDF → remark visible.
- [ ] Manual: view/download again later → same remark (FR-21).
- [ ] Manual: employee without remark → PDF has empty/omitted remarks area (no garbage).
- [ ] **Deployable:** Requires coordinated server release **before** or **with** flipping the client flag.

---

## Phase 11 — Final acceptance, cleanup, handoff

**Goal:** PRD §9 acceptance criteria signed off; dead mock code removed; docs updated.

### 11.1 Acceptance mapping

- [ ] Quantity × rate: all PRD §9 checkboxes for that section.
- [ ] Tax off: all PRD §9 checkboxes for that section.
- [ ] Payslip remarks: all PRD §9 checkboxes (after Phase 10).

### 11.2 Cleanup

- [ ] Remove `EMP_SHEET_EXTENSIONS_BASELINE` if desired.
- [ ] Remove or stop importing `lib/mockEmployeeSheetExtensions.js` from production paths.
- [ ] Delete obsolete Phase 2 “preview only” toasts if any remain.

### 11.3 Docs

- [ ] Update `docs/requirements_emp_sheet_update.md` status to Implemented (client) / Partially blocked as accurate.
- [ ] If server remarks shipped, add a short changelog note when you cut a version (follow existing `docs/changelog-v*.md` style).

### 11.4 Final security review

- [ ] Sheet rate never PATCHes employee pay rate.
- [ ] Tax-off never PATCHes exempt flags.
- [ ] Remark plain-text only; flag gated until server ready.
- [ ] No tokens/secrets in logs, commits, or PRD/TODO samples.

### 11.5 Checkpoint — project complete for v1

- [ ] `npm test` green.
- [ ] Manual payroll happy path on a non-prod company.
- [ ] **Deployable:** Client + (for remarks) server versions agreed; feature usable by any company admin.

---

## Suggested build order (one sitting each)

| Session | Phase | Outcome |
|---|---|---|
| 1 | Phase 1 | Baseline module + test |
| 2 | Phase 2 | Visible skeleton |
| 3 | Phase 3 | Pure math + tests |
| 4 | Phases 4–5 | Qty×rate UX live |
| 5 | Phase 6 | Report amounts |
| 6 | Phase 7–8 | Tax-off + regression |
| 7 | Phase 9 | Remark UI gated |
| 8 | Phase 10 | Server + enable PDF |
| 9 | Phase 11 | Acceptance + cleanup |

---

## Out of scope reminders (do not add to phases)

- New employee pay types  
- CSV import of calls  
- Multiple quantity×rate columns  
- Writing sheet rate back to profile  
- Remark on email / My Payslip HTML (PDF only)  
- Batch-level shared remark  
- `git push` / production deploy from the agent — you push when ready  
`}