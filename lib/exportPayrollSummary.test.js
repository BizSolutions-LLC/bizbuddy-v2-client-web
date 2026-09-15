import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { buildPayrollSummaryLineItems } from './exportPayrollSummary.js';

const HOURLY_EMPLOYEE = {
  name: 'Ada Lovelace',
  payType: 'hourly',
  payRate: 30,
  grossPay: 2400,
  taxes: 200,
  deductions: 200,
  netPay: 2200,
  regularHours: 80,
  overtimeHours: 0,
  futaDeduction: 5,
  taxBreakdown: {
    federalTax: 100,
    fica: 50,
    medicare: 20,
    stateTax: 20,
    sdi: 10,
  },
};

function itemByLabel(lineItems, label) {
  return lineItems.find((item) => item.label === label);
}

describe('buildPayrollSummaryLineItems', () => {
  it('includes QuickBooks hours, gross, SDI, net pay, and total payroll cost', () => {
    const { lineItems } = buildPayrollSummaryLineItems({
      employees: [HOURLY_EMPLOYEE],
      futaEnabled: false,
    });

    const labels = lineItems.map((item) => item.label);
    assert.ok(labels.includes('Hours - Regular Pay'));
    assert.ok(labels.includes('Gross pay - Regular Pay'));
    assert.ok(labels.includes('Employee taxes - CA State Disability Ins'));
    assert.ok(labels.includes('Net pay'));
    assert.ok(labels.includes('Total payroll cost'));

    assert.equal(itemByLabel(lineItems, 'Hours - Regular Pay').total, 80);
    assert.equal(itemByLabel(lineItems, 'Gross pay - Regular Pay').total, 2400);
    assert.equal(itemByLabel(lineItems, 'Employee taxes - CA State Disability Ins').total, -10);
    assert.equal(itemByLabel(lineItems, 'Net pay').total, 2200);
    assert.equal(itemByLabel(lineItems, 'Total payroll cost').total, 2470);
  });

  it('adds the FUTA employer row only when FUTA is enabled', () => {
    const withoutFuta = buildPayrollSummaryLineItems({
      employees: [HOURLY_EMPLOYEE],
      futaEnabled: false,
    });
    const withFuta = buildPayrollSummaryLineItems({
      employees: [HOURLY_EMPLOYEE],
      futaEnabled: true,
    });

    assert.equal(
      withoutFuta.lineItems.some((item) => item.label === 'Employer taxes - FUTA Employer'),
      false
    );
    const futaRow = itemByLabel(withFuta.lineItems, 'Employer taxes - FUTA Employer');
    assert.ok(futaRow);
    assert.equal(futaRow.total, 5);
  });
});
