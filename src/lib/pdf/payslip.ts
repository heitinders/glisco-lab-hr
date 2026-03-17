import path from 'path';

// ─── Types ──────────────────────────────────────────────────────────────────

export interface PayslipData {
  period: string;
  currency: string;
  basicSalary: number;
  hra: number | null;
  allowances: { label: string; amount: number }[];
  deductions: { label: string; amount: number }[];
  grossPay: number;
  taxDeducted: number;
  stateTax: number | null;
  pf: number | null;
  esi: number | null;
  netPay: number;
  leaveDays: number;
  overtimePay: number | null;
  bonuses: number | null;
}

export interface EmployeeData {
  firstName: string;
  lastName: string;
  employeeId: string;
  email: string;
  department: string;
  designation: string;
  bankDetails?: { bankName?: string; accountNumber?: string } | null;
}

export interface CompanyData {
  name: string;
  address?: string;
}

// ─── Helpers ────────────────────────────────────────────────────────────────

/**
 * Format a currency value with symbol. Falls back to code prefix for unknown currencies.
 */
function formatCurrency(amount: number, currency: string): string {
  const symbols: Record<string, string> = {
    USD: '$',
    INR: '\u20B9',
    EUR: '\u20AC',
    GBP: '\u00A3',
  };
  const sym = symbols[currency] ?? `${currency} `;
  return `${sym}${amount.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}

/**
 * Format period string "2026-03" to "March 2026".
 */
function formatPeriod(period: string): string {
  const [year, month] = period.split('-');
  const monthNames = [
    'January', 'February', 'March', 'April', 'May', 'June',
    'July', 'August', 'September', 'October', 'November', 'December',
  ];
  const monthIndex = parseInt(month, 10) - 1;
  const monthName = monthNames[monthIndex] ?? month;
  return `${monthName} ${year}`;
}

/**
 * Mask a bank account number, showing only the last 4 digits.
 */
function maskAccountNumber(account: string): string {
  if (account.length <= 4) return account;
  return 'XXXX-' + account.slice(-4);
}

// ─── PDF Generation ─────────────────────────────────────────────────────────

/**
 * Generate a professional payslip PDF and return it as a Buffer.
 *
 * Uses pdfmake with server-side Roboto font files bundled with the package.
 * The document is fully self-contained with no external network requests.
 */
export async function generatePayslipPDF(
  payslip: PayslipData,
  employee: EmployeeData,
  company: CompanyData,
): Promise<Buffer> {
  // pdfmake is a CommonJS module — dynamic import for ESM compatibility
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  const pdfmake = require('pdfmake/js/index.js');

  // Resolve Roboto font files from the pdfmake package
  const fontsDir = path.join(
    path.dirname(require.resolve('pdfmake/package.json')),
    'build',
    'fonts',
    'Roboto',
  );

  pdfmake.fonts = {
    Roboto: {
      normal: path.join(fontsDir, 'Roboto-Regular.ttf'),
      bold: path.join(fontsDir, 'Roboto-Medium.ttf'),
      italics: path.join(fontsDir, 'Roboto-Italic.ttf'),
      bolditalics: path.join(fontsDir, 'Roboto-MediumItalic.ttf'),
    },
  };

  // Block all external URL fetches for security
  pdfmake.setUrlAccessPolicy(() => false);

  const formattedPeriod = formatPeriod(payslip.period);
  const cur = payslip.currency;

  // ── Build earnings rows ──────────────────────────────────────────────────

  const earningsRows: Array<[string, string]> = [
    ['Basic Salary', formatCurrency(payslip.basicSalary, cur)],
  ];

  if (payslip.hra !== null && payslip.hra > 0) {
    earningsRows.push(['House Rent Allowance (HRA)', formatCurrency(payslip.hra, cur)]);
  }

  for (const allowance of payslip.allowances) {
    earningsRows.push([allowance.label, formatCurrency(allowance.amount, cur)]);
  }

  if (payslip.overtimePay !== null && payslip.overtimePay > 0) {
    earningsRows.push(['Overtime Pay', formatCurrency(payslip.overtimePay, cur)]);
  }

  if (payslip.bonuses !== null && payslip.bonuses > 0) {
    earningsRows.push(['Bonuses', formatCurrency(payslip.bonuses, cur)]);
  }

  // ── Build deductions rows ────────────────────────────────────────────────

  const deductionRows: Array<[string, string]> = [];

  if (payslip.taxDeducted > 0) {
    deductionRows.push(['Income Tax (TDS)', formatCurrency(payslip.taxDeducted, cur)]);
  }

  if (payslip.stateTax !== null && payslip.stateTax > 0) {
    deductionRows.push(['State Tax', formatCurrency(payslip.stateTax, cur)]);
  }

  if (payslip.pf !== null && payslip.pf > 0) {
    deductionRows.push(['Provident Fund (PF)', formatCurrency(payslip.pf, cur)]);
  }

  if (payslip.esi !== null && payslip.esi > 0) {
    deductionRows.push(['ESI', formatCurrency(payslip.esi, cur)]);
  }

  for (const deduction of payslip.deductions) {
    deductionRows.push([deduction.label, formatCurrency(deduction.amount, cur)]);
  }

  // ── Ensure equal row count for the two-column table ──────────────────────

  const maxRows = Math.max(earningsRows.length, deductionRows.length);
  while (earningsRows.length < maxRows) earningsRows.push(['', '']);
  while (deductionRows.length < maxRows) deductionRows.push(['', '']);

  // ── Compose table body ───────────────────────────────────────────────────

  const HEADER_FILL = '#1a1a2e';
  const HEADER_COLOR = '#ffffff';
  const ALT_ROW_FILL = '#f8f9fa';
  const ACCENT = '#4B9EFF';

  const tableBody: unknown[][] = [
    // Header
    [
      { text: 'Earnings', style: 'tableHeader', fillColor: HEADER_FILL, color: HEADER_COLOR },
      { text: 'Amount', style: 'tableHeader', alignment: 'right', fillColor: HEADER_FILL, color: HEADER_COLOR },
      { text: 'Deductions', style: 'tableHeader', fillColor: HEADER_FILL, color: HEADER_COLOR },
      { text: 'Amount', style: 'tableHeader', alignment: 'right', fillColor: HEADER_FILL, color: HEADER_COLOR },
    ],
  ];

  for (let i = 0; i < maxRows; i++) {
    const fill = i % 2 === 1 ? ALT_ROW_FILL : undefined;
    tableBody.push([
      { text: earningsRows[i][0], fillColor: fill },
      { text: earningsRows[i][1], alignment: 'right', fillColor: fill },
      { text: deductionRows[i][0], fillColor: fill },
      { text: deductionRows[i][1], alignment: 'right', fillColor: fill },
    ]);
  }

  // Totals row
  const totalDeductions = payslip.grossPay - payslip.netPay;

  tableBody.push([
    { text: 'Gross Pay', bold: true, fillColor: '#e8edf2' },
    { text: formatCurrency(payslip.grossPay, cur), bold: true, alignment: 'right', fillColor: '#e8edf2' },
    { text: 'Total Deductions', bold: true, fillColor: '#e8edf2' },
    { text: formatCurrency(totalDeductions, cur), bold: true, alignment: 'right', fillColor: '#e8edf2' },
  ]);

  // ── Employee details ─────────────────────────────────────────────────────

  const employeeName = `${employee.firstName} ${employee.lastName}`;
  const bankDisplay = employee.bankDetails?.accountNumber
    ? `${employee.bankDetails.bankName ?? 'Bank'} - A/C ${maskAccountNumber(employee.bankDetails.accountNumber)}`
    : 'N/A';

  // ── Document definition ──────────────────────────────────────────────────

  const docDefinition = {
    pageSize: 'A4' as const,
    pageMargins: [40, 40, 40, 60] as [number, number, number, number],

    content: [
      // Company header
      {
        columns: [
          {
            stack: [
              { text: company.name.toUpperCase(), style: 'companyName' },
              ...(company.address ? [{ text: company.address, style: 'companyAddress' }] : []),
            ],
          },
          {
            text: 'PAYSLIP',
            style: 'payslipBadge',
            alignment: 'right' as const,
          },
        ],
      },

      // Period subtitle
      {
        text: `Pay Period: ${formattedPeriod}`,
        style: 'periodText',
        margin: [0, 4, 0, 16] as [number, number, number, number],
      },

      // Divider
      {
        canvas: [
          {
            type: 'line' as const,
            x1: 0,
            y1: 0,
            x2: 515,
            y2: 0,
            lineWidth: 1,
            lineColor: ACCENT,
          },
        ],
        margin: [0, 0, 0, 16] as [number, number, number, number],
      },

      // Employee details grid
      {
        columns: [
          {
            width: '50%',
            stack: [
              { text: 'EMPLOYEE DETAILS', style: 'sectionTitle' },
              {
                margin: [0, 6, 0, 0] as [number, number, number, number],
                table: {
                  widths: [90, '*'],
                  body: [
                    [{ text: 'Name', style: 'detailLabel' }, { text: employeeName, style: 'detailValue' }],
                    [{ text: 'Employee ID', style: 'detailLabel' }, { text: employee.employeeId, style: 'detailValue' }],
                    [{ text: 'Department', style: 'detailLabel' }, { text: employee.department, style: 'detailValue' }],
                  ],
                },
                layout: 'noBorders',
              },
            ],
          },
          {
            width: '50%',
            stack: [
              { text: '', style: 'sectionTitle' }, // spacer to align with left column
              {
                margin: [0, 6, 0, 0] as [number, number, number, number],
                table: {
                  widths: [90, '*'],
                  body: [
                    [{ text: 'Designation', style: 'detailLabel' }, { text: employee.designation, style: 'detailValue' }],
                    [{ text: 'Bank', style: 'detailLabel' }, { text: bankDisplay, style: 'detailValue' }],
                    [{ text: 'Leave Days', style: 'detailLabel' }, { text: String(payslip.leaveDays), style: 'detailValue' }],
                  ],
                },
                layout: 'noBorders',
              },
            ],
          },
        ],
        margin: [0, 0, 0, 20] as [number, number, number, number],
      },

      // Earnings vs Deductions table
      {
        table: {
          headerRows: 1,
          widths: ['*', 100, '*', 100],
          body: tableBody,
        },
        layout: {
          hLineWidth: (i: number, node: { table: { body: unknown[][] } }) =>
            i === 0 || i === 1 || i === node.table.body.length ? 1 : 0.5,
          vLineWidth: () => 0.5,
          hLineColor: (i: number, node: { table: { body: unknown[][] } }) =>
            i === 0 || i === node.table.body.length ? '#333333' : '#dddddd',
          vLineColor: () => '#dddddd',
          paddingLeft: () => 8,
          paddingRight: () => 8,
          paddingTop: () => 6,
          paddingBottom: () => 6,
        },
        margin: [0, 0, 0, 20] as [number, number, number, number],
      },

      // NET PAY highlight
      {
        table: {
          widths: ['*', 'auto'],
          body: [
            [
              {
                text: 'NET PAY',
                bold: true,
                fontSize: 13,
                color: '#ffffff',
                fillColor: HEADER_FILL,
                margin: [12, 10, 0, 10] as [number, number, number, number],
              },
              {
                text: formatCurrency(payslip.netPay, cur),
                bold: true,
                fontSize: 13,
                color: '#ffffff',
                fillColor: HEADER_FILL,
                alignment: 'right' as const,
                margin: [0, 10, 12, 10] as [number, number, number, number],
              },
            ],
          ],
        },
        layout: {
          hLineWidth: () => 0,
          vLineWidth: () => 0,
        },
        margin: [0, 0, 0, 30] as [number, number, number, number],
      },

      // Footer disclaimer
      {
        text: 'This is a computer-generated payslip and does not require a signature.',
        style: 'disclaimer',
      },
    ],

    styles: {
      companyName: {
        fontSize: 18,
        bold: true,
        color: HEADER_FILL,
      },
      companyAddress: {
        fontSize: 9,
        color: '#666666',
        margin: [0, 2, 0, 0],
      },
      payslipBadge: {
        fontSize: 22,
        bold: true,
        color: ACCENT,
      },
      periodText: {
        fontSize: 10,
        color: '#555555',
      },
      sectionTitle: {
        fontSize: 9,
        bold: true,
        color: ACCENT,
        characterSpacing: 1,
      },
      detailLabel: {
        fontSize: 9,
        color: '#888888',
        margin: [0, 2, 0, 2],
      },
      detailValue: {
        fontSize: 9,
        color: '#333333',
        bold: true,
        margin: [0, 2, 0, 2],
      },
      tableHeader: {
        fontSize: 9,
        bold: true,
        margin: [0, 4, 0, 4],
      },
      disclaimer: {
        fontSize: 8,
        color: '#999999',
        italics: true,
        alignment: 'center' as const,
      },
    },

    defaultStyle: {
      font: 'Roboto',
      fontSize: 9,
      color: '#333333',
    },
  };

  const pdf = pdfmake.createPdf(docDefinition);
  const buffer: Buffer = await pdf.getBuffer();

  return buffer;
}
