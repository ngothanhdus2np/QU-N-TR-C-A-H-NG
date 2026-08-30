import type { POSProduct } from '../../../types';

const BARCODE_LABEL_TEMPLATE_STORAGE_KEY = 'barcode_label_template_settings';

export interface BarcodeLabelTemplateSettings {
  widthMm: number;
  heightMm: number;
  columns: number;
  showName: boolean;
  showPrice: boolean;
  showCode: boolean;
  showBorder: boolean;
}

const DEFAULT_BARCODE_LABEL_TEMPLATE: BarcodeLabelTemplateSettings = {
  widthMm: 35,
  heightMm: 22,
  columns: 2,
  showName: true,
  showPrice: true,
  showCode: true,
  showBorder: false,
};

const escapeLabelText = (value: string | number | undefined) =>
  String(value ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');

const CODE_128_PATTERNS = [
  '212222', '222122', '222221', '121223', '121322', '131222', '122213', '122312',
  '132212', '221213', '221312', '231212', '112232', '122132', '122231', '113222',
  '123122', '123221', '223211', '221132', '221231', '213212', '223112', '312131',
  '311222', '321122', '321221', '312212', '322112', '322211', '212123', '212321',
  '232121', '111323', '131123', '131321', '112313', '132113', '132311', '211313',
  '231113', '231311', '112133', '112331', '132131', '113123', '113321', '133121',
  '313121', '211331', '231131', '213113', '213311', '213131', '311123', '311321',
  '331121', '312113', '312311', '332111', '314111', '221411', '431111', '111224',
  '111422', '121124', '121421', '141122', '141221', '112214', '112412', '122114',
  '122411', '142112', '142211', '241211', '221114', '413111', '241112', '134111',
  '111242', '121142', '121241', '114212', '124112', '124211', '411212', '421112',
  '421211', '212141', '214121', '412121', '111143', '111341', '131141', '114113',
  '114311', '411113', '411311', '113141', '114131', '311141', '411131', '211412',
  '211214', '211232', '2331112',
];

export const normalizeCode128Text = (value: string) =>
  value
    .trim()
    .replace(/[^\x20-\x7E]/g, '')
    .slice(0, 32);

export interface Code128SvgOptions {
  /**
   * Chiều cao dùng cho <rect> và viewBox. KHÔNG phải kích thước hiển thị thật —
   * CSS mới quyết định điều đó. Nhưng nơi nào đặt `height: auto` thì con số này
   * chính là tỉ lệ khung hình, nên đổi nó là đổi độ cao tem in ra.
   * Mặc định 40 (giá trị lịch sử của chính file này).
   */
  height?: number;
  /** Gắn aria-label vào <svg>. Mặc định true. */
  ariaLabel?: boolean;
}

/**
 * Sinh SVG mã vạch Code 128 (bộ B).
 *
 * Gộp 30/08/2026: trước đó thuật toán này tồn tại 3 bản y hệt nhau —
 * `barcodeUtils.ts` (bản này), `GoodsInventory.tsx` và `PrintTemplatesTab.tsx`.
 * Phần mã hoá (bảng pattern, checksum, chuỗi start/stop) giống hệt cả 3; chỉ
 * khác `height` (40 ở đây, 50 ở 2 bản kia) và việc có aria-label hay không.
 * Vì vậy 2 điểm khác biệt đó được đưa thành tham số để mỗi nơi gọi giữ nguyên
 * đầu ra từng ký tự, thay vì ép tất cả về một kiểu rồi làm lệch tem đang in.
 *
 * Phần HTML/CSS của tem thì CỐ Ý không gộp — mỗi nơi khác nhau thật (thẻ bọc
 * <div> vs <section>, hậu tố giá "đ" vs " VNĐ", tên sản phẩm lấy theo cách
 * khác nhau), gộp lại sẽ đổi diện mạo tem in ra.
 */
export const buildCode128Svg = (rawCode: string, options: Code128SvgOptions = {}) => {
  const { height = 40, ariaLabel = true } = options;
  const code = normalizeCode128Text(rawCode) || 'UNKNOWN';
  const values = [104, ...Array.from(code).map(char => char.charCodeAt(0) - 32)];
  const checksum =
    values.reduce((sum, value, index) => sum + value * (index === 0 ? 1 : index), 0) % 103;
  const sequence = [...values, checksum, 106];
  let x = 0;
  const bars = sequence
    .map(value => CODE_128_PATTERNS[value])
    .map(pattern => {
      let patternBars = '';
      Array.from(pattern).forEach((widthChar, index) => {
        const width = Number(widthChar);
        if (index % 2 === 0) {
          patternBars += `<rect x="${x}" y="0" width="${width}" height="${height}" />`;
        }
        x += width;
      });
      return patternBars;
    })
    .join('');

  const aria = ariaLabel ? ` aria-label="Barcode ${escapeLabelText(code)}"` : '';
  return `<svg class="barcode" viewBox="0 0 ${x} ${height}" preserveAspectRatio="none"${aria}>${bars}</svg>`;
};

export const buildLabelProductName = (product: POSProduct) => {
  const name = String(product.name || '').trim();
  const attributes = Object.entries(product.variantAttributes || {})
    .map(([key, value]) => [String(key).trim(), String(value).trim()] as const)
    .filter(([, value]) => value);

  if (attributes.length === 0) return name;

  const normalizedName = name.toLocaleLowerCase('vi-VN');
  const missingAttributes = attributes.filter(
    ([, value]) => !normalizedName.includes(value.toLocaleLowerCase('vi-VN'))
  );

  if (missingAttributes.length === 0) return name;

  const attributesText = missingAttributes
    .map(([key, value]) => (key ? `${key}: ${value}` : value))
    .join(' - ');

  return [name, attributesText].filter(Boolean).join(' - ');
};

export const getBarcodeLabelTemplateSettings = (): BarcodeLabelTemplateSettings => {
  try {
    const raw = localStorage.getItem(BARCODE_LABEL_TEMPLATE_STORAGE_KEY);
    if (!raw) return DEFAULT_BARCODE_LABEL_TEMPLATE;
    const saved = JSON.parse(raw);
    return {
      widthMm:
        typeof saved.widthMm === 'number' ? saved.widthMm : DEFAULT_BARCODE_LABEL_TEMPLATE.widthMm,
      heightMm:
        typeof saved.heightMm === 'number'
          ? saved.heightMm
          : DEFAULT_BARCODE_LABEL_TEMPLATE.heightMm,
      columns:
        typeof saved.columns === 'number' ? saved.columns : DEFAULT_BARCODE_LABEL_TEMPLATE.columns,
      showName:
        typeof saved.showName === 'boolean'
          ? saved.showName
          : DEFAULT_BARCODE_LABEL_TEMPLATE.showName,
      showPrice:
        typeof saved.showPrice === 'boolean'
          ? saved.showPrice
          : DEFAULT_BARCODE_LABEL_TEMPLATE.showPrice,
      showCode:
        typeof saved.showCode === 'boolean'
          ? saved.showCode
          : DEFAULT_BARCODE_LABEL_TEMPLATE.showCode,
      showBorder:
        typeof saved.showBorder === 'boolean'
          ? saved.showBorder
          : DEFAULT_BARCODE_LABEL_TEMPLATE.showBorder,
    };
  } catch {
    return DEFAULT_BARCODE_LABEL_TEMPLATE;
  }
};

export const printProductLabels = (selectedProducts: POSProduct[], labelsPerProduct: number) => {
  const template = getBarcodeLabelTemplateSettings();
  const totalWidthMm = template.widthMm * template.columns;
  const labels = selectedProducts.flatMap(product =>
    Array.from({ length: labelsPerProduct }, () => product)
  );

  const labelHtml = labels
    .map(product => {
      const code = product.sku || product.barcode || product.id;
      return `<div class="label">${template.showName ? `<div class="name">${escapeLabelText(buildLabelProductName(product))}</div>` : ''}${buildCode128Svg(code)}${template.showCode ? `<div class="code">${escapeLabelText(normalizeCode128Text(code) || code)}</div>` : ''}${template.showPrice ? `<div class="price">${escapeLabelText(product.salePrice.toLocaleString('vi-VN'))}đ</div>` : ''}</div>`;
    })
    .join('');

  const iframe = document.createElement('iframe');
  iframe.style.cssText = 'position:fixed;top:-9999px;left:-9999px;width:0;height:0;border:none;';
  document.body.appendChild(iframe);

  const doc = iframe.contentDocument || iframe.contentWindow?.document;
  if (!doc || !iframe.contentWindow) {
    document.body.removeChild(iframe);
    return false;
  }

  doc.open();
  doc.write(`<html>
      <head>
        <meta charset="utf-8" />
        <title>In tem mã hàng</title>
        <style>
          @page { size: ${totalWidthMm}mm ${template.heightMm}mm; margin: 0; }
          * { margin: 0; padding: 0; box-sizing: border-box; }
          body { font-family: Inter, Arial, sans-serif; }
          .sheet { display: flex; flex-wrap: wrap; width: ${totalWidthMm}mm; font-size: 0; }
          .label {
            width: ${template.widthMm}mm;
            height: ${template.heightMm}mm;
            padding: 1mm;
            display: flex;
            flex-direction: column;
            align-items: center;
            justify-content: flex-start;
            overflow: hidden;
            ${template.showBorder ? 'border: 0.5px solid #000;' : ''}
            page-break-inside: avoid;
          }
          .name { font-size: 8px; font-weight: 700; text-align: center; line-height: 1.15; min-height: 4.5mm; display: flex; align-items: flex-end; justify-content: center; overflow: hidden; }
          .barcode { width: 92%; height: auto; max-height: ${template.heightMm * 0.35}mm; margin-top: auto; }
          .code { margin-top: 1mm; font-size: 8px; font-weight: 700; line-height: 1; }
          .price { margin-top: 0.3mm; font-size: 9px; font-weight: 900; line-height: 1; }
        </style>
      </head>
      <body><div class="sheet">${labelHtml}</div></body>
    </html>`);
  doc.close();

  iframe.onload = () => {
    iframe.contentWindow!.focus();
    iframe.contentWindow!.print();
    setTimeout(() => document.body.removeChild(iframe), 2000);
  };
  return true;
};
