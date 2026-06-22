import React, { useCallback, useDeferredValue, useEffect, useMemo, useRef, useState } from 'react';
import {
  AlignCenter,
  AlignLeft,
  AlignRight,
  Bold,
  Check,
  CornerDownLeft,
  Pencil,
  Printer,
} from 'lucide-react';
import DOMPurify from 'dompurify';
import type { BrandProfile, POSOrder } from '../../../types';
import { useToast } from '../../ui/Toast';
import { openPrintInvoice } from '../../pos/printInvoiceFromTemplate';

// Constants
const PRINT_TEMPLATE_TYPES = [
  { id: 'order', label: 'Đặt hàng', disabled: true },
  { id: 'invoice', label: 'Hóa đơn', disabled: false },
  { id: 'repairInvoice', label: 'Hóa đơn sửa chữa', disabled: true },
  { id: 'delivery', label: 'Giao hàng', disabled: true },
  { id: 'return', label: 'Trả hàng', disabled: true },
  { id: 'exchange', label: 'Đổi hàng', disabled: false },
  { id: 'barcodeLabel', label: 'Tem mã', disabled: false },
  { id: 'payroll', label: 'Bảng lương', disabled: false },
  { id: 'purchase', label: 'Nhập hàng', disabled: true },
  { id: 'receipt', label: 'Phiếu thu', disabled: true },
  { id: 'payment', label: 'Phiếu chi', disabled: true },
];

const SAMPLE_INVOICE_ITEMS = [
  { name: 'Sandal bé trai 0068 - 37 - XANH', price: '185,000', quantity: '1', total: '185,000' },
  {
    name: 'Dép nữ quai ngang 1205 - 38 - KEM',
    price: '165,000',
    originalPrice: '195,000',
    discount: '30,000',
    quantity: '2',
    total: '330,000',
  },
  { name: 'Giày búp bê nữ 2301 - 36 - ĐEN', price: '220,000', quantity: '1', total: '220,000' },
];

const SAMPLE_BARCODE_LABEL_PRODUCT = {
  name: 'Sandal bé trai 0068 - 37 - XANH',
  sku: 'SP012295',
  price: '185,000',
};

const INVOICE_TEMPLATE_STORAGE_KEY = 'invoice_print_template';
const BARCODE_LABEL_TEMPLATE_STORAGE_KEY = 'barcode_label_template_settings';

const CODE_128_PATTERNS = [
  '212222',
  '222122',
  '222221',
  '121223',
  '121322',
  '131222',
  '122213',
  '122312',
  '132212',
  '221213',
  '221312',
  '231212',
  '112232',
  '122132',
  '122231',
  '113222',
  '123122',
  '123221',
  '223211',
  '221132',
  '221231',
  '213212',
  '223112',
  '312131',
  '311222',
  '321122',
  '321221',
  '312212',
  '322112',
  '322211',
  '212123',
  '212321',
  '232121',
  '111323',
  '131123',
  '131321',
  '112313',
  '132113',
  '132311',
  '211313',
  '231113',
  '231311',
  '112133',
  '112331',
  '132131',
  '113123',
  '113321',
  '133121',
  '313121',
  '211331',
  '231131',
  '213113',
  '213311',
  '213131',
  '311123',
  '311321',
  '331121',
  '312113',
  '312311',
  '332111',
  '314111',
  '221411',
  '431111',
  '111224',
  '111422',
  '121124',
  '121421',
  '141122',
  '141221',
  '112214',
  '112412',
  '122114',
  '122411',
  '142112',
  '142211',
  '241211',
  '221114',
  '413111',
  '241112',
  '134111',
  '111242',
  '121142',
  '121241',
  '114212',
  '124112',
  '124211',
  '411212',
  '421112',
  '421211',
  '212141',
  '214121',
  '412121',
  '111143',
  '111341',
  '131141',
  '114113',
  '114311',
  '411113',
  '411311',
  '113141',
  '114131',
  '311141',
  '411131',
  '211412',
  '211214',
  '211232',
  '2331112',
];

// Helper functions
const normalizeCode128Text = (value: string) =>
  value
    .trim()
    .replace(/[^\x20-\x7E]/g, '')
    .slice(0, 32);

const buildCode128Svg = (rawCode: string) => {
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
          patternBars += `<rect x="${x}" y="0" width="${width}" height="50" />`;
        }
        x += width;
      });
      return patternBars;
    })
    .join('');

  return `<svg class="barcode" viewBox="0 0 ${x} 50" preserveAspectRatio="none">${bars}</svg>`;
};

const replaceInvoiceTemplateTokens = (line: string, tokens: Record<string, string>) =>
  line.replace(/\{[^}]+\}/g, match => tokens[match] ?? match);

const escapeHtml = (value: string) =>
  value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');

const ensureDiscountSampleRows = (templateBody: string) => {
  if (templateBody.includes('{Ten_Hang_Hoa_2}') || !templateBody.includes('{Ten_Hang_Hoa}')) {
    return templateBody;
  }

  const lines = templateBody.split('\n');
  const itemValueIndex = lines.findIndex(line =>
    ['{Don_Gia}', '{Don_Gia_Chiet_Khau}', '{So_Luong}', '{Thanh_Tien}'].some(token =>
      line.includes(token)
    )
  );

  if (itemValueIndex === -1) {
    return templateBody;
  }

  const nextLineIsBlank = lines[itemValueIndex + 1] === '';
  const insertAt = nextLineIsBlank ? itemValueIndex + 2 : itemValueIndex + 1;
  lines.splice(
    insertAt,
    0,
    '{Ten_Hang_Hoa_2}',
    '{Don_Gia_Chiet_Khau_2}         {So_Luong_2}     {Thanh_Tien_2}',
    '',
    '',
    ''
  );

  return lines.join('\n');
};

// Types
type EditablePrintTemplateType = 'invoice' | 'exchange' | 'payroll';
type PrintTemplateFormatAction = 'left' | 'center' | 'right' | 'bold' | 'newline';

interface PrintTemplatesTabProps {
  brandProfile: BrandProfile;
}

// Section component
const Section: React.FC<{
  id?: string;
  title: string;
  description?: string;
  icon: React.ElementType;
  children: React.ReactNode;
}> = ({ id, title, description, icon: Icon, children }) => (
  <section
    id={id}
    className="scroll-mt-6 bg-white border border-slate-100 rounded-xl shadow-sm overflow-hidden"
  >
    <div className="min-h-[88px] px-5 py-4 border-b border-slate-100 bg-slate-50/60 flex items-start gap-3">
      <div className="h-9 w-9 rounded-xl bg-indigo-50 text-indigo-600 flex items-center justify-center shrink-0">
        <Icon className="h-4 w-4" />
      </div>
      <div className="min-w-0">
        <h3 className="text-sm font-bold text-slate-900">{title}</h3>
        {description && (
          <p className="min-h-10 text-xs text-slate-500 mt-1 leading-relaxed">{description}</p>
        )}
      </div>
    </div>
    <div className="p-5">{children}</div>
  </section>
);

