import fs from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { SpreadsheetFile, Workbook } from '@oai/artifact-tool';

const outputDir = new URL('../outputs/', import.meta.url);
await fs.mkdir(outputDir, { recursive: true });

const workbook = Workbook.create();
const assumptions = workbook.worksheets.add('Assumptions');
const packagesSheet = workbook.worksheets.add('Packages');
const hardware = workbook.worksheets.add('Hardware Budget');
const scenarios = workbook.worksheets.add('Revenue Scenarios');

for (const sheet of [assumptions, packagesSheet, hardware, scenarios]) {
  sheet.showGridLines = true;
}

assumptions.getRange('A1:D1').merge();
assumptions.getRange('A1').values = [['TENG Smart Parking - Pilot Assumptions']];
assumptions.getRange('A3:B11').values = [
  ['Input', 'Value'],
  ['Parking bays', 15],
  ['Open days per month', 30],
  ['Avg paid hours per occupied bay per day', 4],
  ['Hourly price (THB)', 20],
  ['Payment gateway fee', 0.02],
  ['Revenue share to land owner', 0.55],
  ['Revenue share to TENG', 0.45],
  ['Estimated monthly fixed operating cost', 3500]
];
assumptions.getRange('A1:D1').format = { font: { bold: true, size: 16 } };
assumptions.getRange('A3:B3').format = { fill: '#E5E7EB', font: { bold: true } };
assumptions.getRange('B7:B8').format.numberFormat = '0%';
assumptions.getRange('B9').format.numberFormat = '#,##0';
assumptions.getRange('A:B').format.autofitColumns();

packagesSheet.getRange('A1:D1').values = [['Package', 'Duration Hours', 'Price THB', 'Notes']];
packagesSheet.getRange('A2:D8').values = [
  ['1 hour', 1, 20, 'Base rate'],
  ['3 hours', 3, 50, 'Short visit bundle'],
  ['6 hours', 6, 80, 'Half-day bundle'],
  ['12 hours', 12, 120, 'Long stay bundle'],
  ['24 hours', 24, 180, 'Daily cap'],
  ['Daily member', 24, 150, 'Configurable'],
  ['Monthly member', 720, 1200, 'Configurable by site']
];
packagesSheet.getRange('A1:D1').format = { fill: '#E5E7EB', font: { bold: true } };
packagesSheet.getRange('C2:C8').format.numberFormat = '#,##0';
packagesSheet.getRange('A:D').format.autofitColumns();

hardware.getRange('A1:D1').values = [['Item', 'Qty', 'Unit Cost THB', 'Total THB']];
hardware.getRange('A2:D12').values = [
  ['ESP32 DevKitC / ESP32-S3', 2, 350, null],
  ['Relay or optocoupler relay module', 2, 120, null],
  ['Barrier gate with dry-contact input', 2, 22000, null],
  ['Weatherproof enclosure', 2, 1200, null],
  ['12V/24V power and step-down supply', 2, 800, null],
  ['Manual override buttons and wiring', 2, 500, null],
  ['Magnetic/limit sensors', 2, 450, null],
  ['4G/Wi-Fi router', 1, 2500, null],
  ['Pilot signage and QR boards', 2, 900, null],
  ['Installation allowance', 1, 12000, null],
  ['Contingency', 1, 8000, null]
];
hardware.getRange('D2').formulas = [['=B2*C2']];
hardware.getRange('D2:D12').fillDown();
hardware.getRange('C2:D12').format.numberFormat = '#,##0';
hardware.getRange('A1:D1').format = { fill: '#E5E7EB', font: { bold: true } };
hardware.getRange('A14:C14').values = [['Estimated pilot hardware budget', '', '']];
hardware.getRange('D14').formulas = [['=SUM(D2:D12)']];
hardware.getRange('A14:D14').format = { font: { bold: true }, fill: '#F3F4F6' };
hardware.getRange('A:D').format.autofitColumns();

scenarios.getRange('A1:G1').values = [[
  'Occupancy',
  'Monthly Gross THB',
  'Gateway Fees THB',
  'Net After Fees THB',
  'Land Owner Share THB',
  'TENG Share THB',
  'TENG After Fixed Cost THB'
]];
scenarios.getRange('A2:A6').values = [[0.2], [0.35], [0.5], [0.65], [0.8]];
scenarios.getRange('B2').formulas = [[
  '=Assumptions!$B$6*Assumptions!$B$4*Assumptions!$B$5*Assumptions!$B$7*A2'
]];
scenarios.getRange('B2:B6').fillDown();
scenarios.getRange('C2').formulas = [['=B2*Assumptions!$B$8']];
scenarios.getRange('C2:C6').fillDown();
scenarios.getRange('D2').formulas = [['=B2-C2']];
scenarios.getRange('D2:D6').fillDown();
scenarios.getRange('E2').formulas = [['=D2*Assumptions!$B$9']];
scenarios.getRange('E2:E6').fillDown();
scenarios.getRange('F2').formulas = [['=D2*Assumptions!$B$10']];
scenarios.getRange('F2:F6').fillDown();
scenarios.getRange('G2').formulas = [['=F2-Assumptions!$B$11']];
scenarios.getRange('G2:G6').fillDown();
scenarios.getRange('A2:A6').format.numberFormat = '0%';
scenarios.getRange('B2:G6').format.numberFormat = '#,##0';
scenarios.getRange('A1:G1').format = { fill: '#E5E7EB', font: { bold: true } };
scenarios.getRange('A:G').format.autofitColumns();

const inspect = await workbook.inspect({
  kind: 'workbook,sheet,formula',
  maxChars: 6000,
  tableMaxRows: 10,
  tableMaxCols: 8
});
console.log(inspect.ndjson);

const preview = await workbook.render({
  sheetName: 'Revenue Scenarios',
  autoCrop: 'all',
  scale: 1,
  format: 'png'
});
await fs.writeFile(new URL('revenue-scenarios-preview.png', outputDir), new Uint8Array(await preview.arrayBuffer()));

const output = await SpreadsheetFile.exportXlsx(workbook);
await output.save(fileURLToPath(new URL('teng-smart-parking-revenue-model.xlsx', outputDir)));
