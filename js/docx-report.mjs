import { Document, Packer, Paragraph, Table, TableCell, TableRow, TextRun, WidthType, BorderStyle } from '../node_modules/docx/dist/index.mjs';

function formatValue(value) {
  return String(value ?? '').trim();
}

function formatStatus(status, submittedDate) {
  if (status === 'submitted') return '✅ Submitted';
  if (status === 'pending') return '❌ Not Submitted';
  return '❌ Not Submitted';
}

function formatSubmittedDate(submittedDate) {
  if (!submittedDate) return '—';
  return submittedDate;
}

function buildMetadataParagraph(label, value) {
  return new Paragraph({
    children: [
      new TextRun({ text: `${label}: `, bold: true }),
      new TextRun({ text: formatValue(value) })
    ],
    spacing: { after: 120 }
  });
}

function buildTable(rows, teacherProfile) {
  const headerCells = [
    'S.No',
    'Student Name',
    'Register Number',
    'Department',
    'Year',
    'Required Document',
    'Submission Status',
    'Submitted Date'
  ];

  const headerRow = new TableRow({
    children: headerCells.map((cellText) => new TableCell({
      children: [new Paragraph({ children: [new TextRun({ text: cellText, bold: true, size: 24 })], spacing: { after: 60 } })],
      borders: {
        top: { style: BorderStyle.SINGLE, size: 1, color: '000000' },
        bottom: { style: BorderStyle.SINGLE, size: 1, color: '000000' },
        left: { style: BorderStyle.SINGLE, size: 1, color: '000000' },
        right: { style: BorderStyle.SINGLE, size: 1, color: '000000' }
      },
      shading: { fill: 'D9EAF7' }
    })),
    tableHeader: true
  });

  const bodyRows = rows.map((row, index) => new TableRow({
    children: [
      new TableCell({ children: [new Paragraph(String(index + 1))], borders: { top: { style: BorderStyle.SINGLE, size: 1, color: '000000' }, bottom: { style: BorderStyle.SINGLE, size: 1, color: '000000' }, left: { style: BorderStyle.SINGLE, size: 1, color: '000000' }, right: { style: BorderStyle.SINGLE, size: 1, color: '000000' } } }),
      new TableCell({ children: [new Paragraph(formatValue(row.studentName))], borders: { top: { style: BorderStyle.SINGLE, size: 1, color: '000000' }, bottom: { style: BorderStyle.SINGLE, size: 1, color: '000000' }, left: { style: BorderStyle.SINGLE, size: 1, color: '000000' }, right: { style: BorderStyle.SINGLE, size: 1, color: '000000' } } }),
      new TableCell({ children: [new Paragraph(formatValue(row.registerNo))], borders: { top: { style: BorderStyle.SINGLE, size: 1, color: '000000' }, bottom: { style: BorderStyle.SINGLE, size: 1, color: '000000' }, left: { style: BorderStyle.SINGLE, size: 1, color: '000000' }, right: { style: BorderStyle.SINGLE, size: 1, color: '000000' } } }),
      new TableCell({ children: [new Paragraph(formatValue(row.department))], borders: { top: { style: BorderStyle.SINGLE, size: 1, color: '000000' }, bottom: { style: BorderStyle.SINGLE, size: 1, color: '000000' }, left: { style: BorderStyle.SINGLE, size: 1, color: '000000' }, right: { style: BorderStyle.SINGLE, size: 1, color: '000000' } } }),
      new TableCell({ children: [new Paragraph(formatValue(row.year))], borders: { top: { style: BorderStyle.SINGLE, size: 1, color: '000000' }, bottom: { style: BorderStyle.SINGLE, size: 1, color: '000000' }, left: { style: BorderStyle.SINGLE, size: 1, color: '000000' }, right: { style: BorderStyle.SINGLE, size: 1, color: '000000' } } }),
      new TableCell({ children: [new Paragraph(formatValue(row.documentTitle))], borders: { top: { style: BorderStyle.SINGLE, size: 1, color: '000000' }, bottom: { style: BorderStyle.SINGLE, size: 1, color: '000000' }, left: { style: BorderStyle.SINGLE, size: 1, color: '000000' }, right: { style: BorderStyle.SINGLE, size: 1, color: '000000' } } }),
      new TableCell({ children: [new Paragraph(formatStatus(row.status, row.submittedDate))], borders: { top: { style: BorderStyle.SINGLE, size: 1, color: '000000' }, bottom: { style: BorderStyle.SINGLE, size: 1, color: '000000' }, left: { style: BorderStyle.SINGLE, size: 1, color: '000000' }, right: { style: BorderStyle.SINGLE, size: 1, color: '000000' } } }),
      new TableCell({ children: [new Paragraph(formatSubmittedDate(row.submittedDate))], borders: { top: { style: BorderStyle.SINGLE, size: 1, color: '000000' }, bottom: { style: BorderStyle.SINGLE, size: 1, color: '000000' }, left: { style: BorderStyle.SINGLE, size: 1, color: '000000' }, right: { style: BorderStyle.SINGLE, size: 1, color: '000000' } } })
    ]
  }));

  return new Table({
    rows: [headerRow, ...bodyRows],
    width: { size: 100, type: WidthType.PERCENTAGE },
    borders: {
      top: { style: BorderStyle.SINGLE, size: 1, color: '000000' },
      bottom: { style: BorderStyle.SINGLE, size: 1, color: '000000' },
      left: { style: BorderStyle.SINGLE, size: 1, color: '000000' },
      right: { style: BorderStyle.SINGLE, size: 1, color: '000000' },
      insideHorizontal: { style: BorderStyle.SINGLE, size: 1, color: '000000' },
      insideVertical: { style: BorderStyle.SINGLE, size: 1, color: '000000' }
    }
  });
}

export async function buildDocumentSubmissionStatusDocxBlob(reportRows, teacherProfile) {
  const generatedAt = new Date().toLocaleString();
  const doc = new Document({
    sections: [{
      properties: {},
      children: [
        new Paragraph({
          children: [new TextRun({ text: 'Document Submission Status Report', bold: true, size: 32 })],
          spacing: { after: 240 }
        }),
        buildMetadataParagraph('Generated', generatedAt),
        buildMetadataParagraph('Teacher Name', teacherProfile?.name || ''),
        buildMetadataParagraph('Teacher Department', teacherProfile?.department || ''),
        buildMetadataParagraph('Teacher Year/Class Filter', teacherProfile?.year || ''),
        new Paragraph({ children: [new TextRun({ text: '' })], spacing: { after: 240 } }),
        buildTable(reportRows, teacherProfile)
      ]
    }]
  });

  return Packer.toBlob(doc);
}
