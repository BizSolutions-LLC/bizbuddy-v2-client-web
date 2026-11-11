# PRD — Employee Sheet flexibility (quantity×rate earnings, run-level tax off, payslip remarks)

**Product:** BizBuddy v2 (client web)  
**Module:** Payroll → Employee Sheet, Disbursement (mark paid), Payslip PDF  
**Audience:** Payroll preparer / company admin  
**Ticket:** none  
**Status:** Client + server remark path implemented. Run server migration `012_add_recipient_payslip_remark` before relying on PDF remarks in an environment.  
**Primary scope:** Client UX and client-side computation against **existing** APIs where possible  
**Companion repo:** `bizbuddy-v2-server` — required only for items called out under **Server follow-up** (payslip remarks persistence/PDF; any gaps noted below)

---

## 1. Problem

Some companies (including BizSolutions LLC) pay sales agents by **calls × rate**, not by hourly/salary math alone. The Employee Sheet today is built around hourly and salary drivers, so call-based pay is awkward: preparers must pre-compute a dollar total and paste it into a fixed additional-earnings column.

Separately, preparers need a way to **turn off all tax withholdings and employer payroll taxes for an entire payroll run** without changing each employee’s permanent exempt flags on the Employees tab. Non-tax deductions (benefits, garnishments, etc.) must still apply.

Finally, when an admin marks an employee **paid** in Disbursement, they need to attach a **free-text remark** that appears on that employee’s **PDF payslip** and remains available if the PDF is regenerated later.

---

## 2. Goals

1. Let any company add **one sheet-only quantity × rate** additional-earnings column (e.g. named “Calls”), enter quantity and rate per employee, and have the computed amount flow into gross, Process, and the payroll report.
2. Provide a **whole-run toggle** that zeros employee statutory tax withholdings **and** employer taxes (FUTA / SUI / ETT) for that sheet/run only, without changing permanent employee tax-exempt settings, while leaving non-tax deduction columns active.
3. Let the admin who marks an employee paid in Disbursement enter a **per-employee remark** that is printed on the PDF payslip and survives later view/download/regenerate.

## 3. Non-goals (v1)

- No new employee **pay type** (no `per_call` / commission profile type). Hourly and salary remain the profile pay types.
- No CSV/API import of call counts — **manual entry only**.
- No hard-coded “Calls” feature — only a generic quantity×rate column type.
- No more than **one** quantity×rate column per sheet.
- No character limit and **no audit trail** for remarks.
- No change to employee self-service entry of calls.
- No mobile-specific work.
- Remarks are **not** entered on the Employee Sheet during prep (only at Disbursement mark-paid).

---

## 4. Users

| Role | Use |
|---|---|
| Payroll preparer / company admin | Builds the Employee Sheet, adds quantity×rate earnings, toggles taxes off for the run, processes payroll |
| Same admin (Disbursement) | Marks each employee paid and writes the payslip remark |

Applies to **any company**, not BizSolutions-only.

---

## 5. Current behavior (baseline)

### 5.1 Employee Sheet additional earnings

- **Add Earnings Column** already exists (sheet-only): `fixed` ($) or `percent` (% of base gross).
- Amounts go into `additionalEarningsBreakdown`, are included in gross before taxes, and are sent on save via `additionalEarningColumns` + per-employee breakdowns to `POST /api/payroll-system/save-payroll-run`.
- There is **no** quantity × rate calculation type today.

### 5.2 Pay types and hours

- Profile / sheet pay types in use: **hourly** and **salary**.
- Regular/OT (and related) hours still load and compute; that must continue for call-paid agents as well.

### 5.3 Taxes

- Taxes are computed client-side (`calculateTaxes`, FUTA/SUI/ETT helpers) and sent on save.
- Permanent per-employee exempt flags live on the Employees tab (`exemptFederal`, `exemptPit`, SS/Medicare/SDI, etc.).
- There is **no** whole-run “disable all taxes for this sheet” control.

### 5.4 Payslip remarks

- Disbursement mark-paid (batch or per recipient) currently sends **payment method + optional proof file** only (`lib/disbursementApi.js`).
- Payslip PDF generation has **no** remark/memo field in the client contract.
- **Not implemented today.**

---

## 6. Decisions (locked)

