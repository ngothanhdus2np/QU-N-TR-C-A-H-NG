import type { DiagnosisRange } from '../../types';
import * as XLSX from 'xlsx';

export const calculateTimeContext = (
  range: DiagnosisRange,
  customStart: string,
  customEnd: string
) => {
  const now = new Date();
  const todayStr = now.toLocaleDateString('sv-SE');

  const yesterday = new Date(now);
  yesterday.setDate(now.getDate() - 1);
  const yesterdayStr = yesterday.toLocaleDateString('sv-SE');

  const last7 = new Date(now);
  last7.setDate(now.getDate() - 7);
  const last7Str = last7.toLocaleDateString('sv-SE');

  const thisMonthStart = new Date(now.getFullYear(), now.getMonth(), 1);
  const thisMonthStr = thisMonthStart.toLocaleDateString('sv-SE');

  const lastMonthStart = new Date(now.getFullYear(), now.getMonth() - 1, 1);
  const lastMonthEnd = new Date(now.getFullYear(), now.getMonth(), 0);
  const lastMonthStartStr = lastMonthStart.toLocaleDateString('sv-SE');
  const lastMonthEndStr = lastMonthEnd.toLocaleDateString('sv-SE');

  const thisYearStart = new Date(now.getFullYear(), 0, 1);
  const thisYearStr = thisYearStart.toLocaleDateString('sv-SE');

  let start = todayStr;
  let end = todayStr;

  switch (range) {
    case 'today':
      start = todayStr;
      end = todayStr;
      break;
    case 'yesterday':
      start = yesterdayStr;
      end = yesterdayStr;
      break;
    case 'last7':
      start = last7Str;
      end = todayStr;
      break;
    case 'thisMonth':
      start = thisMonthStr;
      end = todayStr;
      break;
    case 'lastMonth':
      start = lastMonthStartStr;
      end = lastMonthEndStr;
      break;
    case 'thisYear':
      start = thisYearStr;
      end = todayStr;
      break;
    case 'custom':
      start = customStart;
      end = customEnd;
      break;
    case 'all':
      start = '1900-01-01';
      end = '2100-12-31';
      break;
  }

  return { start, end };
};

export const isUUID = (id: string): boolean => {
  if (!id) return false;
  const regex = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
  return regex.test(id);
};

export const generateId = (): string => globalThis.crypto.randomUUID();

export const normalizeHeader = (val: unknown): string => {
  if (val === null || val === undefined) return '';
  // Chuẩn hóa chuỗi: bỏ dấu, bỏ khoảng trắng, chuyển chữ thường
  return String(val)
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[đĐ]/g, 'd')
    .replace(/[^a-z0-9]/g, '')
    .trim();
};

export const cleanVNNumber = (val: unknown): number => {
  if (typeof val === 'number') return isNaN(val) ? 0 : val;
  if (!val) return 0;
  const s = val.toString().trim();
  if (s === '' || s === '---' || s === '0') return 0;
  let cleanStr = s.replace(/[^\d.,-]/g, '');
  if (cleanStr.includes('.') && cleanStr.includes(',')) {
    cleanStr = cleanStr.replace(/\./g, '').replace(',', '.');
  } else if (cleanStr.includes(',')) {
    const parts = cleanStr.split(',');
    if (parts[parts.length - 1].length === 3) {
      cleanStr = cleanStr.replace(/,/g, '');
    } else {
      cleanStr = cleanStr.replace(',', '.');
    }
  } else if (cleanStr.includes('.')) {
    const parts = cleanStr.split('.');
    if (parts.length > 2 || parts[parts.length - 1].length === 3) {
      cleanStr = cleanStr.replace(/\./g, '');
    }
  }
  const num = parseFloat(cleanStr);
  return isNaN(num) ? 0 : num;
};

