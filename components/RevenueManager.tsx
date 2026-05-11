
import React, { useState, useRef, useMemo } from 'react';
import {
  RevenueRecord, ProductGroup, ProductGroupRevenue,
  ShopeeSourceItem, ShopeeCostConfig, ShopeeInventoryInRecord, ShopeeInventoryOutRecord,
  DiagnosisRange
} from '../types';
import {
  AlertTriangle, ShieldAlert, X,
  Sparkles, Database, Settings, ArrowDownToLine, ArrowUpFromLine, ClipboardList, Filter, FileSpreadsheet,
} from 'lucide-react';
import { cleanVNNumber, parseVNDate, normalizeHeader, processExcelRawData, generateId } from '../businessLogic';
import * as XLSX from 'xlsx';
import TimeFilter from './TimeFilter';
import DiagnosisTab from './revenue/DiagnosisTab';
import MatrixTab from './revenue/MatrixTab';
import SourceTab from './revenue/SourceTab';
import CostsTab from './revenue/CostsTab';
import InventoryInTab from './revenue/InventoryInTab';
import InventoryOutTab from './revenue/InventoryOutTab';
import ReportTab from './revenue/ReportTab';
import LedgerTab from './revenue/LedgerTab';

interface ConflictItem {
  date: string;
  columnKey: keyof RevenueRecord;
  columnLabel: string;
  currentValue: number;
  newValue: number;
  resolution: 'keep' | 'update';
}

interface Props {
  list: RevenueRecord[];
  productGroups: ProductGroup[];
  groupRevenue: ProductGroupRevenue[];
  onUpdate: (newList: RevenueRecord[], idToRemove?: string) => Promise<void>;
  onUpdateGroupRevenue: (newList: ProductGroupRevenue[]) => Promise<void>;
  onUpdateGroups: (newList: ProductGroup[]) => Promise<void>;
  onUpdateSurgical?: (updates: { key: any, item: any, isDelete?: boolean }[]) => Promise<void>;
  isShopee?: boolean;
  
  // New Shopee fields
  shopeeSourceData?: ShopeeSourceItem[];
  shopeeCosts?: ShopeeCostConfig;
  shopeeInventoryIn?: ShopeeInventoryInRecord[];
  shopeeInventoryOut?: ShopeeInventoryOutRecord[];
  dailyAdsConfig?: Record<string, number>;
  onUpdateShopeeSource?: (newList: ShopeeSourceItem[]) => Promise<void>;
  onUpdateShopeeCosts?: (costs: ShopeeCostConfig) => Promise<void>;
  onUpdateShopeeInventoryIn?: (newList: ShopeeInventoryInRecord[]) => Promise<void>;
  onUpdateShopeeInventoryOut?: (newList: ShopeeInventoryOutRecord[]) => Promise<void>;
  onUpdateDailyAdsConfig?: (config: Record<string, number>) => Promise<void>;

  diagnosisRange: DiagnosisRange;
  setDiagnosisRange: (range: DiagnosisRange) => void;
  diagStartDate: string;
  setDiagStartDate: (date: string) => void;
  diagEndDate: string;
  setDiagEndDate: (date: string) => void;
}

