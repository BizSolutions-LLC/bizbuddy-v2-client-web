import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { DEFAULT_TAX_RATES } from "./payrollCompute.js";
import {
  QTY_RATE_CALC_TYPE,
  PAYSLIP_REMARK_PERSISTENCE_ENABLED,
  calculateQuantityRateAmount,
  calculateSheetAdditionalEarning,
  canAddQuantityRateColumn,
  emptyEmployeeTaxes,
  employerTaxesForSheetRun,
  prefillQtyRateFromEmployee,
  sheetHasQuantityRateColumn,
  taxesForSheetRun,
} from "./employeeSheetExtensions.js";

describe("employeeSheetExtensions", () => {
  it("exports the quantity_rate type constant", () => {
    assert.equal(QTY_RATE_CALC_TYPE, "quantity_rate");
  });

  it("enables payslip remark persistence once server accepts remark", () => {
    assert.equal(PAYSLIP_REMARK_PERSISTENCE_ENABLED, true);
  });

  it("emptyEmployeeTaxes totals to zero", () => {
    const t = emptyEmployeeTaxes();
    assert.equal(t.totalTaxes, 0);
    assert.equal(t.federalTax, 0);
    assert.equal(t.fica, 0);
  });

  it("calculateQuantityRateAmount multiplies and rounds", () => {
    assert.equal(calculateQuantityRateAmount("120", "2.5"), 300);
    assert.equal(calculateQuantityRateAmount(0, 2.5), 0);
    assert.equal(calculateQuantityRateAmount("", 3), 0);
    assert.equal(calculateQuantityRateAmount("5", "0.5"), 2.5);
  });

  it("calculateSheetAdditionalEarning routes quantity_rate vs fixed", () => {
    const qtyCol = { id: "c1", calculationType: QTY_RATE_CALC_TYPE };
    const fixedCol = { id: "c2", calculationType: "fixed" };
    assert.equal(
      calculateSheetAdditionalEarning(qtyCol, "", 1000, { quantity: "10", rate: "3" }),
      30
    );
    assert.equal(calculateSheetAdditionalEarning(fixedCol, "50", 1000), 50);
  });

  it("allows only one quantity_rate column", () => {
    assert.equal(canAddQuantityRateColumn([]), true);
    assert.equal(
      canAddQuantityRateColumn([{ id: "a", calculationType: "fixed" }]),
      true
    );
    assert.equal(
      canAddQuantityRateColumn([{ id: "a", calculationType: QTY_RATE_CALC_TYPE }]),
      false
    );
    assert.equal(
      sheetHasQuantityRateColumn([{ calculationType: QTY_RATE_CALC_TYPE }]),
      true
    );
  });

  it("taxesForSheetRun zeros when disabled", () => {
    const employee = {
      payrollDetails: {
        payType: "hourly",
        payRate: 20,
        maritalStatus: "single",
      },
    };
    const disabled = taxesForSheetRun({
      employee,
      grossPay: 1000,
      taxRates: DEFAULT_TAX_RATES,
      payFrequency: "biweekly",
      taxesDisabledForRun: true,
    });
    assert.equal(disabled.totalTaxes, 0);

    const enabled = taxesForSheetRun({
      employee,
      grossPay: 1000,
      taxRates: {
        ...DEFAULT_TAX_RATES,
        ficaRate: 0.062,
        medicareRate: 0.0145,
        sdiRate: 0.011,
      },
      payFrequency: "biweekly",
      taxesDisabledForRun: false,
    });
    assert.ok(enabled.totalTaxes > 0);
  });

  it("employerTaxesForSheetRun zeros amounts when disabled", () => {
    const result = employerTaxesForSheetRun({
      taxesDisabledForRun: true,
      futaAmount: 12,
      suiAmount: 8,
      ettAmount: 1,
    });
    assert.deepEqual(result, { futaAmount: 0, suiAmount: 0, ettAmount: 0 });
  });

  it("prefillQtyRateFromEmployee reads payRate and does not mutate input", () => {
    const employee = { payrollDetails: { payRate: 15.5 }, payRate: 15.5 };
    const snapshot = JSON.parse(JSON.stringify(employee));
    const prefill = prefillQtyRateFromEmployee(employee);
    assert.deepEqual(prefill, { quantity: "", rate: "15.5" });
    assert.deepEqual(employee, snapshot);
  });
});
