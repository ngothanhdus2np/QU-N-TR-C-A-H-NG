import React, { useState, useMemo, useEffect } from 'react';
import {
  ShopeeInventoryOutRecord, ShopeeSourceItem, ShopeeCostConfig,
} from '../../types';
import {
  shopeeOrderKind, calcShopeePlatformNet, calcShopeeNetProfit,
} from '../../src/lib/shopeeProfit';
import {
  Upload, TrendingUp, DollarSign, Plus, Pencil, Save, Trash2,
  Check, X, ArrowUpFromLine, ArrowDownToLine, ChevronLeft, ChevronRight, FileDown, RefreshCw,
} from 'lucide-react';

const PAGE_SIZE = 100;

// Độ rộng cố định (px) từng cột — khớp class w-* của header, dùng cho <colgroup> + table-fixed
// để độ rộng không đổi khi cuộn ngang. Đúng thứ tự 29 cột trong bảng.
// QUAN TRỌNG: tổng mảng này PHẢI khớp với min-w-[...] của <table> bên dưới — nếu min-w lớn
// hơn tổng thật, trình duyệt sẽ giãn thêm cột để đủ min-w, làm sticky (cột đóng băng) bị lệch
// khỏi vị trí cuộn thật khi vuốt ngang.
const COLUMN_WIDTHS = [
  48, 128, 112, 112, 112, 144, 144, // 1-7: đóng băng — vừa nội dung (badge/mã/số nhỏ), không dư thừa như trước
  320, 112, 128, 172, 128, 128, 0, 128, 144, 128, 128, 128, 152, 128, 128, 128, 160, 128, 128, 128, 128, 128, // 8-29 (cột 14 "Phí Ads Shopee" ẩn — width 0, dữ liệu vẫn dùng để tính Sàn Thanh Toán)
];
// Offset cộng dồn cho 7 cột đóng băng đầu tiên khi vuốt ngang
const STICKY_LEFT = [0, 48, 176, 288, 400, 512, 656];

const STATUS_CONFIG: Record<string, { label: string; className: string }> = {
  OK:       { label: 'Đã giao',      className: 'bg-emerald-700 text-white' },
  RETURN:   { label: 'Hoàn hàng',   className: 'bg-rose-600 text-white' },
  CANCEL:   { label: 'Huỷ',         className: 'bg-rose-600 text-white' },
  FAILED:   { label: 'Giao thất bại', className: 'bg-orange-600 text-white' },
  LOST:     { label: 'Thất lạc',    className: 'bg-rose-600 text-white' },
  SHIPPING: { label: 'Đang giao',   className: 'bg-amber-500 text-white' },
  PENDING:  { label: 'Chờ xử lý',   className: 'bg-slate-400 text-white' },
};

interface ShopeeTotals {
  profitMargin: number;
  adsRatio: number;
  platformFeeRatio: number;
  paymentFeeRatio: number;
  freeshipExtraRatio: number;
  affiliateFeeRatio: number;
}

interface Props {
  shopeeInventoryOut: ShopeeInventoryOutRecord[];
  shopeeSourceData: ShopeeSourceItem[];
  shopeeCosts: ShopeeCostConfig | undefined;
  dailyAdsConfig: Record<string, number>;
  selectedAdsDate: string;
  setSelectedAdsDate: (date: string) => void;
  inventoryOutForm: Partial<ShopeeInventoryOutRecord>;
  setInventoryOutForm: (form: Partial<ShopeeInventoryOutRecord>) => void;
  editingInventoryOutId: string | null;
  setEditingInventoryOutId: (id: string | null) => void;
  deleteConfirmId: string | null;
  setDeleteConfirmId: (id: string | null) => void;
  clearAllConfirm: boolean;
  setClearAllConfirm: (v: boolean) => void;
  handleAddInventoryOut: () => void;
  handleEditInventoryOut: (item: ShopeeInventoryOutRecord) => void;
  handleRemoveInventoryOut: (id: string) => Promise<void>;
  handleClearAllInventoryOut: () => Promise<void>;
  handleShopeeFileUpload: (e: React.ChangeEvent<HTMLInputElement>) => void;
  handleDistributeAdsCost: (totalAds: number, date: string, platform: string) => void;
  handleSyncAdsFromBot?: () => Promise<{ updatedDays: number; error?: string }>;
  syncingAds?: boolean;
  shopeeFileInputRef: React.RefObject<HTMLInputElement>;
  totalVariableCosts: number;
  formatNumber: (num: number) => string;
  dynamicTitle: string;
  shopeeTotals: ShopeeTotals;
  onUpdateShopeeCosts: ((costs: ShopeeCostConfig) => Promise<void>) | undefined;
  filterPlatforms?: string[];
  filterStatuses?: string[];
  filterShippingUnits?: string[];
  onSyncFromBot?: () => Promise<{ inserted: number; skipped: number }>;
}

