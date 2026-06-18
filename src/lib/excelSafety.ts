const XLSX_ZIP_SIGNATURE = [0x50, 0x4b];
const XLS_OLE_SIGNATURE = [0xd0, 0xcf, 0x11, 0xe0];

export const EXCEL_MAX_FILE_SIZE_BYTES = 10 * 1024 * 1024;
export const EXCEL_MAX_ROWS = 50000;

const getBytes = (input: ArrayBuffer | Uint8Array): Uint8Array =>
  input instanceof Uint8Array ? input : new Uint8Array(input);

export function assertSafeExcelBuffer(
  input: ArrayBuffer | Uint8Array,
  fileName = 'file',
  maxBytes = EXCEL_MAX_FILE_SIZE_BYTES
) {
  const bytes = getBytes(input);
  if (bytes.byteLength === 0) {
    throw new Error(`${fileName} trống.`);
  }
  if (bytes.byteLength > maxBytes) {
    throw new Error(`${fileName} vượt quá ${Math.round(maxBytes / 1024 / 1024)}MB.`);
  }

  const isXlsxZip =
    bytes[0] === XLSX_ZIP_SIGNATURE[0] &&
    bytes[1] === XLSX_ZIP_SIGNATURE[1];
  const isLegacyXls = XLS_OLE_SIGNATURE.every((byte, index) => bytes[index] === byte);

  if (!isXlsxZip && !isLegacyXls) {
    throw new Error(`${fileName} không phải file Excel hợp lệ.`);
  }
}

export function assertSafeExcelFile(file: File, maxBytes = EXCEL_MAX_FILE_SIZE_BYTES) {
  const name = file.name.toLowerCase();
  if (!name.endsWith('.xlsx') && !name.endsWith('.xls')) {
    throw new Error('Chỉ hỗ trợ file .xlsx hoặc .xls.');
  }
  if (file.size > maxBytes) {
    throw new Error(`File vượt quá ${Math.round(maxBytes / 1024 / 1024)}MB.`);
  }
}
