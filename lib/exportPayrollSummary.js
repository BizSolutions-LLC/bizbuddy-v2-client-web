import ExcelJS from 'exceljs';
import { calculateTaxes, round2 } from '@/lib/payrollCompute';

const FONT = { name: 'Calibri', size: 10 };
const FONT_BOLD = { ...FONT, bold: true };
const FONT_TITLE = { name: 'Calibri', size: 18, bold: false };
const FONT_SUBTITLE = { name: 'Calibri', size: 12, bold: true };
const FONT_RANGE = { name: 'Calibri', size: 10, bold: true };

const FILL_HEADER = {
  type: 'pattern',
  pattern: 'solid',
  fgColor: { argb: 'FFD9D9D9' },
};

const FILL_TOTAL = {
  type: 'pattern',
  pattern: 'solid',
  fgColor: { argb: 'FFEFEFEF' },
};

const BORDER_THIN = {
  top: { style: 'thin', color: { argb: 'FFBFBFBF' } },
  left: { style: 'thin', color: { argb: 'FFBFBFBF' } },
  bottom: { style: 'thin', color: { argb: 'FFBFBFBF' } },
  right: { style: 'thin', color: { argb: 'FFBFBFBF' } },
};

const NUM_HOURS = '#,##0.0';
const NUM_CURRENCY = '$#,##0.00';

function formatReportDate(dateStr) {
  if (!dateStr) return '';
  const [y, m, d] = dateStr.split('-').map(Number);
  const date = new Date(y, m - 1, d);
  return date.toLocaleDateString('en-US', { month: 'short', day: '2-digit', year: 'numeric' });
}

function formatEmployeeHeader(name) {
  return String(name || '').trim().toUpperCase();
}

function getTaxBreakdown(row) {
  if (row.taxBreakdown) {
    return row.taxBreakdown;
  }
  const employee = {
    payrollDetails: row.payrollDetails,
    earningRates: row.earningRates || {},
  };
  return calculateTaxes(employee, row.grossPay ?? 0);
}

/** Map saved payroll report employee rows for summary export. */
export function mapReportEmployeeToSummaryRow(emp) {
  const taxes = emp.taxes && typeof emp.taxes === 'object' ? emp.taxes : {};
  const totalTaxes = emp.totalTaxes ?? taxes.totalTaxes ?? (typeof emp.taxes === 'number' ? emp.taxes : 0);
  const hasBreakdown = taxes.federalTax != null || taxes.fica != null;

  return {
    name: emp.employeeName || emp.name,
    payType: emp.payType || emp.payrollDetails?.payType,
    payRate: emp.payRate ?? emp.payrollDetails?.payRate,
    payrollDetails: emp.payrollDetails,
    earningRates: emp.earningRates || {},
    grossPay: emp.grossPay ?? emp.calculated?.grossEarnings,
    taxes: totalTaxes,
    taxBreakdown: hasBreakdown ? taxes : null,
    deductions: emp.totalDeductions ?? emp.deductions ?? emp.calculated?.totalDeductions,
    futaDeduction: emp.futaDeduction ?? 0,
    netPay: emp.netPay ?? emp.netPayAfterTaxes,
    regularHours: emp.regularHours ?? emp.hours?.regularHours,
    overtimeHours: emp.overtimeHours ?? emp.hours?.overtimeHours,
    totalPunchHours: emp.totalPunchHours,
  };
}

function getOtherDeductions(row) {
  const taxes = row.taxes ?? 0;
  const futa = row.futaDeduction ?? 0;
  const total = row.deductions ?? 0;
  return round2(Math.max(0, total - taxes - futa));
}

function getRegularGross(row) {
  if (row.payType === 'salary') return 0;
  const rate = parseFloat(row.payRate) || 0;
  const hours = parseFloat(row.regularHours) || 0;
  return round2(hours * rate);
}

function getSalaryGross(row) {
  if (row.payType !== 'salary') return 0;
  return row.grossPay ?? 0;
}

function getOvertimeGross(row) {
  if (row.payType === 'salary') return 0;
  const gross = row.grossPay ?? 0;
  return round2(Math.max(0, gross - getRegularGross(row)));
}

function getTotalHours(row) {
  const regular = parseFloat(row.regularHours) || 0;
  const ot = parseFloat(row.overtimeHours) || 0;
  if (regular || ot) return round2(regular + ot);
  return row.totalPunchHours ?? 0;
}

function getSalaryHours(row) {
  return row.payType === 'salary' ? getTotalHours(row) : 0;
}

function getRegularHours(row) {
  return row.payType === 'salary' ? 0 : parseFloat(row.regularHours) || 0;
}

function getOvertimeHours(row) {
  return row.payType === 'salary' ? 0 : parseFloat(row.overtimeHours) || 0;
}

