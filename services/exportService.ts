
import * as XLSX from 'xlsx';

// Xuất dữ liệu ra file Excel (.xlsx)
export function exportToExcel(rows: Record<string, any>[], fileName: string, sheetName = 'Sheet1'): void {
  const ws = XLSX.utils.json_to_sheet(rows);

  // Tự động điều chỉnh độ rộng cột theo nội dung
  const colWidths = Object.keys(rows[0] ?? {}).map(key => {
    const maxLen = Math.max(
      key.length,
      ...rows.map(r => String(r[key] ?? '').length)
    );
    return { wch: Math.min(maxLen + 2, 50) };
  });
  ws['!cols'] = colWidths;

  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, sheetName);
  XLSX.writeFile(wb, `${fileName}_${new Date().toLocaleDateString('sv-SE')}.xlsx`);
}

// Xuất nhiều sheet trong cùng 1 file Excel
export function exportToExcelMultiSheet(
  sheets: { name: string; rows: Record<string, any>[] }[],
  fileName: string
): void {
  const wb = XLSX.utils.book_new();
  for (const sheet of sheets) {
    const ws = XLSX.utils.json_to_sheet(sheet.rows);
    const colWidths = Object.keys(sheet.rows[0] ?? {}).map(key => {
      const maxLen = Math.max(key.length, ...sheet.rows.map(r => String(r[key] ?? '').length));
      return { wch: Math.min(maxLen + 2, 50) };
    });
    ws['!cols'] = colWidths;
    XLSX.utils.book_append_sheet(wb, ws, sheet.name);
  }
  XLSX.writeFile(wb, `${fileName}_${new Date().toLocaleDateString('sv-SE')}.xlsx`);
}

// Mở cửa sổ in PDF — nhận HTML content, tự print & đóng
export function printToPDF(title: string, htmlBody: string): void {
  const win = window.open('', '_blank');
  if (!win) return;
  win.document.write(`<!DOCTYPE html><html><head>
    <meta charset="utf-8"/>
    <title>${title}</title>
    <style>
      * { box-sizing: border-box; margin: 0; padding: 0; }
      body { font-family: Arial, sans-serif; font-size: 11px; color: #111; padding: 20px; }
      h1 { font-size: 16px; font-weight: bold; margin-bottom: 4px; }
      h2 { font-size: 13px; font-weight: bold; margin: 16px 0 6px; }
      p.subtitle { font-size: 10px; color: #555; margin-bottom: 16px; }
      table { width: 100%; border-collapse: collapse; margin-bottom: 16px; }
      th { background: #1e293b; color: white; padding: 6px 8px; text-align: left; font-size: 10px; font-weight: bold; }
      td { padding: 5px 8px; border-bottom: 1px solid #e2e8f0; font-size: 10px; }
      tr:nth-child(even) td { background: #f8fafc; }
      .total-row td { font-weight: bold; background: #f1f5f9; border-top: 2px solid #334155; }
      .text-right { text-align: right; }
      @page { size: A4; margin: 15mm; }
    </style>
  </head><body>${htmlBody}</body></html>`);
  win.document.close();
  win.onload = () => { win.print(); setTimeout(() => win.close(), 500); };
}

// Format số tiền VND
export function fmtVND(n: number): string {
  return Number(n || 0).toLocaleString('vi-VN') + 'đ';
}