const InventoryOutTab: React.FC<Props> = ({
  shopeeInventoryOut, shopeeSourceData, shopeeCosts, dailyAdsConfig,
  selectedAdsDate, setSelectedAdsDate,
  inventoryOutForm, setInventoryOutForm,
  editingInventoryOutId, setEditingInventoryOutId,
  deleteConfirmId, setDeleteConfirmId,
  clearAllConfirm, setClearAllConfirm,
  handleAddInventoryOut, handleEditInventoryOut, handleRemoveInventoryOut, handleClearAllInventoryOut,
  handleShopeeFileUpload, handleDistributeAdsCost, handleSyncAdsFromBot, syncingAds,
  shopeeFileInputRef, totalVariableCosts, formatNumber, dynamicTitle, shopeeTotals, onUpdateShopeeCosts,
  filterPlatforms = [],
  filterStatuses = [],
  filterShippingUnits = [],
  onSyncFromBot,
}) => {
  const localTodayStr = new Date().toLocaleDateString('sv-SE');
  const [showModal, setShowModal] = useState(false);
  const [syncing, setSyncing] = useState(false);
  const [syncMsg, setSyncMsg] = useState<string | null>(null);
  const [selectedAdsPlatform, setSelectedAdsPlatform] = useState<'Shopee 1' | 'Shopee 2'>('Shopee 1');
  const [adsSyncMsg, setAdsSyncMsg] = useState<string | null>(null);
  const [page, setPage] = useState(1);
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());

  useEffect(() => {
    if (editingInventoryOutId) setShowModal(true);
  }, [editingInventoryOutId]);

  useEffect(() => {
    setPage(1);
  }, [shopeeInventoryOut.length, filterPlatforms, filterStatuses, filterShippingUnits]);

  // Tự động phân bổ QC ngay khi mở trang — không cần người dùng bấm nút nữa.
  // Job nền server (routes/adsSpendSync.ts, chạy mỗi 30 phút) cũng làm việc này độc
  // lập để dữ liệu luôn cập nhật kể cả khi không ai mở trang.
  useEffect(() => {
    handleSyncAdsFromBot?.();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const handleSyncFromBot = async () => {
    if (!onSyncFromBot || syncing) return;
    setSyncing(true);
    setSyncMsg(null);
    try {
      const result = await onSyncFromBot();
      setSyncMsg(`Đã thêm ${result.inserted} dòng sản phẩm mới, bỏ qua ${result.skipped} dòng đã có`);
      setTimeout(() => setSyncMsg(null), 5000);
    } catch (err) {
      setSyncMsg(`Lỗi: ${err instanceof Error ? err.message : 'Không kết nối được bot'}`);
      setTimeout(() => setSyncMsg(null), 5000);
    } finally {
      setSyncing(false);
    }
  };

  const handleSyncAds = async () => {
    if (!handleSyncAdsFromBot || syncingAds) return;
    setAdsSyncMsg(null);
    try {
      const result = await handleSyncAdsFromBot();
      setAdsSyncMsg(
        result.error
          ? `Lỗi: ${result.error}`
          : `Đã tự động phân bổ QC cho ${result.updatedDays} ngày (2 shop)`
      );
    } catch (err) {
      setAdsSyncMsg(`Lỗi: ${err instanceof Error ? err.message : 'Không kết nối được bot'}`);
    } finally {
      setTimeout(() => setAdsSyncMsg(null), 5000);
    }
  };

  const closeModal = () => {
    setShowModal(false);
    if (editingInventoryOutId) {
      setEditingInventoryOutId(null);
      setInventoryOutForm({
        date: localTodayStr, status: 'OK', platform: 'Shopee 2', quantity: 1,
        salePrice: 0, customerPaid: 0, platformFee: 0, paymentFee: 0,
        freeshipExtra: 0, affiliateFee: 0, shippingUnit: 'GHN', profitStatus: 'LÃI 2',
      });
    }
  };

  // Dedup bằng orderId + sku (1 đơn nhiều sản phẩm khác nhau = nhiều sku, không gộp mất) — lớp bảo vệ cuối cùng
  const dedupedInventoryOut = useMemo(() => {
    const score = (item: typeof shopeeInventoryOut[number]) =>
      (item.sku ? 100 : 0) +
      (item.productName && item.productName.toUpperCase() !== 'DEBUG' ? 20 : 0) +
      (Number(item.salePrice || 0) > 0 ? 10 : 0) +
      (item.status === 'OK' ? 1 : 0);
    const bestByOrder = new Map<string, typeof shopeeInventoryOut[number]>();
    shopeeInventoryOut.forEach(item => {
      const key = item.orderId ? `${item.orderId}||${item.sku ?? ''}` : item.id;
      if (!key) return;
      const existing = bestByOrder.get(key);
      if (!existing || score(item) > score(existing)) bestByOrder.set(key, item);
    });
    return Array.from(bestByOrder.values());
  }, [shopeeInventoryOut]);

  const filteredData = useMemo(() => {
    const q = searchQuery.trim().toLowerCase();
    return dedupedInventoryOut
      .filter(item => {
        if (filterPlatforms.length > 0 && !filterPlatforms.includes(item.platform || 'Shopee 2')) return false;
        if (filterStatuses.length > 0 && !filterStatuses.includes(item.status || 'OK')) return false;
        if (filterShippingUnits.length > 0 && !filterShippingUnits.includes(item.shippingUnit || 'GHN')) return false;
        if (q) {
          const haystack = [
            item.orderCode, item.trackingNumber, item.orderId, item.sku, item.productName, item.address,
          ].filter(Boolean).join(' ').toLowerCase();
          if (!haystack.includes(q)) return false;
        }
        return true;
      })
      .sort((a, b) => {
        // Sort chính theo ngày (mới nhất trước). Sort phụ theo orderId + sku để các dòng
        // cùng 1 đơn (đơn nhiều SKU) luôn nằm liền nhau — điều kiện để gộp ô (rowSpan) cột cấp đơn.
        const dc = (b.shipDate || b.date).localeCompare(a.shipDate || a.date);
        if (dc !== 0) return dc;
        const oc = (a.orderId || a.trackingNumber || '').localeCompare(b.orderId || b.trackingNumber || '');
        if (oc !== 0) return oc;
        return (a.sku || '').localeCompare(b.sku || '');
      });
  }, [dedupedInventoryOut, filterPlatforms, filterStatuses, filterShippingUnits, searchQuery]);

  // Map SKU → tên sản phẩm từ shopeeSourceData
  const skuNameEntries = useMemo(() => {
    const norm = (s: string) => s.trim().toLowerCase().replace(/[\s\-_.]/g, '');
    return shopeeSourceData
      .filter(s => s.sku && s.name)
      .map(s => ({ normSku: norm(s.sku), name: s.name }));
  }, [shopeeSourceData]);

  const getProductName = (item: typeof shopeeInventoryOut[0]) => {
    if (item.productName) return item.productName;
    const norm = (s: string) => s.trim().toLowerCase().replace(/[\s\-_.]/g, '');
    const orderSku = norm(item.sku);
    if (!orderSku) return '-';
    // Khớp chính xác
    const exact = skuNameEntries.find(e => e.normSku === orderSku);
    if (exact) return exact.name;
    // Khớp: order SKU chứa source SKU (source là base code)
    const contained = skuNameEntries.find(e => orderSku.startsWith(e.normSku));
    if (contained) return contained.name;
    // Khớp: source SKU chứa order SKU
    const reverse = skuNameEntries.find(e => e.normSku.startsWith(orderSku));
    if (reverse) return reverse.name;
    // Khớp prefix 4 ký tự đầu
    const prefix = orderSku.slice(0, 4);
    const fuzzy = skuNameEntries.find(e => e.normSku.startsWith(prefix));
    if (fuzzy) return fuzzy.name;
    return '-';
  };

  // Nhóm các dòng cùng 1 đơn (order_id) — filteredData đã sort để chúng nằm liền nhau.
  // Đơn nhiều SKU = 1 group nhiều dòng (gộp ô các cột cấp đơn); đơn 1 SP = group 1 dòng.
  const orderGroups = useMemo(() => {
    const groups: { orderKey: string; rows: typeof filteredData }[] = [];
    filteredData.forEach(item => {
      const key = item.orderId || item.id;
      const last = groups[groups.length - 1];
      if (last && last.orderKey === key) last.rows.push(item);
      else groups.push({ orderKey: key, rows: [item] });
    });
    return groups;
  }, [filteredData]);

  // Số thứ tự ĐƠN trong ngày — đếm mỗi đơn 1 lần (đơn đa SP không làm nhảy số)
  const dailyOrderIndexMap = useMemo(() => {
    const map: Record<string, number> = {};
    const countPerDate: Record<string, number> = {};
    orderGroups.forEach(g => {
      const d = g.rows[0].shipDate || g.rows[0].date;
      countPerDate[d] = (countPerDate[d] || 0) + 1;
      map[g.orderKey] = countPerDate[d];
    });
    return map;
  }, [orderGroups]);

  // Phân trang theo NHÓM — không cắt 1 đơn ra 2 trang. Mỗi trang tối đa PAGE_SIZE dòng;
  // nếu thêm 1 đơn làm vượt quá thì đẩy đơn đó sang trang sau (trừ khi đơn tự > PAGE_SIZE).
  const groupPages = useMemo(() => {
    const pages: (typeof orderGroups)[] = [];
    let cur: typeof orderGroups = [];
    let count = 0;
    for (const g of orderGroups) {
      if (count > 0 && count + g.rows.length > PAGE_SIZE) {
        pages.push(cur); cur = []; count = 0;
      }
      cur.push(g);
      count += g.rows.length;
    }
    if (cur.length) pages.push(cur);
    return pages.length ? pages : [[] as typeof orderGroups];
  }, [orderGroups]);

  // ─── Phân loại đơn để tính phí/lợi nhuận đúng theo trạng thái ───
  //  • Thành công (đã giao / đang giao / đã nhận): tính đủ phí + lợi nhuận.
  //  • Lỗ ship (giao thất bại / hoàn hàng): chỉ chịu PiShip + Phí Vận Hành — hàng về kho nên
  //    KHÔNG trừ giá gốc, các phí Shopee khác = 0.
  //  • Còn lại (huỷ chưa giao / chờ xử lý / thất lạc): không phát sinh gì → 0.
  // Nhận diện loại đơn từ cả status CODE (bot sync) lẫn status tiếng Việt thô (dữ liệu cũ/import)
  // Phân loại đơn: nguồn duy nhất src/lib/shopeeProfit.ts — không chép lại công thức
  const orderKind = shopeeOrderKind;
  const isSuccessOrder  = (s: string) => orderKind(s) === 'success';
  const isShipLossOrder = (s: string) => orderKind(s) === 'shiploss';

  // Phí Shopee + doanh thu chỉ tính ở đơn thành công
  const successVal = (i: ShopeeInventoryOutRecord, v: number) => isSuccessOrder(i.status) ? v : 0;
  // PiShip (= phí bảo vệ người bán) + Phí Vận Hành: tính ở đơn thành công VÀ đơn lỗ ship; đơn huỷ = 0
  const pishipVal   = (i: ShopeeInventoryOutRecord) => (isSuccessOrder(i.status) || isShipLossOrder(i.status)) ? Math.abs(i.pishipFee || 0) : 0;
  const handlingVal = (i: ShopeeInventoryOutRecord) => (isSuccessOrder(i.status) || isShipLossOrder(i.status)) ? (i.handlingFee || 0) : 0;

  // Bỏ tiền tố "Tỉnh"/"Thành phố"/"TP." khỏi tên tỉnh/thành — hiện gọn "Hà Nội" thay vì "Thành phố Hà Nội"
  const shortProvinceName = (raw: string) => raw.replace(/^(Thành phố|Tỉnh|TP\.?)\s+/i, '').trim();

  // Sàn Thanh Toán / Lợi nhuận — wrapper quanh công thức chuẩn (src/lib/shopeeProfit.ts)
  const calcPlatformNet = (i: ShopeeInventoryOutRecord) => calcShopeePlatformNet(i.status, i);
  const calcNetProfit = (i: ShopeeInventoryOutRecord) => {
    const importPrice = (shopeeSourceData.find(s => s.sku === i.sku)?.importPrice || 0) * (i.quantity || 1);
    return calcShopeeNetProfit(i.status, i, {
      importPrice,
      adsCost: i.adsCost,
      adsTax: i.adsTax,
      handlingFee: i.handlingFee,
    });
  };

  const tableTotals = useMemo(() => ({
    quantity: filteredData.reduce((s, i) => s + (isSuccessOrder(i.status) ? i.quantity : 0), 0),
    salePrice: filteredData.reduce((s, i) => s + i.salePrice, 0),
    customerPaid: filteredData.reduce((s, i) => s + successVal(i, i.customerPaid), 0),
    platformFee: filteredData.reduce((s, i) => s + successVal(i, i.platformFee), 0),
    pishipFee: filteredData.reduce((s, i) => s + pishipVal(i), 0),
    shopeeAdsFee: filteredData.reduce((s, i) => s + successVal(i, Math.abs(i.shopeeAdsFee || 0)), 0),
    freeshipExtra: filteredData.reduce((s, i) => s + successVal(i, i.freeshipExtra), 0),
    paymentFee: filteredData.reduce((s, i) => s + successVal(i, i.paymentFee), 0),
    vatTax: filteredData.reduce((s, i) => s + successVal(i, i.vatTax || 0), 0),
    personalIncomeTax: filteredData.reduce((s, i) => s + successVal(i, i.personalIncomeTax), 0),
    affiliateFee: filteredData.reduce((s, i) => s + successVal(i, i.affiliateFee), 0),
    platformNet: filteredData.reduce((s, i) => s + calcPlatformNet(i), 0),
    adsCost: filteredData.reduce((s, i) => s + successVal(i, i.adsCost), 0),
    adsTax: filteredData.reduce((s, i) => s + successVal(i, i.adsTax), 0),
    handlingFee: filteredData.reduce((s, i) => s + handlingVal(i), 0),
    netProfit: filteredData.reduce((s, i) => s + calcNetProfit(i), 0),
  }), [filteredData, shopeeSourceData]);

  const totalPages = groupPages.length;
  const pagedGroups = groupPages[Math.min(page, totalPages) - 1] ?? [];
  const pagedRows = pagedGroups.flatMap(g => g.rows);

  // Cột: STT(1) TrangThai(2) Ngay(3) SoDon(4) NenTang(5) MaVD(6) SKU(7) TenSP(8) SL(9) GiaTri(10) KhachTT(11)
  //       PhiCoDinh(12) PhiPiShip(13) PhiDV(14) PhiTT(15) ThueVAT(16) ThueTNCN(17) PhiAff(18)
  //       SanTT(19) QC(20) ThueQC(21) PhiVH(22) LoiNhuan(23) DiaChi(24) DVVC(25) LaiLo(26) HanhDong(27)
  // Tổng 27 cột

  return (
    <section className="flex h-full min-w-0 flex-col overflow-hidden rounded-lg border border-slate-200 bg-white">
      <div className="flex shrink-0 items-center justify-between border-b border-slate-200 px-4 py-3">
        <div>
          <h3 className="text-sm font-semibold text-slate-900">DANH SÁCH ĐƠN HÀNG</h3>
          <p className="text-xs text-slate-500">{filteredData.length} đơn hàng</p>
        </div>
        <div className="flex items-center gap-2">
          {onSyncFromBot && (
            <div className="flex items-center gap-2">
              <button
                onClick={handleSyncFromBot}
                disabled={syncing}
                className="flex h-9 items-center gap-2 rounded-lg bg-indigo-600 px-3 text-sm font-semibold text-white transition-colors hover:bg-indigo-700 disabled:opacity-60 disabled:cursor-not-allowed"
              >
                <RefreshCw className={`h-4 w-4 ${syncing ? 'animate-spin' : ''}`} />
                {syncing ? 'Đang quét...' : 'Đồng bộ Bot'}
              </button>
              {syncMsg && (
                <span className={`text-xs font-medium px-2 py-1 rounded-md ${syncMsg.startsWith('Lỗi') ? 'bg-rose-50 text-rose-600' : 'bg-emerald-50 text-emerald-700'}`}>
                  {syncMsg}
                </span>
              )}
            </div>
          )}
          {handleSyncAdsFromBot && (
            <div className="flex items-center gap-2">
              <button
                onClick={handleSyncAds}
                disabled={syncingAds}
                className="flex h-9 items-center gap-2 rounded-lg bg-rose-600 px-3 text-sm font-semibold text-white transition-colors hover:bg-rose-700 disabled:opacity-60 disabled:cursor-not-allowed"
              >
                <RefreshCw className={`h-4 w-4 ${syncingAds ? 'animate-spin' : ''}`} />
                {syncingAds ? 'Đang đồng bộ...' : 'Tự động phân bổ QC'}
              </button>
              {adsSyncMsg && (
                <span className={`text-xs font-medium px-2 py-1 rounded-md ${adsSyncMsg.startsWith('Lỗi') ? 'bg-rose-50 text-rose-600' : 'bg-emerald-50 text-emerald-700'}`}>
                  {adsSyncMsg}
                </span>
              )}
            </div>
          )}
          <button
            onClick={() => setShowModal(true)}
            className="flex h-9 items-center gap-2 rounded-lg bg-emerald-600 px-3 text-sm font-semibold text-white transition-colors hover:bg-emerald-700"
          >
            <Plus className="h-4 w-4" /> Thêm đơn mới
          </button>
          <button
            onClick={() => {
              const rows = filteredData.map(i => [
                i.shipDate || i.date, i.status, i.platform, i.trackingNumber || i.orderId,
                i.sku, i.productName, i.quantity, i.salePrice, i.customerPaid,
                i.platformFee, i.pishipFee || 0, i.shopeeAdsFee || 0, i.freeshipExtra, i.paymentFee,
                i.vatTax || 0, i.personalIncomeTax, i.affiliateFee, i.adsCost,
                i.adsTax, i.handlingFee, i.netProfit, i.address, i.deliveredAt || '', i.shippingUnit,
              ].join(','));
              const header = 'Ngày,Trạng thái,Nền tảng,Mã VĐ,SKU,Tên SP,SL,Giá trị,Khách TT,Phí CĐ,PiShip,Ads Shopee,Phí DV,Phí TT,VAT,TNCN,Affiliate,QC,Thuế QC,Vận hành,Lợi nhuận,Địa chỉ,Ngày giao,ĐVVC';
              const csv = [header, ...rows].join('\n');
              const blob = new Blob(['﻿' + csv], { type: 'text/csv;charset=utf-8;' });
              const url = URL.createObjectURL(blob);
              const a = document.createElement('a'); a.href = url; a.download = `don-hang-${new Date().toISOString().slice(0,10)}.csv`; a.click();
              URL.revokeObjectURL(url);
            }}
            className="flex h-9 items-center gap-2 rounded-lg bg-slate-100 px-3 text-sm font-semibold text-slate-600 transition-colors hover:bg-slate-200 border border-slate-200"
          >
            <FileDown className="h-4 w-4" /> Xuất file
          </button>
          {clearAllConfirm ? (
            <div className="flex items-center gap-2">
              <button onClick={handleClearAllInventoryOut} className="flex h-9 items-center gap-1 rounded-lg bg-rose-500 hover:bg-rose-600 text-white text-sm font-semibold px-3 transition-all animate-pulse">
                <Check className="w-4 h-4" /> Xác nhận xoá hết
              </button>
              <button onClick={() => setClearAllConfirm(false)} className="flex h-9 items-center gap-1 rounded-lg bg-slate-400 hover:bg-slate-500 text-white text-sm font-semibold px-3 transition-all">
                <X className="w-4 h-4" /> Huỷ
              </button>
            </div>
          ) : (
            <button onClick={() => setClearAllConfirm(true)} className="flex h-9 items-center gap-2 rounded-lg border border-rose-200 bg-rose-50 px-3 text-sm font-semibold text-rose-600 transition-colors hover:bg-rose-100">
              <Trash2 className="h-4 w-4" /> Xoá toàn bộ
            </button>
          )}
        </div>
      </div>

      <div className="min-h-0 flex-1 overflow-auto">
        <table className="w-full table-fixed border-separate border-spacing-0 text-left text-xs min-w-[3780px]">
          <colgroup>
            {COLUMN_WIDTHS.map((w, i) => <col key={i} style={{ width: w }} />)}
          </colgroup>
          <thead className="sticky top-0 z-30">
            {/* Row tổng: banner đỏ gộp 8 cột đầu + số tổng từng cột */}
            <tr className="border-b border-slate-200 font-semibold tabular-nums text-xs whitespace-nowrap">
              {/* Cột 1-7 gộp (vùng đóng băng): banner đỏ — rowSpan phủ cả hàng % bên dưới */}
              <td
                colSpan={7}
                rowSpan={2}
                className="sticky left-0 z-40 bg-white p-3 border-r border-slate-200 shadow-[2px_0_5px_rgba(0,0,0,0.08)]"
                style={{ left: STICKY_LEFT[0] }}
              >
                <div className="flex items-center gap-2 flex-1 min-w-0">
                  <div className="relative flex-1">
                    <input
                      type="text"
                      value={searchQuery}
                      onChange={e => { setSearchQuery(e.target.value); setPage(1); }}
                      placeholder="Tìm mã đơn, SKU, tên SP..."
                      className="w-full pl-8 pr-3 py-1.5 text-xs font-semibold border border-slate-200 rounded-lg bg-slate-50 text-slate-700 placeholder-slate-400 placeholder:font-normal focus:outline-none focus:ring-1 focus:ring-slate-300"
                    />
                    <svg className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-slate-400" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-4.35-4.35M17 11A6 6 0 1 1 5 11a6 6 0 0 1 12 0z"/></svg>
                  </div>
                  {(filterPlatforms.length > 0 || filterStatuses.length > 0 || filterShippingUnits.length > 0) && (
                    <div className="flex items-center gap-1.5 flex-wrap">
                      {filterPlatforms.map(v => (
                        <span key={v} className="bg-slate-100 border border-slate-200 text-slate-600 text-2xs font-medium px-2 py-0.5 rounded-full">{v}</span>
                      ))}
                      {filterStatuses.map(v => (
                        <span key={v} className="bg-slate-100 border border-slate-200 text-slate-600 text-2xs font-medium px-2 py-0.5 rounded-full">{STATUS_CONFIG[v]?.label ?? v}</span>
                      ))}
                      {filterShippingUnits.map(v => (
                        <span key={v} className="bg-slate-100 border border-slate-200 text-slate-600 text-2xs font-medium px-2 py-0.5 rounded-full">{v}</span>
                      ))}
                    </div>
                  )}
                </div>
              </td>
              {/* Cột 8 (Tên Sản Phẩm) — không đóng băng, vẫn cuộn theo */}
              <td rowSpan={2} className="bg-white p-3 border-r border-slate-200"></td>
              {/* 9: SL */}
              <td className="p-2 border-r border-slate-200 text-center bg-white">{tableTotals.quantity}</td>
              {/* 10: Giá trị */}
              <td className="p-2 border-r border-slate-200 text-right bg-white">{formatNumber(tableTotals.salePrice)} đ</td>
              {/* 11: Khách TT */}
              <td className="p-2 border-r border-slate-200 text-right bg-white">{formatNumber(tableTotals.customerPaid)} đ</td>
              {/* 12: Phí cố định */}
              <td className="p-2 border-r border-slate-200 text-right bg-white">{formatNumber(tableTotals.platformFee)} đ</td>
              {/* 13: Phí PiShip */}
              <td className="p-2 border-r border-slate-200 text-right bg-white">{formatNumber(tableTotals.pishipFee)} đ</td>
              {/* 13b: Phí Ads Shopee — ẩn */}
              <td className="p-0 border-r border-slate-200 bg-white" style={{ overflow: 'hidden' }}></td>
              {/* 14: Phí dịch vụ */}
              <td className="p-2 border-r border-slate-200 text-right bg-white">{formatNumber(tableTotals.freeshipExtra)} đ</td>
              {/* 15: Phí thanh toán */}
              <td className="p-2 border-r border-slate-200 text-right bg-white">{formatNumber(tableTotals.paymentFee)} đ</td>
              {/* 16: Thuế VAT */}
              <td className="p-2 border-r border-slate-200 text-right bg-white">{formatNumber(tableTotals.vatTax)} đ</td>
              {/* 17: Thuế TNCN */}
              <td className="p-2 border-r border-slate-200 text-right bg-white">{formatNumber(tableTotals.personalIncomeTax)} đ</td>
              {/* 18: Phí Affiliate */}
              <td className="p-2 border-r border-slate-200 text-right bg-white">{formatNumber(tableTotals.affiliateFee)} đ</td>
              {/* 19: Sàn TT */}
              <td className="p-2 border-r border-slate-200 text-right bg-white">{formatNumber(tableTotals.platformNet)} đ</td>
              {/* 20: QC */}
              <td className="p-2 border-r border-slate-200 text-right bg-white">{formatNumber(tableTotals.adsCost)} đ</td>
              {/* 21: Thuế QC */}
              <td className="p-2 border-r border-slate-200 text-right bg-white">{formatNumber(tableTotals.adsTax)} đ</td>
              {/* 22: Phí vận hành */}
              <td className="p-2 border-r border-slate-200 text-right bg-white">{formatNumber(tableTotals.handlingFee)} đ</td>
              {/* 23: Lợi nhuận */}
              <td className="p-2 border-r border-slate-200 text-right bg-white">{formatNumber(tableTotals.netProfit)} đ</td>
              {/* 24-27: trailing */}
              <td className="p-2 border-r border-slate-200 bg-white"></td>
              <td className="p-2 border-r border-slate-200 bg-white"></td>
              <td className="p-2 border-r border-slate-200 bg-white"></td>
              <td className="p-2 border-r border-slate-200 bg-white"></td>
            </tr>

            {/* Row 3: % ratios — cột 1-8 đã bị banner đỏ rowSpan=2 che, bắt đầu từ cột 9 */}
            <tr className="bg-white border-b border-slate-200 font-bold text-rose-500 tabular-nums text-2xs">
              {/* 9: SL — empty */}
              <td className="p-2 border-r border-slate-200 bg-white"></td>
              {/* 10: Giá trị — empty */}
              <td className="p-2 border-r border-slate-200 bg-white"></td>
              {/* 11: Khách TT — empty */}
              <td className="p-2 border-r border-slate-200 bg-white"></td>
              {/* 12: Phí cố định ratio */}
              <td className="p-2 border-r border-slate-200 text-center bg-white">{shopeeTotals.platformFeeRatio.toFixed(1)}%</td>
              {/* 13: Phí PiShip — no ratio */}
              <td className="p-2 border-r border-slate-200 text-center bg-white">—</td>
              {/* 13b: Phí Ads Shopee — ẩn */}
              <td className="p-0 border-r border-slate-200 bg-white" style={{ overflow: 'hidden' }}></td>
              {/* 14: Phí dịch vụ ratio */}
              <td className="p-2 border-r border-slate-200 text-center bg-white">{shopeeTotals.freeshipExtraRatio.toFixed(1)}%</td>
              {/* 15: Phí thanh toán ratio */}
              <td className="p-2 border-r border-slate-200 text-center bg-blue-50 border-2 border-blue-500">{shopeeTotals.paymentFeeRatio.toFixed(1)}%</td>
              {/* 16: Thuế VAT — no ratio */}
              <td className="p-2 border-r border-slate-200 text-center bg-white">—</td>
              {/* 17: Thuế TNCN — no ratio */}
              <td className="p-2 border-r border-slate-200 text-center bg-white">—</td>
              {/* 18: Phí Affiliate ratio */}
              <td className="p-2 border-r border-slate-200 text-center bg-white">{shopeeTotals.affiliateFeeRatio.toFixed(1)}%</td>
              {/* 19: Sàn TT — tổng % còn lại */}
              <td className="p-2 border-r border-slate-200 text-center bg-white">
                {(100 - (shopeeTotals.platformFeeRatio + shopeeTotals.paymentFeeRatio + shopeeTotals.freeshipExtraRatio + shopeeTotals.affiliateFeeRatio)).toFixed(1)}%
              </td>
              {/* 20: QC ratio */}
              <td className="p-2 border-r border-slate-200 text-center bg-white">{shopeeTotals.adsRatio.toFixed(1)}%</td>
              {/* 21: Thuế QC — no ratio */}
              <td className="p-2 border-r border-slate-200 text-center bg-white">—</td>
              {/* 22: Phí vận hành */}
              <td className="p-2 border-r border-slate-200 text-center bg-white">{formatNumber(totalVariableCosts)} đ</td>
              {/* 23: Lợi nhuận margin */}
              <td className="p-2 border-r border-slate-200 text-center bg-white">{shopeeTotals.profitMargin.toFixed(1)}%</td>
              {/* 24-27: trailing */}
              <td className="p-2 border-r border-slate-200 bg-white"></td>
              <td className="p-2 border-r border-slate-200 bg-white"></td>
              <td className="p-2 border-r border-slate-200 bg-white"></td>
              <td className="p-2 border-r border-slate-200 bg-white"></td>
            </tr>

            {/* Row 1: Column headers */}
            <tr className="bg-slate-50 border-b border-slate-200 whitespace-nowrap">
              <th className="sticky z-40 px-3 py-3 border-r border-slate-200 w-12 text-center bg-slate-50" style={{ left: STICKY_LEFT[0] }}>
                <input
                  type="checkbox"
                  className="w-3.5 h-3.5 rounded border-slate-300 accent-slate-600 cursor-pointer"
                  checked={pagedRows.length > 0 && pagedRows.every(i => selectedIds.has(i.id))}
                  onChange={e => {
                    if (e.target.checked) setSelectedIds(prev => new Set([...prev, ...pagedRows.map(i => i.id)]));
                    else setSelectedIds(prev => { const n = new Set(prev); pagedRows.forEach(i => n.delete(i.id)); return n; });
                  }}
                />
              </th>
              <th className="sticky z-40 px-3 py-3 border-r border-slate-200 w-32 text-center text-xs font-semibold uppercase text-slate-500 bg-slate-50" style={{ left: STICKY_LEFT[1] }}>Tình Trạng</th>
              <th className="sticky z-40 px-3 py-3 border-r border-slate-200 w-28 text-center text-xs font-semibold uppercase text-slate-500 bg-slate-50" style={{ left: STICKY_LEFT[2] }}>Ngày đặt</th>
              <th className="sticky z-40 px-3 py-3 border-r border-slate-200 w-28 text-center text-xs font-semibold uppercase text-slate-500 bg-slate-50" style={{ left: STICKY_LEFT[3] }}>Số đơn/ngày</th>
              <th className="sticky z-40 px-3 py-3 border-r border-slate-200 w-28 text-center text-xs font-semibold uppercase text-slate-500 bg-slate-50" style={{ left: STICKY_LEFT[4] }}>Nền tảng</th>
              <th className="sticky z-40 px-3 py-3 border-r border-slate-200 w-36 text-center text-xs font-semibold uppercase text-slate-500 bg-slate-50" style={{ left: STICKY_LEFT[5] }}>Mã Vận Đơn</th>
              <th className="sticky z-40 px-3 py-3 border-r border-slate-200 w-36 text-center text-xs font-semibold uppercase text-slate-500 bg-slate-50 shadow-[2px_0_5px_rgba(0,0,0,0.08)]" style={{ left: STICKY_LEFT[6] }}>SKU Biến Thể</th>
              <th className="px-3 py-3 border-r border-slate-200 w-80 text-center text-xs font-semibold uppercase text-slate-500 bg-slate-50">Tên Sản Phẩm</th>
              <th className="px-3 py-3 border-r border-slate-200 w-28 text-center text-xs font-semibold uppercase text-slate-500 bg-slate-50">Số lượng</th>
              <th className="px-3 py-3 border-r border-slate-200 w-32 text-center text-xs font-semibold uppercase text-slate-500 bg-slate-50">Giá trị hàng</th>
              <th className="px-3 py-3 border-r border-slate-200 w-32 text-center text-xs font-semibold uppercase text-slate-500 bg-slate-50">Khách Thanh Toán</th>
              <th className="px-3 py-3 border-r border-slate-200 w-32 text-center text-xs font-semibold uppercase text-slate-500 bg-slate-50">Phí Cố Định</th>
              <th className="px-3 py-3 border-r border-slate-200 w-32 text-center text-xs font-semibold uppercase text-slate-500 bg-slate-50">Phí PiShip</th>
              {/* Phí Ads Shopee: ẩn khỏi bảng (dễ nhầm với cột Quảng Cáo) — vẫn dùng để trừ đúng Sàn Thanh Toán */}
              <th className="p-0 border-r border-slate-200 bg-slate-50" style={{ overflow: 'hidden' }}></th>
              <th className="px-3 py-3 border-r border-slate-200 w-32 text-center text-xs font-semibold uppercase text-slate-500 bg-slate-50">Phí Dịch Vụ</th>
              <th className="px-3 py-3 border-r border-slate-200 w-32 text-center text-xs font-semibold uppercase text-slate-500 bg-slate-50">Phí Thanh Toán</th>
              <th className="px-3 py-3 border-r border-slate-200 w-32 text-center text-xs font-semibold uppercase text-slate-500 bg-slate-50">Thuế VAT</th>
              <th className="px-3 py-3 border-r border-slate-200 w-32 text-center text-xs font-semibold uppercase text-slate-500 bg-slate-50">Thuế TNCN</th>
              <th className="px-3 py-3 border-r border-slate-200 w-32 text-center text-xs font-semibold uppercase text-slate-500 bg-slate-50">Phí Affiliate</th>
              <th className="px-3 py-3 border-r border-slate-200 w-32 text-center text-xs font-semibold uppercase text-slate-500 bg-slate-50">Sàn Thanh Toán</th>
              <th className="px-3 py-3 border-r border-slate-200 w-32 text-center text-xs font-semibold uppercase text-slate-500 bg-slate-50">Quảng Cáo</th>
              <th className="px-3 py-3 border-r border-slate-200 w-32 text-center text-xs font-semibold uppercase text-slate-500 bg-slate-50">Thuế QC</th>
              <th className="px-3 py-3 border-r border-slate-200 w-32 text-center text-xs font-semibold uppercase text-slate-500 bg-slate-50">Phí Vận Hành</th>
              <th className="px-3 py-3 border-r border-slate-200 w-32 text-center text-xs font-semibold uppercase text-slate-500 bg-slate-50">Lợi Nhuận</th>
              <th className="px-3 py-3 border-r border-slate-200 w-40 text-center text-xs font-semibold uppercase text-slate-500 bg-slate-50">Địa chỉ</th>
              <th className="px-3 py-3 border-r border-slate-200 w-32 text-center text-xs font-semibold uppercase text-slate-500 bg-slate-50">Ngày giao</th>
              <th className="px-3 py-3 border-r border-slate-200 w-32 text-center text-xs font-semibold uppercase text-slate-500 bg-slate-50">ĐVVC</th>
              <th className="px-3 py-3 border-r border-slate-200 w-32 text-center text-xs font-semibold uppercase text-slate-500 bg-slate-50">LÃI/LỖ</th>
              <th className="px-3 py-3 border-r border-slate-200 w-32 text-center text-xs font-semibold uppercase text-slate-500 bg-slate-50">Hành động</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-200 tabular-nums">
            {pagedGroups.length > 0 ? pagedGroups.map((grp, gIdx) => {
              const first = grp.rows[0];
              const span = grp.rows.length;
              // Đường kẻ phân cách ngày: khi group này khác ngày với group liền trước
              const prevGroup = gIdx > 0 ? pagedGroups[gIdx - 1] : null;
              const isNewDate = prevGroup
                ? (first.shipDate || first.date) !== (prevGroup.rows[0].shipDate || prevGroup.rows[0].date)
                : false;
              const dt = isNewDate ? ' border-t-2 border-t-slate-400' : '';
              const groupNetProfit = grp.rows.reduce((s, r) => s + calcNetProfit(r), 0);
              const allSelected = grp.rows.every(r => selectedIds.has(r.id));
              const orderIdx = dailyOrderIndexMap[grp.orderKey] ?? 1;
              const statusCfg = STATUS_CONFIG[first.status] ?? { label: first.status, className: 'bg-slate-400 text-white' };
              // Badge LÃI/LỖ: đơn huỷ/chờ/thất lạc → hiện trạng thái (xám); còn lại theo dấu lợi nhuận
              const groupKind = orderKind(first.status);
              const profitBadge = groupKind === 'void'
                ? { label: statusCfg.label, cls: 'bg-slate-400 text-white' }
                : groupKind === 'shiploss'
                  ? { label: 'LỖ', cls: 'bg-rose-700 text-white' }
                  : groupNetProfit >= 0
                    ? { label: 'LÃI', cls: 'bg-emerald-700 text-white' }
                    : { label: 'LỖ', cls: 'bg-rose-700 text-white' };

              return grp.rows.map((item, rIdx) => {
                const isFirst = rIdx === 0;
                const rowDt = isFirst ? dt : '';
                return (
                <tr key={item.id} className="hover:bg-slate-50 transition-all whitespace-nowrap">
                  {/* ── Cột cấp đơn (gộp ô rowSpan, hiện 1 lần cho cả đơn) ── */}
                  {isFirst && (
                    <td rowSpan={span} className={`sticky z-10 bg-white p-2 border-b border-r border-slate-200 text-center align-middle${dt}`} style={{ left: STICKY_LEFT[0] }}>
                      <input
                        type="checkbox"
                        className="w-3.5 h-3.5 rounded border-slate-300 accent-slate-600 cursor-pointer"
                        checked={allSelected}
                        onChange={e => setSelectedIds(prev => {
                          const n = new Set(prev);
                          if (e.target.checked) grp.rows.forEach(r => n.add(r.id));
                          else grp.rows.forEach(r => n.delete(r.id));
                          return n;
                        })}
                      />
                    </td>
                  )}
                  {isFirst && (
                    <td rowSpan={span} className={`sticky z-10 bg-white p-2 border-b border-r border-slate-200 align-middle${dt}`} style={{ left: STICKY_LEFT[1] }}>
                      <div className={`inline-flex items-center px-2 py-1 rounded-md text-2xs font-semibold ${statusCfg.className}`}>
                        {statusCfg.label}
                      </div>
                    </td>
                  )}
                  {isFirst && (
                    <td rowSpan={span} className={`sticky z-10 bg-white p-2 border-b border-r border-slate-200 text-center align-middle${dt}`} style={{ left: STICKY_LEFT[2] }}>{(first.shipDate || first.date).split('-').reverse().join('/')}</td>
                  )}
                  {isFirst && (
                    <td rowSpan={span} className={`sticky z-10 bg-white p-2 border-b border-r border-slate-200 text-center font-normal align-middle${dt}`} style={{ left: STICKY_LEFT[3] }}>{orderIdx}</td>
                  )}
                  {isFirst && (
                    <td rowSpan={span} className={`sticky z-10 bg-white p-2 border-b border-r border-slate-200 align-middle${dt}`} style={{ left: STICKY_LEFT[4] }}>
                      <div className="flex items-center justify-between bg-orange-200 text-orange-800 px-2 py-1 rounded-md text-2xs font-normal cursor-pointer">
                        <span>{first.platform || 'Shopee 2'}</span>
                        <ArrowDownToLine className="w-3 h-3 rotate-180" />
                      </div>
                    </td>
                  )}
                  {isFirst && (
                    <td rowSpan={span} className={`sticky z-10 bg-white p-2 border-b border-r border-slate-200 text-xs text-indigo-600 align-middle${dt}`} style={{ left: STICKY_LEFT[5] }}>
                      {first.trackingNumber || first.orderId || '-'}
                    </td>
                  )}
                  {/* ── Cột theo từng sản phẩm ── */}
                  <td className={`sticky z-10 bg-white p-2 border-b border-r border-slate-200 shadow-[2px_0_5px_rgba(0,0,0,0.08)]${rowDt}`} style={{ left: STICKY_LEFT[6] }}>
                    <div className="flex items-center justify-between bg-slate-100 text-slate-800 px-2 py-1 rounded-md text-2xs font-normal cursor-pointer">
                      <span>{item.sku}</span>
                      <ArrowDownToLine className="w-3 h-3 rotate-180" />
                    </div>
                  </td>
                  <td className={`p-2 border-b border-r border-slate-200 max-w-[320px]${rowDt}`}>
                    <p className="truncate text-slate-800 text-xs">{getProductName(item)}</p>
                  </td>
                  <td className={`p-2 border-b border-r border-slate-200 text-center font-normal${rowDt}`}>{isSuccessOrder(item.status) ? item.quantity : 0}</td>
                  <td className={`p-2 border-b border-r border-slate-200 text-right font-normal${rowDt}`}>{formatNumber(item.salePrice)} đ</td>
                  {/* Khách TT + phí Shopee: chỉ đơn thành công; đơn lỗ ship/huỷ = 0 */}
                  <td className={`p-2 border-b border-r border-slate-200 text-right font-normal${rowDt}`}>{formatNumber(successVal(item, item.customerPaid))} đ</td>
                  {/* Phí shopee */}
                  <td className={`p-2 border-b border-r border-slate-200 text-right text-slate-500${rowDt}`}>{formatNumber(successVal(item, item.platformFee))} đ</td>
                  {/* PiShip (phí bảo vệ NB): có ở đơn thành công VÀ đơn lỗ ship */}
                  <td className={`p-2 border-b border-r border-slate-200 text-right text-slate-500${rowDt}`}>{formatNumber(pishipVal(item))} đ</td>
                  {/* Phí Ads Shopee (AMS_COMMISSION_FEE): ẩn khỏi bảng, vẫn dùng để tính Sàn Thanh Toán */}
                  <td className="p-0 border-b border-r border-slate-200" style={{ overflow: 'hidden' }}></td>
                  <td className={`p-2 border-b border-r border-slate-200 text-right text-slate-500${rowDt}`}>{formatNumber(successVal(item, item.freeshipExtra))} đ</td>
                  <td className={`p-2 border-b border-r border-slate-200 text-right text-slate-500${rowDt}`}>{formatNumber(successVal(item, item.paymentFee))} đ</td>
                  <td className={`p-2 border-b border-r border-slate-200 text-right text-slate-500${rowDt}`}>{formatNumber(successVal(item, item.vatTax || 0))} đ</td>
                  <td className={`p-2 border-b border-r border-slate-200 text-right text-slate-500${rowDt}`}>{formatNumber(successVal(item, item.personalIncomeTax))} đ</td>
                  <td className={`p-2 border-b border-r border-slate-200 text-right text-slate-500${rowDt}`}>{formatNumber(successVal(item, item.affiliateFee))} đ</td>
                  {/* Sàn Thanh Toán (0 nếu không phải đơn thành công) */}
                  <td className={`p-2 border-b border-r border-slate-200 text-right font-normal text-slate-700 bg-slate-50${rowDt}`}>{formatNumber(calcPlatformNet(item))} đ</td>
                  {/* QC */}
                  <td className={`p-2 border-b border-r border-slate-200 text-right text-slate-500${rowDt}`}>{formatNumber(successVal(item, item.adsCost))} đ</td>
                  <td className={`p-2 border-b border-r border-slate-200 text-right text-slate-500${rowDt}`}>{formatNumber(successVal(item, item.adsTax))} đ</td>
                  {/* Phí Vận Hành: có ở đơn thành công VÀ đơn lỗ ship */}
                  <td className={`p-2 border-b border-r border-slate-200 text-right text-slate-500${rowDt}`}>{formatNumber(handlingVal(item))} đ</td>
                  {/* Lợi nhuận (từng SP) — đơn lỗ ship ra số âm */}
                  <td className={`p-2 border-b border-r border-slate-200 text-right font-normal ${calcNetProfit(item) < 0 ? 'text-rose-600' : 'text-emerald-700'}${rowDt}`}>{formatNumber(calcNetProfit(item))} đ</td>
                  {/* ── Cột cấp đơn (gộp ô rowSpan) ── */}
                  {isFirst && (
                    <td
                      rowSpan={span}
                      className={`max-w-[160px] truncate p-2 border-b border-r border-slate-200 text-slate-500 uppercase align-middle${dt}`}
                      title={first.address ? shortProvinceName(first.address.split(',').pop()!.trim()) : '-'}
                    >
                      {first.address ? shortProvinceName(first.address.split(',').pop()!.trim()) : '-'}
                    </td>
                  )}
                  {isFirst && (
                    <td rowSpan={span} className={`p-2 border-b border-r border-slate-200 text-center text-xs text-slate-600 align-middle${dt}`}>
                      {first.deliveredAt ? first.deliveredAt.split('-').reverse().join('/') : '-'}
                    </td>
                  )}
                  {isFirst && (
                    <td rowSpan={span} className={`p-2 border-b border-r border-slate-200 align-middle${dt}`}>
                      <div className="flex items-center justify-between bg-slate-100 text-slate-800 px-2 py-1 rounded-md text-2xs font-normal cursor-pointer">
                        <span>{first.shippingUnit || 'GHN'}</span>
                        <ArrowDownToLine className="w-3 h-3 rotate-180" />
                      </div>
                    </td>
                  )}
                  {isFirst && (
                    <td rowSpan={span} className={`p-2 border-b border-r border-slate-200 align-middle${dt}`}>
                      <div className={`flex items-center justify-between px-2 py-1 rounded-md text-2xs font-normal cursor-pointer ${profitBadge.cls}`}>
                        <span>{profitBadge.label}</span>
                        <ArrowDownToLine className="w-3 h-3 rotate-180" />
                      </div>
                    </td>
                  )}
                  {isFirst && (
                    <td rowSpan={span} className={`p-2 border-b border-r border-slate-200 align-middle${dt}`}>
                      <div className="flex items-center justify-center gap-2">
                        {deleteConfirmId === first.id ? (
                          <div className="flex items-center gap-1">
                            <button onClick={async () => { for (const r of grp.rows) { await handleRemoveInventoryOut(r.id); } setDeleteConfirmId(null); }} className="p-1 bg-rose-600 text-white rounded hover:bg-rose-700 transition-colors shadow-sm" title={span > 1 ? `Xác nhận xoá cả đơn (${span} SP)` : 'Xác nhận xoá'}><Check className="w-3 h-3" /></button>
                            <button onClick={() => setDeleteConfirmId(null)} className="p-1 bg-slate-400 text-white rounded hover:bg-slate-500 transition-colors shadow-sm" title="Huỷ"><X className="w-3 h-3" /></button>
                          </div>
                        ) : (
                          <>
                            <button onClick={() => handleEditInventoryOut(first)} className="p-1.5 bg-indigo-50 text-indigo-600 rounded-md hover:bg-indigo-600 hover:text-white transition-all shadow-sm cursor-pointer" title="Sửa"><Pencil className="w-3.5 h-3.5" /></button>
                            <button onClick={() => setDeleteConfirmId(first.id)} className="p-1.5 bg-rose-50 text-rose-600 rounded-md hover:bg-rose-600 hover:text-white transition-all shadow-sm cursor-pointer" title={span > 1 ? `Xoá cả đơn (${span} SP)` : 'Xoá'}><Trash2 className="w-3.5 h-3.5" /></button>
                          </>
                        )}
                      </div>
                    </td>
                  )}
                </tr>
                );
              });
            }) : (
              <tr>
                <td colSpan={29} className="p-20 text-center text-slate-400 font-normal uppercase tracking-widest">Chưa có dữ liệu xuất kho</td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      {totalPages > 1 && (
        <div className="shrink-0 border-t border-slate-100 bg-white px-4 py-2 flex items-center justify-between">
          <span className="text-xs text-slate-500">{filteredData.length} đơn • Trang {page}/{totalPages}</span>
          <div className="flex items-center gap-1">
            <button
              onClick={() => setPage(p => Math.max(1, p - 1))}
              disabled={page === 1}
              className="h-7 w-7 rounded border border-slate-200 flex items-center justify-center text-slate-500 hover:border-indigo-400 hover:text-indigo-600 disabled:opacity-40 disabled:cursor-not-allowed"
            >
              <ChevronLeft className="h-3.5 w-3.5" />
            </button>
            <button
              onClick={() => setPage(p => Math.min(totalPages, p + 1))}
              disabled={page === totalPages}
              className="h-7 w-7 rounded border border-slate-200 flex items-center justify-center text-slate-500 hover:border-indigo-400 hover:text-indigo-600 disabled:opacity-40 disabled:cursor-not-allowed"
            >
              <ChevronRight className="h-3.5 w-3.5" />
            </button>
          </div>
        </div>
      )}

      {/* Modal: Thêm/Sửa đơn hàng */}
      {showModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
          <div className="relative w-full max-w-4xl max-h-[90vh] overflow-y-auto rounded-2xl bg-white shadow-2xl">
            <div className="flex items-center justify-between border-b border-slate-200 px-5 py-4 sticky top-0 bg-white z-10">
              <h3 className="text-sm font-semibold uppercase text-slate-900">
                {editingInventoryOutId ? 'Cập nhật đơn hàng' : 'Thêm đơn hàng mới'}
              </h3>
              <button onClick={closeModal} className="h-8 w-8 flex items-center justify-center rounded-lg text-slate-400 hover:bg-slate-100 hover:text-slate-600 transition-colors">
                <X className="h-4 w-4" />
              </button>
            </div>

            <div className="p-5 space-y-4">
              <div
                className="flex flex-col items-center justify-center rounded-2xl border-2 border-dashed border-slate-200 bg-slate-50 p-6 hover:border-rose-300 transition-all group cursor-pointer"
                onClick={() => shopeeFileInputRef.current?.click()}
              >
                <input type="file" ref={shopeeFileInputRef} className="hidden" accept=".xlsx, .xls" onChange={handleShopeeFileUpload} />
                <div className="w-10 h-10 bg-rose-50 rounded-full flex items-center justify-center mb-2 group-hover:scale-110 transition-transform">
                  <Upload className="w-5 h-5 text-rose-600" />
                </div>
                <h4 className="text-xs font-semibold text-slate-900 uppercase">Tải file Shopee</h4>
                <p className="text-[8px] text-slate-400 font-normal uppercase mt-1 text-center">Tự động phân tích đơn hàng</p>
              </div>

              <div className="bg-white rounded-2xl border border-slate-200 shadow-sm p-4">
                <div className="flex flex-col md:flex-row items-center gap-4">
                  <div className="flex items-center gap-2 min-w-[150px]">
                    <div className="p-2 bg-rose-100 rounded-lg text-rose-600"><TrendingUp className="w-4 h-4" /></div>
                    <h4 className="text-xs font-semibold text-slate-900 uppercase">Quảng cáo ngày</h4>
                  </div>
                  <div className="flex-1 flex items-center gap-3 bg-slate-50 p-2 rounded-xl border border-slate-100 w-full">
                    <div className="flex items-center gap-1">
                      {(['Shopee 1', 'Shopee 2'] as const).map(p => (
                        <button
                          key={p}
                          onClick={() => setSelectedAdsPlatform(p)}
                          className={`h-7 rounded-md px-2 text-2xs font-semibold transition-colors ${
                            selectedAdsPlatform === p ? 'bg-slate-900 text-white' : 'text-slate-500 hover:bg-slate-200'
                          }`}
                        >
                          {p === 'Shopee 1' ? 'Shop 1' : 'Shop 2'}
                        </button>
                      ))}
                    </div>
                    <div className="h-6 w-[1px] bg-slate-200"></div>
                    <input type="date" value={selectedAdsDate} onChange={e => setSelectedAdsDate(e.target.value)} className="bg-transparent border-none outline-none text-xs font-normal text-slate-600 w-32" />
                    <div className="h-6 w-[1px] bg-slate-200"></div>
                    <div className="flex-1 flex items-center gap-2">
                      <DollarSign className="w-3.5 h-3.5 text-rose-600" />
                      <input
                        type="number"
                        value={dailyAdsConfig[`${selectedAdsPlatform}::${selectedAdsDate}`] || 0}
                        onChange={e => handleDistributeAdsCost(Number(e.target.value), selectedAdsDate, selectedAdsPlatform)}
                        className="bg-transparent border-none outline-none text-slate-900 font-normal text-xs w-full"
                        placeholder="Nhập tổng tiền QC của ngày..."
                      />
                    </div>
                  </div>
                </div>
                <p className="mt-2 text-2xs text-slate-400">
                  Nhập tay để sửa riêng 1 ngày — dùng nút "Tự động phân bổ QC" ở thanh công cụ phía trên để đồng bộ tự động từ bot cho toàn bộ dữ liệu.
                </p>
              </div>

              <div className={`bg-white rounded-2xl border ${editingInventoryOutId ? 'border-indigo-500 shadow-indigo-100 ring-2 ring-indigo-500/20' : 'border-slate-200'} shadow-sm p-5 transition-all`}>
                <div className="flex items-center justify-between mb-4">
                  <div className="flex items-center gap-3">
                    <div className={`p-2 ${editingInventoryOutId ? 'bg-indigo-600' : 'bg-slate-900'} rounded-lg text-white shadow-md transition-colors`}>
                      {editingInventoryOutId ? <Pencil className="w-3.5 h-3.5" /> : <Plus className="w-3.5 h-3.5" />}
                    </div>
                    <div>
                      <h4 className="text-xs font-semibold text-slate-900 uppercase">{editingInventoryOutId ? 'Cập nhật đơn hàng' : 'Nhập đơn hàng mới'}</h4>
                      {editingInventoryOutId && (
                        <p className="text-[8px] font-normal text-indigo-600 uppercase tracking-widest mt-0.5">Đang sửa bản ghi: {shopeeInventoryOut.find(r => r.id === editingInventoryOutId)?.trackingNumber}</p>
                      )}
                    </div>
                  </div>
                  <span className="text-[9px] font-normal text-slate-400 uppercase italic">* Nhập nhanh đơn hàng lẻ</span>
                </div>

                <div className="space-y-3">
                  <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-6 gap-3">
                    <div className="space-y-1">
                      <label className="text-[9px] font-normal text-slate-400 uppercase ml-1">Ngày đặt</label>
                      <input type="date" value={inventoryOutForm.date} onChange={e => setInventoryOutForm({...inventoryOutForm, date: e.target.value})} className="w-full bg-slate-50 border border-slate-100 rounded-lg px-3 py-2 text-2xs font-normal focus:outline-none focus:ring-1 focus:ring-rose-500" />
                    </div>
                    <div className="space-y-1">
                      <label className="text-[9px] font-normal text-slate-400 uppercase ml-1">Mã Vận Đơn</label>
                      <input type="text" placeholder="Mã vận đơn..." value={inventoryOutForm.orderId || ''} onChange={e => setInventoryOutForm({...inventoryOutForm, orderId: e.target.value})} className="w-full bg-slate-50 border border-slate-100 rounded-lg px-3 py-2 text-2xs font-normal focus:outline-none focus:ring-1 focus:ring-rose-500" />
                    </div>
                    <div className="space-y-1">
                      <label className="text-[9px] font-normal text-slate-400 uppercase ml-1">SKU</label>
                      <select
                        value={inventoryOutForm.sku || ''}
                        onChange={e => {
                          const sku = e.target.value;
                          const skuData = shopeeSourceData.find(s => s.sku === sku);
                          setInventoryOutForm({ ...inventoryOutForm, sku, salePrice: skuData?.salePrice || 0, customerPaid: skuData?.salePrice || 0 });
                        }}
                        className="w-full bg-slate-50 border border-slate-100 rounded-lg px-3 py-2 text-2xs font-normal focus:outline-none focus:ring-1 focus:ring-rose-500"
                      >
                        <option value="">Chọn SKU</option>
                        {shopeeSourceData.map(s => <option key={s.id} value={s.sku}>{s.sku}</option>)}
                      </select>
                    </div>
                    <div className="space-y-1">
                      <label className="text-[9px] font-normal text-slate-400 uppercase ml-1">Số lượng</label>
                      <input type="number" value={inventoryOutForm.quantity || 0} onChange={e => setInventoryOutForm({...inventoryOutForm, quantity: Number(e.target.value)})} className="w-full bg-slate-50 border border-slate-100 rounded-lg px-3 py-2 text-2xs font-normal focus:outline-none focus:ring-1 focus:ring-rose-500" />
                    </div>
                    <div className="space-y-1">
                      <label className="text-[9px] font-normal text-slate-400 uppercase ml-1">Giá bán</label>
                      <input type="number" value={inventoryOutForm.salePrice || 0} onChange={e => setInventoryOutForm({...inventoryOutForm, salePrice: Number(e.target.value)})} className="w-full bg-slate-50 border border-slate-100 rounded-lg px-3 py-2 text-2xs font-normal focus:outline-none focus:ring-1 focus:ring-rose-500" />
                    </div>
                    <div className="space-y-1">
                      <label className="text-[9px] font-normal text-slate-400 uppercase ml-1">Khách trả</label>
                      <input type="number" value={inventoryOutForm.customerPaid || 0} onChange={e => setInventoryOutForm({...inventoryOutForm, customerPaid: Number(e.target.value)})} className="w-full bg-slate-50 border border-slate-100 rounded-lg px-3 py-2 text-2xs font-normal focus:outline-none focus:ring-1 focus:ring-rose-500" />
                    </div>
                    <div className="space-y-1">
                      <label className="text-[9px] font-normal text-slate-400 uppercase ml-1">Phí cố định (đ)</label>
                      <input type="number" value={inventoryOutForm.platformFee ?? 0} onChange={e => setInventoryOutForm({...inventoryOutForm, platformFee: Number(e.target.value)})} className="w-full bg-slate-50 border border-slate-100 rounded-lg px-3 py-2 text-2xs font-normal focus:outline-none focus:ring-1 focus:ring-rose-500" />
                    </div>
                    <div className="space-y-1">
                      <label className="text-[9px] font-normal text-slate-400 uppercase ml-1">Phí dịch vụ (đ)</label>
                      <input type="number" value={inventoryOutForm.freeshipExtra ?? 0} onChange={e => setInventoryOutForm({...inventoryOutForm, freeshipExtra: Number(e.target.value)})} className="w-full bg-slate-50 border border-slate-100 rounded-lg px-3 py-2 text-2xs font-normal focus:outline-none focus:ring-1 focus:ring-rose-500" />
                    </div>
                    <div className="space-y-1">
                      <label className="text-[9px] font-normal text-slate-400 uppercase ml-1">Phí thanh toán (đ)</label>
                      <input type="number" value={inventoryOutForm.paymentFee ?? 0} onChange={e => setInventoryOutForm({...inventoryOutForm, paymentFee: Number(e.target.value)})} className="w-full bg-slate-50 border border-slate-100 rounded-lg px-3 py-2 text-2xs font-normal focus:outline-none focus:ring-1 focus:ring-rose-500" />
                    </div>
                    <div className="space-y-1">
                      <label className="text-[9px] font-normal text-slate-400 uppercase ml-1">Phí Affiliate (đ)</label>
                      <input type="number" value={inventoryOutForm.affiliateFee ?? 0} onChange={e => setInventoryOutForm({...inventoryOutForm, affiliateFee: Number(e.target.value)})} className="w-full bg-slate-50 border border-slate-100 rounded-lg px-3 py-2 text-2xs font-normal focus:outline-none focus:ring-1 focus:ring-rose-500" />
                    </div>
                  </div>

                  <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-6 gap-3">
                    <div className="space-y-1">
                      <label className="text-[9px] font-normal text-slate-400 uppercase ml-1">Nền tảng</label>
                      <select value={inventoryOutForm.platform || 'Shopee 2'} onChange={e => setInventoryOutForm({...inventoryOutForm, platform: e.target.value})} className="w-full bg-slate-50 border border-slate-100 rounded-lg px-3 py-2 text-2xs font-normal focus:outline-none focus:ring-1 focus:ring-rose-500">
                        <option value="Shopee 1">Shopee 1</option>
                        <option value="Shopee 2">Shopee 2</option>
                        <option value="Lazada">Lazada</option>
                        <option value="TikTok">TikTok</option>
                      </select>
                    </div>
                    <div className="space-y-1">
                      <label className="text-[9px] font-normal text-slate-400 uppercase ml-1">ĐVVC</label>
                      <select value={inventoryOutForm.shippingUnit || 'GHN'} onChange={e => setInventoryOutForm({...inventoryOutForm, shippingUnit: e.target.value})} className="w-full bg-slate-50 border border-slate-100 rounded-lg px-3 py-2 text-2xs font-normal focus:outline-none focus:ring-1 focus:ring-rose-500">
                        <option value="GHN">GHN</option>
                        <option value="SPX">SPX</option>
                        <option value="GHTK">GHTK</option>
                        <option value="J&T">J&T</option>
                      </select>
                    </div>
                    <div className="lg:col-span-3 space-y-1">
                      <label className="text-[9px] font-normal text-slate-400 uppercase ml-1">Địa chỉ (Tỉnh/Thành)</label>
                      <input type="text" placeholder="VD: ĐÀ NẴNG" value={inventoryOutForm.address || ''} onChange={e => setInventoryOutForm({...inventoryOutForm, address: e.target.value})} className="w-full bg-slate-50 border border-slate-100 rounded-lg px-3 py-2 text-2xs font-normal focus:outline-none focus:ring-1 focus:ring-rose-500" />
                    </div>
                    <div className="flex items-end">
                      <button
                        onClick={() => { handleAddInventoryOut(); setShowModal(false); }}
                        className={`w-full ${editingInventoryOutId ? 'bg-indigo-600 hover:bg-indigo-700' : 'bg-rose-600 hover:bg-rose-700'} text-white py-2 rounded-lg font-normal text-[9px] uppercase tracking-widest transition-all shadow-lg flex items-center justify-center gap-2`}
                      >
                        <Save className="w-3.5 h-3.5" /> {editingInventoryOutId ? 'Cập nhật' : 'Ghi nhận'}
                      </button>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}
    </section>
  );
};

export default InventoryOutTab;