function colLetter(index) {
  let n = index;
  let letters = '';
  while (n > 0) {
    const rem = (n - 1) % 26;
    letters = String.fromCharCode(65 + rem) + letters;
    n = Math.floor((n - 1) / 26);
  }
  return letters;
}

function buildLineItems(snapshots, futaEnabled) {
  const add = (label, getter, kind, valueType) => {
    const values = snapshots.map(getter);
    const total = round2(values.reduce((sum, v) => sum + (v || 0), 0));
    return { label, total, values, kind, valueType };
  };

  const items = [
    add('Hours - total', (s) => s.totalHours, 'section', 'hours'),
    add('Hours - Salary', (s) => s.salaryHours, 'detail', 'hours'),
    add('Hours - Regular Pay', (s) => s.regularHours, 'detail', 'hours'),
    add('Hours - Overtime Pay', (s) => s.overtimeHours, 'detail', 'hours'),
    add('Gross pay - total', (s) => s.gross, 'section', 'currency'),
    add('Gross pay - Salary', (s) => s.salaryGross, 'detail', 'currency'),
    add('Gross pay - Regular Pay', (s) => s.regularGross, 'detail', 'currency'),
    add('Gross pay - Overtime Pay', (s) => s.overtimeGross, 'detail', 'currency'),
    add('Pretax deductions - total', () => 0, 'section', 'currency'),
    add('Adjusted gross', (s) => s.gross, 'section', 'currency'),
    add('Other pay - total', () => 0, 'section', 'currency'),
    add('Employee taxes & deductions - total', (s) => -(s.row.deductions ?? 0), 'section', 'currency'),
    add('Employee taxes - total', (s) => -(s.row.taxes ?? 0), 'section', 'currency'),
    add('Employee taxes - Federal Income Tax', (s) => -(s.taxes.federalTax || 0), 'detail', 'currency'),
    add('Employee taxes - Social Security', (s) => -(s.taxes.fica || 0), 'detail', 'currency'),
    add('Employee taxes - Medicare', (s) => -(s.taxes.medicare || 0), 'detail', 'currency'),
    add('Employee taxes - CA Income Tax', (s) => -(s.taxes.stateTax || 0), 'detail', 'currency'),
    add('Employee taxes - CA State Disability Ins', (s) => -(s.taxes.sdi || 0), 'detail', 'currency'),
    add('Employee Aftertax deductions - total', (s) => s.otherDeductions, 'section', 'currency'),
    add('Net pay', (s) => s.row.netPay ?? 0, 'section', 'currency'),
    add('Employer taxes & contributions - total', (s) => s.employerTaxTotal, 'section', 'currency'),
    add('Employer taxes - total', (s) => s.employerTaxTotal, 'section', 'currency'),
  ];

  if (futaEnabled) {
    items.push(add('Employer taxes - FUTA Employer', (s) => s.futa, 'detail', 'currency'));
  }

  items.push(
    add('Employer taxes - Social Security Employer', (s) => s.taxes.fica || 0, 'detail', 'currency'),
    add('Employer taxes - Medicare Employer', (s) => s.taxes.medicare || 0, 'detail', 'currency'),
    add('Company contributions - total', () => 0, 'section', 'currency'),
    add('Total payroll cost', (s) => s.totalPayrollCost, 'section', 'currency'),
  );

  return items;
}

function buildSnapshots(employees, futaEnabled) {
  return employees.map((row) => {
    const taxes = getTaxBreakdown(row);
    const otherDeductions = getOtherDeductions(row);
    const futa = futaEnabled ? row.futaDeduction ?? 0 : 0;
    const employerTaxTotal = round2(taxes.fica + taxes.medicare + futa);
    const gross = row.grossPay ?? 0;

    return {
      row,
      taxes,
      otherDeductions,
      futa,
      employerTaxTotal,
      gross,
      totalHours: getTotalHours(row),
      salaryHours: getSalaryHours(row),
      regularHours: getRegularHours(row),
      overtimeHours: getOvertimeHours(row),
      salaryGross: getSalaryGross(row),
      regularGross: getRegularGross(row),
      overtimeGross: getOvertimeGross(row),
      totalPayrollCost: round2(gross + employerTaxTotal),
    };
  });
}

function styleLabelCell(cell, { bold = false } = {}) {
  cell.font = bold ? FONT_BOLD : FONT;
  cell.alignment = { vertical: 'middle', horizontal: 'left', wrapText: true };
  cell.border = BORDER_THIN;
}

function styleValueCell(cell, { bold = false, shaded = false, valueType = 'currency' } = {}) {
  cell.font = bold ? FONT_BOLD : FONT;
  cell.alignment = { vertical: 'middle', horizontal: 'right' };
  cell.border = BORDER_THIN;
  if (shaded) cell.fill = FILL_TOTAL;
  cell.numFmt = valueType === 'hours' ? NUM_HOURS : NUM_CURRENCY;
}

