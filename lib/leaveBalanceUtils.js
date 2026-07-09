// Shared parsing for GET /api/leave-balances/matrix rows.
//
// The endpoint's per-type cell shape changed (docs/CLIENT_LEAVE_CONTRACT.md, Phase 5):
//   before — a flat credits number per type, with a separate `usedBalances` map
//   after  — `{ credits, used, available }` per type, no `usedBalances` map
//
// This normalizes either shape into { credits, used, available } so callers never
// have to know which one the server actually sent.
export function normalizeLeaveBalanceCell(cell, legacyUsed) {
  if (cell && typeof cell === "object") {
    const credits = Number(cell.credits || 0);
    const used = Number(cell.used || 0);
    const available = cell.available != null ? Number(cell.available) : Math.max(credits - used, 0);
    return { credits, used, available };
  }
  const credits = Number(cell || 0);
  const used = Number(legacyUsed || 0);
  return { credits, used, available: Math.max(credits - used, 0) };
}

// Normalizes one matrix row (per the leave types list) into
// { ...row, balances: { [leaveType]: { credits, used, available } } }.
export function normalizeLeaveMatrixRow(row, types) {
  const balances = {};
  types.forEach((t) => {
    balances[t] = normalizeLeaveBalanceCell(row.balances?.[t], row.usedBalances?.[t]);
  });
  return { ...row, balances };
}
