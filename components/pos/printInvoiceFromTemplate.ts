import { POSOrder } from '../../types';

const INVOICE_TEMPLATE_KEY = 'invoice_print_template';

const PAYMENT_LABELS: Record<string, string> = {
  Cash: 'Tiền mặt',
  Bank: 'Chuyển khoản',
  Card: 'Thẻ',
  Momo: 'Ví MoMo',
  Wallet: 'Ví',
  Other: 'Khác',
};

const escapeHtml = (str: string) =>
  str.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');

const DEFAULT_TEMPLATE = [
  '{Ten_Cua_Hang}',
  'Địa chỉ: {Dia_Chi_Chi_Nhanh}',
  'Điện thoại: {Dien_Thoai}',
  '',
  'HÓA ĐƠN BÁN HÀNG',
  'Số HĐ: {Ma_Don_Hang}',
  'Ngày {Ngay} tháng {Thang} năm {Nam}',
  '',
  'Khách hàng: {Khach_Hang}',
  'SĐT: {So_Dien_Thoai}',
  'Địa chỉ: {Dia_Chi_Khach_Hang}',
  '',
  'Đơn giá                         SL       T.Tiền',
  '{Ten_Hang_Hoa}',
  '{Don_Gia_Chiet_Khau}           {So_Luong}       {Thanh_Tien}',
  '',
  '',
  'Tổng tiền hàng: {Tong_Tien_Hang}',
  'Chiết khấu: {Chiet_Khau_Hoa_Don}',
  'Tổng thanh toán: {Tong_Cong}',
  '{Tong_Cong_Bang_Chu}',
  '',
  'Cảm ơn và hẹn gặp lại!',
].join('\n');

function numberToVietnameseWords(n: number): string {
  if (n === 0) return 'Không đồng';
  const units = ['', 'một', 'hai', 'ba', 'bốn', 'năm', 'sáu', 'bảy', 'tám', 'chín'];
  const groups = ['', 'nghìn', 'triệu', 'tỷ'];

  const readThreeDigits = (h: number, t: number, u: number, hasHigher: boolean): string => {
    const parts: string[] = [];
    if (h > 0) {
      parts.push(units[h] + ' trăm');
      if (t === 0 && u > 0) parts.push('lẻ');
    } else if (hasHigher && (t > 0 || u > 0)) {
      parts.push('không trăm');
    }
    if (t > 1) {
      parts.push(units[t] + ' mươi');
      if (u === 1) parts.push('mốt');
      else if (u === 5) parts.push('lăm');
      else if (u > 0) parts.push(units[u]);
    } else if (t === 1) {
      parts.push('mười');
      if (u === 5) parts.push('lăm');
      else if (u > 0) parts.push(units[u]);
    } else if (u > 0) {
      parts.push(units[u]);
    }
    return parts.join(' ');
  };

  const chunks: number[] = [];
  let remaining = Math.abs(Math.round(n));
  while (remaining > 0) {
    chunks.push(remaining % 1000);
    remaining = Math.floor(remaining / 1000);
  }

  const resultParts: string[] = [];
  for (let i = chunks.length - 1; i >= 0; i--) {
    const chunk = chunks[i];
    if (chunk === 0) continue;
    const h = Math.floor(chunk / 100);
    const t = Math.floor((chunk % 100) / 10);
    const u = chunk % 10;
    const text = readThreeDigits(h, t, u, i < chunks.length - 1);
    resultParts.push(text + (groups[i] ? ' ' + groups[i] : ''));
  }

  const result = resultParts.join(' ').replace(/\s+/g, ' ').trim();
  return result.charAt(0).toUpperCase() + result.slice(1) + ' đồng';
}

interface PrintInvoiceOptions {
  order: POSOrder;
  storeName?: string;
  storeAddress?: string;
  storePhone?: string;
  customerPhone?: string;
  customerAddress?: string;
  staffName?: string;
}

interface ExpandedLine {
  text: string;
  rawTemplate: string;
  isAfterItemValue: boolean;
  storeHeaderIndex: number;
  itemData?: { price: number; discount: number; quantity: number; total: number; lineType?: string };
}

