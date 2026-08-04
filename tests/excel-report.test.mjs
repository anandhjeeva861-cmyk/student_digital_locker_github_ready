import test from 'node:test';
import assert from 'node:assert/strict';
import ExcelJS from 'exceljs';
import { buildDocumentSubmissionStatusExcelBlob } from '../js/excel-report.mjs';

test('builds a table-only Excel submission status workbook', async () => {
  const blob = await buildDocumentSubmissionStatusExcelBlob({
    documentTitles: ['AADHAR CARD', 'INCOME CERTIFICATE', 'TC'],
    students: [
      {
        studentName: 'Alice Johnson',
        registerNo: '20240101',
        department: 'BSC CS',
        year: '2025-2028',
        submittedByTitle: {
          'AADHAR CARD': true,
          'INCOME CERTIFICATE': false,
          TC: true
        }
      },
      {
        studentName: 'Bob Smith',
        registerNo: '20240102',
        department: 'BSC AI&ML',
        year: '2025-2028',
        submittedByTitle: {
          'AADHAR CARD': false,
          'INCOME CERTIFICATE': true,
          TC: false
        }
      }
    ]
  });

  assert.equal(blob.type, 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
  assert.ok(blob.size > 0, 'Excel blob should not be empty');

  const workbook = new ExcelJS.Workbook();
  await workbook.xlsx.load(Buffer.from(await blob.arrayBuffer()));
  const worksheet = workbook.worksheets[0];
  const rows = [];
  worksheet.eachRow((row) => rows.push(row.values.slice(1)));

  assert.equal(workbook.worksheets.length, 1);
  assert.equal(worksheet.name, 'Submission Status');
  assert.deepEqual(rows[0], ['S.No', 'Student Name', 'Register Number', 'Department', 'Year', 'AADHAR CARD', 'INCOME CERTIFICATE', 'TC']);
  assert.deepEqual(rows[1], [1, 'Alice Johnson', '20240101', 'BSC CS', '2025-2028', '\u2705', '\u274c', '\u2705']);
  assert.deepEqual(rows[2], [2, 'Bob Smith', '20240102', 'BSC AI&ML', '2025-2028', '\u274c', '\u2705', '\u274c']);
  assert.equal(worksheet.views[0].state, 'frozen');
  assert.equal(worksheet.views[0].ySplit, 1);
});
