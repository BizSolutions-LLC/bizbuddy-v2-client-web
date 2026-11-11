# Server request — Payslip remark on recipient mark-paid

**From:** client (`bizbuddy-client-web`)  
**For:** `bizbuddy-v2-server` (`bizbuddy-server`)  
**Status:** Implemented in server tree (pending you run migration + deploy). Client flag `PAYSLIP_REMARK_PERSISTENCE_ENABLED` is now `true`.

## Why

Payroll admins enter an optional free-text remark when marking an **individual** employee paid in Disbursement. That remark must appear on the employee’s PDF payslip and survive regenerate/download.

## Contract

### `POST /api/disbursements/:id/recipients/:recipientId/mark-paid`

Multipart (unchanged + one field):

| Field | Required | Notes |
|---|---|---|
| `paymentMethod` | yes | existing |
| `proof` | yes | existing file |
| `remark` | no | plain text; stored as `DisbursementRecipient.payslipRemark` |

Batch-level `POST .../:id/mark-paid` does **not** accept a shared remark (per-employee only).

### Payslip PDF

`GET /api/payroll-system/generate-payslip-pdf/:payrollRunId/:employeeId` and  
`GET /api/payroll-system/my-payslip/:payrollRunId`  
load the latest paid recipient remark for that `payrollRunId` + `employeeId` and render a **REMARKS** block when present.

## Migration (you run)

`prisma/migrations/012_add_recipient_payslip_remark/migration.sql`

```sql
ALTER TABLE "DisbursementRecipient"
  ADD COLUMN IF NOT EXISTS "payslipRemark" TEXT;
```

Do **not** have the agent run migrate/db push.

## Client impact

- Sends `remark` on per-recipient mark-paid when persistence is enabled.
- Helper copy on Record Payment explains the remark is saved with payment / PDF.

## Related: payslip release gate (no ticket)

Employee **My Payslips** / mobile PDF only after Disbursement marks that employee **PAID**.
`PAYSLIP_GENERATED` notification fires on mark-paid, not on Process or admin PDF preview.