export const parseVNDate = (dateStr: unknown): string => {
  if (dateStr === null || dateStr === undefined || dateStr === '') return '';

  // Handle Javascript Date objects directly
  if (Object.prototype.toString.call(dateStr) === '[object Date]' || dateStr instanceof Date) {
    const d = dateStr as Date;
    if (isNaN(d.getTime())) return '';
    const y = d.getFullYear();
    const m = (d.getMonth() + 1).toString().padStart(2, '0');
    const day = d.getDate().toString().padStart(2, '0');
    return `${y}-${m}-${day}`;
  }

  if (typeof dateStr === 'number') {
    try {
      // Excel serial date to JS Date
      const d = new Date(Math.round((dateStr - 25569) * 86400 * 1000));
      if (isNaN(d.getTime())) return '';
      const y = d.getFullYear();
      const m = (d.getMonth() + 1).toString().padStart(2, '0');
      const day = d.getDate().toString().padStart(2, '0');
      return `${y}-${m}-${day}`;
    } catch {
      return '';
    }
  }

  const rawStr = String(dateStr).trim();
  if (!rawStr) return '';

  // Bỏ phần thời gian nếu có (vd: 2024-04-18 15:30:00 -> 2024-04-18)
  const sRaw = rawStr.split(' ')[0];
  const s = sRaw.replace(/[^\d\/\-\.]/g, '');
  if (!s) return '';

  const parts = s.split(/[\/\-\.]/);
  if (parts.length === 3) {
    let d = 0,
      m = 0,
      y = 0;
    const p0 = parseInt(parts[0]);
    const p1 = parseInt(parts[1]);
    const p2 = parseInt(parts[2]);

    if (p0 > 1000) {
      // YYYY-MM-DD
      y = p0;
      m = p1;
      d = p2;
    } else if (p2 > 1000) {
      // DD-MM-YYYY hoặc MM-DD-YYYY
      y = p2;
      // Thông thường ở VN là DD-MM-YYYY.
      // Nếu p0 > 12 thì chắc chắn p0 là ngày, p1 là tháng.
      if (p0 > 12) {
        d = p0;
        m = p1;
      }
      // Nếu p1 > 12 thì chắc chắn p1 là ngày, p0 là tháng (MM-DD-YYYY).
      else if (p1 > 12) {
        d = p1;
        m = p0;
      }
      // Còn lại (vd: 01/02/2024) thì mặc định theo VN là DD/MM/YYYY
      else {
        d = p0;
        m = p1;
      }
    }

    if (d >= 1 && d <= 31 && m >= 1 && m <= 12 && y > 1900 && y < 2100) {
      return `${y}-${m.toString().padStart(2, '0')}-${d.toString().padStart(2, '0')}`;
    }
  }
  return '';
};

export type ParsedExcelRow = Record<string, string | number | boolean | Date | null>;

type RawSpreadsheetCell = string | number | boolean | Date | null | undefined;

export const parseHierarchyGroups = (rawPath: unknown) => {
  const pathStr = rawPath === null || rawPath === undefined ? '' : String(rawPath).trim();
  if (!pathStr) return [];
  const parts = pathStr.split(' >> ');
  const nodes: { fullPath: string; name: string; level: number }[] = [];
  let currentPath = '';
  parts.forEach((part, index) => {
    const trimmedPart = part.trim();
    if (trimmedPart) {
      currentPath = currentPath ? `${currentPath} >> ${trimmedPart}` : trimmedPart;
      nodes.push({ fullPath: currentPath, name: trimmedPart, level: index + 1 });
    }
  });
  return nodes;
};

export const processExcelRawData = (
  data: ArrayBuffer | string,
  isExcel: boolean
): ParsedExcelRow[] => {
  let rows: RawSpreadsheetCell[][] = [];
  try {
    if (isExcel) {
      const workbook = XLSX.read(data, {
        type: 'array',
        cellDates: true,
        cellNF: false,
        cellText: false,
      });
      const firstSheet = workbook.Sheets[workbook.SheetNames[0]];
      rows = XLSX.utils.sheet_to_json<RawSpreadsheetCell[]>(firstSheet, { header: 1, defval: '' });
    } else {
      const text = (data as string).replace(/^\uFEFF/, '');
      const lines = text.split(/\r?\n/).filter(l => l.trim());
      const delimiter =
        (lines.join('\n').match(/;/g) || []).length > (lines.join('\n').match(/,/g) || []).length
          ? ';'
          : ',';
      rows = lines.map(line => line.split(delimiter));
    }
    if (rows.length === 0) return [];

    let headerRowIndex = -1;
    // Tìm dòng tiêu đề dựa trên mật độ từ khóa KiotViet/Standard
    const keywords = [
      'thoigian',
      'ngay',
      'time',
      'nhomhang',
      'doanhthu',
      'slban',
      'soluong',
      'tennhom',
      'giavon',
      'doanhthuthuan',
      'loinhuangop',
    ];
    let maxMatch = 0;

    for (let i = 0; i < Math.min(rows.length, 50); i++) {
      const cells = rows[i].map(c => normalizeHeader(c));
      const matchCount = cells.filter(c => keywords.includes(c)).length;
      if (matchCount > maxMatch) {
        maxMatch = matchCount;
        headerRowIndex = i;
      }
      if (matchCount >= 2) {
        headerRowIndex = i;
        break;
      }
    }

    if (headerRowIndex === -1) return [];

    const headers = rows[headerRowIndex].map(h => normalizeHeader(h));
    const dataRows = rows.slice(headerRowIndex + 1);

    return dataRows
      .map(row => {
        const obj: ParsedExcelRow = {};
        headers.forEach((h, idx) => {
          if (h) {
            const val = row[idx];
            obj[h] = val === null || val === undefined ? '' : val;
          }
        });
        return obj;
      })
      .filter(o => Object.values(o).some(v => v !== null && v !== '')); // Bỏ dòng rỗng hoàn toàn
  } catch (err) {
    console.error('Lỗi processExcelRawData:', err);
    return [];
  }
};