function printInvoiceFromTemplate(opts: PrintInvoiceOptions): string | null {
  const { order, storeName, storeAddress, storePhone, customerPhone, customerAddress, staffName } = opts;
  const orderDate = new Date(order.date);
  const cashGiven = order.cashReceived || Math.abs(order.finalAmount);
  const changeAmount = Math.max(0, cashGiven - Math.abs(order.finalAmount));
  const totalInWords = numberToVietnameseWords(Math.abs(order.finalAmount));

  const tokens: Record<string, string> = {
    '{Ten_Cua_Hang}': storeName || 'CỬA HÀNG',
    '{Ten_Chi_Nhanh}': storeName || 'CỬA HÀNG',
    '{Dia_Chi_Chi_Nhanh}': storeAddress || '',
    '{Dien_Thoai}': storePhone || '',
    '{Ma_Don_Hang}': order.orderCode,
    '{Ngay}': String(orderDate.getDate()).padStart(2, '0'),
    '{Thang}': String(orderDate.getMonth() + 1).padStart(2, '0'),
    '{Nam}': String(orderDate.getFullYear()),
    '{Ngay_Ban}': orderDate.toLocaleDateString('vi-VN'),
    '{Thoi_Gian_Ban}': orderDate.toLocaleString('vi-VN'),
    '{Khach_Hang}': order.customerName || 'Khách lẻ',
    '{So_Dien_Thoai}': customerPhone || '',
    '{Dia_Chi_Khach_Hang}': customerAddress || '',
    '{Tong_Tien_Hang}': order.totalAmount.toLocaleString(),
    '{Chiet_Khau_Hoa_Don}': order.discount > 0 ? order.discount.toLocaleString() : '0',
    '{Tong_Cong}': Math.abs(order.finalAmount).toLocaleString(),
    '{Tong_Cong_Bang_Chu}': `(${totalInWords})`,
    '{Phuong_Thuc_Thanh_Toan}': order.cashReceived === 0 ? 'Ghi nợ' : (PAYMENT_LABELS[order.paymentMethod] || order.paymentMethod),
    '{Tien_Khach_Dua}': cashGiven.toLocaleString(),
    '{Tien_Thua}': changeAmount.toLocaleString(),
    '{Thu_Ngan}': staffName || order.staffId || '',
  };

  const replaceTokens = (line: string) =>
    line.replace(/\{[^}]+\}/g, match => tokens[match] ?? match);

  const savedTemplate = localStorage.getItem(INVOICE_TEMPLATE_KEY);
  const templateBody = savedTemplate || DEFAULT_TEMPLATE;
  const templateLines = templateBody.split('\n');

  const itemNameLineIdx = templateLines.findIndex(l => /\{Ten_Hang_Hoa\}/.test(l) && !/\{Ten_Hang_Hoa_\d/.test(l));
  const itemValueLineIdx = templateLines.findIndex(l =>
    /\{(?:Don_Gia|Don_Gia_Chiet_Khau|So_Luong|Thanh_Tien)\}/.test(l) && !/\{(?:Don_Gia|Don_Gia_Chiet_Khau|So_Luong|Thanh_Tien)_\d/.test(l)
  );

  const skipSecondItemLines = new Set<number>();
  templateLines.forEach((line, idx) => {
    if (/\{(?:Ten_Hang_Hoa|Don_Gia|Don_Gia_Chiet_Khau|So_Luong|Thanh_Tien)_\d+\}/.test(line)) {
      skipSecondItemLines.add(idx);
    }
  });

  const titleLineIdx = templateLines.findIndex(l => /HÓA ĐƠN|HOA DON/i.test(l));

  const expandedLines: ExpandedLine[] = [];
  let storeHeaderCounter = 0;

  for (let i = 0; i < templateLines.length; i++) {
    if (skipSecondItemLines.has(i)) continue;

    if (i === itemNameLineIdx && itemValueLineIdx >= 0) {
      const nameTpl = templateLines[itemNameLineIdx];
      const valueTpl = templateLines[itemValueLineIdx];

      (order.items || []).forEach(item => {
        const isReturn = item.lineType === 'return';
        const isExchange = item.lineType === 'exchange';
        const prefix = isReturn ? '[TRẢ] ' : isExchange ? '[ĐỔI] ' : '';
        const discountedUnitPrice = item.discount > 0
          ? Math.round(item.total / item.quantity)
          : item.price;
        const itemTokens: Record<string, string> = {
          '{Ten_Hang_Hoa}': prefix + item.name,
          '{Don_Gia}': item.price.toLocaleString(),
          '{Don_Gia_Chiet_Khau}': discountedUnitPrice.toLocaleString(),
          '{So_Luong}': String(item.quantity),
          '{Thanh_Tien}': item.total.toLocaleString(),
        };
        const replaceLine = (l: string) =>
          l.replace(/\{[^}]+\}/g, match => itemTokens[match] ?? tokens[match] ?? match);

        expandedLines.push({
          text: replaceLine(nameTpl),
          rawTemplate: nameTpl,
          isAfterItemValue: false,
          storeHeaderIndex: -1,
          itemData: { price: item.price, discount: item.discount, quantity: item.quantity, total: item.total, lineType: item.lineType },
        });
        expandedLines.push({
          text: replaceLine(valueTpl),
          rawTemplate: valueTpl,
          isAfterItemValue: false,
          storeHeaderIndex: -1,
          itemData: { price: item.price, discount: item.discount, quantity: item.quantity, total: item.total, lineType: item.lineType },
        });
        expandedLines.push({
          text: '',
          rawTemplate: '',
          isAfterItemValue: true,
          storeHeaderIndex: -1,
        });
      });
      continue;
    }

    if (i === itemValueLineIdx) continue;

    const isBeforeTitle = titleLineIdx >= 0 && i < titleLineIdx;
    const hasContent = templateLines[i].trim().length > 0;
    const currentStoreIdx = isBeforeTitle && hasContent ? storeHeaderCounter++ : -1;

    expandedLines.push({
      text: replaceTokens(templateLines[i]),
      rawTemplate: templateLines[i],
      isAfterItemValue: false,
      storeHeaderIndex: currentStoreIdx,
    });
  }

  const htmlLines = expandedLines.map((entry) => {
    const { text, rawTemplate, isAfterItemValue, storeHeaderIndex, itemData } = entry;
    const trimmed = text.trim();

    if (!trimmed) {
      if (isAfterItemValue) {
        return '<div style="height:8px;border-bottom:1px dashed #334155;"></div>';
      }
      return '<div style="height:24px;"></div>';
    }

    const hasItemNameToken = /\{Ten_Hang_Hoa(?:_2)?\}/.test(rawTemplate);
    const hasItemValueToken = /\{(?:Don_Gia|Don_Gia_Chiet_Khau|So_Luong|Thanh_Tien)(?:_2)?\}/.test(rawTemplate);
    const isTableHeader = /Đơn giá|SL|T\.Tiền|Thành tiền/i.test(text);
    const isTitleLine = /HÓA ĐƠN|HOA DON/i.test(text);
    const isCenteredMeta = /^Số HĐ:/i.test(trimmed) || /^Ngày /i.test(trimmed);
    const isTotalLine = /Tổng|Chiết khấu|thanh toán|Tiền khách|Tiền thừa/i.test(text);
    const isTotalInWords = /^\(.+\)$/.test(trimmed);
    const isFooter = /Cảm ơn/i.test(text);

    if (storeHeaderIndex === 0) {
      return `<div style="min-height:24px;text-align:center;font-weight:bold;">${escapeHtml(trimmed)}</div>`;
    }
    if (storeHeaderIndex > 0) {
      return `<div style="min-height:24px;text-align:center;">${escapeHtml(trimmed)}</div>`;
    }

    if (isTitleLine) {
      return `<div style="min-height:24px;text-align:center;font-size:16px;font-weight:bold;">${escapeHtml(trimmed)}</div>`;
    }

    if (isCenteredMeta) {
      return `<div style="min-height:24px;text-align:center;">${escapeHtml(trimmed)}</div>`;
    }

    if (isTableHeader) {
      return `<div style="display:grid;min-height:24px;grid-template-columns:1fr 80px 110px;border-top:1px solid #0f172a;border-bottom:1px solid #0f172a;align-items:center;">
        <span>Đơn giá</span>
        <span style="text-align:center;">SL</span>
        <span style="text-align:right;">T.Tiền</span>
      </div>`;
    }

    if (hasItemNameToken) {
      const isReturn = itemData?.lineType === 'return';
      const isExchangeItem = itemData?.lineType === 'exchange';
      const color = isReturn ? 'color:#dc2626;' : isExchangeItem ? 'color:#2563eb;' : '';
      return `<div style="min-height:24px;${color}">${escapeHtml(trimmed)}</div>`;
    }

    if (hasItemValueToken && itemData) {
      const discountedPrice = itemData.discount > 0
        ? Math.round(itemData.total / itemData.quantity).toLocaleString()
        : itemData.price.toLocaleString();
      const originalPriceHtml = itemData.discount > 0
        ? `<span style="margin-left:8px;color:#64748b;text-decoration:line-through;">${itemData.price.toLocaleString()}</span>`
        : '';
      return `<div style="display:grid;min-height:24px;grid-template-columns:1fr 80px 110px;align-items:center;">
        <span>${escapeHtml(discountedPrice)}${originalPriceHtml}</span>
        <span style="text-align:center;">${itemData.quantity}</span>
        <span style="text-align:right;">${itemData.total.toLocaleString()}</span>
      </div>`;
    }

    const totalMatch = trimmed.match(/^(.+?:)\s*(.+)$/);
    if (isTotalLine && totalMatch) {
      return `<div style="display:grid;min-height:24px;grid-template-columns:1fr 220px 120px;align-items:center;">
        <span></span>
        <span>${escapeHtml(totalMatch[1])}</span>
        <span style="text-align:right;">${escapeHtml(totalMatch[2])}</span>
      </div>`;
    }

    if (isTotalInWords) {
      return `<div style="min-height:24px;text-align:right;font-style:italic;">${escapeHtml(trimmed)}</div>`;
    }

    if (isFooter) {
      return `<div style="min-height:24px;text-align:center;">${escapeHtml(trimmed)}</div>`;
    }

    return `<div style="min-height:24px;">${escapeHtml(trimmed)}</div>`;
  });

  return `<html>
    <head>
      <title>In Hóa Đơn - ${escapeHtml(order.orderCode)}</title>
      <style>
        @page { size: 80mm auto; margin: 0; }
        body { margin: 0; padding: 5mm; font-family: 'Inter', ui-sans-serif, system-ui, -apple-system, sans-serif; font-size: 14px; line-height: 24px; color: #0f172a; }
      </style>
    </head>
    <body>
      ${htmlLines.join('\n')}
      <script>
        window.onload = function() {
          window.print();
          setTimeout(function() { window.close(); }, 100);
        };
      </script>
    </body>
  </html>`;
}