| # | Decision |
|---|---|
| D1 | No new pay type — use sheet **Add Earnings** with a **quantity × rate** value type. |
| D2 | At most **one** quantity×rate column per sheet; label is user-defined (e.g. “Calls”). |
| D3 | Per period: one quantity + one rate **per employee** on that column (not multiple call lines). |
| D4 | Quantity is **manual**; rate **prefills from the employee profile pay rate** (`payrollDetails.payRate` / equivalent shown as Pay Rate) and remains **editable on the sheet only** (edits do not write back to the employee profile). |
| D5 | Hourly/salary hours columns **still appear and compute**; quantity×rate pay is **additive** to that base. |
| D6 | Quantity×rate column is **sheet-only** (not a company earning-type setting) but its **amounts** must appear in the processed payroll report like other additional earnings. |
| D7 | **Tax off** = whole sheet/run, **this run only**; does not change Employees-tab exempt flags. |
| D8 | When tax off: zero **employee statutory withholdings** (federal, state, FICA, Medicare, SDI, CalSavers, additional withholding) **and** **employer taxes** (FUTA, SUI, ETT). **Non-tax deduction columns stay.** |
| D9 | Remarks: entered by the admin at **per-employee mark paid** in Disbursement; shown on **PDF payslip**; retained for later regenerate/download; no length cap; no audit requirement. |
| D10 | Client implements against existing save/report paths where they already accept computed amounts/columns. **Payslip remarks require server follow-up** (see §10). |

---

## 7. Functional requirements

### 7.1 Quantity × rate additional earning (Employee Sheet)

**FR-1.** In **Add Earnings Column**, add a third value type: **Quantity × rate**.

**FR-2.** A sheet may have **at most one** column with that type. Attempting to add a second is blocked with a clear message. Fixed and percent columns remain unrestricted relative to this rule (existing behavior unless already limited elsewhere).

**FR-3.** Creating the column asks for a **column name** only (plus the value type). Example placeholder: “Calls”.

**FR-4.** For each employee row, the column UI collects:

| Field | Behavior |
|---|---|
| Quantity | Manual number; default empty / 0 |
| Rate | Prefill from employee profile pay rate; editable on the sheet; sheet-only |
| Amount (display) | `round2(quantity × rate)`; read-only |

**FR-5.** Amount is **taxable additional pay**: added to gross the same way fixed/percent additional earnings are today (after base gross from hours/salary; before tax computation unless tax-off applies).

**FR-6.** Changing quantity or rate recomputes that employee’s amount, gross, taxes (unless tax-off), employer taxes, and net for the sheet.

**FR-7.** Removing the quantity×rate column clears its inputs and amounts from the sheet computation.

**FR-8.** On **Compute / Recompute / Process (save payroll run)**, the column definition is included in `additionalEarningColumns` (with `calculationType` representing quantity×rate) and each employee’s **computed amount** is included in `additionalEarningsBreakdown` / earnings breakdown consistently with existing custom columns, so the **payroll report** can show the earning line and amount via the existing report path.

**FR-9.** Client should store quantity and rate in sheet state for editing. If the existing save API does not round-trip quantity/rate (only amounts + column metadata), document that reopening a run may restore **amount/column** from the server but require **re-entry of qty/rate** unless/until a server follow-up stores them (see §10.2). **Amounts in the processed report remain the source of truth for pay.**

### 7.2 Whole-run tax off (Employee Sheet)

**FR-10.** Provide a clear control on the Employee Sheet (e.g. toggle): **Disable taxes for this run**.

**FR-11.** Default: off (normal tax computation).

**FR-12.** When **on**, for every employee on the sheet:

- Employee tax components display and compute as **$0** (federal, state, FICA, Medicare, SDI, CalSavers, additional federal/state withholding).
- Employer tax components on the sheet display and compute as **$0** (FUTA, SUI, ETT).
- Non-tax **deduction** columns continue to use entered/loaded values and affect net as today.

**FR-13.** Net pay when tax-off = gross − non-tax deductions (no employee tax subtraction; no employer tax amounts on the run).

**FR-14.** Toggle is **run/sheet scoped**. It does **not** patch employee profile exempt flags.

**FR-15.** Turning the toggle on/off recomputes all visible totals and per-row nets.

**FR-16.** On save/process, the payload’s tax and employer-tax fields must reflect **$0** when the toggle is on (including any path that today re-runs `calculateTaxes` at save time — that path must respect the toggle). Totals must match the sheet.

**FR-17.** UI copy should make clear this is **this payroll run only**.

### 7.3 Payslip remarks (Disbursement → PDF)

**FR-18.** On **per-employee** mark paid in Disbursement, show an optional **Remarks** multi-line text field (no max length enforced in product rules).

**FR-19.** Remark is stored with that employee’s payment / payslip context for that payroll run (server; see §10.1).

**FR-20.** PDF payslip for that employee includes the remark in a dedicated remarks/notes area.

**FR-21.** Later **view / download / regenerate** of the same payslip shows the **same** remark.

**FR-22.** No audit log UI or retention rules beyond “stored with the payment/payslip so it can be shown again.”

**FR-23.** Batch-level mark paid (all recipients) is out of scope for a single shared remark unless product later asks; v1 is **per employee** only. If the UI only exposes per-recipient mark paid for remarks, that is acceptable.