const PrintTemplatesTab: React.FC<PrintTemplatesTabProps> = ({ brandProfile }) => {
  const { showToast } = useToast();
  // Refs
  const invoiceTemplateTextareaRef = useRef<HTMLTextAreaElement>(null);
  const exchangeTemplateTextareaRef = useRef<HTMLTextAreaElement>(null);
  const payrollTemplateTextareaRef = useRef<HTMLTextAreaElement>(null);

  // State
  const [activePrintTemplateType, setActivePrintTemplateType] = useState<string>('invoice');

  // Invoice template states
  const [isInvoiceTemplateEditing, setIsInvoiceTemplateEditing] = useState(false);
  const [invoiceTemplateName, setInvoiceTemplateName] = useState('Khổ giấy K80');
  const [invoiceTemplateBody, setInvoiceTemplateBody] = useState('');

  // Exchange template states
  const [isExchangeTemplateEditing, setIsExchangeTemplateEditing] = useState(false);
  const [exchangeTemplateName, setExchangeTemplateName] = useState('Khổ giấy K80');
  const [exchangeTemplateBody, setExchangeTemplateBody] = useState('');

  // Payroll template states
  const [isPayrollTemplateEditing, setIsPayrollTemplateEditing] = useState(false);
  const [payrollTemplateName, setPayrollTemplateName] = useState('Khổ giấy K80');
  const [payrollTemplateBody, setPayrollTemplateBody] = useState('');

  // Barcode label states
  const [barcodeLabelTemplateName, setBarcodeLabelTemplateName] = useState('Tem mã 2 tem 35x22');
  const [barcodeLabelWidthMm, setBarcodeLabelWidthMm] = useState(35);
  const [barcodeLabelHeightMm, setBarcodeLabelHeightMm] = useState(22);
  const [barcodeLabelColumns, setBarcodeLabelColumns] = useState(2);
  const [barcodeLabelDefaultQty, setBarcodeLabelDefaultQty] = useState(2);
  const [barcodeLabelShowName, setBarcodeLabelShowName] = useState(true);
  const [barcodeLabelShowPrice, setBarcodeLabelShowPrice] = useState(true);
  const [barcodeLabelShowCode, setBarcodeLabelShowCode] = useState(true);
  const [barcodeLabelShowBorder, setBarcodeLabelShowBorder] = useState(false);

  // Load invoice template from localStorage
  useEffect(() => {
    try {
      const saved = localStorage.getItem(INVOICE_TEMPLATE_STORAGE_KEY);
      if (saved) setInvoiceTemplateBody(saved);
    } catch {}
  }, []);

  // Save invoice template to localStorage
  useEffect(() => {
    if (invoiceTemplateBody) {
      try {
        localStorage.setItem(INVOICE_TEMPLATE_STORAGE_KEY, invoiceTemplateBody);
      } catch {}
    }
  }, [invoiceTemplateBody]);

  // Load barcode label settings from localStorage
  useEffect(() => {
    try {
      const raw = localStorage.getItem(BARCODE_LABEL_TEMPLATE_STORAGE_KEY);
      if (!raw) return;
      const saved = JSON.parse(raw);
      if (typeof saved.name === 'string') setBarcodeLabelTemplateName(saved.name);
      if (typeof saved.widthMm === 'number') setBarcodeLabelWidthMm(saved.widthMm);
      if (typeof saved.heightMm === 'number') setBarcodeLabelHeightMm(saved.heightMm);
      if (typeof saved.columns === 'number') setBarcodeLabelColumns(saved.columns);
      if (typeof saved.defaultQty === 'number') setBarcodeLabelDefaultQty(saved.defaultQty);
      if (typeof saved.showName === 'boolean') setBarcodeLabelShowName(saved.showName);
      if (typeof saved.showPrice === 'boolean') setBarcodeLabelShowPrice(saved.showPrice);
      if (typeof saved.showCode === 'boolean') setBarcodeLabelShowCode(saved.showCode);
      if (typeof saved.showBorder === 'boolean') setBarcodeLabelShowBorder(saved.showBorder);
    } catch {}
  }, []);

  // Save barcode label settings to localStorage
  useEffect(() => {
    try {
      localStorage.setItem(
        BARCODE_LABEL_TEMPLATE_STORAGE_KEY,
        JSON.stringify({
          name: barcodeLabelTemplateName,
          widthMm: barcodeLabelWidthMm,
          heightMm: barcodeLabelHeightMm,
          columns: barcodeLabelColumns,
          defaultQty: barcodeLabelDefaultQty,
          showName: barcodeLabelShowName,
          showPrice: barcodeLabelShowPrice,
          showCode: barcodeLabelShowCode,
          showBorder: barcodeLabelShowBorder,
        })
      );
    } catch {}
  }, [
    barcodeLabelColumns,
    barcodeLabelDefaultQty,
    barcodeLabelHeightMm,
    barcodeLabelShowBorder,
    barcodeLabelShowCode,
    barcodeLabelShowName,
    barcodeLabelShowPrice,
    barcodeLabelTemplateName,
    barcodeLabelWidthMm,
  ]);

  // Computed values
  const barcodeLabelTotalWidthMm = barcodeLabelWidthMm * barcodeLabelColumns;

  // Default templates
  const defaultInvoiceTemplateBody = useMemo(
    () =>
      [
        '{Ten_Cua_Hang}',
        `Địa chỉ: ${brandProfile.address || '{Dia_Chi_Chi_Nhanh}'}`,
        `Điện thoại: ${brandProfile.phone || '{Dien_Thoai}'}`,
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
        '{Ten_Hang_Hoa_2}',
        '{Don_Gia_Chiet_Khau_2}         {So_Luong_2}     {Thanh_Tien_2}',
        '',
        '',
        '',
        'Tổng tiền hàng: {Tong_Tien_Hang}',
        'Chiết khấu: {Chiet_Khau_Hoa_Don}',
        'Tổng thanh toán: {Tong_Cong}',
        '{Tong_Cong_Bang_Chu}',
        '',
        'Cảm ơn và hẹn gặp lại!',
      ].join('\n'),
    [brandProfile.address, brandProfile.name, brandProfile.phone]
  );

  const defaultExchangeTemplateBody = useMemo(
    () =>
      [
        '{Ten_Cua_Hang}',
        `Địa chỉ: ${brandProfile.address || '{Dia_Chi_Chi_Nhanh}'}`,
        `Điện thoại: ${brandProfile.phone || '{Dien_Thoai}'}`,
        '',
        'PHIẾU ĐỔI HÀNG',
        'Số phiếu: {Ma_Don_Hang}',
        'Ngày {Ngay} tháng {Thang} năm {Nam}',
        '',
        'Khách hàng: {Khach_Hang}',
        'SĐT: {So_Dien_Thoai}',
        'Địa chỉ: {Dia_Chi_Khach_Hang}',
        '',
        'HÀNG TRẢ',
        'Đơn giá                         SL       T.Tiền',
        '{Ten_Hang_Hoa}',
        '{Don_Gia_Chiet_Khau}           {So_Luong}       {Thanh_Tien}',
        '',
        '{Ten_Hang_Hoa_2}',
        '{Don_Gia_Chiet_Khau_2}         {So_Luong_2}     {Thanh_Tien_2}',
        '',
        '',
        '',
        'HÀNG ĐỔI',
        'Đơn giá                         SL       T.Tiền',
        '{Ten_Hang_Hoa_Moi}',
        '{Don_Gia_Chiet_Khau_Moi}       {So_Luong_Moi}   {Thanh_Tien_Moi}',
        '',
        '{Ten_Hang_Hoa_Moi_2}',
        '{Don_Gia_Chiet_Khau_Moi_2}     {So_Luong_Moi_2} {Thanh_Tien_Moi_2}',
        '',
        '',
        '',
        'Tổng tiền hàng trả: {Tong_Tien_Tra_Hang}',
        'Tổng tiền hàng đổi: {Tong_Tien_Hoa_Don_Mua}',
        'Chênh lệch: {Tong_Cong}',
        '{Tong_Cong_Bang_Chu}',
        '',
        'Cảm ơn và hẹn gặp lại!',
      ].join('\n'),
    [brandProfile.address, brandProfile.name, brandProfile.phone]
  );

  const defaultPayrollTemplateBody = useMemo(
    () =>
      [
        '{Ten_Cua_Hang}',
        'PHIẾU THANH TOÁN LƯƠNG',
        'Tháng: {Thang_Luong}',
        '',
        'NV: {Nhan_Vien}',
        'CV: {Chuc_Vu} ({Nhom_Luong})',
        'Loại: {Loai_Nhan_Vien}',
        'Ngày công: {Ngay_Cong}/{Tong_Ngay_Cong} ({Tong_Gio_Cong}h)',
        '',
        'Lương cơ bản: {Luong_Co_Ban}',
        'Phụ cấp (Theo công): {Phu_Cap}',
        '- Chuyên cần: {Phu_Cap_Chuyen_Can}',
        '- Vệ sinh: {Phu_Cap_Ve_Sinh}',
        '- CSKH: {Phu_Cap_CSKH}',
        '- Ăn tối: {Phu_Cap_An_Toi}',
        '- Hỗ trợ ở: {Phu_Cap_Nha_O}',
        'Trách nhiệm: {Phu_Cap_Trach_Nhiem}',
        'Hoa hồng ({Ti_Le_Hoa_Hong}%): {Hoa_Hong}',
        'Tăng ca ({Gio_Tang_Ca}h): {Tang_Ca}',
        'Thưởng lễ: {Thuong_Le}',
        'Thâm niên: {Thuong_Tham_Nien}',
        '',
        'Khấu trừ: -{Tong_Khau_Tru}',
        '- Vi phạm/Vắng: {Tien_Phat}',
        '- Tiền thiếu: {Tien_Thieu}',
        '- Tạm ứng: {Tam_Ung}',
        '',
        'THỰC NHẬN: {Thuc_Nhan}',
        '',
        'Cảm ơn bạn đã đồng hành!',
        'Hệ thống Quản trị Phúc Sang',
      ].join('\n'),
    [brandProfile.name]
  );

  // Current template bodies — memoized so useMemo chain below works correctly
  const currentInvoiceTemplateBody = useMemo(
    () => ensureDiscountSampleRows(invoiceTemplateBody || defaultInvoiceTemplateBody),
    [invoiceTemplateBody, defaultInvoiceTemplateBody]
  );
  const currentExchangeTemplateBody = useMemo(
    () => exchangeTemplateBody || defaultExchangeTemplateBody,
    [exchangeTemplateBody, defaultExchangeTemplateBody]
  );
  const currentPayrollTemplateBody = useMemo(
    () => payrollTemplateBody || defaultPayrollTemplateBody,
    [payrollTemplateBody, defaultPayrollTemplateBody]
  );

  // Deferred values for preview only — textarea updates instantly, preview catches up async
  const deferredInvoiceBody = useDeferredValue(currentInvoiceTemplateBody);
  const deferredExchangeBody = useDeferredValue(currentExchangeTemplateBody);
  const deferredPayrollBody = useDeferredValue(currentPayrollTemplateBody);

  // Template lines — use deferred body so regex work runs in background
  const rawInvoiceTemplateLines = useMemo(
    () => deferredInvoiceBody.split('\n'),
    [deferredInvoiceBody]
  );
  const rawExchangeTemplateLines = useMemo(
    () => deferredExchangeBody.split('\n'),
    [deferredExchangeBody]
  );
  const rawPayrollTemplateLines = useMemo(
    () => deferredPayrollBody.split('\n'),
    [deferredPayrollBody]
  );

  // Preview tokens
  const invoicePreviewTokens = useMemo(
    () => ({
      '{Ten_Cua_Hang}': brandProfile.name || 'GIÀY DÉP PHÚC SANG',
      '{Ten_Chi_Nhanh}': brandProfile.name || 'GIÀY DÉP PHÚC SANG',
      '{Dia_Chi_Chi_Nhanh}':
        brandProfile.address || 'Số nhà 14 đường NC2 - Mỹ Phước 2 - Bến Cát, Bình Dương',
      '{Dien_Thoai}': brandProfile.phone || '033.571.3423 - 096.886.7411',
      '{Ma_Don_Hang}': 'HD003362',
      '{Ngay}': '08',
      '{Thang}': '05',
      '{Nam}': '2026',
      '{Ngay_Ban}': '08/05/2026',
      '{Thoi_Gian_Ban}': '08/05/2026 19:47',
      '{Khach_Hang}': 'Anh Hòa Q.1',
      '{So_Dien_Thoai}': '0901 234 567',
      '{Dia_Chi_Khach_Hang}': 'Số 10, Phổ Quang, Tân Bình, TP.HCM',
      '{Tong_Tien_Hang}': '735,000',
      '{Chiet_Khau_Hoa_Don}': '35,000',
      '{Tong_Cong}': '700,000',
      '{Tong_Cong_Bang_Chu}': '(Bảy trăm nghìn đồng chẵn)',
      '{Tien_Khach_Dua}': '700,000',
      '{Tien_Thua}': '0',
      '{Phuong_Thuc_Thanh_Toan}': 'Tiền mặt',
      '{Thu_Ngan}': 'Thu ngân POS',
    }),
    [brandProfile.address, brandProfile.name, brandProfile.phone]
  );

  const exchangePreviewTokens = useMemo(
    () => ({
      '{Ten_Cua_Hang}': brandProfile.name || 'GIÀY DÉP PHÚC SANG',
      '{Ten_Chi_Nhanh}': brandProfile.name || 'GIÀY DÉP PHÚC SANG',
      '{Dia_Chi_Chi_Nhanh}':
        brandProfile.address || 'Số nhà 14 đường NC2 - Mỹ Phước 2 - Bến Cát, Bình Dương',
      '{Dien_Thoai}': brandProfile.phone || '033.571.3423 - 096.886.7411',
      '{Ma_Don_Hang}': 'DH003363',
      '{Ngay}': '08',
      '{Thang}': '05',
      '{Nam}': '2026',
      '{Ngay_Ban}': '08/05/2026',
      '{Thoi_Gian_Ban}': '08/05/2026 20:05',
      '{Khach_Hang}': 'Anh Hòa Q.1',
      '{So_Dien_Thoai}': '0901 234 567',
      '{Dia_Chi_Khach_Hang}': 'Số 10, Phổ Quang, Tân Bình, TP.HCM',
      '{Khu_Vuc_Khach_Hang}': 'TP.HCM',
      '{Nhan_Vien_Ban_Hang}': 'Thu ngân POS',
      '{Ten_Hang_Hoa}': 'Sandal bé trai 0068 - 37 - XANH',
      '{Don_Gia}': '185,000',
      '{Don_Gia_Chiet_Khau}': '185,000',
      '{So_Luong}': '1',
      '{Thanh_Tien}': '185,000',
      '{Ten_Hang_Hoa_2}': 'Dép nữ quai ngang 1205 - 38 - KEM',
      '{Don_Gia_2}': '165,000',
      '{Don_Gia_Chiet_Khau_2}': '165,000',
      '{So_Luong_2}': '1',
      '{Thanh_Tien_2}': '165,000',
      '{Ten_Hang_Hoa_Moi}': 'Giày búp bê nữ 2301 - 36 - ĐEN',
      '{Don_Gia_Moi}': '220,000',
      '{Don_Gia_Chiet_Khau_Moi}': '220,000',
      '{So_Luong_Moi}': '1',
      '{Thanh_Tien_Moi}': '220,000',
      '{Ten_Hang_Hoa_Moi_2}': 'Sandal nữ quai hậu 5502 - 37 - NÂU',
      '{Don_Gia_Moi_2}': '190,000',
      '{Don_Gia_Chiet_Khau_Moi_2}': '190,000',
      '{So_Luong_Moi_2}': '1',
      '{Thanh_Tien_Moi_2}': '190,000',
      '{Tong_Tien_Tra_Hang}': '350,000',
      '{Tong_Tien_Hoa_Don_Mua}': '410,000',
      '{Tong_Cong}': '60,000',
      '{Tong_Cong_Bang_Chu}': '(Sáu mươi nghìn đồng chẵn)',
    }),
    [brandProfile.address, brandProfile.name, brandProfile.phone]
  );

  const payrollPreviewTokens = useMemo(
    () => ({
      '{Ten_Cua_Hang}': brandProfile.name || 'PHÚC SANG',
      '{Thang_Luong}': '2026-05',
      '{Nhan_Vien}': 'Nguyễn Thị Mai',
      '{Chuc_Vu}': 'Nhân viên bán hàng',
      '{Nhom_Luong}': 'Chính thức bậc 1',
      '{Loai_Nhan_Vien}': 'Chính thức',
      '{Ngay_Cong}': '24',
      '{Tong_Ngay_Cong}': '31',
      '{Tong_Gio_Cong}': '264',
      '{Luong_Co_Ban}': '6,200,000',
      '{Phu_Cap}': '1,180,000',
      '{Phu_Cap_Chuyen_Can}': '300,000',
      '{Phu_Cap_Ve_Sinh}': '150,000',
      '{Phu_Cap_CSKH}': '200,000',
      '{Phu_Cap_An_Toi}': '480,000',
      '{Phu_Cap_Nha_O}': '50,000',
      '{Phu_Cap_Trach_Nhiem}': '400,000',
      '{Ti_Le_Hoa_Hong}': '1.5',
      '{Hoa_Hong}': '850,000',
      '{Gio_Tang_Ca}': '6.5',
      '{Tang_Ca}': '390,000',
      '{Thuong_Le}': '200,000',
      '{Thuong_Tham_Nien}': '150,000',
      '{Tong_Khau_Tru}': '500,000',
      '{Tien_Phat}': '100,000',
      '{Tien_Thieu}': '150,000',
      '{Tam_Ung}': '250,000',
      '{Thuc_Nhan}': '8,870,000',
    }),
    [brandProfile.name]
  );

  // Rendered preview lines
  const renderedInvoicePreviewLines = useMemo(
    () =>
      rawInvoiceTemplateLines.map(line => replaceInvoiceTemplateTokens(line, invoicePreviewTokens)),
    [invoicePreviewTokens, rawInvoiceTemplateLines]
  );

  const renderedExchangePreviewLines = useMemo(
    () =>
      rawExchangeTemplateLines.map(line =>
        replaceInvoiceTemplateTokens(line, exchangePreviewTokens)
      ),
    [exchangePreviewTokens, rawExchangeTemplateLines]
  );

  const renderedPayrollPreviewLines = useMemo(
    () =>
      rawPayrollTemplateLines.map(line => replaceInvoiceTemplateTokens(line, payrollPreviewTokens)),
    [payrollPreviewTokens, rawPayrollTemplateLines]
  );

  // Barcode label CSS and HTML
  const barcodeLabelPrintCss = useMemo(
    () => `
    @page { size: ${barcodeLabelTotalWidthMm}mm auto; margin: 0; }
    body { margin: 0; padding: 0; font-family: Inter, Arial, sans-serif; }
    .sheet { display: flex; flex-wrap: wrap; width: ${barcodeLabelTotalWidthMm}mm; font-size: 0; }
    .label {
      box-sizing: border-box;
      width: ${barcodeLabelWidthMm}mm;
      height: ${barcodeLabelHeightMm}mm;
      padding: 1mm;
      display: flex;
      flex-direction: column;
      align-items: center;
      justify-content: center;
      overflow: hidden;
      ${barcodeLabelShowBorder ? 'border: 0.5px solid #000;' : ''}
      page-break-inside: avoid;
    }
    .name { font-size: 7px; font-weight: 700; text-align: center; line-height: 1.15; margin-bottom: 0.3mm; max-height: 7mm; overflow: hidden; }
    .barcode { width: 92%; height: auto; max-height: ${barcodeLabelHeightMm * 0.40}mm; }
    .code { margin-top: 0.3mm; font-size: 8px; font-weight: 700; line-height: 1; }
    .price { margin-top: 0.3mm; font-size: 8px; font-weight: 700; line-height: 1; }
  `,
    [barcodeLabelWidthMm, barcodeLabelHeightMm, barcodeLabelShowBorder, barcodeLabelTotalWidthMm]
  );

  const renderBarcodeLabelHtml = useCallback(
    (product: { name: string; sku: string; price: string }) =>
      `<section class="label">${barcodeLabelShowName ? `<div class="name">${escapeHtml(product.name)}</div>` : ''}${buildCode128Svg(product.sku)}${barcodeLabelShowCode ? `<div class="code">${escapeHtml(product.sku)}</div>` : ''}${barcodeLabelShowPrice ? `<div class="price">${escapeHtml(product.price)} VNĐ</div>` : ''}</section>`,
    [barcodeLabelShowName, barcodeLabelShowCode, barcodeLabelShowPrice]
  );

  const barcodeLabelPreviewItems = useMemo(
    () => Array(barcodeLabelDefaultQty).fill(SAMPLE_BARCODE_LABEL_PRODUCT),
    [barcodeLabelDefaultQty]
  );

  // Helper functions for template editing
  const getEditablePrintTemplate = (templateType: EditablePrintTemplateType) => {
    if (templateType === 'invoice') {
      return {
        isEditing: isInvoiceTemplateEditing,
        value: currentInvoiceTemplateBody,
        ref: invoiceTemplateTextareaRef,
        setBody: setInvoiceTemplateBody,
      };
    }

    if (templateType === 'exchange') {
      return {
        isEditing: isExchangeTemplateEditing,
        value: currentExchangeTemplateBody,
        ref: exchangeTemplateTextareaRef,
        setBody: setExchangeTemplateBody,
      };
    }

    return {
      isEditing: isPayrollTemplateEditing,
      value: currentPayrollTemplateBody,
      ref: payrollTemplateTextareaRef,
      setBody: setPayrollTemplateBody,
    };
  };

  const updatePrintTemplateSelection = (
    templateType: EditablePrintTemplateType,
    nextValue: string,
    nextStart: number,
    nextEnd = nextStart
  ) => {
    const template = getEditablePrintTemplate(templateType);
    template.setBody(nextValue);
    window.setTimeout(() => {
      const textarea = template.ref.current;
      if (!textarea) return;
      textarea.focus();
      textarea.setSelectionRange(nextStart, nextEnd);
    }, 0);
  };

  const formatPrintTemplate = (
    templateType: EditablePrintTemplateType,
    action: PrintTemplateFormatAction
  ) => {
    const template = getEditablePrintTemplate(templateType);
    if (!template.isEditing) return;
    const textarea = template.ref.current;
    const value = template.value;
    const selectionStart = textarea?.selectionStart ?? 0;
    const selectionEnd = textarea?.selectionEnd ?? selectionStart;

    if (action === 'newline') {
      const nextValue = `${value.slice(0, selectionStart)}\n${value.slice(selectionEnd)}`;
      updatePrintTemplateSelection(templateType, nextValue, selectionStart + 1);
      return;
    }

    if (action === 'bold') {
      const selectedText = value.slice(selectionStart, selectionEnd);
      const fallbackStart = value.lastIndexOf('\n', Math.max(selectionStart - 1, 0)) + 1;
      const fallbackEndIndex = value.indexOf('\n', selectionStart);
      const fallbackEnd = fallbackEndIndex === -1 ? value.length : fallbackEndIndex;
      const start = selectedText ? selectionStart : fallbackStart;
      const end = selectedText ? selectionEnd : fallbackEnd;
      const text = value.slice(start, end);
      const nextValue = `${value.slice(0, start)}**${text}**${value.slice(end)}`;
      updatePrintTemplateSelection(templateType, nextValue, start + 2, end + 2);
      return;
    }

    const lineStart = value.lastIndexOf('\n', Math.max(selectionStart - 1, 0)) + 1;
    const lineEndIndex = value.indexOf('\n', selectionEnd);
    const lineEnd = lineEndIndex === -1 ? value.length : lineEndIndex;
    const block = value.slice(lineStart, lineEnd);
    const prefix =
      action === 'center' ? '          ' : action === 'right' ? '                    ' : '';
    const formattedBlock = block
      .split('\n')
      .map(line => `${prefix}${line.trimStart()}`)
      .join('\n');
    const nextValue = `${value.slice(0, lineStart)}${formattedBlock}${value.slice(lineEnd)}`;
    updatePrintTemplateSelection(
      templateType,
      nextValue,
      lineStart,
      lineStart + formattedBlock.length
    );
  };

  const renderPrintTemplateToolbar = (templateType: EditablePrintTemplateType) => {
    const { isEditing } = getEditablePrintTemplate(templateType);
    return (
      <div className="flex h-8 items-center">
        {isEditing && (
          <div className="flex items-center gap-1 rounded-lg border border-slate-200 bg-white px-1 py-1 shadow-sm">
            {[
              { action: 'left' as const, title: 'Căn trái', icon: AlignLeft },
              { action: 'center' as const, title: 'Căn giữa', icon: AlignCenter },
              { action: 'right' as const, title: 'Căn phải', icon: AlignRight },
              { action: 'bold' as const, title: 'In đậm', icon: Bold },
              { action: 'newline' as const, title: 'Xuống dòng', icon: CornerDownLeft },
            ].map(tool => {
              const ToolIcon = tool.icon;
              return (
                <button
                  key={tool.action}
                  type="button"
                  onClick={() => formatPrintTemplate(templateType, tool.action)}
                  className="flex h-6 w-7 items-center justify-center rounded-md text-slate-500 hover:bg-indigo-50 hover:text-indigo-600"
                  title={tool.title}
                  aria-label={tool.title}
                >
                  <ToolIcon className="h-3.5 w-3.5" />
                </button>
              );
            })}
          </div>
        )}
      </div>
    );
  };

  const handlePrintTemplatePreview = () => {
    if (activePrintTemplateType === 'barcodeLabel') {
      const printWindow = window.open('', '_blank', 'width=420,height=320');
      if (!printWindow) {
        showToast('Vui lòng cho phép mở cửa sổ mới (Pop-up) để in thử.', 'warning');
        return;
      }

      printWindow.document.write(`
        <html>
          <head>
            <meta charset="utf-8" />
            <title>In thử mẫu tem mã</title>
            <style>${barcodeLabelPrintCss}</style>
          </head>
          <body>
            <main class="sheet">
              ${barcodeLabelPreviewItems.map(item => renderBarcodeLabelHtml(item)).join('')}
            </main>
            <script>
              window.onload = function() {
                window.print();
              };
            </script>
          </body>
        </html>
      `);
      printWindow.document.close();
      return;
    }

    if (activePrintTemplateType === 'invoice') {
      const sampleOrder: POSOrder = {
        id: 'preview-invoice',
        orderCode: 'HD003362',
        date: '2026-05-08T19:47:00',
        customerName: 'Anh Hòa Q.1',
        items: [
          { productId: 'p1', sku: 'S0068-37-XANH', name: 'Sandal bé trai 0068 - 37 - XANH', quantity: 1, price: 250000, discount: 0, total: 250000 },
          { productId: 'p2', sku: 'D1205-38-KEM', name: 'Dép nữ quai ngang 1205 - 38 - KEM', quantity: 1, price: 300000, discount: 35000, total: 265000 },
          { productId: 'p3', sku: 'G2301-36-DEN', name: 'Giày búp bê nữ 2301 - 36 - ĐEN', quantity: 1, price: 220000, discount: 0, total: 220000 },
        ],
        totalAmount: 735000,
        discount: 35000,
        finalAmount: 700000,
        paymentMethod: 'Cash',
        cashReceived: 700000,
        staffId: 'staff-1',
        staffName: 'Thu ngân POS',
        pointsEarned: 0,
      };
      const ok = openPrintInvoice({
        order: sampleOrder,
        storeName: brandProfile.name || 'GIÀY DÉP PHÚC SANG',
        storeAddress: brandProfile.address || 'Số nhà 14 đường NC2 - Mỹ Phước 2 - Bến Cát, Bình Dương',
        storePhone: brandProfile.phone || '033.571.3423 - 096.886.7411',
        customerPhone: '0901 234 567',
        customerAddress: 'Số 10, Phổ Quang, Tân Bình, TP.HCM',
        staffName: 'Thu ngân POS',
      });
      if (!ok) {
        showToast('Vui lòng cho phép mở cửa sổ mới (Pop-up) để in thử.', 'warning');
      }
      return;
    }

    const printConfig = {
      exchange: {
        title: 'In thử phiếu đổi hàng',
        lines: renderedExchangePreviewLines,
      },
      payroll: {
        title: 'In thử bảng lương',
        lines: renderedPayrollPreviewLines,
      },
    }[activePrintTemplateType as 'exchange' | 'payroll'];

    if (!printConfig) {
      showToast('Mẫu in này chưa hỗ trợ in thử.', 'warning');
      return;
    }

    const printWindow = window.open('', '_blank', 'width=420,height=640');
    if (!printWindow) {
      showToast('Vui lòng cho phép mở cửa sổ mới (Pop-up) để in thử.', 'warning');
      return;
    }

    printWindow.document.write(`
      <html>
        <head>
          <title>${printConfig.title}</title>
          <style>
            @page { size: 80mm auto; margin: 0; }
            body { margin: 0; padding: 5mm; font-family: Inter, ui-sans-serif, system-ui, sans-serif; font-size: 12px; line-height: 1.5; color: #0f172a; letter-spacing: 0; }
            pre { margin: 0; white-space: pre-wrap; word-break: break-word; }
          </style>
        </head>
        <body>
          <pre>${escapeHtml(printConfig.lines.join('\n'))}</pre>
          <script>
            window.onload = function() {
              window.print();
            };
          </script>
        </body>
      </html>
    `);
    printWindow.document.close();
  };

  // Render
  return (
    <div className="space-y-4">
      {/* Tab selector */}
      <div className="flex flex-wrap gap-x-6 gap-y-2 rounded-xl border border-slate-100 bg-white px-5 py-3 shadow-sm">
        {PRINT_TEMPLATE_TYPES.map(type => (
          <button
            key={type.id}
            type="button"
            disabled={type.disabled}
            onClick={() => !type.disabled && setActivePrintTemplateType(type.id)}
            className={`border-b-2 py-2 text-sm font-normal transition-colors ${
              type.id === activePrintTemplateType
                ? 'border-blue-600 text-blue-600'
                : type.disabled
                  ? 'border-transparent text-slate-400'
                  : 'border-transparent text-slate-600 hover:text-slate-900'
            }`}
            title={type.disabled ? 'Sẽ bổ sung ở phase sau' : undefined}
          >
            {type.label}
          </button>
        ))}
      </div>

      {/* Invoice template */}
      {activePrintTemplateType === 'invoice' && (
        <div className="grid gap-4 xl:grid-cols-[minmax(0,1fr)_minmax(430px,0.95fr)]">
          <Section
            id="print-template-editor"
            title="Mẫu in hóa đơn"
            description="Thiết lập trước mẫu hóa đơn bán hàng. Phase này mới là cấu hình giao diện mẫu, chưa thay thế luồng in thật của POS."
            icon={Printer}
          >
            <div className="space-y-5">
              <div className="flex h-24 flex-col justify-between rounded-lg border border-slate-100 bg-slate-50/70 px-5 py-3">
                <div className="grid h-10 w-full min-w-0 grid-cols-[auto_minmax(150px,1fr)_40px] items-center gap-3">
                  <span
                    className={`shrink-0 whitespace-nowrap rounded-full px-3 py-1 text-xs font-normal ${
                      isInvoiceTemplateEditing
                        ? 'bg-indigo-50 text-indigo-700'
                        : 'bg-slate-100 text-slate-500'
                    }`}
                  >
                    {isInvoiceTemplateEditing ? 'Đang sửa realtime' : 'Chỉ xem'}
                  </span>
                  <select
                    value={invoiceTemplateName}
                    onChange={e => setInvoiceTemplateName(e.target.value)}
                    className="h-10 w-full min-w-0 rounded-xl border border-slate-200 bg-white px-3 text-sm font-normal outline-none focus:border-indigo-300"
                    aria-label="Chọn khổ giấy hóa đơn"
                  >
                    <option>Khổ giấy K80</option>
                    <option>Khổ giấy A4</option>
                    <option>Khổ giấy A5</option>
                  </select>
                  <button
                    type="button"
                    onClick={() => {
                      if (!invoiceTemplateBody) {
                        setInvoiceTemplateBody(defaultInvoiceTemplateBody);
                      }
                      setIsInvoiceTemplateEditing(prev => !prev);
                    }}
                    className={`flex h-10 w-10 items-center justify-center rounded-lg transition-colors ${
                      isInvoiceTemplateEditing
                        ? 'bg-indigo-600 text-white hover:bg-indigo-700'
                        : 'text-slate-600 hover:bg-white hover:text-indigo-600'
                    }`}
                    title={isInvoiceTemplateEditing ? 'Khóa sửa mẫu' : 'Sửa nội dung mẫu'}
                  >
                    {isInvoiceTemplateEditing ? (
                      <Check className="h-4 w-4" />
                    ) : (
                      <Pencil className="h-4 w-4" />
                    )}
                  </button>
                </div>
                {renderPrintTemplateToolbar('invoice')}
              </div>

              <textarea
                ref={invoiceTemplateTextareaRef}
                value={currentInvoiceTemplateBody}
                onChange={e => setInvoiceTemplateBody(e.target.value)}
                readOnly={!isInvoiceTemplateEditing}
                className={`h-[650px] w-full resize-none rounded-lg border p-4 font-sans text-sm leading-6 text-slate-900 outline-none ${
                  isInvoiceTemplateEditing
                    ? 'border-indigo-300 bg-white ring-2 ring-indigo-100'
                    : 'border-slate-200 bg-slate-50'
                }`}
                placeholder="Gõ nội dung mẫu in. Có thể xuống dòng bằng Enter."
                spellCheck={false}
              />
            </div>
          </Section>

          <Section
            id="print-template-preview"
            title="Xem trước mẫu in"
            description="Bản xem trước cập nhật realtime theo nội dung mẫu bên trái."
            icon={Printer}
          >
            <div className="space-y-5">
              <div className="flex h-24 flex-col justify-between rounded-lg border border-slate-100 bg-slate-50/70 px-5 py-3">
                <div className="flex h-10 items-center justify-between gap-3">
                  <span className="text-sm font-normal text-slate-600">Mẫu xem trước</span>
                  <button
                    type="button"
                    onClick={handlePrintTemplatePreview}
                    className="inline-flex h-10 items-center gap-2 rounded-xl border border-indigo-200 bg-white px-4 text-sm font-normal text-indigo-700 hover:bg-indigo-50"
                  >
                    <Printer className="h-4 w-4" />
                    In thử
                  </button>
                </div>

                <div className="flex h-6 items-center justify-between gap-3 text-xs font-normal text-slate-500">
                  <span>
                    {isInvoiceTemplateEditing
                      ? 'Đang xem realtime nội dung đang sửa'
                      : 'Xem trước mẫu in'}
                  </span>
                  <span>{renderedInvoicePreviewLines.length} dòng</span>
                </div>
              </div>

              <div className="h-[650px] overflow-y-auto rounded-lg border border-blue-100 bg-blue-50 p-4 font-sans text-sm leading-6 text-slate-950">
                {renderedInvoicePreviewLines.map((line, index) => {
                  const rawLine = rawInvoiceTemplateLines[index] || '';
                  const previousRawLine = rawInvoiceTemplateLines[index - 1] || '';
                  const trimmedLine = line.trim();
                  const usesSecondSampleItem = /_2\}/.test(rawLine);
                  const sampleItem = SAMPLE_INVOICE_ITEMS[usesSecondSampleItem ? 1 : 0];
                  const hasItemNameToken = /\{Ten_Hang_Hoa(?:_2)?\}/.test(rawLine);
                  const hasItemValueToken =
                    /\{(?:Don_Gia|Don_Gia_Chiet_Khau|So_Luong|Thanh_Tien)(?:_2)?\}/.test(rawLine);
                  const previousIsProductLine =
                    /\{(?:Don_Gia|Don_Gia_Chiet_Khau|So_Luong|Thanh_Tien)(?:_2)?\}/.test(
                      previousRawLine
                    );
                  const isTableHeader = /Đơn giá|SL|T\.Tiền|Thành tiền/i.test(line);
                  const isTitleLine = /HÓA ĐƠN|HOA DON/i.test(line);
                  const isStoreHeader = index <= 2;
                  const isCenteredInvoiceMetaLine =
                    /^Số HĐ:/i.test(trimmedLine) || /^Ngày /i.test(trimmedLine);
                  const isTotalLine = /Tổng|Chiết khấu|thanh toán|Tiền khách|Tiền thừa/i.test(line);
                  const isTotalInWordsLine = /^\(.+\)$/.test(trimmedLine);

                  if (!trimmedLine) {
                    return (
                      <div
                        key={`blank-${index}`}
                        className={`${previousIsProductLine ? 'h-2 border-b border-dashed border-slate-700' : 'h-6'}`}
                      />
                    );
                  }

                  if (isTableHeader) {
                    return (
                      <div
                        key={`header-${index}`}
                        className="grid h-6 grid-cols-[1fr_80px_110px] border-y border-slate-900 font-bold"
                      >
                        <span>Đơn giá</span>
                        <span className="text-center">SL</span>
                        <span className="text-right">T.Tiền</span>
                      </div>
                    );
                  }

                  if (hasItemNameToken) {
                    const itemTokens = {
                      ...invoicePreviewTokens,
                      '{Ten_Hang_Hoa}': sampleItem.name,
                      '{Ten_Hang_Hoa_2}': sampleItem.name,
                    };
                    const itemNameLine = replaceInvoiceTemplateTokens(rawLine, itemTokens);

                    return (
                      <div key={`item-name-${index}`} className="h-6 overflow-hidden">
                        {itemNameLine}
                      </div>
                    );
                  }

                  if (hasItemValueToken) {
                    return (
                      <div
                        key={`item-value-${index}`}
                        className="grid h-6 grid-cols-[1fr_80px_110px]"
                      >
                        <span>
                          {sampleItem.price}
                          {sampleItem.originalPrice && (
                            <span className="ml-2 text-slate-500 line-through">
                              {sampleItem.originalPrice}
                            </span>
                          )}
                        </span>
                        <span className="text-center">{sampleItem.quantity}</span>
                        <span className="text-right">{sampleItem.total}</span>
                      </div>
                    );
                  }

                  const sampleItemTokens = {
                    ...invoicePreviewTokens,
                    '{Don_Gia}': sampleItem.price,
                    '{Don_Gia_Chiet_Khau}': sampleItem.price,
                    '{So_Luong}': sampleItem.quantity,
                    '{Thanh_Tien}': sampleItem.total,
                    '{Don_Gia_2}': sampleItem.price,
                    '{Don_Gia_Chiet_Khau_2}': sampleItem.price,
                    '{So_Luong_2}': sampleItem.quantity,
                    '{Thanh_Tien_2}': sampleItem.total,
                  };
                  const displayLine = replaceInvoiceTemplateTokens(rawLine, sampleItemTokens);
                  const totalLineMatch = displayLine.match(/^(.+?:)\s*(.+)$/);

                  if (isTotalLine && totalLineMatch) {
                    return (
                      <div
                        key={`total-${index}`}
                        className="grid h-6 grid-cols-[1fr_220px_120px] font-bold"
                      >
                        <span />
                        <span>{totalLineMatch[1]}</span>
                        <span className="text-right">{totalLineMatch[2]}</span>
                      </div>
                    );
                  }

                  return (
                    <div
                      key={`${line}-${index}`}
                      className={
                        isTitleLine
                          ? 'h-6 text-center text-base font-bold'
                          : isStoreHeader
                            ? 'h-6 text-center first:font-bold'
                            : isCenteredInvoiceMetaLine
                              ? 'h-6 text-center'
                              : isTotalInWordsLine
                                ? 'h-6 text-right italic'
                                : isTotalLine
                                  ? 'h-6 text-right font-bold'
                                  : line.includes('Cảm ơn')
                                    ? 'h-6 text-center font-bold'
                                    : 'h-6'
                      }
                    >
                      {displayLine}
                    </div>
                  );
                })}
              </div>
            </div>
          </Section>
        </div>
      )}

      {/* Exchange template */}
      {activePrintTemplateType === 'exchange' && (
        <div className="grid gap-4 xl:grid-cols-[minmax(0,1fr)_minmax(430px,0.95fr)]">
          <Section
            id="exchange-template-editor"
            title="Mẫu in phiếu đổi hàng"
            description="Thiết lập trước mẫu phiếu đổi hàng. Sử dụng tokens để tùy chỉnh nội dung in."
            icon={Printer}
          >
            <div className="space-y-5">
              <div className="flex h-24 flex-col justify-between rounded-lg border border-slate-100 bg-slate-50/70 px-5 py-3">
                <div className="grid h-10 w-full min-w-0 grid-cols-[auto_minmax(150px,1fr)_40px] items-center gap-3">
                  <span
                    className={`shrink-0 whitespace-nowrap rounded-full px-3 py-1 text-xs font-normal ${
                      isExchangeTemplateEditing
                        ? 'bg-indigo-50 text-indigo-700'
                        : 'bg-slate-100 text-slate-500'
                    }`}
                  >
                    {isExchangeTemplateEditing ? 'Đang sửa realtime' : 'Chỉ xem'}
                  </span>
                  <select
                    value={exchangeTemplateName}
                    onChange={e => setExchangeTemplateName(e.target.value)}
                    className="h-10 w-full min-w-0 rounded-xl border border-slate-200 bg-white px-3 text-sm font-normal outline-none focus:border-indigo-300"
                    aria-label="Chọn khổ giấy đổi hàng"
                  >
                    <option>Khổ giấy K80</option>
                    <option>Khổ giấy A4</option>
                    <option>Khổ giấy A5</option>
                  </select>
                  <button
                    type="button"
                    onClick={() => {
                      if (!exchangeTemplateBody) {
                        setExchangeTemplateBody(defaultExchangeTemplateBody);
                      }
                      setIsExchangeTemplateEditing(prev => !prev);
                    }}
                    className={`flex h-10 w-10 items-center justify-center rounded-lg transition-colors ${
                      isExchangeTemplateEditing
                        ? 'bg-indigo-600 text-white hover:bg-indigo-700'
                        : 'text-slate-600 hover:bg-white hover:text-indigo-600'
                    }`}
                    title={isExchangeTemplateEditing ? 'Khóa sửa mẫu' : 'Sửa nội dung mẫu'}
                  >
                    {isExchangeTemplateEditing ? (
                      <Check className="h-4 w-4" />
                    ) : (
                      <Pencil className="h-4 w-4" />
                    )}
                  </button>
                </div>
                {renderPrintTemplateToolbar('exchange')}
              </div>

              <textarea
                ref={exchangeTemplateTextareaRef}
                value={currentExchangeTemplateBody}
                onChange={e => setExchangeTemplateBody(e.target.value)}
                readOnly={!isExchangeTemplateEditing}
                className={`h-[650px] w-full resize-none rounded-lg border p-4 font-sans text-sm leading-6 text-slate-900 outline-none ${
                  isExchangeTemplateEditing
                    ? 'border-indigo-300 bg-white ring-2 ring-indigo-100'
                    : 'border-slate-200 bg-slate-50'
                }`}
                placeholder="Gõ nội dung mẫu in phiếu đổi hàng. Có thể xuống dòng bằng Enter."
                spellCheck={false}
              />
            </div>
          </Section>

          <Section
            id="exchange-template-preview"
            title="Xem trước mẫu in"
            description="Bản xem trước cập nhật realtime theo nội dung mẫu bên trái."
            icon={Printer}
          >
            <div className="space-y-5">
              <div className="flex h-24 flex-col justify-between rounded-lg border border-slate-100 bg-slate-50/70 px-5 py-3">
                <div className="flex h-10 items-center justify-between gap-3">
                  <span className="text-sm font-normal text-slate-600">Mẫu xem trước</span>
                  <button
                    type="button"
                    onClick={handlePrintTemplatePreview}
                    className="inline-flex h-10 items-center gap-2 rounded-xl border border-indigo-200 bg-white px-4 text-sm font-normal text-indigo-700 hover:bg-indigo-50"
                  >
                    <Printer className="h-4 w-4" />
                    In thử
                  </button>
                </div>

                <div className="flex h-6 items-center justify-between gap-3 text-xs font-normal text-slate-500">
                  <span>
                    {isExchangeTemplateEditing
                      ? 'Đang xem realtime nội dung đang sửa'
                      : 'Xem trước mẫu in'}
                  </span>
                  <span>{renderedExchangePreviewLines.length} dòng</span>
                </div>
              </div>

              <div className="h-[650px] overflow-y-auto rounded-lg border border-blue-100 bg-blue-50 p-4 font-sans text-sm leading-6 text-slate-950">
                {renderedExchangePreviewLines.map((line, index) => {
                  const rawLine = rawExchangeTemplateLines[index] || '';
                  const previousRawLine = rawExchangeTemplateLines[index - 1] || '';
                  const trimmedLine = line.trim();

                  const hasItemNameToken = /\{Ten_Hang_Hoa(?:_2)?\}/.test(rawLine);
                  const hasItemValueToken =
                    /\{(?:Don_Gia|Don_Gia_Chiet_Khau|So_Luong|Thanh_Tien)(?:_2)?\}/.test(rawLine);
                  const hasNewItemNameToken = /\{Ten_Hang_Hoa_Moi(?:_2)?\}/.test(rawLine);
                  const hasNewItemValueToken =
                    /\{(?:Don_Gia_Moi|Don_Gia_Chiet_Khau_Moi|So_Luong_Moi|Thanh_Tien_Moi)(?:_2)?\}/.test(
                      rawLine
                    );
                  const previousIsProductLine =
                    /\{(?:Don_Gia|Don_Gia_Chiet_Khau|So_Luong|Thanh_Tien|Don_Gia_Moi|Don_Gia_Chiet_Khau_Moi|So_Luong_Moi|Thanh_Tien_Moi)(?:_2)?\}/.test(
                      previousRawLine
                    );

                  const isTitle = /PHIẾU ĐỔI HÀNG|HÓA ĐƠN TRẢ HÀNG/i.test(line);
                  const isStoreHeader = index <= 2;
                  const isCenteredExchangeMetaLine =
                    /^Số phiếu:/i.test(trimmedLine) || /^Ngày /i.test(trimmedLine);
                  const isSectionHeader =
                    /^HÀNG TRẢ$|^HÀNG ĐỔI$|^Mua cũ$|^Mua mới$|^Ghi chú$/i.test(trimmedLine);
                  const isDottedLine = /^\.+$/.test(trimmedLine);
                  const isTableHeader = /Đơn giá|SL|T\.Tiền|Thành tiền/i.test(line);
                  const isTotalLine =
                    /Tổng tiền hàng trả:|Tổng tiền hàng đổi:|Chênh lệch:|Tổng tiền hóa đơn trả:|Tổng tiền hóa đơn mua:|Tổng cộng:/i.test(
                      line
                    );
                  const isTotalInWords = /^\(.+\)$/.test(trimmedLine);

                  if (!trimmedLine) {
                    return (
                      <div
                        key={`blank-${index}`}
                        className={`${previousIsProductLine ? 'h-2 border-b border-dashed border-slate-700' : 'h-6'}`}
                      />
                    );
                  }

                  if (isTitle) {
                    return (
                      <div key={`title-${index}`} className="h-6 text-center text-base font-bold">
                        {line}
                      </div>
                    );
                  }

                  if (isStoreHeader) {
                    return (
                      <div key={`header-${index}`} className="h-6 text-center first:font-bold">
                        {line}
                      </div>
                    );
                  }

                  if (isDottedLine) {
                    return (
                      <div
                        key={`dotted-${index}`}
                        className="h-2 border-b border-dashed border-slate-700"
                      ></div>
                    );
                  }

                  if (isSectionHeader) {
                    return (
                      <div key={`section-${index}`} className="h-6 text-center">
                        {line}
                      </div>
                    );
                  }

                  if (isTableHeader) {
                    return (
                      <div
                        key={`header-${index}`}
                        className="grid h-6 grid-cols-[1fr_80px_110px] border-y border-slate-900 font-bold"
                      >
                        <span>Đơn giá</span>
                        <span className="text-center">SL</span>
                        <span className="text-right">T.Tiền</span>
                      </div>
                    );
                  }

                  if (hasItemNameToken) {
                    return (
                      <div key={`item-name-${index}`} className="h-6 overflow-hidden">
                        {line}
                      </div>
                    );
                  }

                  if (hasItemValueToken) {
                    const parts = line.split(/\s+/).filter(p => p);
                    const price = parts[0] || '';
                    const quantity = parts[1] || '';
                    const total = parts[2] || '';

                    return (
                      <div
                        key={`item-value-${index}`}
                        className="grid h-6 grid-cols-[1fr_80px_110px]"
                      >
                        <span>{price}</span>
                        <span className="text-center">{quantity}</span>
                        <span className="text-right">{total}</span>
                      </div>
                    );
                  }

                  if (hasNewItemNameToken) {
                    return (
                      <div key={`new-item-name-${index}`} className="h-6 overflow-hidden">
                        {line}
                      </div>
                    );
                  }

                  if (hasNewItemValueToken) {
                    const parts = line.split(/\s+/).filter(p => p);
                    const price = parts[0] || '';
                    const quantity = parts[1] || '';
                    const total = parts[2] || '';

                    return (
                      <div
                        key={`new-item-value-${index}`}
                        className="grid h-6 grid-cols-[1fr_80px_110px]"
                      >
                        <span>{price}</span>
                        <span className="text-center">{quantity}</span>
                        <span className="text-right">{total}</span>
                      </div>
                    );
                  }

                  if (isTotalLine) {
                    const match = line.match(/^(.+?:)\s*(.+)$/);
                    if (match) {
                      return (
                        <div
                          key={`total-${index}`}
                          className="grid h-6 grid-cols-[1fr_220px_120px] font-bold"
                        >
                          <span />
                          <span>{match[1]}</span>
                          <span className="text-right">{match[2]}</span>
                        </div>
                      );
                    }
                  }

                  if (isTotalInWords) {
                    return (
                      <div key={`words-${index}`} className="h-6 text-right italic">
                        {line}
                      </div>
                    );
                  }

                  return (
                    <div
                      key={`line-${index}`}
                      className={
                        isCenteredExchangeMetaLine
                          ? 'h-6 text-center'
                          : line.includes('Cảm ơn')
                            ? 'h-6 text-center font-bold'
                            : 'h-6'
                      }
                    >
                      {line}
                    </div>
                  );
                })}
              </div>
            </div>
          </Section>
        </div>
      )}

      {/* Barcode label template */}
      {activePrintTemplateType === 'barcodeLabel' && (
        <div className="grid gap-4 xl:grid-cols-[minmax(0,1fr)_minmax(430px,0.95fr)]">
          <Section
            id="barcode-label-template-editor"
            title="Mẫu in tem mã"
            description="Thiết kế mẫu tem mã vạch theo khổ 2 tem, tự sinh barcode từ mã hàng khi in trong danh sách hàng hóa."
            icon={Printer}
          >
            <div className="space-y-5">
              <div className="flex h-24 flex-col justify-between rounded-lg border border-slate-100 bg-slate-50/70 px-5 py-3">
                <div className="grid h-10 w-full min-w-0 grid-cols-[auto_minmax(150px,1fr)_auto] items-center gap-3">
                  <span className="shrink-0 whitespace-nowrap rounded-full bg-indigo-50 px-3 py-1 text-xs font-normal text-indigo-700">
                    Đang áp dụng
                  </span>
                  <input
                    value={barcodeLabelTemplateName}
                    onChange={e => setBarcodeLabelTemplateName(e.target.value)}
                    className="h-10 w-full min-w-0 rounded-xl border border-slate-200 bg-white px-3 text-sm font-normal outline-none focus:border-indigo-300"
                    aria-label="Tên mẫu tem mã"
                  />
                  <span className="shrink-0 rounded-lg bg-white px-3 py-2 text-xs font-normal text-slate-500">
                    {barcodeLabelWidthMm}x{barcodeLabelHeightMm}mm
                  </span>
                </div>
                <div className="flex h-6 items-center justify-between gap-3 text-xs font-normal text-slate-500">
                  <span>
                    Khổ giấy {barcodeLabelTotalWidthMm}mm, {barcodeLabelColumns} tem ngang
                  </span>
                  <span>Mặc định {barcodeLabelDefaultQty} tem / hàng</span>
                </div>
              </div>

              <div className="grid gap-3 sm:grid-cols-2">
                <label className="space-y-2 rounded-lg border border-slate-100 bg-white p-4">
                  <span className="text-xs font-normal uppercase tracking-wide text-slate-500">
                    Rộng tem (mm)
                  </span>
                  <input
                    type="number"
                    min={20}
                    max={80}
                    value={barcodeLabelWidthMm}
                    onChange={e =>
                      setBarcodeLabelWidthMm(Math.max(20, Number(e.target.value) || 35))
                    }
                    className="h-10 w-full rounded-xl border border-slate-200 px-3 text-sm outline-none focus:border-indigo-300"
                  />
                </label>
                <label className="space-y-2 rounded-lg border border-slate-100 bg-white p-4">
                  <span className="text-xs font-normal uppercase tracking-wide text-slate-500">
                    Cao tem (mm)
                  </span>
                  <input
                    type="number"
                    min={12}
                    max={60}
                    value={barcodeLabelHeightMm}
                    onChange={e =>
                      setBarcodeLabelHeightMm(Math.max(12, Number(e.target.value) || 22))
                    }
                    className="h-10 w-full rounded-xl border border-slate-200 px-3 text-sm outline-none focus:border-indigo-300"
                  />
                </label>
                <label className="space-y-2 rounded-lg border border-slate-100 bg-white p-4">
                  <span className="text-xs font-normal uppercase tracking-wide text-slate-500">
                    Số tem ngang
                  </span>
                  <input
                    type="number"
                    min={1}
                    max={4}
                    value={barcodeLabelColumns}
                    onChange={e =>
                      setBarcodeLabelColumns(Math.min(4, Math.max(1, Number(e.target.value) || 2)))
                    }
                    className="h-10 w-full rounded-xl border border-slate-200 px-3 text-sm outline-none focus:border-indigo-300"
                  />
                </label>
                <label className="space-y-2 rounded-lg border border-slate-100 bg-white p-4">
                  <span className="text-xs font-normal uppercase tracking-wide text-slate-500">
                    Tem mỗi hàng
                  </span>
                  <input
                    type="number"
                    min={1}
                    max={99}
                    value={barcodeLabelDefaultQty}
                    onChange={e =>
                      setBarcodeLabelDefaultQty(Math.max(1, Number(e.target.value) || 2))
                    }
                    className="h-10 w-full rounded-xl border border-slate-200 px-3 text-sm outline-none focus:border-indigo-300"
                  />
                </label>
              </div>

              <div className="rounded-lg border border-slate-100 bg-white p-4">
                <div className="mb-3 text-xs font-normal uppercase tracking-wide text-slate-500">
                  Nội dung trên tem
                </div>
                <div className="grid gap-3 sm:grid-cols-2">
                  {[
                    {
                      label: 'Tên hàng',
                      checked: barcodeLabelShowName,
                      onChange: setBarcodeLabelShowName,
                    },
                    {
                      label: 'Mã hàng',
                      checked: barcodeLabelShowCode,
                      onChange: setBarcodeLabelShowCode,
                    },
                    {
                      label: 'Giá bán',
                      checked: barcodeLabelShowPrice,
                      onChange: setBarcodeLabelShowPrice,
                    },
                    {
                      label: 'Viền tem thử',
                      checked: barcodeLabelShowBorder,
                      onChange: setBarcodeLabelShowBorder,
                    },
                  ].map(option => (
                    <label
                      key={option.label}
                      className="flex items-center justify-between gap-3 rounded-xl border border-slate-100 px-3 py-2"
                    >
                      <span className="text-sm font-normal text-slate-700">{option.label}</span>
                      <input
                        type="checkbox"
                        checked={option.checked}
                        onChange={e => option.onChange(e.target.checked)}
                        className="h-4 w-4 rounded border-slate-300 text-indigo-600 focus:ring-indigo-500"
                      />
                    </label>
                  ))}
                </div>
              </div>

              <div className="rounded-lg border border-indigo-100 bg-indigo-50 px-4 py-3 text-xs leading-relaxed text-indigo-800">
                Khi in trong danh sách hàng hóa, barcode sẽ được sinh từ mã hàng SKU. Nếu sản phẩm
                chưa có SKU, hệ thống dùng barcode hoặc ID làm mã dự phòng.
              </div>
            </div>
          </Section>

          <Section
            id="barcode-label-template-preview"
            title="Xem trước mẫu tem"
            description="Bản xem trước dùng đúng kích thước tem và barcode mẫu để kiểm tra độ vừa khung."
            icon={Printer}
          >
            <div className="space-y-5">
              <div className="flex h-24 flex-col justify-between rounded-lg border border-slate-100 bg-slate-50/70 px-5 py-3">
                <div className="flex h-10 items-center justify-between gap-3">
                  <span className="text-sm font-normal text-slate-600">Mẫu xem trước</span>
                  <button
                    type="button"
                    onClick={handlePrintTemplatePreview}
                    className="inline-flex h-10 items-center gap-2 rounded-xl border border-indigo-200 bg-white px-4 text-sm font-normal text-indigo-700 hover:bg-indigo-50"
                  >
                    <Printer className="h-4 w-4" />
                    In thử
                  </button>
                </div>

                <div className="flex h-6 items-center justify-between gap-3 text-xs font-normal text-slate-500">
                  <span>Barcode Code128 từ mã hàng</span>
                  <span>{barcodeLabelPreviewItems.length} tem mẫu</span>
                </div>
              </div>

              <div className="flex h-[650px] items-center justify-center overflow-auto rounded-lg border border-blue-100 bg-blue-50 p-5">
                <style>{barcodeLabelPrintCss.replace(/@page\s*\{[^}]*\}/, '')}</style>
                <div className="inline-block rounded-lg bg-white p-4 shadow-sm">
                  <main
                    className="sheet"
                    dangerouslySetInnerHTML={{
                      __html: DOMPurify.sanitize(
                        barcodeLabelPreviewItems
                          .map(item => renderBarcodeLabelHtml(item))
                          .join(''),
                        { ADD_TAGS: ['svg', 'rect', 'path'], ADD_ATTR: ['viewBox', 'xmlns', 'fill', 'stroke', 'width', 'height', 'd', 'x', 'y'] }
                      ),
                    }}
                  />
                </div>
              </div>
            </div>
          </Section>
        </div>
      )}

      {/* Payroll template */}
      {activePrintTemplateType === 'payroll' && (
        <div className="grid gap-4 xl:grid-cols-[minmax(0,1fr)_minmax(430px,0.95fr)]">
          <Section
            id="payroll-template-editor"
            title="Mẫu in bảng lương"
            description="Thiết lập trước mẫu phiếu thanh toán lương theo mẫu đang dùng trong phân hệ Bảng lương."
            icon={Printer}
          >
            <div className="space-y-5">
              <div className="flex h-24 flex-col justify-between rounded-lg border border-slate-100 bg-slate-50/70 px-5 py-3">
                <div className="grid h-10 w-full min-w-0 grid-cols-[auto_minmax(150px,1fr)_40px] items-center gap-3">
                  <span
                    className={`shrink-0 whitespace-nowrap rounded-full px-3 py-1 text-xs font-normal ${
                      isPayrollTemplateEditing
                        ? 'bg-indigo-50 text-indigo-700'
                        : 'bg-slate-100 text-slate-500'
                    }`}
                  >
                    {isPayrollTemplateEditing ? 'Đang sửa realtime' : 'Chỉ xem'}
                  </span>
                  <select
                    value={payrollTemplateName}
                    onChange={e => setPayrollTemplateName(e.target.value)}
                    className="h-10 w-full min-w-0 rounded-xl border border-slate-200 bg-white px-3 text-sm font-normal outline-none focus:border-indigo-300"
                    aria-label="Chọn khổ giấy bảng lương"
                  >
                    <option>Khổ giấy K80</option>
                    <option>Khổ giấy A4</option>
                    <option>Khổ giấy A5</option>
                  </select>
                  <button
                    type="button"
                    onClick={() => {
                      if (!payrollTemplateBody) {
                        setPayrollTemplateBody(defaultPayrollTemplateBody);
                      }
                      setIsPayrollTemplateEditing(prev => !prev);
                    }}
                    className={`flex h-10 w-10 items-center justify-center rounded-lg transition-colors ${
                      isPayrollTemplateEditing
                        ? 'bg-indigo-600 text-white hover:bg-indigo-700'
                        : 'text-slate-600 hover:bg-white hover:text-indigo-600'
                    }`}
                    title={isPayrollTemplateEditing ? 'Khóa sửa mẫu' : 'Sửa nội dung mẫu'}
                  >
                    {isPayrollTemplateEditing ? (
                      <Check className="h-4 w-4" />
                    ) : (
                      <Pencil className="h-4 w-4" />
                    )}
                  </button>
                </div>
                {renderPrintTemplateToolbar('payroll')}
              </div>

              <textarea
                ref={payrollTemplateTextareaRef}
                value={currentPayrollTemplateBody}
                onChange={e => setPayrollTemplateBody(e.target.value)}
                readOnly={!isPayrollTemplateEditing}
                className={`h-[650px] w-full resize-none rounded-lg border p-4 font-sans text-sm leading-6 text-slate-900 outline-none ${
                  isPayrollTemplateEditing
                    ? 'border-indigo-300 bg-white ring-2 ring-indigo-100'
                    : 'border-slate-200 bg-slate-50'
                }`}
                placeholder="Gõ nội dung mẫu in bảng lương. Có thể xuống dòng bằng Enter."
                spellCheck={false}
              />
            </div>
          </Section>

          <Section
            id="payroll-template-preview"
            title="Xem trước mẫu in"
            description="Bản xem trước cập nhật realtime theo nội dung mẫu bên trái."
            icon={Printer}
          >
            <div className="space-y-5">
              <div className="flex h-24 flex-col justify-between rounded-lg border border-slate-100 bg-slate-50/70 px-5 py-3">
                <div className="flex h-10 items-center justify-between gap-3">
                  <span className="text-sm font-normal text-slate-600">Mẫu xem trước</span>
                  <button
                    type="button"
                    onClick={handlePrintTemplatePreview}
                    className="inline-flex h-10 items-center gap-2 rounded-xl border border-indigo-200 bg-white px-4 text-sm font-normal text-indigo-700 hover:bg-indigo-50"
                  >
                    <Printer className="h-4 w-4" />
                    In thử
                  </button>
                </div>

                <div className="flex h-6 items-center justify-between gap-3 text-xs font-normal text-slate-500">
                  <span>
                    {isPayrollTemplateEditing
                      ? 'Đang xem realtime nội dung đang sửa'
                      : 'Xem trước mẫu in'}
                  </span>
                  <span>{renderedPayrollPreviewLines.length} dòng</span>
                </div>
              </div>

              <div className="h-[650px] overflow-y-auto rounded-lg border border-blue-100 bg-blue-50 p-4 font-sans text-sm leading-6 text-slate-950">
                {renderedPayrollPreviewLines.map((line, index) => {
                  const trimmedLine = line.trim();
                  const isStoreHeader = index === 0;
                  const isTitleLine = /PHIẾU THANH TOÁN LƯƠNG/i.test(line);
                  const isMonthLine = /^Tháng:/i.test(trimmedLine);
                  const isMainPayLine = /^THỰC NHẬN:/i.test(trimmedLine);
                  const isDeductionLine = /^Khấu trừ:/i.test(trimmedLine);
                  const isIndentedLine = /^- /.test(trimmedLine);
                  const isEmployeeInfoLine = /^NV:|^CV:|^Loại:|^Ngày công:/i.test(trimmedLine);
                  const isAmountLine = /:/.test(trimmedLine) && !isMonthLine && !isEmployeeInfoLine;
                  const isFooterLine = /Cảm ơn|Hệ thống Quản trị/i.test(line);

                  if (!trimmedLine) {
                    return <div key={`payroll-blank-${index}`} className="h-6" />;
                  }

                  if (isStoreHeader || isTitleLine || isMonthLine) {
                    return (
                      <div
                        key={`payroll-header-${index}`}
                        className={`h-6 text-center ${isStoreHeader || isTitleLine ? 'font-bold' : ''}`}
                      >
                        {line}
                      </div>
                    );
                  }

                  if (isMainPayLine) {
                    const match = line.match(/^(.+?:)\s*(.+)$/);
                    return (
                      <div
                        key={`payroll-net-${index}`}
                        className="grid h-7 grid-cols-[1fr_150px] border-t border-dashed border-slate-700 pt-1 text-base font-bold"
                      >
                        <span>{match?.[1] || 'THỰC NHẬN:'}</span>
                        <span className="text-right">{match?.[2] || line}</span>
                      </div>
                    );
                  }

                  if (isEmployeeInfoLine) {
                    return (
                      <div key={`payroll-info-${index}`} className="min-h-5 leading-5">
                        {line}
                      </div>
                    );
                  }

                  if (isAmountLine) {
                    const match = line.match(/^(.+?:)\s*(.+)$/);
                    return (
                      <div
                        key={`payroll-amount-${index}`}
                        className={`grid h-6 grid-cols-[1fr_140px] ${isIndentedLine ? 'pl-4 text-slate-700' : ''} ${isDeductionLine ? 'border-t border-dashed border-slate-700 pt-1 font-bold' : ''}`}
                      >
                        <span>{match?.[1] || line}</span>
                        <span className="text-right">{match?.[2] || ''}</span>
                      </div>
                    );
                  }

                  return (
                    <div
                      key={`payroll-line-${index}`}
                      className={isFooterLine ? 'h-6 text-center italic' : 'h-6'}
                    >
                      {line}
                    </div>
                  );
                })}
              </div>
            </div>
          </Section>
        </div>
      )}
    </div>
  );
};

export default React.memo(PrintTemplatesTab);
