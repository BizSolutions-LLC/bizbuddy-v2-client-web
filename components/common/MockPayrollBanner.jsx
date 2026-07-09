"use client";

import { isMockPayrollEnabled } from "@/lib/mockPayrollData";

export default function MockPayrollBanner({ showingMock }) {
  if (!isMockPayrollEnabled() || !showingMock) return null;

  return (
    <div className="mb-4 rounded-lg border border-amber-300 bg-amber-50 px-4 py-3 text-sm text-amber-900">
      <span className="font-semibold">Demo data</span>
      {" — "}
      Sample payroll records for UI preview. Set{" "}
      <code className="rounded bg-amber-100 px-1">NEXT_PUBLIC_MOCK_PAYROLL=false</code>{" "}
      or save real payroll to hide this.
    </div>
  );
}
