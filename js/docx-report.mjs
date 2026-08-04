async function loadDocxModule() {
  return import('./vendor/docx/index.mjs');
}

function formatValue(value) {
  return String(value ?? '').trim();
}

function buildMetadataParagraph(docx, label, value) {
  return new docx.Paragraph({
    children: [
      new docx.TextRun({ text: `${label}: `, bold: true }),
      new docx.TextRun({ text: formatValue(value) })
    ],
    spacing: { after: 120 }
  });
}

function buildTableCell(docx, value, { bold = false, shading, centered = false } = {}) {
  return new docx.TableCell({
    children: [new docx.Paragraph({
      children: [new docx.TextRun({ text: formatValue(value), bold, size: 18 })],
      alignment: centered ? docx.AlignmentType.CENTER : docx.AlignmentType.LEFT,
      spacing: { after: 40 }
    })],
    shading: shading ? { fill: shading } : undefined
  });
}

function buildTable(docx, reportData) {
  const documentTitles = Array.isArray(reportData?.documentTitles) ? reportData.documentTitles : [];
  const students = Array.isArray(reportData?.students) ? reportData.students : [];
  const headerCells = [
    'S.No',
    'Student Name',
    'Register Number',
    'Department',
    'Year',
    ...documentTitles
  ];

  const headerRow = new docx.TableRow({
    children: headerCells.map((cellText) => buildTableCell(docx, cellText, { bold: true, shading: 'D9EAF7', centered: true })),
    tableHeader: true
  });

  const bodyRows = students.map((student, index) => new docx.TableRow({
    children: [
      buildTableCell(docx, index + 1, { centered: true }),
      buildTableCell(docx, student.studentName),
      buildTableCell(docx, student.registerNo),
      buildTableCell(docx, student.department),
      buildTableCell(docx, student.year),
      ...documentTitles.map((title) => buildTableCell(
        docx,
        student.submittedByTitle?.[title] ? '\u2705' : '\u274c',
        { centered: true }
      ))
    ]
  }));

  return new docx.Table({
    rows: [headerRow, ...bodyRows],
    width: { size: 100, type: docx.WidthType.PERCENTAGE },
    borders: {
      top: { style: docx.BorderStyle.SINGLE, size: 1, color: '000000' },
      bottom: { style: docx.BorderStyle.SINGLE, size: 1, color: '000000' },
      left: { style: docx.BorderStyle.SINGLE, size: 1, color: '000000' },
      right: { style: docx.BorderStyle.SINGLE, size: 1, color: '000000' },
      insideHorizontal: { style: docx.BorderStyle.SINGLE, size: 1, color: '000000' },
      insideVertical: { style: docx.BorderStyle.SINGLE, size: 1, color: '000000' }
    }
  });
}

export async function buildDocumentSubmissionStatusDocxBlob(reportData, teacherProfile) {
  const docx = await loadDocxModule();
  const generatedAt = new Date().toLocaleString();
  const doc = new docx.Document({
    sections: [{
      properties: {},
      children: [
        new docx.Paragraph({
          children: [new docx.TextRun({ text: 'Document Submission Status Report', bold: true, size: 32 })],
          spacing: { after: 240 }
        }),
        buildMetadataParagraph(docx, 'Generated', generatedAt),
        buildMetadataParagraph(docx, 'Teacher Name', teacherProfile?.name || ''),
        buildMetadataParagraph(docx, 'Teacher Department', teacherProfile?.department || ''),
        buildMetadataParagraph(docx, 'Teacher Year/Class Filter', teacherProfile?.year || ''),
        new docx.Paragraph({ children: [new docx.TextRun({ text: '' })], spacing: { after: 240 } }),
        buildTable(docx, reportData)
      ]
    }]
  });

  return docx.Packer.toBlob(doc);
}
