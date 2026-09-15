export const PERIOD_AGGREGATE_ID = 'period-aggregate';

export function getQuarterRange(year, quarter) {
  const ranges = {
    1: { from: `${year}-01-01`, to: `${year}-03-31` },
    2: { from: `${year}-04-01`, to: `${year}-06-30` },
    3: { from: `${year}-07-01`, to: `${year}-09-30` },
    4: { from: `${year}-10-01`, to: `${year}-12-31` },
  };
  return ranges[quarter] ?? ranges[1];
}

export function getMonthRange(year, month) {
  const lastDay = new Date(year, month, 0).getDate();
  const mm = String(month).padStart(2, '0');
  return {
    from: `${year}-${mm}-01`,
    to: `${year}-${mm}-${String(lastDay).padStart(2, '0')}`,
  };
}

export function getYearRange(year, today = new Date()) {
  const isCurrentYear = year === today.getFullYear();
  return {
    from: `${year}-01-01`,
    to: isCurrentYear ? today.toLocaleDateString('en-CA') : `${year}-12-31`,
  };
}

export function getCurrentQuarter(today = new Date()) {
  return Math.floor(today.getMonth() / 3) + 1;
}

export function toDateKey(value) {
  if (!value) return null;
  return String(value).split('T')[0];
}

/** Include runs whose pay period overlaps the selected range (not just pay date). */
export function reportMatchesDateRange(report, rangeFrom, rangeTo) {
  const periodStart = toDateKey(report.periodStart);
  const periodEnd = toDateKey(report.periodEnd);
  const payDate = toDateKey(report.payDate);

  if (periodStart && periodEnd) {
    if (periodStart <= rangeTo && periodEnd >= rangeFrom) return true;
  }

  if (payDate && payDate >= rangeFrom && payDate <= rangeTo) return true;

  return false;
}

export function getYearsInRange(rangeFrom, rangeTo) {
  const startYear = parseInt(rangeFrom.split('-')[0], 10);
  const endYear = parseInt(rangeTo.split('-')[0], 10);
  const years = [];
  for (let year = startYear; year <= endYear; year += 1) {
    years.push(year);
  }
  return years;
}

export function buildAggregatedPeriodReport(reports, periodLabel, dateRange) {
  const employeeMap = new Map();

  reports.forEach((report) => {
    (report.employees || []).forEach((emp) => {
      const key = emp.employeeId || emp.employeeName;
      if (!key) return;

      const taxes = emp.totalTaxes ?? emp.taxes?.totalTaxes ?? (typeof emp.taxes === 'number' ? emp.taxes : 0);
      const existing = employeeMap.get(key);

      if (!existing) {
        employeeMap.set(key, {
          employeeId: emp.employeeId,
          employeeName: emp.employeeName,
          position: emp.position,
          payType: emp.payType,
          payrollDetails: emp.payrollDetails,
          earningRates: emp.earningRates || {},
          taxes: emp.taxes,
          checkNumbers: emp.checkNumber ? [emp.checkNumber] : [],
          grossPay: emp.grossPay || 0,
          totalTaxes: taxes,
          totalDeductions: emp.totalDeductions || 0,
          netPay: emp.netPay || 0,
          paycheckCount: 1,
        });
        return;
      }

      existing.grossPay += emp.grossPay || 0;
      existing.totalTaxes += taxes;
      existing.totalDeductions += emp.totalDeductions || 0;
      existing.netPay += emp.netPay || 0;
      existing.paycheckCount += 1;
      if (emp.checkNumber) existing.checkNumbers.push(emp.checkNumber);
    });
  });

  const employees = Array.from(employeeMap.values()).map((emp) => ({
    ...emp,
    checkNumber:
      emp.checkNumbers.length > 1
        ? `${emp.checkNumbers.length} checks`
        : emp.checkNumbers[0] || '—',
  }));

  const totals = employees.reduce(
    (acc, emp) => {
      acc.gross += emp.grossPay || 0;
      acc.taxes += emp.totalTaxes || 0;
      acc.deductions += emp.totalDeductions || 0;
      acc.net += emp.netPay || 0;
      return acc;
    },
    { gross: 0, taxes: 0, deductions: 0, net: 0 }
  );

  return {
    id: PERIOD_AGGREGATE_ID,
    isPeriodAggregate: true,
    periodLabel,
    periodStart: dateRange.from,
    periodEnd: dateRange.to,
    payDate: null,
    employeeCount: employees.length,
    employees,
    totalGross: totals.gross,
    totalTaxes: totals.taxes,
    totalDeductions: totals.deductions,
    totalNet: totals.net,
    runsIncluded: reports.length,
    isMock: reports.some((r) => r.isMock),
  };
}

export function usesPeriodAggregateView(periodMode) {
  return periodMode !== 'custom';
}