function styleHeaderCell(cell) {
  cell.font = FONT_BOLD;
  cell.fill = FILL_HEADER;
  cell.alignment = { vertical: 'middle', horizontal: 'center', wrapText: true };
  cell.border = BORDER_THIN;
}

function styleTitleCell(cell, font) {
  cell.font = font;
  cell.alignment = { vertical: 'middle', horizontal: 'left' };
}

/**
 * Build pivot-style payroll summary workbook with styling.
 */
export async function downloadPayrollSummaryExcel({
  companyName = 'Company',
  dateFrom,
  dateTo,
  employees = [],
  futaEnabled = false,
}) {
  const snapshots = buildSnapshots(employees, futaEnabled);
  const lineItems = buildLineItems(snapshots, futaEnabled);
  const employeeHeaders = snapshots.map(({ row }) => formatEmployeeHeader(row.name));
  const lastCol = 2 + employeeHeaders.length;
  const lastColLetter = colLetter(lastCol);
  const rangeLabel = `From ${formatReportDate(dateFrom)} to ${formatReportDate(dateTo)} for all employees from all locations`;

  const workbook = new ExcelJS.Workbook();
  workbook.creator = 'BizBuddy';
  workbook.created = new Date();

  const sheet = workbook.addWorksheet('Payroll summary by employee rep', {
    views: [{ state: 'frozen', ySplit: 5, xSplit: 1 }],
  });

  sheet.getColumn(1).width = 52;
  sheet.getColumn(2).width = 15;
  for (let i = 3; i <= lastCol; i += 1) {
    sheet.getColumn(i).width = 22;
  }

  // Header block (merged)
  sheet.mergeCells(`A1:${lastColLetter}1`);
  styleTitleCell(sheet.getCell('A1'), FONT_TITLE);
  sheet.getCell('A1').value = String(companyName).toUpperCase();

  sheet.mergeCells(`A2:${lastColLetter}2`);
  styleTitleCell(sheet.getCell('A2'), FONT_SUBTITLE);
  sheet.getCell('A2').value = 'Payroll summary by employee report';

  sheet.mergeCells(`A3:${lastColLetter}3`);

  sheet.mergeCells(`A4:${lastColLetter}4`);
  styleTitleCell(sheet.getCell('A4'), FONT_RANGE);
  sheet.getCell('A4').value = rangeLabel;

  // Column headers
  const headerRow = sheet.getRow(5);
  const headers = ['Item', 'Total', ...employeeHeaders];
  headers.forEach((label, idx) => {
    const cell = headerRow.getCell(idx + 1);
    cell.value = label;
    styleHeaderCell(cell);
    if (idx >= 2) {
      cell.alignment = { vertical: 'middle', horizontal: 'right', wrapText: true };
    }
  });
  headerRow.height = 28;

  // Data rows
  let rowIndex = 6;
  lineItems.forEach((item) => {
    const row = sheet.getRow(rowIndex);
    const isSection = item.kind === 'section';
    const isGrandTotal = item.label === 'Total payroll cost';

    styleLabelCell(row.getCell(1), { bold: isSection || isGrandTotal });
    row.getCell(1).value = item.label;

    const allValues = [item.total, ...item.values];
    allValues.forEach((value, idx) => {
      const cell = row.getCell(idx + 2);
      cell.value = value;
      styleValueCell(cell, {
        bold: isSection || isGrandTotal,
        shaded: isSection,
        valueType: item.valueType,
      });
    });

    if (isGrandTotal) {
      row.getCell(1).font = { ...FONT_BOLD, size: 11 };
    }

    rowIndex += 1;
  });

  const buffer = await workbook.xlsx.writeBuffer();
  const blob = new Blob([buffer], {
    type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  });

  const safeCompany = String(companyName || 'Company')
    .replace(/[^a-zA-Z0-9]/g, '')
    .toUpperCase()
    .slice(0, 24);
  const stamp = new Date().toISOString().slice(0, 10).replace(/-/g, '');
  const filename = `${safeCompany}_PayrollSummaryByEmployee_${stamp}.xlsx`;

  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = filename;
  link.click();
  URL.revokeObjectURL(url);

  return filename;
}

/** @deprecated Use downloadPayrollSummaryExcel — kept for tests if needed */
export function buildPayrollSummaryRows(options) {
  const snapshots = buildSnapshots(options.employees || [], options.futaEnabled);
  const lineItems = buildLineItems(snapshots, options.futaEnabled);
  const aoa = [
    [String(options.companyName || 'Company').toUpperCase()],
    ['Payroll summary by employee report'],
    [],
    [`From ${formatReportDate(options.dateFrom)} to ${formatReportDate(options.dateTo)} for all employees from all locations`],
    ['Item', 'Total', ...snapshots.map(({ row }) => formatEmployeeHeader(row.name))],
    ...lineItems.map((item) => [item.label, item.total, ...item.values]),
  ];
  return aoa;
}
