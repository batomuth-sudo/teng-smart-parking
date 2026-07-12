import fs from 'node:fs/promises';
import path from 'node:path';
import { SpreadsheetFile, Workbook } from '@oai/artifact-tool';

const outputDir = path.resolve('outputs');
const outputPath = path.join(outputDir, 'teng-smart-parking-operations-log.xlsx');

const workbook = Workbook.create();
const log = workbook.worksheets.add('Parking Log');
const summary = workbook.worksheets.add('Daily Summary');
const lookup = workbook.worksheets.add('Lookup');

for (const sheet of [log, summary, lookup]) {
  sheet.showGridLines = false;
}

log.getRange('A1:R1').values = [[
  'Event ID',
  'Session ID',
  'Payment ID',
  'Charge ID',
  'Event Type',
  'Status',
  'Entry Time',
  'Paid Time',
  'Exit Time',
  'Plate',
  'Normalized Plate',
  'Package',
  'Amount THB',
  'Overtime THB',
  'Gate ID',
  'Token Last 6',
  'Source',
  'Notes'
]];

log.getRange('A2:R6').values = [
  ['evt_sample_001', 'sess_sample_001', 'pay_sample_001', 'chrg_test_sample', 'entry_created', 'pending_payment', '2026-07-12 08:00', '', '', 'UBON-1234', 'UBON1234', '1h', 20, 0, 'entry-1', 'abc123', 'system', 'ตัวอย่าง / sample row'],
  ['evt_sample_002', 'sess_sample_001', 'pay_sample_001', 'chrg_test_sample', 'payment_confirmed', 'paid', '2026-07-12 08:00', '2026-07-12 08:01', '', 'UBON-1234', 'UBON1234', '1h', 20, 0, 'entry-1', 'abc123', 'opn_webhook', 'Payment success'],
  ['evt_sample_003', 'sess_sample_001', 'pay_sample_001', 'chrg_test_sample', 'exit_approved', 'closed', '2026-07-12 08:00', '2026-07-12 08:01', '2026-07-12 08:50', 'UBON-1234', 'UBON1234', '1h', 20, 0, 'exit-1', 'abc123', 'system', 'No overtime'],
  ['evt_sample_004', 'sess_sample_002', 'pay_sample_002', 'chrg_test_sample_2', 'entry_created', 'pending_payment', '2026-07-12 09:15', '', '', 'UBON-5678', 'UBON5678', 'custom-hour-3', 60, 0, 'entry-1', 'def456', 'system', 'Custom duration'],
  ['evt_sample_005', 'sess_sample_002', 'pay_sample_002', 'chrg_test_sample_2', 'payment_confirmed', 'paid', '2026-07-12 09:15', '2026-07-12 09:16', '', 'UBON-5678', 'UBON5678', 'custom-hour-3', 60, 0, 'entry-1', 'def456', 'opn_webhook', 'Payment success']
];

log.tables.add('A1:R6', true, 'ParkingLogTable');
log.freezePanes.freezeRows(1);
log.getRange('A1:R1').format = {
  fill: '#111111',
  font: { bold: true, color: '#FFFFFF' },
  wrapText: true
};
log.getRange('A:R').format.font = { name: 'Aptos', size: 10 };
log.getRange('G:I').format.numberFormat = '@';
log.getRange('M:N').format.numberFormat = '#,##0';
log.getRange('A:R').format.autofitColumns();

summary.getRange('A1:H1').values = [['TENG Smart Parking - Daily Summary', null, null, null, null, null, null, null]];
summary.getRange('A1:H1').merge();
summary.getRange('A1:H1').format = {
  fill: '#111111',
  font: { bold: true, color: '#FFFFFF', size: 16 }
};

