async function loadDocxModule() {
  return import('./vendor/docx/index.mjs');
}

function formatValue(value) {
  return String(value ?? '').trim();
}

function buildMetadataParagraph(docx, label, value) {
  return new docx.Paragraph({
    children: [
      new docx.TextRun({ text: `${label}: `, bold: true, size: 20, font: 'Arial' }),
      new docx.TextRun({ text: formatValue(value), size: 20, font: 'Arial' })
    ],
    spacing: { after: 120 }
  });
}

const PAGE_WIDTH_TWIPS = 16838;
const PAGE_HEIGHT_TWIPS = 11906;
const NARROW_MARGIN_TWIPS = 360;
const TABLE_WIDTH_TWIPS = PAGE_WIDTH_TWIPS - (NARROW_MARGIN_TWIPS * 2);
const BASE_COLUMN_WIDTHS = [520, 2200, 1800, 1800, 700];
const MIN_STATUS_COLUMN_WIDTH = 520;
const BORDER = { style: 'single', size: 4, color: '7F8FA6' };

function calculateColumnWidths(documentTitleCount) {
  const baseWidth = BASE_COLUMN_WIDTHS.reduce((total, width) => total + width, 0);
  const statusWidth = documentTitleCount
    ? Math.max(MIN_STATUS_COLUMN_WIDTH, Math.floor((TABLE_WIDTH_TWIPS - baseWidth) / documentTitleCount))
    : 0;
  return [
    ...BASE_COLUMN_WIDTHS,
    ...Array(documentTitleCount).fill(statusWidth)
  ];
}

function buildTableCell(docx, value, { bold = false, shading, centered = false, width, fontSize = 16 } = {}) {
  return new docx.TableCell({
    children: [new docx.Paragraph({
      children: [new docx.TextRun({ text: formatValue(value), bold, size: fontSize, font: 'Arial' })],
      alignment: centered ? docx.AlignmentType.CENTER : docx.AlignmentType.LEFT,
      spacing: { before: 0, after: 0 }
    })],
    width: width ? { size: width, type: docx.WidthType.DXA } : undefined,
    verticalAlign: docx.VerticalAlignTable.CENTER,
    margins: {
      top: 60,
      bottom: 60,
      left: 80,
      right: 80
    },
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
  const columnWidths = calculateColumnWidths(documentTitles.length);

  const headerRow = new docx.TableRow({
    children: headerCells.map((cellText, index) => buildTableCell(docx, cellText, {
      bold: true,
      shading: 'D9EAF7',
      centered: true,
      width: columnWidths[index],
      fontSize: 16
    })),
    tableHeader: true,
    cantSplit: true,
    height: { value: 560, rule: docx.HeightRule.ATLEAST }
  });

  const bodyRows = students.map((student, index) => new docx.TableRow({
    children: [
      buildTableCell(docx, index + 1, { centered: true, width: columnWidths[0] }),
      buildTableCell(docx, student.studentName, { width: columnWidths[1] }),
      buildTableCell(docx, student.registerNo, { width: columnWidths[2] }),
      buildTableCell(docx, student.department, { width: columnWidths[3] }),
      buildTableCell(docx, student.year, { centered: true, width: columnWidths[4] }),
      ...documentTitles.map((title, titleIndex) => buildTableCell(
        docx,
        student.submittedByTitle?.[title] ? '\u2705' : '\u274c',
        { centered: true, width: columnWidths[titleIndex + BASE_COLUMN_WIDTHS.length], fontSize: 18 }
      ))
    ],
    cantSplit: true,
    height: { value: 420, rule: docx.HeightRule.ATLEAST }
  }));

  return new docx.Table({
    rows: [headerRow, ...bodyRows],
    width: { size: TABLE_WIDTH_TWIPS, type: docx.WidthType.DXA },
    columnWidths,
    layout: docx.TableLayoutType.FIXED,
    alignment: docx.AlignmentType.CENTER,
    margins: {
      top: 0,
      bottom: 0,
      left: 60,
      right: 60
    },
    tableLook: {
      firstRow: true,
      noHBand: true,
      noVBand: true
    },
    borders: {
      top: BORDER,
      bottom: BORDER,
      left: BORDER,
      right: BORDER,
      insideHorizontal: BORDER,
      insideVertical: BORDER
    }
  });
}

export async function buildDocumentSubmissionStatusDocxBlob(reportData, teacherProfile) {
  const docx = await loadDocxModule();
  const generatedAt = new Date().toLocaleString();
  const doc = new docx.Document({
    sections: [{
      properties: {
        page: {
          size: {
            width: PAGE_HEIGHT_TWIPS,
            height: PAGE_WIDTH_TWIPS,
            orientation: docx.PageOrientation.LANDSCAPE
          },
          margin: {
            top: NARROW_MARGIN_TWIPS,
            right: NARROW_MARGIN_TWIPS,
            bottom: NARROW_MARGIN_TWIPS,
            left: NARROW_MARGIN_TWIPS,
            header: 180,
            footer: 180
          }
        }
      },
      children: [
        new docx.Paragraph({
          children: [new docx.TextRun({ text: 'Document Submission Status Report', bold: true, size: 28, font: 'Arial' })],
          spacing: { after: 180 }
        }),
        buildMetadataParagraph(docx, 'Generated', generatedAt),
        buildMetadataParagraph(docx, 'Teacher Name', teacherProfile?.name || ''),
        buildMetadataParagraph(docx, 'Teacher Department', teacherProfile?.department || ''),
        buildMetadataParagraph(docx, 'Teacher Year/Class Filter', teacherProfile?.year || ''),
        new docx.Paragraph({ children: [new docx.TextRun({ text: '' })], spacing: { after: 120 } }),
        buildTable(docx, reportData)
      ]
    }]
  });

  return docx.Packer.toBlob(doc);
}