function openOneWindow(html: string): boolean {
  const w = window.open('', '_blank', 'width=450,height=600');
  if (!w) return false;
  w.document.write(html);
  w.document.close();
  return true;
}

export function openPrintInvoice(opts: PrintInvoiceOptions, copies = 1): boolean {
  const html = printInvoiceFromTemplate(opts);
  if (!html) return false;

  // Mở bản đầu ngay, các bản sau delay 350ms để browser không block popup
  let opened = openOneWindow(html);
  for (let i = 1; i < copies; i++) {
    setTimeout(() => openOneWindow(html), i * 350);
  }
  return opened;
}

interface PrintWarrantyOptions {
  order: POSOrder;
  storeName?: string;
  storeAddress?: string;
  storePhone?: string;
  mode: 'per_item' | 'per_order';
  warrantyByProductId?: Record<string, string>; // productId → warranty period string
}

function buildWarrantyHtml(opts: PrintWarrantyOptions, items: POSOrder['items']): string {
  const { order, storeName, storeAddress, storePhone } = opts;
  const orderDate = new Date(order.date);
  const dateStr = `${orderDate.getDate().toString().padStart(2,'0')}/${(orderDate.getMonth()+1).toString().padStart(2,'0')}/${orderDate.getFullYear()}`;

  const itemRows = items.map(item => {
    const warranty = opts.warrantyByProductId?.[item.productId] || '—';
    return `<tr>
      <td style="padding:4px 6px;border-bottom:1px solid #e2e8f0">${escapeHtml(item.name)}</td>
      <td style="padding:4px 6px;border-bottom:1px solid #e2e8f0;text-align:center">${item.quantity}</td>
      <td style="padding:4px 6px;border-bottom:1px solid #e2e8f0;text-align:center">${escapeHtml(warranty)}</td>
    </tr>`;
  }).join('');

  return `<html>
    <head>
      <title>Phiếu Bảo Hành - ${escapeHtml(order.orderCode)}</title>
      <style>
        @page { size: 80mm auto; margin: 0; }
        body { margin: 0; padding: 5mm; font-family: 'Inter', ui-sans-serif, system-ui, -apple-system, sans-serif; font-size: 13px; line-height: 1.6; color: #0f172a; }
        h2 { margin: 4px 0; font-size: 15px; text-align: center; }
        .center { text-align: center; }
        .muted { color: #64748b; font-size: 12px; }
        table { width: 100%; border-collapse: collapse; margin-top: 8px; }
        th { background: #f8fafc; padding: 4px 6px; text-align: left; font-size: 12px; color: #475569; border-bottom: 2px solid #cbd5e1; }
        th:nth-child(2), th:nth-child(3) { text-align: center; }
        .footer { margin-top: 10px; text-align: center; font-size: 11px; color: #94a3b8; }
      </style>
    </head>
    <body>
      <div class="center" style="margin-bottom:6px">
        <strong style="font-size:15px">${escapeHtml(storeName || 'CỬA HÀNG')}</strong><br>
        ${storeAddress ? `<span class="muted">${escapeHtml(storeAddress)}</span><br>` : ''}
        ${storePhone ? `<span class="muted">ĐT: ${escapeHtml(storePhone)}</span><br>` : ''}
      </div>
      <h2>PHIẾU BẢO HÀNH</h2>
      <hr style="border:none;border-top:1px dashed #cbd5e1;margin:6px 0">
      <div>Mã HĐ: <strong>${escapeHtml(order.orderCode)}</strong></div>
      <div>Ngày: ${dateStr}</div>
      ${order.customerName ? `<div>Khách: ${escapeHtml(order.customerName)}</div>` : ''}
      <table>
        <thead>
          <tr>
            <th>Hàng hóa</th>
            <th>SL</th>
            <th>Bảo hành</th>
          </tr>
        </thead>
        <tbody>${itemRows}</tbody>
      </table>
      <div class="footer">Vui lòng giữ phiếu này để được bảo hành</div>
      <script>window.onload = function() { window.print(); setTimeout(function(){ window.close(); }, 100); };</script>
    </body>
  </html>`;
}

export function openPrintWarranty(opts: PrintWarrantyOptions, copies = 1): boolean {
  const saleItems = (opts.order.items || []).filter(i => i.lineType !== 'return');
  if (saleItems.length === 0) return false;

  if (opts.mode === 'per_item') {
    // Mỗi sản phẩm 1 phiếu riêng, nhân với số bản
    let anyOpened = false;
    let delay = 0;
    for (const item of saleItems) {
      const html = buildWarrantyHtml(opts, [item]);
      for (let c = 0; c < copies; c++) {
        setTimeout(() => openOneWindow(html), delay);
        delay += 350;
      }
      anyOpened = true;
    }
    return anyOpened;
  } else {
    // per_order: 1 phiếu tổng hợp tất cả hàng hóa, nhân với số bản
    const html = buildWarrantyHtml(opts, saleItems);
    openOneWindow(html);
    for (let i = 1; i < copies; i++) {
      setTimeout(() => openOneWindow(html), i * 350);
    }
    return true;
  }
}
