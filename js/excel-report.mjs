const EXCEL_MIME_TYPE = 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet';
const HEADER_FILL = 'FFD9EAF7';
const BORDER_COLOR = 'FF7F8FA6';
const BASE_HEADERS = ['S.No', 'Student Name', 'Register Number', 'Department', 'Year'];
const BASE_COLUMN_WIDTHS = [8, 28, 20, 24, 12];

async function loadExcelModule() {
  const module = await import('./vendor/exceljs/exceljs.min.js');
  const ExcelJS = module.default || module['module.exports'] || globalThis.ExcelJS;
  if (!ExcelJS) throw new Error('Excel report library failed to load.');
  return ExcelJS;
}

function formatValue(value) {
  return String(value ?? '').trim();
}

function documentColumnWidth(title) {
  return Math.min(20, Math.max(12, formatValue(title).length + 2));
}

function cellBorder() {
  return {
    top: { style: 'thin', color: { argb: BORDER_COLOR } },
    left: { style: 'thin', color: { argb: BORDER_COLOR } },
    bottom: { style: 'thin', color: { argb: BORDER_COLOR } },
    right: { style: 'thin', color: { argb: BORDER_COLOR } }
  };
}

export async function buildDocumentSubmissionStatusExcelBlob(reportData) {
  const ExcelJS = await loadExcelModule();
  const documentTitles = Array.isArray(reportData?.documentTitles) ? reportData.documentTitles : [];
  const students = Array.isArray(reportData?.students) ? reportData.students : [];
  const headers = [...BASE_HEADERS, ...documentTitles];
  const workbook = new ExcelJS.Workbook();
  const worksheet = workbook.addWorksheet('Submission Status', {
    views: [{ state: 'frozen', ySplit: 1 }]
  });

  worksheet.columns = [
    ...BASE_HEADERS.map((header, index) => ({ header, key: `base${index}`, width: BASE_COLUMN_WIDTHS[index] })),
    ...documentTitles.map((title, index) => ({ header: title, key: `document${index}`, width: documentColumnWidth(title) }))
  ];

  worksheet.getRow(1).height = 28;
  worksheet.getRow(1).eachCell((cell) => {
    cell.font = { bold: true, size: 9, name: 'Arial' };
    cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: HEADER_FILL } };
    cell.alignment = { horizontal: 'center', vertical: 'middle', wrapText: true };
    cell.border = cellBorder();
  });

  students.forEach((student, index) => {
    const row = worksheet.addRow([
      index + 1,
      formatValue(student.studentName),
      formatValue(student.registerNo),
      formatValue(student.department),
      formatValue(student.year),
      ...documentTitles.map((title) => (student.submittedByTitle?.[title] ? '\u2705' : '\u274c'))
    ]);
    row.height = 22;
  });

  worksheet.eachRow((row, rowNumber) => {
    row.eachCell((cell, columnNumber) => {
      cell.font = rowNumber === 1 ? cell.font : { size: 9, name: 'Arial' };
      cell.border = cell.border || cellBorder();
      cell.alignment = {
        horizontal: columnNumber === 1 || columnNumber >= BASE_HEADERS.length + 1 ? 'center' : 'left',
        vertical: 'middle',
        wrapText: rowNumber === 1
      };
    });
  });

  worksheet.autoFilter = {
    from: { row: 1, column: 1 },
    to: { row: 1, column: headers.length }
  };

  const buffer = await workbook.xlsx.writeBuffer();
  return new Blob([buffer], { type: EXCEL_MIME_TYPE });
}
