import test from 'node:test';
import assert from 'node:assert/strict';
import { buildDocumentSubmissionStatusDocxBlob } from '../js/docx-report.mjs';

test('builds a real DOCX blob with table content and status markers', async () => {
  const rows = [
    {
      studentName: 'Alice Johnson',
      registerNo: '20240101',
      department: 'BSC CS',
      year: '2025-2028',
      documentTitle: 'ID Card',
      status: 'submitted',
      submittedDate: '2026-08-04 10:00'
    },
    {
      studentName: 'Bob Smith',
      registerNo: '20240102',
      department: 'BSC AI&ML',
      year: '2025-2028',
      documentTitle: 'Bonafide Certificate',
      status: 'pending'
    }
  ];

  const blob = await buildDocumentSubmissionStatusDocxBlob(rows, {
    department: 'Computer Science',
    year: '2025-2028'
  });

  assert.equal(blob.type, 'application/vnd.openxmlformats-officedocument.wordprocessingml.document');
  assert.ok(blob.size > 0, 'DOCX blob should not be empty');

  const buffer = Buffer.from(await blob.arrayBuffer());
  assert.ok(buffer.length > 0, 'DOCX bytes should be present');
  assert.deepEqual(buffer.subarray(0, 4), Buffer.from([0x50, 0x4b, 0x03, 0x04]), 'DOCX should be a ZIP-based Office document');
});
