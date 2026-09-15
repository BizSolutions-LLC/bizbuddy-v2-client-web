import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import {
  PERIOD_AGGREGATE_ID,
  buildAggregatedPeriodReport,
  getMonthRange,
  getQuarterRange,
  getYearRange,
  getYearsInRange,
  reportMatchesDateRange,
  usesPeriodAggregateView,
} from './payrollReportPeriod.js';

describe('getQuarterRange', () => {
  it('returns calendar quarters including Q3 2026', () => {
    assert.deepEqual(getQuarterRange(2026, 1), { from: '2026-01-01', to: '2026-03-31' });
    assert.deepEqual(getQuarterRange(2026, 2), { from: '2026-04-01', to: '2026-06-30' });
    assert.deepEqual(getQuarterRange(2026, 3), { from: '2026-07-01', to: '2026-09-30' });
    assert.deepEqual(getQuarterRange(2026, 4), { from: '2026-10-01', to: '2026-12-31' });
  });

  it('falls back to Q1 for an unknown quarter', () => {
    assert.deepEqual(getQuarterRange(2026, 9), { from: '2026-01-01', to: '2026-03-31' });
  });
});

describe('getMonthRange', () => {
  it('uses the last day of the month, including Feb in a leap year', () => {
    assert.deepEqual(getMonthRange(2026, 9), { from: '2026-09-01', to: '2026-09-30' });
    assert.deepEqual(getMonthRange(2024, 2), { from: '2024-02-01', to: '2024-02-29' });
    assert.deepEqual(getMonthRange(2025, 2), { from: '2025-02-01', to: '2025-02-28' });
  });
});

describe('getYearRange', () => {
  it('uses Dec 31 for a past year', () => {
    assert.deepEqual(getYearRange(2025, new Date('2026-09-11T12:00:00')), {
      from: '2025-01-01',
      to: '2025-12-31',
    });
  });
});

describe('getYearsInRange', () => {
  it('includes every calendar year the range touches', () => {
    assert.deepEqual(getYearsInRange('2025-12-01', '2026-01-15'), [2025, 2026]);
  });
});

describe('reportMatchesDateRange', () => {
  const q3 = getQuarterRange(2026, 3);

  it('includes a run whose period is 2026-08-27 to 2026-09-09 in Q3', () => {
    assert.equal(
      reportMatchesDateRange(
        { periodStart: '2026-08-27', periodEnd: '2026-09-09' },
        q3.from,
        q3.to
      ),
      true
    );
  });

  it('includes a July-only run in Q3', () => {
    assert.equal(
      reportMatchesDateRange(
        { periodStart: '2026-07-08', periodEnd: '2026-07-21' },
        q3.from,
        q3.to
      ),
      true
    );
  });

  it('excludes a June run from Q3', () => {
    assert.equal(
      reportMatchesDateRange(
        { periodStart: '2026-06-11', periodEnd: '2026-06-24' },
        q3.from,
        q3.to
      ),
      false
    );
  });

  it('includes a run by pay date when the period is missing', () => {
    assert.equal(
      reportMatchesDateRange({ payDate: '2026-09-11' }, q3.from, q3.to),
      true
    );
  });
});

describe('buildAggregatedPeriodReport', () => {
  it('sums gross, taxes, and net for the same employee across two runs', () => {
    const reports = [
      {
        employees: [
          {
            employeeId: 'emp-1',
            employeeName: 'Ada Lovelace',
            position: 'Aide',
            payType: 'hourly',
            checkNumber: '1001',
            grossPay: 2400,
            totalTaxes: 200,
            totalDeductions: 200,
            netPay: 2200,
          },
        ],
      },
      {
        employees: [
          {
            employeeId: 'emp-1',
            employeeName: 'Ada Lovelace',
            checkNumber: '1002',
            grossPay: 1500,
            totalTaxes: 120,
            totalDeductions: 120,
            netPay: 1380,
          },
        ],
      },
    ];

    const aggregated = buildAggregatedPeriodReport(reports, 'Q3 2026', {
      from: '2026-07-01',
      to: '2026-09-30',
    });

    assert.equal(aggregated.id, PERIOD_AGGREGATE_ID);
    assert.equal(aggregated.runsIncluded, 2);
    assert.equal(aggregated.employeeCount, 1);
    assert.equal(aggregated.employees[0].paycheckCount, 2);
    assert.equal(aggregated.employees[0].checkNumber, '2 checks');
    assert.equal(aggregated.employees[0].grossPay, 3900);
    assert.equal(aggregated.employees[0].totalTaxes, 320);
    assert.equal(aggregated.employees[0].netPay, 3580);
    assert.equal(aggregated.totalGross, 3900);
    assert.equal(aggregated.totalNet, 3580);
  });
});

describe('usesPeriodAggregateView', () => {
  it('is on for quarterly/monthly/yearly and off for custom', () => {
    assert.equal(usesPeriodAggregateView('quarterly'), true);
    assert.equal(usesPeriodAggregateView('monthly'), true);
    assert.equal(usesPeriodAggregateView('yearly'), true);
    assert.equal(usesPeriodAggregateView('custom'), false);
  });
});