---

## 8. UX notes

- Reuse existing Add Earnings Column modal; extend the value-type select with **Quantity × rate**.
- Prefer showing quantity and rate as editable cells (or an inline pair) under the custom earning column rather than forcing preparers to calculate dollars offline.
- Prefill rate from profile pay rate even when that rate is “hourly” semantically — preparer may overwrite with the true per-call rate for the sheet.
- Tax-off control should be hard to miss near Compute / sheet totals; when on, tax and employer-tax columns should still be visible as **$0** (not silently removed), so the preparer can verify.
- Remark field appears in the existing mark-paid flow next to payment method / proof.

---

## 9. Acceptance criteria

### Quantity × rate

- [ ] Admin can add one quantity×rate column with a custom name on any company’s Employee Sheet.
- [ ] Second quantity×rate column is refused.
- [ ] Rate prefills from employee pay rate; quantity starts empty/zero; both editable on sheet only.
- [ ] Amount = quantity × rate (rounded consistently with existing money rounding) and increases gross.
- [ ] Hours/salary earnings still show and compute for the same employees.
- [ ] After process, payroll report shows the additional earning amount for that column.
- [ ] Profile pay rate is unchanged after sheet rate edits.

### Tax off

- [ ] Whole-sheet toggle zeros employee statutory taxes and FUTA/SUI/ETT for the run.
- [ ] Non-tax deductions still reduce net.
- [ ] Employees-tab exempt flags unchanged after the run.
- [ ] Saved/processed run totals match the zeroed tax state when the toggle was on.

### Payslip remarks

- [ ] Per-employee mark paid accepts a remark.
- [ ] PDF payslip shows that remark.
- [ ] Regenerated/downloaded PDF still shows it.
- [ ] *(Blocked on client-only until §10.1 ships.)*

---

## 10. Server follow-up (companion repo)

Client-only implementation can deliver sheet UX and computed amounts against today’s save payload for much of §7.1–§7.2. The following **cannot** be completed correctly without `bizbuddy-v2-server` work.

### 10.1 Payslip remarks (required for FR-18–FR-21)

**Needed (contract sketch for server owners):**

1. Accept an optional `remark` (or `payslipRemark`) string on per-recipient mark-paid  
   `POST /api/disbursements/:batchId/recipients/:recipientId/mark-paid`  
   (multipart today: add a text field alongside `paymentMethod` / `proof`).
2. Persist remark on the recipient / payment / payslip record for that run.
3. Include remark in payslip PDF generation payloads and rendered PDF.
4. Return remark on any read path used to regenerate the PDF so view/download stay consistent.

Until this ships: client may implement the remark **input UI**, but must not claim PDF persistence; or gate the field behind API support.

### 10.2 Optional persistence gaps (quantity×rate / tax-off flag)

Confirm with server whether today’s `save-payroll-run` already:

| Data | Likely today | Gap if missing |
|---|---|---|
| Custom column list + **amounts** in breakdowns | Yes (used today for fixed/percent) | — |
| New `calculationType` for quantity×rate | Unknown — may be stored opaquely | Report/payslip label still OK if amount + column name stored |
| Per-employee **quantity** and **rate** inputs | Likely **not** | Reopen sheet cannot restore qty/rate; amount still in report |
| Explicit **taxesDisabledForRun** flag | Likely **not** | Reopen may not show toggle state; **$0 tax amounts** in saved run may still be enough if server trusts client tax fields |

No new pay-type or employee-profile fields are required for v1.

---

## 11. Out of scope / future ideas (not committed)

- Multiple quantity×rate columns or multiple rate tiers per employee per period.
- Importing call counts.
- Writing sheet rate edits back to the employee profile.
- Company-wide default remark.
- Remark on email body or My Payslip HTML UI (PDF only in v1).
- Disabling only a subset of tax components from the run toggle.

---

## 12. Implementation notes (client)

Primary touchpoints (for later build; not part of this doc’s approval to code):

- `app/dashboard/employee/(E_Payroll)/payroll/EmployeeSheet.jsx` — Add Earnings modal, column UI, tax-off toggle, save payload respect toggle.
- `lib/payrollCompute.js` — `calculateAdditionalEarning` (or sibling) for quantity×rate; tax helpers short-circuit when run flag is on.
- Disbursement mark-paid UI + `lib/disbursementApi.js` — remark field once server accepts it.
- Payslip PDF path — display remark once server returns it.

Do **not** treat this PRD as approval to implement; follow the usual discuss → estimate → go-ahead workflow when build starts.

---

## 13. Open questions

None remaining from the product interview. Revisit only if server owners reject remark storage on mark-paid or refuse unknown `additionalEarningColumns.calculationType` values.
`}