summary.getRange('A3:H3').values = [[
  'Date',
  'Entry Events',
  'Paid Events',
  'Exit Events',
  'Gross THB',
  'Overtime THB',
  'Total THB',
  'Unique Plates'
]];
summary.getRange('A4:A17').values = Array.from({ length: 14 }, (_, index) => {
  const date = new Date('2026-07-12T00:00:00.000Z');
  date.setUTCDate(date.getUTCDate() + index);
  return [date];
});
summary.getRange('B4').formulas = [['=SUMPRODUCT(--(\'Parking Log\'!$E$2:$E$1000="entry_created"),--(LEFT(\'Parking Log\'!$G$2:$G$1000,10)=TEXT(A4,"yyyy-mm-dd")))']];
summary.getRange('C4').formulas = [['=SUMPRODUCT(--(\'Parking Log\'!$E$2:$E$1000="payment_confirmed"),--(LEFT(\'Parking Log\'!$H$2:$H$1000,10)=TEXT(A4,"yyyy-mm-dd")))']];
summary.getRange('D4').formulas = [['=SUMPRODUCT(--(\'Parking Log\'!$E$2:$E$1000="exit_approved"),--(LEFT(\'Parking Log\'!$I$2:$I$1000,10)=TEXT(A4,"yyyy-mm-dd")))']];
summary.getRange('E4').formulas = [['=SUMPRODUCT(--(\'Parking Log\'!$E$2:$E$1000="payment_confirmed"),--(LEFT(\'Parking Log\'!$H$2:$H$1000,10)=TEXT(A4,"yyyy-mm-dd")),\'Parking Log\'!$M$2:$M$1000)']];
summary.getRange('F4').formulas = [['=SUMPRODUCT(--(LEFT(\'Parking Log\'!$I$2:$I$1000,10)=TEXT(A4,"yyyy-mm-dd")),\'Parking Log\'!$N$2:$N$1000)']];
summary.getRange('G4').formulas = [['=E4+F4']];
summary.getRange('H4').formulas = [['=COUNTA(UNIQUE(FILTER(\'Parking Log\'!$J$2:$J$1000,LEFT(\'Parking Log\'!$G$2:$G$1000,10)=TEXT(A4,"yyyy-mm-dd"))))']];
summary.getRange('B4:H17').fillDown();
summary.getRange('A3:H3').format = {
  fill: '#D6AD60',
  font: { bold: true, color: '#111111' }
};
summary.getRange('A4:A17').format.numberFormat = 'yyyy-mm-dd';
summary.getRange('E4:G17').format.numberFormat = '#,##0';
summary.getRange('A3:H17').format.borders = { preset: 'all', style: 'thin', color: '#D9D9D9' };
summary.getRange('A:H').format.autofitColumns();
summary.freezePanes.freezeRows(3);

lookup.getRange('A1:C1').values = [['Field', 'Meaning', 'Notes']];
lookup.getRange('A2:C11').values = [
  ['entry_created', 'Customer started parking session', 'Created when plate + duration are submitted'],
  ['payment_confirmed', 'Payment succeeded', 'From Opn webhook or demo confirm'],
  ['exit_approved', 'Customer allowed to leave', 'No overtime or overtime paid'],
  ['manual_gate_open', 'Manual/admin gate open', 'Requires ADMIN_GATE_TOKEN'],
  ['status pending_payment', 'Waiting for payment', 'Do not open gate'],
  ['status paid', 'Paid and active', 'Entry gate may open'],
  ['status closed', 'Session finished', 'Exit completed'],
  ['Amount THB', 'Base parking fee', 'Gross amount before fees'],
  ['Overtime THB', 'Extra parking fee', 'Rounded up by policy'],
  ['Token Last 6', 'Debug-friendly token reference', 'Never store full token in public reports']
];
lookup.getRange('A1:C1').format = {
  fill: '#111111',
  font: { bold: true, color: '#FFFFFF' }
};
lookup.getRange('A:C').format.autofitColumns();

await fs.mkdir(outputDir, { recursive: true });
const preview = await workbook.render({ sheetName: 'Parking Log', autoCrop: 'all', scale: 1, format: 'png' });
await fs.writeFile(path.join(outputDir, 'teng-smart-parking-operations-log-preview.png'), new Uint8Array(await preview.arrayBuffer()));
const output = await SpreadsheetFile.exportXlsx(workbook);
await output.save(outputPath);

console.log(outputPath);