const RevenueManager: React.FC<Props> = ({ 
  list, onUpdate, isShopee, groupRevenue, onUpdateGroupRevenue, productGroups,
  onUpdateSurgical,
  shopeeSourceData = [], shopeeCosts, shopeeInventoryIn = [], shopeeInventoryOut = [],
  dailyAdsConfig = {},
  onUpdateShopeeSource, onUpdateShopeeCosts, onUpdateShopeeInventoryIn, onUpdateShopeeInventoryOut,
  onUpdateDailyAdsConfig,
  diagnosisRange,
  setDiagnosisRange,
  diagStartDate,
  setDiagStartDate,
  diagEndDate,
  setDiagEndDate
}) => {
  const [activeSubTab, setActiveSubTab] = useState<'diagnosis' | 'matrix' | 'ledger' | 'source' | 'costs' | 'inventory_in' | 'inventory_out' | 'report'>(
    isShopee ? 'diagnosis' : 'diagnosis'
  );
  const [isSaving, setIsSaving] = useState(false);
  const [selectedAdsDate, setSelectedAdsDate] = useState(new Date().toISOString().split('T')[0]);
  const shopeeFileInputRef = useRef<HTMLInputElement>(null);

  const localTodayStr = new Date().toLocaleDateString('sv-SE');

  const handleShopeeFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !onUpdateShopeeInventoryOut) return;

    const reader = new FileReader();
    reader.onload = async (event) => {
      try {
        const data = event.target?.result;
        if (!data) return;
        const workbook = XLSX.read(data, { type: 'array', cellDates: true });
        const firstSheet = workbook.Sheets[workbook.SheetNames[0]];
        const rows = XLSX.utils.sheet_to_json(firstSheet, { header: 1 }) as any[][];
        
        if (rows.length < 2) return;

        // Find header row
        let headerIdx = -1;
        const shopeeKeywords = [
          'madonhang', 'mavandon', 'masku', 'skuphanloaihang', 'skusanpham', 'tensanpham', 
          'soluong', 'ngaydathang', 'ngaydat', 'ngaydatdon', 'ngaytaodon', 'thoigiantaodon', 'giauudai', 'phicodinh', 'phithanhtoan'
        ];
        for (let i = 0; i < Math.min(rows.length, 20); i++) {
          const cells = rows[i].map(c => normalizeHeader(c));
          if (cells.some(c => shopeeKeywords.includes(c))) {
            headerIdx = i;
            break;
          }
        }

        if (headerIdx === -1) {
          alert("Không tìm thấy định dạng file Shopee hợp lệ. Vui lòng kiểm tra lại tiêu đề file.");
          return;
        }

        const headers = rows[headerIdx].map(h => normalizeHeader(h));
        const dataRows = rows.slice(headerIdx + 1);

        const newRecords: ShopeeInventoryOutRecord[] = dataRows.map(row => {
          const obj: any = {};
          headers.forEach((h, idx) => { if (h) obj[h] = row[idx]; });

          const trackingNumber = String(obj.mavandon || obj.trackingnumber || obj.waybillid || obj.m輸送状番号 || '').trim();
          const orderId = String(obj.madonhang || obj.orderid || '').trim();
          // Ưu tiên SKU phân loại hàng (biến thể) hơn SKU sản phẩm (tổng)
          const sku = String(obj.skuphanloaihang || obj.masku || obj.skusanpham || obj.sku || '').trim();
          
          if (!trackingNumber || !sku) return null;

          const salePrice = cleanVNNumber(obj.giauudai || obj.giaban || obj.price || 0);
          const quantity = cleanVNNumber(obj.soluong || obj.quantity || 1);
          let date = parseVNDate(obj.ngaydathang || obj.ngaydat || obj.ngaydatdon || obj.ngaytaodon || obj.thoigiantaodon || obj.orderdate || obj.ordercreationdate || localTodayStr);
          if (!date) date = localTodayStr;
          const shipDate = date; // Yêu cầu của user: Ngày gửi lấy đúng bằng ngày đặt đơn
          
          const productName = String(obj.tensanpham || obj.productname || '');
          const address = String(obj.diachinhanhang || obj.address || '');
          const shippingUnit = String(obj.donvivanchuyen || obj.shippingcarrier || '');
          const platformStatus = String(obj.trangthaidonhang || '').toLowerCase();

          // Map trạng thái Shopee sang hệ thống
          let status: ShopeeInventoryOutRecord['status'] = 'OK';
          if (platformStatus.includes('huy')) status = 'CANCEL';
          else if (platformStatus.includes('tra hang') || platformStatus.includes('hoan tien')) status = 'RETURN';
          else if (platformStatus.includes('hoan thanh')) status = 'OK';
          else if (platformStatus.includes('dang giao') || platformStatus.includes('van chuyen')) status = 'SHIPPING';

          // Extract fees from file if available, otherwise fallback to config formulas
          const platformFee = cleanVNNumber(obj.phicodinh || obj.commissionfee || (salePrice * (shopeeCosts?.platformFeePercent || 0)) / 100);
          const paymentFee = cleanVNNumber(obj.phithanhtoan || obj.paymentfee || (salePrice * (shopeeCosts?.paymentFeePercent || 0)) / 100);
          const freeshipExtra = cleanVNNumber(obj.phidichvu || obj.servicefee || obj.freeshipextra || (salePrice * (shopeeCosts?.freeshipExtraPercent || 0)) / 100);
          const affiliateFee = cleanVNNumber(obj.phitiepthilienket || obj.phitiepthilienketshopee || obj.affiliatefee || (salePrice * (shopeeCosts?.affiliateFeePercent || 0)) / 100);
          const handlingFee = totalVariableCosts;
          
          const adsCost = 0;
          const adsTax = 0;
          const personalIncomeTax = (salePrice * (shopeeCosts?.taxPercent || 0)) / 100;
          
          const skuData = shopeeSourceData.find(s => s.sku === sku);
          const importPrice = skuData?.importPrice || 0;
          const netProfit = (status === 'OK' || status === 'SHIPPING') 
            ? (salePrice - platformFee - paymentFee - freeshipExtra - affiliateFee - handlingFee - adsCost - adsTax - personalIncomeTax - importPrice)
            : 0; // Trả hàng hoặc hủy thì netProfit = 0 (tránh tính ảo)

          // Cột AT: tongsotiennguoimuanthanhtoan (Tổng số tiền Người mua thanh toán)
          const customerPaid = cleanVNNumber(obj.tongsotiennguoimuanthanhtoan || obj.tonggiatridonhang || obj.buyerpaid || salePrice);

          return {
            id: crypto.randomUUID(),
            date,
            shipDate,
            orderId,
            trackingNumber,
            sku,
            productName,
            platform: 'Shopee 2',
            quantity,
            salePrice,
            customerPaid,
            platformFee,
            paymentFee,
            freeshipExtra,
            affiliateFee,
            handlingFee,
            adsCost,
            adsTax,
            personalIncomeTax,
            netProfit,
            address,
            shippingUnit,
            status,
            profitStatus: status === 'CANCEL' ? 'HỦY' : (netProfit >= 0 ? 'LÃI 2' : 'LỖ 1'),
            dailyOrderIndex: 0 // Will be updated
          };
        }).filter(Boolean) as ShopeeInventoryOutRecord[];

        // Merge with existing, avoid duplicates by trackingNumber + sku
        const updatedList = [...shopeeInventoryOut];
        const addedItems: ShopeeInventoryOutRecord[] = [];
        newRecords.forEach(nr => {
          const existingIdx = updatedList.findIndex(r => r.trackingNumber === nr.trackingNumber && r.sku === nr.sku);
          if (existingIdx === -1) {
            updatedList.unshift(nr);
            addedItems.push(nr);
          } else {
            // Nếu đã tồn tại nhưng bản ghi cũ bị thiếu ngày, cập nhật lại
            if (!updatedList[existingIdx].date || updatedList[existingIdx].date === '') {
              updatedList[existingIdx] = { ...updatedList[existingIdx], ...nr };
              addedItems.push(nr);
            }
          }
        });

        if (addedItems.length === 0) {
          alert("Không có dữ liệu mới để cập nhật.");
          return;
        }

        // Update daily order index
        const groupedByDate: Record<string, number> = {};
        const finalList = updatedList.map(r => {
          groupedByDate[r.date] = (groupedByDate[r.date] || 0) + 1;
          return { ...r, dailyOrderIndex: groupedByDate[r.date] };
        });

        if (onUpdateSurgical) {
          const updates = addedItems.map(item => ({
            key: 'shopeeInventoryOut' as any,
            item: item
          }));
          await onUpdateSurgical(updates);
        } else {
          await onUpdateShopeeInventoryOut(finalList);
        }
        alert(`Đã nhập thành công ${addedItems.length} đơn hàng từ Shopee.`);
      } catch (err) {
        console.error(err);
        alert("Lỗi xử lý file Shopee.");
      }
    };
    reader.readAsArrayBuffer(file);
  };

  const handleDistributeAdsCost = (totalAds: number, date: string) => {
    if (!onUpdateShopeeInventoryOut || !onUpdateDailyAdsConfig) return;

    // Update config
    const newConfig = { ...dailyAdsConfig, [date]: totalAds };
    onUpdateDailyAdsConfig(newConfig);

    // Update records
    const recordsForDate = shopeeInventoryOut.filter(r => r.date === date);
    if (recordsForDate.length === 0) return;

    const adsPerOrder = totalAds / recordsForDate.length;
    const adsTaxPercent = shopeeCosts?.adsTaxPercent || 0;

    const newList = shopeeInventoryOut.map(r => {
      if (r.date === date) {
        const adsTax = (adsPerOrder * adsTaxPercent) / 100;
        // Recalculate profit
        const skuData = shopeeSourceData.find(s => s.sku === r.sku);
        const importPrice = skuData?.importPrice || 0;
        
        // We need to keep other fees as they were
        const netProfit = r.salePrice - r.platformFee - r.paymentFee - r.freeshipExtra - r.affiliateFee - r.handlingFee - adsPerOrder - adsTax - r.personalIncomeTax - importPrice;

        return {
          ...r,
          adsCost: adsPerOrder,
          adsTax: adsTax,
          netProfit: netProfit
        };
      }
      return r;
    });

    onUpdateShopeeInventoryOut(newList);
  };
  
  // Local Today based on system clock (Vietnam GMT+7)

  // States cho Audit
  const [auditConflicts, setAuditConflicts] = useState<ConflictItem[]>([]);
  const [showAuditModal, setShowAuditModal] = useState(false);
  const [pendingRecords, setPendingRecords] = useState<RevenueRecord[]>([]);

  // Ledger States
  const [formData, setFormData] = useState({
    date: localTodayStr,
    totalGrossRevenue: '',
    discount: '',
    revenueOther: '',
    returnsValue: '',
    totalCogs: ''
  });

  // AI Strategic Diagnosis States
  const [isDiagnosing, setIsDiagnosing] = useState(false);
  const [diagnosisResult, setDiagnosisResult] = useState<string | null>(null);

  const totalFixedCosts = useMemo(() => {
    return (shopeeCosts?.fixedCosts || []).reduce((sum, item) => sum + (item.quantity * item.unitPrice), 0);
  }, [shopeeCosts?.fixedCosts]);

  const totalVariableCosts = useMemo(() => {
    return (shopeeCosts?.variableCosts || []).reduce((sum, item) => sum + (item.quantity * item.unitPrice), 0);
  }, [shopeeCosts?.variableCosts]);

  const shopeeTotals = useMemo(() => {
    const totalSalePrice = shopeeInventoryOut.reduce((sum, i) => sum + i.salePrice, 0);
    const totalNetProfit = shopeeInventoryOut.reduce((sum, i) => sum + i.netProfit, 0);
    const totalAdsCost = shopeeInventoryOut.reduce((sum, i) => sum + i.adsCost, 0);
    
    const totalPlatformFee = shopeeInventoryOut.reduce((sum, i) => sum + i.platformFee, 0);
    const totalPaymentFee = shopeeInventoryOut.reduce((sum, i) => sum + i.paymentFee, 0);
    const totalFreeshipExtra = shopeeInventoryOut.reduce((sum, i) => sum + i.freeshipExtra, 0);
    const totalAffiliateFee = shopeeInventoryOut.reduce((sum, i) => sum + i.affiliateFee, 0);

    return {
      profitMargin: totalSalePrice > 0 ? (totalNetProfit / totalSalePrice) * 100 : 0,
      adsRatio: totalSalePrice > 0 ? (totalAdsCost / totalSalePrice) * 100 : 0,
      platformFeeRatio: totalSalePrice > 0 ? (totalPlatformFee / totalSalePrice) * 100 : 0,
      paymentFeeRatio: totalSalePrice > 0 ? (totalPaymentFee / totalSalePrice) * 100 : 0,
      freeshipExtraRatio: totalSalePrice > 0 ? (totalFreeshipExtra / totalSalePrice) * 100 : 0,
      affiliateFeeRatio: totalSalePrice > 0 ? (totalAffiliateFee / totalSalePrice) * 100 : 0,
    };
  }, [shopeeInventoryOut]);

  const fixedCostPerOrder = useMemo(() => {
    const target = shopeeCosts?.targetOrders || 1;
    return totalFixedCosts / (target || 1);
  }, [totalFixedCosts, shopeeCosts?.targetOrders]);

  const [inventoryOutForm, setInventoryOutForm] = useState<Partial<ShopeeInventoryOutRecord>>({
    date: localTodayStr,
    orderId: '',
    sku: '',
    status: 'OK',
    platform: 'Shopee 2',
    quantity: 1,
    salePrice: 0,
    customerPaid: 0,
    platformFee: 0,
    paymentFee: 0,
    freeshipExtra: 0,
    affiliateFee: 0,
    shippingUnit: 'GHN',
    address: '',
    profitStatus: 'LÃI 2'
  });

  const [editingInventoryOutId, setEditingInventoryOutId] = useState<string | null>(null);

  const handleAddInventoryOut = () => {
    if (!onUpdateShopeeInventoryOut || !inventoryOutForm.sku || !inventoryOutForm.orderId) {
      alert("Vui lòng nhập đầy đủ Mã đơn hàng và Mã SKU");
      return;
    }

    const skuData = shopeeSourceData.find(s => s.sku === inventoryOutForm.sku);
    const salePrice = Number(inventoryOutForm.salePrice) || 0;
    
    // Use actual fee amounts from form
    const platformFee = Number(inventoryOutForm.platformFee) || 0;
    const paymentFee = Number(inventoryOutForm.paymentFee) || 0;
    const freeshipExtra = Number(inventoryOutForm.freeshipExtra) || 0;
    const affiliateFee = Number(inventoryOutForm.affiliateFee) || 0;
    const handlingFee = totalVariableCosts;
    
    // Check if there's a daily ads config for this date
    const dailyTotalAds = dailyAdsConfig[inventoryOutForm.date || localTodayStr] || 0;
    const ordersToday = shopeeInventoryOut.filter(r => r.date === (inventoryOutForm.date || localTodayStr)).length + (editingInventoryOutId ? 0 : 1);
    const adsCost = dailyTotalAds > 0 ? (dailyTotalAds / ordersToday) : (Number(inventoryOutForm.adsCost) || 0);
    
    const adsTax = (adsCost * (shopeeCosts?.adsTaxPercent || 0)) / 100;
    const personalIncomeTax = (salePrice * (shopeeCosts?.taxPercent || 0)) / 100;
    
    const netProfit = salePrice - platformFee - paymentFee - freeshipExtra - affiliateFee - handlingFee - adsCost - adsTax - personalIncomeTax - (skuData?.importPrice || 0);

    const newRecord: ShopeeInventoryOutRecord = {
      id: editingInventoryOutId || generateId(),
      date: inventoryOutForm.date || localTodayStr,
      shipDate: inventoryOutForm.date || localTodayStr,
      orderId: inventoryOutForm.orderId || '',
      sku: inventoryOutForm.sku || '',
      productName: skuData?.name || '',
      platform: inventoryOutForm.platform || 'Shopee 2',
      quantity: Number(inventoryOutForm.quantity) || 1,
      salePrice: salePrice,
      customerPaid: Number(inventoryOutForm.customerPaid) || salePrice,
      platformFee,
      paymentFee,
      freeshipExtra,
      affiliateFee,
      handlingFee,
      adsCost,
      adsTax,
      personalIncomeTax,
      netProfit,
      address: inventoryOutForm.address || '',
      shippingUnit: inventoryOutForm.shippingUnit || 'GHN',
      status: inventoryOutForm.status as any || 'OK',
      profitStatus: netProfit >= 0 ? 'LÃI 2' : 'LỖ 1',
      dailyOrderIndex: editingInventoryOutId ? (shopeeInventoryOut.find(r => r.id === editingInventoryOutId)?.dailyOrderIndex || 1) : ordersToday
    };

    if (onUpdateSurgical) {
      if (dailyTotalAds > 0) {
        const adsPerOrder = dailyTotalAds / ordersToday;
        const adsTaxPercent = shopeeCosts?.adsTaxPercent || 0;
        
        let workingList = [...shopeeInventoryOut];
        if (editingInventoryOutId) {
          const idx = workingList.findIndex(r => r.id === editingInventoryOutId);
          if (idx > -1) workingList[idx] = newRecord;
        } else {
          workingList = [newRecord, ...workingList];
        }

        const updates = workingList
          .filter(r => r.date === (inventoryOutForm.date || localTodayStr))
          .map(r => {
            const sData = shopeeSourceData.find(s => s.sku === r.sku);
            const importPrice = sData?.importPrice || 0;
            const newAdsTax = (adsPerOrder * adsTaxPercent) / 100;
            const newNetProfit = r.salePrice - r.platformFee - r.paymentFee - r.freeshipExtra - r.affiliateFee - r.handlingFee - adsPerOrder - newAdsTax - r.personalIncomeTax - importPrice;
            
            return {
              key: 'shopeeInventoryOut',
              item: {
                ...r,
                adsCost: adsPerOrder,
                adsTax: newAdsTax,
                netProfit: newNetProfit
              }
            };
          });
        onUpdateSurgical(updates);
      } else {
        onUpdateSurgical([{ key: 'shopeeInventoryOut', item: newRecord }]);
      }
    } else {
      let finalList = [...shopeeInventoryOut];
      if (editingInventoryOutId) {
        const idx = finalList.findIndex(r => r.id === editingInventoryOutId);
        if (idx > -1) finalList[idx] = newRecord;
      } else {
        finalList = [newRecord, ...finalList];
      }
      onUpdateShopeeInventoryOut(finalList);
    }
    
    setEditingInventoryOutId(null);
    setInventoryOutForm({
      date: localTodayStr,
      orderId: '',
      sku: '',
      status: 'OK',
      platform: 'Shopee 2',
      quantity: 1,
      salePrice: 0,
      customerPaid: 0,
      platformFee: 0,
      paymentFee: 0,
      freeshipExtra: 0,
      affiliateFee: 0,
      shippingUnit: 'GHN',
      address: '',
      profitStatus: 'LÃI 2'
    });
  };

  const handleEditInventoryOut = (item: ShopeeInventoryOutRecord) => {
    setEditingInventoryOutId(item.id);
    setInventoryOutForm({
      date: item.date || localTodayStr,
      orderId: item.orderId || '',
      sku: item.sku || '',
      quantity: item.quantity || 1,
      salePrice: item.salePrice || 0,
      customerPaid: item.customerPaid || 0,
      platformFee: item.platformFee || 0,
      paymentFee: item.paymentFee || 0,
      freeshipExtra: item.freeshipExtra || 0,
      affiliateFee: item.affiliateFee || 0,
      platform: item.platform || 'Shopee 2',
      shippingUnit: item.shippingUnit || 'GHN',
      address: item.address || '',
      status: item.status || 'OK'
    });
  };

  // Use state-based confirmation to avoid window.confirm issues in iframe
  const [deleteConfirmId, setDeleteConfirmId] = useState<string | null>(null);
  const [clearAllConfirm, setClearAllConfirm] = useState(false);

  const handleRemoveInventoryOut = async (id: string) => {
    if (!onUpdateShopeeInventoryOut) return;
    
    if (onUpdateSurgical) {
      await onUpdateSurgical([{ key: 'shopeeInventoryOut', item: { id }, isDelete: true }]);
    } else {
      const newList = shopeeInventoryOut.filter(i => i.id !== id);
      await onUpdateShopeeInventoryOut(newList);
    }
    setDeleteConfirmId(null);
  };

  const handleClearAllInventoryOut = async () => {
    if (!onUpdateShopeeInventoryOut) return;
    await onUpdateShopeeInventoryOut([]);
    setClearAllConfirm(false);
  };

  const fileInputRef = useRef<HTMLInputElement>(null);
  const formatNumber = (num: number) => Math.round(num || 0).toLocaleString('vi-VN');

  const handleUpdateShopeeCostConfig = (updates: Partial<ShopeeCostConfig>) => {
    if (!shopeeCosts || !onUpdateShopeeCosts) return;
    onUpdateShopeeCosts({ ...shopeeCosts, ...updates });
  };

  const handleAddShopeeCostItem = (type: 'fixed' | 'variable') => {
    if (!shopeeCosts || !onUpdateShopeeCosts) return;
    const newItem = { id: crypto.randomUUID(), name: 'Mục mới', quantity: 1, unitPrice: 0 };
    if (type === 'fixed') {
      onUpdateShopeeCosts({ ...shopeeCosts, fixedCosts: [...(shopeeCosts.fixedCosts || []), newItem] });
    } else {
      onUpdateShopeeCosts({ ...shopeeCosts, variableCosts: [...(shopeeCosts.variableCosts || []), newItem] });
    }
  };

  const handleUpdateShopeeCostItem = (type: 'fixed' | 'variable', id: string, field: string, value: any) => {
    if (!shopeeCosts || !onUpdateShopeeCosts) return;
    const list = type === 'fixed' ? [...(shopeeCosts.fixedCosts || [])] : [...(shopeeCosts.variableCosts || [])];
    const idx = list.findIndex(i => i.id === id);
    if (idx > -1) {
      list[idx] = { ...list[idx], [field]: value };
      if (type === 'fixed') {
        onUpdateShopeeCosts({ ...shopeeCosts, fixedCosts: list });
      } else {
        onUpdateShopeeCosts({ ...shopeeCosts, variableCosts: list });
      }
    }
  };

  const handleRemoveShopeeCostItem = (type: 'fixed' | 'variable', id: string) => {
    if (!shopeeCosts || !onUpdateShopeeCosts) return;
    const list = type === 'fixed' ? [...(shopeeCosts.fixedCosts || [])] : [...(shopeeCosts.variableCosts || [])];
    const newList = list.filter(i => i.id !== id);
    if (type === 'fixed') {
      onUpdateShopeeCosts({ ...shopeeCosts, fixedCosts: newList });
    } else {
      onUpdateShopeeCosts({ ...shopeeCosts, variableCosts: newList });
    }
  };

  // --- LOGIC TIME INTELLIGENCE TOÀN CỤC ---
  const timeContext = useMemo(() => {
    const now = new Date();
    const todayStr = now.toLocaleDateString('sv-SE');
    let start = '';
    let end = todayStr;

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

    switch (diagnosisRange) {
      case 'today': start = todayStr; end = todayStr; break;
      case 'yesterday': start = yesterdayStr; end = yesterdayStr; break;
      case 'last7': start = last7Str; end = todayStr; break;
      case 'thisMonth': start = thisMonthStr; end = todayStr; break;
      case 'lastMonth': start = lastMonthStartStr; end = lastMonthEndStr; break;
      case 'thisYear': start = thisYearStr; end = todayStr; break;
      case 'custom': start = diagStartDate; end = diagEndDate; break;
      case 'all': start = '1900-01-01'; end = '2100-12-31'; break;
    }

    return { start, end };
  }, [diagnosisRange, diagStartDate, diagEndDate]);

  const dynamicTitle = useMemo(() => {
    const formatDate = (dateStr: string) => {
      if (!dateStr || dateStr === '1900-01-01' || dateStr === '2100-12-31') return '';
      const [y, m] = dateStr.split('-');
      return `${m}/${y}`;
    };
    const formatYear = (dateStr: string) => {
      return dateStr.split('-')[0];
    };

    if (diagnosisRange === 'thisMonth' || diagnosisRange === 'lastMonth') {
      return `THÁNG ${formatDate(timeContext.start)}`;
    }
    if (diagnosisRange === 'thisYear') {
      return `NĂM ${formatYear(timeContext.start)}`;
    }
    if (diagnosisRange === 'all') {
      return "TẤT CẢ THỜI GIAN";
    }
    
    const startFormatted = formatDate(timeContext.start);
    const endFormatted = formatDate(timeContext.end);
    
    if (startFormatted === endFormatted) {
      return `THÁNG ${startFormatted}`;
    }
    
    return `TỪ ${startFormatted} ĐẾN ${endFormatted}`;
  }, [diagnosisRange, timeContext]);

  const filteredListByRange = useMemo(() => {
    return list
      .filter(r => r.date >= timeContext.start && r.date <= timeContext.end)
      .sort((a, b) => (b.date || "").localeCompare(a.date || ""));
  }, [list, timeContext]);

  // --- LOGIC CHO MA TRẬN TÀI CHÍNH (DYNAMIC RANGE) ---
  const years = useMemo(() => {
    const ySet = new Set<string>();
    list.forEach(r => {
      if (r.date) {
        const parts = r.date.split('-');
        if (parts.length > 0) ySet.add(parts[0]);
      }
    });
    return Array.from(ySet).sort((a, b) => b.localeCompare(a));
  }, [list]);

  const financialMetrics = [
    { key: 'totalGrossRevenue', label: 'Tổng tiền hàng' },
    { key: 'discount', label: 'Giảm giá' },
    { key: 'revenueOther', label: 'Doanh thu khác' },
    { key: 'returnsValue', label: 'Giá trị trả hàng' },
    { key: 'netRevenue', label: 'Doanh thu thuần' },
    { key: 'totalCogs', label: 'Tổng giá vốn' },
    { key: 'grossProfit', label: 'Lợi nhuận gộp' },
  ];

  const financialMatrixData = useMemo(() => {
    return financialMetrics.map(metric => {
      const yearValues: Record<string, number> = {};
      years.forEach(y => {
        // So sánh cùng kỳ lọc của năm đó
        const sParts = timeContext.start.split('-');
        const eParts = timeContext.end.split('-');
        const startOfTarget = `${y}-${sParts[1]}-${sParts[2]}`;
        const endOfTarget = `${y}-${eParts[1]}-${eParts[2]}`;

        const sum = list
          .filter(r => r.date >= startOfTarget && r.date <= endOfTarget)
          .reduce((acc, curr) => acc + (curr[metric.key as keyof RevenueRecord] as number || 0), 0);
        yearValues[y] = sum;
      });
      return { ...metric, yearValues };
    });
  }, [list, years, timeContext]);

  const maxFinancialValue = useMemo(() => {
    let max = 0;
    financialMatrixData.forEach(row => {
      Object.values(row.yearValues).forEach(v => {
        const val = v as number;
        if (val > max) max = val;
      });
    });
    return max || 1;
  }, [financialMatrixData]);

  const getHeatmapColor = (value: number) => {
    if (value <= 0) return 'transparent';
    const intensity = value / maxFinancialValue;
    if (intensity > 0.8) return 'bg-emerald-500 text-white font-black';
    if (intensity > 0.5) return 'bg-emerald-400 text-white font-black';
    if (intensity > 0.3) return 'bg-emerald-200 text-emerald-900 font-bold';
    if (intensity > 0.1) return 'bg-emerald-100 text-emerald-800 font-bold';
    return 'bg-emerald-50 text-emerald-700 font-bold';
  };

  // --- LOGIC CHIẾN LƯỢC (DIAGNOSIS) ---
  const revenueAnalytics = useMemo(() => {
    if (filteredListByRange.length === 0) return null;
    const totalRev = filteredListByRange.reduce((sum, r) => sum + (r.netRevenue || 0) + (r.revenueOther || 0), 0);
    const totalGrossBeforeLeak = filteredListByRange.reduce((sum, r) => sum + (r.totalGrossRevenue || 0) + (r.revenueOther || 0), 0);
    const totalDisc = filteredListByRange.reduce((sum, r) => sum + (r.discount || 0), 0);
    const totalRet = filteredListByRange.reduce((sum, r) => sum + (r.returnsValue || 0), 0);
    const totalCogs = filteredListByRange.reduce((sum, r) => sum + (r.totalCogs || 0), 0);
    const leakRatio = totalGrossBeforeLeak > 0 ? ((totalDisc + totalRet) / totalGrossBeforeLeak) * 100 : 0;
    const margin = totalRev > 0 ? ((totalRev - totalCogs) / totalRev) * 100 : 0;
    const uniqueDays = new Set(filteredListByRange.map(r => r.date).filter(Boolean)).size;
    const salesVelocity = uniqueDays > 0 ? totalRev / uniqueDays : 0;
    const netProfit = totalRev - totalCogs;
    
    return { totalRev, totalDisc, totalRet, totalCogs, leakRatio, margin, salesVelocity, netProfit, daysCount: uniqueDays, totalGrossBeforeLeak };
  }, [filteredListByRange]);

  const structureData = useMemo(() => {
    if (!revenueAnalytics) return [];
    return [
      { name: 'Giảm giá', value: revenueAnalytics.totalDisc, color: '#f43f5e' }, 
      { name: 'Trả hàng', value: revenueAnalytics.totalRet, color: '#f59e0b' },  
      { name: 'Giá vốn', value: revenueAnalytics.totalCogs, color: '#64748b' },  
      { name: 'Lợi nhuận', value: revenueAnalytics.netProfit, color: '#10b981' } 
    ].filter(d => d.value > 0);
  }, [revenueAnalytics]);

  // --- HANDLERS ---
  const runRevenueDiagnosis = async () => {
    setIsDiagnosing(true);
    setDiagnosisResult(null);
    try {
      const contextData = `
        KHOẢNG THỜI GIAN: ${diagnosisRange.toUpperCase()} (Từ ${timeContext.start} đến ${timeContext.end}).

        THÔNG SỐ TÀI CHÍNH CỐT LÕI:
        - Doanh thu Thuần: ${revenueAnalytics?.totalRev.toLocaleString()}đ (Net Revenue)
        - Giá vốn hàng bán (COGS): ${revenueAnalytics?.totalCogs.toLocaleString()}đ
        - Lợi nhuận gộp: ${revenueAnalytics?.netProfit.toLocaleString()}đ
        - Biên lợi nhuận gộp: ${revenueAnalytics?.margin.toFixed(1)}%
        - Tỷ lệ Rò rỉ (Leakage): ${revenueAnalytics?.leakRatio.toFixed(1)}% (Chiết khấu + Trả hàng / Doanh thu tổng)
        - Vận tốc bán hàng: ${revenueAnalytics?.salesVelocity.toLocaleString()}đ/ngày

        NHIỆM VỤ:
        1. PHÂN TÍCH 'SỨC KHOẺ TÀI CHÍNH': Nhận định về biên lợi nhuận và tỷ lệ rò rỉ.
        2. TỐI ƯU CHI PHÍ: Đưa ra 3 hành động cụ thể để cắt giảm chi phí mà không ảnh hưởng doanh số.
        3. CHIẾN LƯỢC TĂNG TRƯỞNG: Làm sao để tăng 'Vận tốc bán hàng' trong giai đoạn tiếp theo?
        4. CẢNH BÁO RỦI RO: Dự báo các rủi ro về tồn kho hoặc hụt dòng tiền.
      `;
      const response = await fetch('/api/ai/revenue-analysis', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ contextData }),
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || 'AI service error');
      setDiagnosisResult(data.result || 'Lỗi khởi tạo chẩn đoán.');
    } catch (err) { setDiagnosisResult("Lỗi kết nối AI. Vui lòng kiểm tra ANTHROPIC_API_KEY trong .env.local."); }
    finally { setIsDiagnosing(false); }
  };

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    const isExcel = file.name.endsWith('.xlsx') || file.name.endsWith('.xls');

    reader.onload = async (event) => {
      try {
        const fileContent = event.target?.result;
        if (!fileContent) return;
        const results = processExcelRawData(fileContent, isExcel);
        if (results.length === 0) { alert("Không tìm thấy tiêu đề hợp lệ."); return; }
        const groupedByDate: Record<string, RevenueRecord> = {};
        results.forEach(r => {
          const date = parseVNDate(r.thoigian || r.ngay || r.time);
          if (!date) return;
          const tg = cleanVNNumber(r.tongtienhang || r.totalgrossrevenue || r.tongtien);
          const gg = cleanVNNumber(r.giamgia || r.discount || r.chietkhau);
          const th = cleanVNNumber(r.giatritra || r.returnsvalue || r.trahang);
          const gv = cleanVNNumber(r.tonggiavon || r.totalcogs || r.giavon);
          const dt = cleanVNNumber(r.doanhthu || r.revenue || r.doanhthuthuan);
          const ln = cleanVNNumber(r.loinhuangop || r.grossprofit);
          if (!groupedByDate[date]) {
            groupedByDate[date] = { id: generateId(), date, totalGrossRevenue: tg, discount: gg, revenueOther: 0, returnsValue: th, netRevenue: dt || (tg - gg - th), totalCogs: gv, grossProfit: ln || ((dt || (tg - gg - th)) - gv) };
          } else {
            const existing = groupedByDate[date];
            existing.totalGrossRevenue += tg; existing.discount += gg; existing.returnsValue += th; existing.netRevenue += (dt || (tg - gg - th)); existing.totalCogs += gv; existing.grossProfit += (ln || ((dt || (tg - gg - th)) - gv));
          }
        });

        const conflicts: ConflictItem[] = [];
        const updatedFullList = [...list];
        const newProcessedItems: RevenueRecord[] = [];
        const changedItems: { key: any, item: any }[] = [];

        Object.values(groupedByDate).forEach(fileRec => {
          const existingIdx = updatedFullList.findIndex(item => item.date === fileRec.date);
          if (existingIdx === -1) { 
            newProcessedItems.push(fileRec); 
            changedItems.push({ key: isShopee ? 'shopeeRevenue' : 'revenue', item: fileRec });
          } 
          else {
            const current = { ...updatedFullList[existingIdx] }; // Clone to compare
            const columnsToAudit: { key: keyof RevenueRecord, label: string }[] = [{ key: 'totalGrossRevenue', label: 'Tổng tiền hàng' }, { key: 'discount', label: 'Giảm giá' }, { key: 'returnsValue', label: 'Giá trị trả' }, { key: 'totalCogs', label: 'Tổng giá vốn' }];
            let isModified = false;
            columnsToAudit.forEach(col => {
              const curVal = current[col.key] as number; const fileVal = fileRec[col.key] as number;
              if (curVal === 0 || curVal === null || curVal === undefined) { 
                (current as any)[col.key] = fileVal; 
                isModified = true;
              } 
              else if (curVal !== fileVal) { 
                conflicts.push({ date: fileRec.date, columnKey: col.key, columnLabel: col.label, currentValue: curVal, newValue: fileVal, resolution: 'keep' }); 
              }
            });

            if (isModified) {
              current.netRevenue = (current.totalGrossRevenue || 0) - (current.discount || 0) - (current.returnsValue || 0);
              current.grossProfit = (current.netRevenue + (current.revenueOther || 0)) - (current.totalCogs || 0);
              updatedFullList[existingIdx] = current;
              changedItems.push({ key: isShopee ? 'shopeeRevenue' : 'revenue', item: current });
            }
          }
        });

        if (conflicts.length > 0) { 
          setAuditConflicts(conflicts); 
          setPendingRecords([...updatedFullList, ...newProcessedItems]); 
          setShowAuditModal(true); 
        } 
        else { 
          try {
            if (onUpdateSurgical && changedItems.length > 0) {
              await onUpdateSurgical(changedItems);
            } else {
              await onUpdate([...updatedFullList, ...newProcessedItems].sort((a, b) => (b.date || '').localeCompare(a.date || ''))); 
            }
            alert("Đồng bộ thành công!"); 
          } catch (e) {
            console.error("Cloud Sync Error:", e);
            alert("Lỗi đồng bộ dữ liệu lên hệ thống. Dữ liệu đã được lưu tạm trên máy tính này.");
          }
        }
      } catch (err) { alert("Lỗi xử lý file."); }
    };
    if (isExcel) reader.readAsArrayBuffer(file); else reader.readAsText(file);
    if (e.target) e.target.value = '';
  };

  const handleResolveConflicts = async () => {
    const finalRecords = [...pendingRecords];
    const changedItems: { key: any, item: any }[] = [];
    
    auditConflicts.forEach(conflict => {
      if (conflict.resolution === 'update') {
        const idx = finalRecords.findIndex(r => r.date === conflict.date);
        if (idx > -1) {
          (finalRecords[idx] as any)[conflict.columnKey] = conflict.newValue;
          finalRecords[idx].netRevenue = (finalRecords[idx].totalGrossRevenue || 0) - (finalRecords[idx].discount || 0) - (finalRecords[idx].returnsValue || 0);
          finalRecords[idx].grossProfit = (finalRecords[idx].netRevenue + (finalRecords[idx].revenueOther || 0)) - (finalRecords[idx].totalCogs || 0);
          changedItems.push({ key: isShopee ? 'shopeeRevenue' : 'revenue', item: finalRecords[idx] });
        }
      }
    });

    // Also include new items that were previously identified
    // Actually pendingRecords already contains everything. We just need to find what's "new" vs what's "existing".
    // But surgical update is best for items that actually changed or are new.
    
    try {
      if (onUpdateSurgical && changedItems.length > 0) {
        await onUpdateSurgical(changedItems);
      } else {
        await onUpdate(finalRecords.sort((a, b) => (b.date || '').localeCompare(a.date || '')));
      }
      setShowAuditModal(false); setAuditConflicts([]); setPendingRecords([]); setActiveSubTab('ledger');
      alert("Đồng bộ thành công!");
    } catch (e) {
      console.error("Conflict Resolution Sync Error:", e);
      alert("Lỗi đồng bộ dữ liệu lên hệ thống. Vui lòng kiểm tra kết nối.");
    }
  };

  const handleAdd = async (e: React.FormEvent) => {
    e.preventDefault();
    const net = (Number(formData.totalGrossRevenue) || 0) - (Number(formData.discount) || 0) - (Number(formData.returnsValue) || 0);
    const profit = (net + (Number(formData.revenueOther) || 0)) - (Number(formData.totalCogs) || 0);
    
    // Check if record exists to decide between update or create
    const existingRecord = list.find(item => item.date === formData.date);
    
    if (existingRecord) {
      if (!confirm(`Dữ liệu ngày ${formData.date.split("-").reverse().join("/")} đã tồn tại. Bạn có muốn cập nhật không?`)) return;
    }

    setIsSaving(true);
    try {
      const newRecord: RevenueRecord = { 
        id: existingRecord ? existingRecord.id : generateId(), 
        date: formData.date, 
        totalGrossRevenue: Number(formData.totalGrossRevenue) || 0, 
        discount: Number(formData.discount) || 0, 
        revenueOther: Number(formData.revenueOther) || 0, 
        returnsValue: Number(formData.returnsValue) || 0, 
        netRevenue: net, 
        totalCogs: Number(formData.totalCogs) || 0, 
        grossProfit: profit 
      };

      if (onUpdateSurgical) {
        await onUpdateSurgical([{ key: isShopee ? 'shopeeRevenue' : 'revenue', item: newRecord }]);
      } else {
        if (existingRecord) {
          await onUpdate(list.map(r => r.id === newRecord.id ? newRecord : r));
        } else {
          await onUpdate([newRecord, ...list]);
        }
      }
      setFormData({ ...formData, totalGrossRevenue: '', discount: '', revenueOther: '', returnsValue: '', totalCogs: '' });
    } catch (error) {
       console.error("Lỗi khi lưu dữ liệu:", error);
       alert("Lỗi đồng bộ Cloud. Dữ liệu đã được lưu tạm trên máy tính này.");
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <div className="space-y-8 pb-20 max-w-full animate-in fade-in duration-500">
      
      {/* GLOBAL TIME INTELLIGENCE FILTER - MASTER POSITION */}
      <TimeFilter 
        diagnosisRange={diagnosisRange}
        setDiagnosisRange={setDiagnosisRange}
        diagStartDate={diagStartDate}
        setDiagStartDate={setDiagStartDate}
        diagEndDate={diagEndDate}
        setDiagEndDate={setDiagEndDate}
      />

      {/* Sub-tab Navigation */}
      <div className="flex flex-wrap bg-slate-100 p-1.5 rounded-[2rem] w-fit mx-auto shadow-sm border border-slate-200 gap-1">
        {isShopee ? (
          <>
            <button onClick={() => setActiveSubTab('diagnosis')} className={`flex items-center gap-2 px-6 py-3 rounded-[1.5rem] font-black text-[10px] uppercase tracking-widest transition-all ${activeSubTab === 'diagnosis' ? 'bg-white text-blue-600 shadow-xl' : 'text-slate-400 hover:text-slate-600'}`}>
              <Sparkles className="w-4 h-4" /> Siêu Chẩn Đoán
            </button>
            <button onClick={() => setActiveSubTab('source')} className={`flex items-center gap-2 px-6 py-3 rounded-[1.5rem] font-black text-[10px] uppercase tracking-widest transition-all ${activeSubTab === 'source' ? 'bg-white text-emerald-600 shadow-xl' : 'text-slate-400 hover:text-slate-600'}`}>
              <Database className="w-4 h-4" /> Dữ liệu nguồn
            </button>
            <button onClick={() => setActiveSubTab('costs')} className={`flex items-center gap-2 px-6 py-3 rounded-[1.5rem] font-black text-[10px] uppercase tracking-widest transition-all ${activeSubTab === 'costs' ? 'bg-white text-amber-600 shadow-xl' : 'text-slate-400 hover:text-slate-600'}`}>
              <Settings className="w-4 h-4" /> Chi phí
            </button>
            <button onClick={() => setActiveSubTab('inventory_in')} className={`flex items-center gap-2 px-6 py-3 rounded-[1.5rem] font-black text-[10px] uppercase tracking-widest transition-all ${activeSubTab === 'inventory_in' ? 'bg-white text-sky-600 shadow-xl' : 'text-slate-400 hover:text-slate-600'}`}>
              <ArrowDownToLine className="w-4 h-4" /> Nhập kho
            </button>
            <button onClick={() => setActiveSubTab('inventory_out')} className={`flex items-center gap-2 px-6 py-3 rounded-[1.5rem] font-black text-[10px] uppercase tracking-widest transition-all ${activeSubTab === 'inventory_out' ? 'bg-white text-rose-600 shadow-xl' : 'text-slate-400 hover:text-slate-600'}`}>
              <ArrowUpFromLine className="w-4 h-4" /> Xuất kho
            </button>
            <button onClick={() => setActiveSubTab('report')} className={`flex items-center gap-2 px-6 py-3 rounded-[1.5rem] font-black text-[10px] uppercase tracking-widest transition-all ${activeSubTab === 'report' ? 'bg-white text-indigo-600 shadow-xl' : 'text-slate-400 hover:text-slate-600'}`}>
              <ClipboardList className="w-4 h-4" /> Báo cáo
            </button>
          </>
        ) : (
          <>
            <button onClick={() => setActiveSubTab('diagnosis')} className={`flex items-center gap-2 px-8 py-4 rounded-[1.5rem] font-black text-[10px] uppercase tracking-widest transition-all ${activeSubTab === 'diagnosis' ? 'bg-white text-blue-600 shadow-xl' : 'text-slate-400 hover:text-slate-600'}`}>
              <Sparkles className="w-4 h-4" /> Siêu Chẩn Đoán
            </button>
            <button onClick={() => setActiveSubTab('matrix')} className={`flex items-center gap-2 px-8 py-4 rounded-[1.5rem] font-black text-[10px] uppercase tracking-widest transition-all ${activeSubTab === 'matrix' ? 'bg-white text-emerald-600 shadow-xl' : 'text-slate-400 hover:text-slate-600'}`}>
              <Filter className="w-4 h-4" /> Ma Trận Tài Chính
            </button>
            <button onClick={() => setActiveSubTab('ledger')} className={`flex items-center gap-2 px-8 py-4 rounded-[1.5rem] font-black text-[10px] uppercase tracking-widest transition-all ${activeSubTab === 'ledger' ? 'bg-white text-indigo-600 shadow-xl' : 'text-slate-400 hover:text-slate-600'}`}>
              <FileSpreadsheet className="w-4 h-4" /> Sổ Cái Doanh Thu
            </button>
          </>
        )}
      </div>

      {activeSubTab === 'diagnosis' && (
        <DiagnosisTab
          revenueAnalytics={revenueAnalytics}
          structureData={structureData}
          formatNumber={formatNumber}
          runRevenueDiagnosis={runRevenueDiagnosis}
          isDiagnosing={isDiagnosing}
          diagnosisResult={diagnosisResult}
          setDiagnosisResult={setDiagnosisResult}
        />
      )}

      {activeSubTab === 'matrix' && !isShopee && (
        <MatrixTab
          isShopee={!!isShopee}
          productGroups={productGroups}
          groupRevenue={groupRevenue}
          timeContext={timeContext}
          years={years}
          financialMatrixData={financialMatrixData}
          getHeatmapColor={getHeatmapColor}
          formatNumber={formatNumber}
        />
      )}

      {isShopee && activeSubTab === 'source' && (
        <SourceTab shopeeSourceData={shopeeSourceData} formatNumber={formatNumber} />
      )}

      {isShopee && activeSubTab === 'costs' && (
        <CostsTab
          shopeeCosts={shopeeCosts}
          totalFixedCosts={totalFixedCosts}
          totalVariableCosts={totalVariableCosts}
          fixedCostPerOrder={fixedCostPerOrder}
          formatNumber={formatNumber}
          handleUpdateShopeeCostConfig={handleUpdateShopeeCostConfig}
          handleAddShopeeCostItem={handleAddShopeeCostItem}
          handleUpdateShopeeCostItem={handleUpdateShopeeCostItem}
          handleRemoveShopeeCostItem={handleRemoveShopeeCostItem}
        />
      )}

      {isShopee && activeSubTab === 'inventory_in' && (
        <InventoryInTab shopeeInventoryIn={shopeeInventoryIn} formatNumber={formatNumber} />
      )}

      {isShopee && activeSubTab === 'inventory_out' && (
        <InventoryOutTab
          shopeeInventoryOut={shopeeInventoryOut}
          shopeeSourceData={shopeeSourceData}
          shopeeCosts={shopeeCosts}
          dailyAdsConfig={dailyAdsConfig}
          selectedAdsDate={selectedAdsDate}
          setSelectedAdsDate={setSelectedAdsDate}
          inventoryOutForm={inventoryOutForm}
          setInventoryOutForm={setInventoryOutForm}
          editingInventoryOutId={editingInventoryOutId}
          setEditingInventoryOutId={setEditingInventoryOutId}
          deleteConfirmId={deleteConfirmId}
          setDeleteConfirmId={setDeleteConfirmId}
          clearAllConfirm={clearAllConfirm}
          setClearAllConfirm={setClearAllConfirm}
          handleAddInventoryOut={handleAddInventoryOut}
          handleEditInventoryOut={handleEditInventoryOut}
          handleRemoveInventoryOut={handleRemoveInventoryOut}
          handleClearAllInventoryOut={handleClearAllInventoryOut}
          handleShopeeFileUpload={handleShopeeFileUpload}
          handleDistributeAdsCost={handleDistributeAdsCost}
          shopeeFileInputRef={shopeeFileInputRef}
          totalVariableCosts={totalVariableCosts}
          formatNumber={formatNumber}
          dynamicTitle={dynamicTitle}
          shopeeTotals={shopeeTotals}
          onUpdateShopeeCosts={onUpdateShopeeCosts}
        />
      )}

      {isShopee && activeSubTab === 'report' && (
        <ReportTab
          shopeeSourceData={shopeeSourceData}
          shopeeInventoryOut={shopeeInventoryOut}
          timeContext={timeContext}
          formatNumber={formatNumber}
        />
      )}

      {activeSubTab === 'ledger' && !isShopee && (
        <LedgerTab
          formData={formData}
          setFormData={setFormData}
          isSaving={isSaving}
          fileInputRef={fileInputRef}
          handleFileUpload={handleFileUpload}
          handleAdd={handleAdd}
          filteredListByRange={filteredListByRange}
          timeContext={timeContext}
          onUpdate={onUpdate}
          list={list}
          isShopee={isShopee}
          formatNumber={formatNumber}
        />
      )}

      {showAuditModal && (
        <div className="fixed inset-0 z-[110] flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-slate-900/40 backdrop-blur-sm" onClick={() => setShowAuditModal(false)}></div>
          <div className="relative bg-white w-full max-w-4xl max-h-[90vh] overflow-hidden rounded-[3rem] shadow-2xl animate-in zoom-in-95 duration-200 flex flex-col">
            <div className="p-8 border-b border-slate-100 bg-rose-50 flex items-center justify-between">
              <div className="flex items-center gap-4">
                <div className="p-3 bg-rose-600 text-white rounded-2xl shadow-lg"><ShieldAlert className="w-6 h-6" /></div>
                <div><h3 className="text-xl font-black text-slate-900 uppercase tracking-tight">Đối Soát Sai Lệch</h3></div>
              </div>
              <button onClick={() => setShowAuditModal(false)} className="p-2 text-slate-400 hover:text-rose-600"><X className="w-6 h-6" /></button>
            </div>
            <div className="flex-1 overflow-y-auto p-8 no-scrollbar">
              <div className="mb-6 p-4 bg-amber-50 rounded-2xl border border-amber-200 flex items-start gap-4">
                <AlertTriangle className="w-5 h-5 text-amber-500 flex-shrink-0" />
                <p className="text-xs text-amber-800 font-medium">Phát hiện dữ liệu khác biệt. Vui lòng chọn phương án cập nhật.</p>
              </div>
              <div className="rounded-3xl border border-slate-200 overflow-hidden">
                <table className="w-full text-left border-collapse">
                  <thead>
                    <tr className="bg-slate-50 text-[10px] font-black text-slate-500 uppercase border-b border-slate-200"><th className="px-6 py-4">Ngày tháng</th><th className="px-6 py-4">Hạng mục</th><th className="px-6 py-4 text-right">App</th><th className="px-6 py-4 text-right">File</th><th className="px-6 py-4 text-center">Phương án</th></tr>
                  </thead>
                  <tbody className="divide-y divide-slate-50 text-xs font-bold">
                    {auditConflicts.map((conflict, idx) => (
                      <tr key={idx} className={`hover:bg-slate-50 ${conflict.resolution === 'update' ? 'bg-rose-50/30' : ''}`}>
                        <td className="px-6 py-4">{conflict.date.split('-').reverse().join('/')}</td>
                        <td className="px-6 py-4 uppercase text-slate-500">{conflict.columnLabel}</td>
                        <td className="px-6 py-4 text-right">{formatNumber(conflict.currentValue)}</td>
                        <td className="px-6 py-4 text-right text-rose-600">{formatNumber(conflict.newValue)}</td>
                        <td className="px-6 py-4 text-center">
                          <button onClick={() => { const next = [...auditConflicts]; next[idx].resolution = 'keep'; setAuditConflicts(next); }} className={`px-3 py-1.5 rounded-lg text-[9px] font-black uppercase mr-2 ${conflict.resolution === 'keep' ? 'bg-slate-900 text-white' : 'bg-slate-100 text-slate-400'}`}>Giữ</button>
                          <button onClick={() => { const next = [...auditConflicts]; next[idx].resolution = 'update'; setAuditConflicts(next); }} className={`px-3 py-1.5 rounded-lg text-[9px] font-black uppercase ${conflict.resolution === 'update' ? 'bg-rose-600 text-white' : 'bg-slate-100 text-slate-400'}`}>Sửa</button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
            <div className="p-8 border-t border-slate-100 flex items-center justify-between bg-slate-50/50">
              <button onClick={() => setAuditConflicts(auditConflicts.map(c => ({...c, resolution: 'update'})))} className="text-xs font-black text-rose-600 uppercase">Cập nhật tất cả</button>
              <button onClick={handleResolveConflicts} className="px-12 py-4 bg-slate-900 text-white rounded-2xl font-black text-[10px] uppercase shadow-xl">XÁC NHẬN ĐỐI SOÁT</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default RevenueManager;
