
import React, { useState, useRef, useMemo } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { 
  RevenueRecord, ProductGroup, ProductGroupRevenue, 
  ShopeeSourceItem, ShopeeCostConfig, ShopeeInventoryInRecord, ShopeeInventoryOutRecord,
  DiagnosisRange
} from '../types';
import { 
  Trash2, Calendar, DollarSign, Tag, Upload, 
  ArrowRightLeft, ShoppingCart, FileSpreadsheet, Save, HandCoins,
  Sparkles, Loader2, Zap, FileText, Target, Activity, X, BarChart3,
  Circle, Filter, Download, Plus, Hash, TrendingUp, TrendingDown, ShieldAlert, PieChart as PieChartIcon, Check, AlertTriangle,
  Package, Database, Settings, ArrowDownToLine, ArrowUpFromLine, ClipboardList, Pencil
} from 'lucide-react';
import { cleanVNNumber, parseVNDate, normalizeHeader, processExcelRawData, calculateTimeContext, generateId } from '../businessLogic';
import { GoogleGenAI } from "@google/genai";
import { marked } from "marked";
import * as XLSX from 'xlsx';
import { AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Cell, PieChart, Pie, Legend, BarChart, Bar } from 'recharts';
import TimeFilter from './TimeFilter';

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

  const waterfallData = useMemo(() => {
    if (!revenueAnalytics) return [];
    const { totalGrossBeforeLeak, totalDisc, totalRet, totalRev, totalCogs, netProfit } = revenueAnalytics;
    
    const data = [];
    // 1. Gross Revenue
    data.push({ name: 'Doanh thu tổng', value: [0, totalGrossBeforeLeak], fill: '#3b82f6' });
    
    // 2. Discount
    let current = totalGrossBeforeLeak;
    if (totalDisc > 0) {
      data.push({ name: 'Chiết khấu', value: [current - totalDisc, current], fill: '#f43f5e' });
      current -= totalDisc;
    }
    
    // 3. Returns
    if (totalRet > 0) {
      data.push({ name: 'Trả hàng', value: [current - totalRet, current], fill: '#f59e0b' });
      current -= totalRet;
    }
    
    // 4. Net Revenue
    data.push({ name: 'Doanh thu thuần', value: [0, totalRev], fill: '#1e293b' });
    
    // 5. COGS
    current = totalRev;
    if (totalCogs > 0) {
      data.push({ name: 'Giá vốn', value: [current - totalCogs, current], fill: '#64748b' });
      current -= totalCogs;
    }
    
    // 6. Gross Profit
    data.push({ name: 'Lợi nhuận gộp', value: [0, netProfit], fill: '#10b981' });
    
    return data;
  }, [revenueAnalytics]);

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
      const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY });
      const contextPrompt = `
        BẠN LÀ: CFO CHIẾN LƯỢC & CHUYÊN GIA DATA SCIENCE HÀNG ĐẦU.
        DỰ ÁN: CFO BRAIN - HỆ THỐNG MIS QUẢN TRỊ DOANH NGHIỆP 4.0.
        KHOẢNG THỜI GIAN: ${diagnosisRange.toUpperCase()} (Từ ${timeContext.start} đến ${timeContext.end}).
        
        THÔNG SỐ TÀI CHÍNH CỐT LÕI:
        - Doanh thu Thuần: ${revenueAnalytics?.totalRev.toLocaleString()}đ (Net Revenue)
        - Giá vốn hàng bán (COGS): ${revenueAnalytics?.totalCogs.toLocaleString()}đ
        - Lợi nhuận gộp: ${revenueAnalytics?.netProfit.toLocaleString()}đ
        - Biên lợi nhuận gộp: ${revenueAnalytics?.margin.toFixed(1)}%
        - Tỷ lệ Rò rỉ (Leakage): ${revenueAnalytics?.leakRatio.toFixed(1)}% (Chiết khấu + Trả hàng / Doanh thu tổng)
        - Vận tốc bán hàng: ${revenueAnalytics?.salesVelocity.toLocaleString()}đ/ngày
        
        NHIỆM VỤ CỦA CFO:
        1. PHÂN TÍCH 'SỨC KHOẺ TÀI CHÍNH': Nhận định về biên lợi nhuận và tỷ lệ rò rỉ. Có đang bị 'chảy máu' dòng tiền ở đâu không?
        2. TỐI ƯU CHI PHÍ: Dựa trên COGS và Leakage, đưa ra 3 hành động cụ thể để cắt giảm chi phí mà không ảnh hưởng doanh số.
        3. CHIẾN LƯỢC TĂNG TRƯỞNG: Làm sao để tăng 'Vận tốc bán hàng' trong giai đoạn tiếp theo?
        4. CẢNH BÁO RỦI RO: Dự báo các rủi ro về tồn kho hoặc hụt dòng tiền dựa trên các con số trên.
        
        YÊU CẦU TRÌNH BÀY:
        - Sử dụng Markdown chuyên nghiệp, có bảng biểu (nếu cần).
        - Ngôn ngữ: Tiếng Việt, súc tích, quyết đoán, mang tính hành động (Actionable Insights).
        - Tránh nói lý thuyết suông, tập trung vào con số thực tế đã cung cấp.
      `;
      const result = await ai.models.generateContent({ model: 'gemini-3-flash-preview', contents: contextPrompt });
      setDiagnosisResult(result.text || "Lỗi khởi tạo chẩn đoán.");
    } catch (err) { setDiagnosisResult("Lỗi kết nối AI."); } 
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
        <div className="space-y-10 animate-in fade-in duration-700">
           <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
              <MetricCard title="Doanh thu thực nhận" value={formatNumber(revenueAnalytics?.totalRev || 0) + 'đ'} icon={DollarSign} color="indigo" desc={`Tổng thu trong khoảng lọc`} />
              <MetricCard title="Biên lợi nhuận gộp" value={(revenueAnalytics?.margin || 0).toFixed(1) + '%'} icon={Target} color="emerald" desc="Hiệu suất sinh lời dòng tiền" />
              <MetricCard title="Vận tốc doanh thu" value={formatNumber(revenueAnalytics?.salesVelocity || 0) + 'đ'} icon={Zap} color="sky" desc="Doanh thu trung bình mỗi ngày" />
              <MetricCard title="Tỷ lệ Rò rỉ (Leakage)" value={(revenueAnalytics?.leakRatio || 0).toFixed(1) + '%'} icon={ShieldAlert} color={(revenueAnalytics?.leakRatio || 0) > 10 ? "rose" : "emerald"} desc="Thất thoát do chiết khấu & trả hàng" />
           </div>

           <div className="grid grid-cols-1 lg:grid-cols-10 gap-8">
              <div className="lg:col-span-6 bg-white p-10 rounded-[3rem] border border-slate-200 shadow-xl">
                 <h3 className="text-xl font-black text-slate-900 mb-8 uppercase flex items-center gap-4">
                    <div className="p-3 bg-blue-600 rounded-2xl text-white shadow-lg"><PieChartIcon className="w-5 h-5" /></div>
                    CẤU TRÚC DÒNG TIỀN DOANH THU
                 </h3>
                 <div className="h-80">
                    <ResponsiveContainer width="100%" height="100%">
                       <PieChart>
                          <Pie data={structureData} cx="50%" cy="50%" innerRadius={80} outerRadius={110} paddingAngle={8} dataKey="value">
                             {structureData.map((entry, index) => (
                                <Cell key={`cell-${index}`} fill={entry.color} />
                             ))}
                          </Pie>
                          <Tooltip contentStyle={{ borderRadius: '1.5rem', border: 'none', boxShadow: '0 20px 25px -5px rgb(0 0 0 / 0.1)' }} formatter={(v: number) => formatNumber(v) + 'đ'} />
                          <Legend verticalAlign="bottom" height={36} iconType="circle" wrapperStyle={{ paddingTop: '20px', fontSize: '10px', fontWeight: 'bold', textTransform: 'uppercase' }} />
                       </PieChart>
                    </ResponsiveContainer>
                 </div>
              </div>

              <div className="lg:col-span-4 bg-slate-900 p-10 rounded-[3rem] text-white shadow-2xl relative overflow-hidden flex flex-col">
                 <div className="absolute top-0 right-0 p-10 opacity-10"><Sparkles className="w-32 h-32" /></div>
                 <h3 className="text-xl font-black uppercase tracking-tight mb-8 flex items-center gap-4 relative z-10">
                    <div className="p-3 bg-indigo-600 rounded-2xl shadow-lg"><Activity className="w-6 h-6" /></div>
                    REVENUE AI ADVISOR
                 </h3>
                 <div className="space-y-6 flex-1 relative z-10">
                    <div className="p-6 bg-emerald-500/10 border border-emerald-500/20 rounded-2xl flex items-start gap-4">
                       <div className="p-2 bg-emerald-500/20 text-emerald-500 rounded-xl"><TrendingUp className="w-5 h-5" /></div>
                       <div><h5 className="text-sm font-black text-emerald-400 uppercase">Tối ưu biên gộp</h5><p className="text-[11px] text-slate-300 mt-1 leading-relaxed">Biên lợi nhuận trong khoảng này là {(revenueAnalytics?.margin || 0).toFixed(1)}%.</p></div>
                    </div>
                 </div>
                 <div className="mt-10 pt-8 border-t border-white/10 relative z-10">
                    <button onClick={runRevenueDiagnosis} disabled={isDiagnosing || !revenueAnalytics} className="w-full px-8 py-5 bg-blue-600 hover:bg-blue-500 text-white rounded-3xl font-black text-[11px] uppercase tracking-widest shadow-xl transition-all flex items-center justify-center gap-3 active:scale-95 disabled:opacity-50">
                       {isDiagnosing ? <Loader2 className="w-5 h-5 animate-spin" /> : <Sparkles className="w-5 h-5" />}
                       {isDiagnosing ? "Đang giải mã dữ liệu..." : "Bắt đầu Siêu Chẩn Đoán"}
                    </button>
                 </div>
              </div>
           </div>

           {diagnosisResult && (
             <div className="bg-white rounded-[3.5rem] p-12 shadow-2xl border border-slate-100 animate-in slide-in-from-top-4 duration-500">
                <div className="flex items-center justify-between mb-8 border-b border-slate-50 pb-8">
                   <div className="flex items-center gap-4"><div className="p-3 bg-blue-600 rounded-2xl text-white shadow-lg"><FileText className="w-6 h-6" /></div><h4 className="text-xl font-black text-slate-900 uppercase tracking-tight">Báo Cáo Chẩn Đoán Doanh Thu</h4></div>
                   <button onClick={() => setDiagnosisResult(null)} className="p-2 text-slate-300 hover:text-rose-500 transition-colors"><X className="w-6 h-6" /></button>
                </div>
                <div className="markdown-content text-slate-800" dangerouslySetInnerHTML={{ __html: marked.parse(diagnosisResult) }} />
             </div>
           )}
        </div>
      )}

      {activeSubTab === 'matrix' && !isShopee && (
        <div className="bg-white rounded-[3.5rem] p-8 md:p-12 border border-slate-200 shadow-xl flex flex-col gap-10">
          <div className="flex flex-col md:flex-row items-center justify-between gap-6 border-b border-slate-100 pb-10">
             <div className="flex items-center gap-5">
                <div className="p-4 bg-emerald-600 rounded-[1.5rem] text-white shadow-lg"><Filter className="w-6 h-6" /></div>
                <div>
                   <h3 className="text-2xl font-black text-slate-900 uppercase tracking-tight">
                     {isShopee ? 'Tổng hợp Số lượng bán Shopee' : 'Ma Trận Tài Chính Liên Năm'}
                   </h3>
                   <p className="text-[10px] text-emerald-600 font-bold uppercase tracking-widest mt-1">
                     {isShopee ? 'Thống kê chi tiết sản phẩm trong khoảng lọc' : 'So sánh hiệu suất cùng kỳ lọc (Tháng-Ngày) qua các năm'}
                   </p>
                </div>
             </div>
             <div className="px-6 py-3 bg-slate-50 rounded-2xl border border-slate-100">
                <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Giai đoạn: </span>
                <span className="text-xs font-black text-slate-900 ml-2">
                   {timeContext.start.split('-').reverse().join('/')} → {timeContext.end.split('-').reverse().join('/')}
                </span>
             </div>
          </div>

          {isShopee ? (
            <div className="bg-white rounded-[2rem] border border-slate-200 shadow-sm overflow-x-auto no-scrollbar">
              <table className="w-full border-collapse">
                <thead>
                  <tr className="bg-slate-50 border-b border-slate-200 text-[11px] font-black text-slate-500 uppercase tracking-widest">
                    <th className="p-6 text-left">Mã Nhóm / Sản phẩm</th>
                    <th className="p-6 text-right">Số lượng bán</th>
                    <th className="p-6 text-right">Số lượng trả</th>
                    <th className="p-6 text-right">Doanh thu thuần</th>
                    <th className="p-6 text-right">Giá vốn</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-50">
                  {productGroups.map(group => {
                    const groupRev = groupRevenue.filter(r => r.groupId === group.id && r.date >= timeContext.start && r.date <= timeContext.end);
                    const totalQty = groupRev.reduce((sum, r) => sum + (r.quantity || 0), 0);
                    const totalRetQty = groupRev.reduce((sum, r) => sum + (r.returnsQuantity || 0), 0);
                    const totalNet = groupRev.reduce((sum, r) => sum + (r.netRevenue || 0), 0);
                    const totalCogs = groupRev.reduce((sum, r) => sum + (r.cogs || 0), 0);
                    
                    return (
                      <tr key={group.id} className="hover:bg-slate-50 transition-all">
                        <td className="p-6 font-black text-slate-700 uppercase text-xs">{group.name}</td>
                        <td className="p-6 text-right tabular-nums font-bold text-blue-600">{totalQty.toLocaleString()}</td>
                        <td className="p-6 text-right tabular-nums font-bold text-rose-500">{totalRetQty.toLocaleString()}</td>
                        <td className="p-6 text-right tabular-nums font-bold text-emerald-600">{totalNet.toLocaleString()}đ</td>
                        <td className="p-6 text-right tabular-nums font-bold text-slate-500">{totalCogs.toLocaleString()}đ</td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          ) : (
            <div className="bg-white rounded-[2rem] border border-slate-200 shadow-sm overflow-x-auto no-scrollbar">
               <table className="w-full border-collapse">
                  <thead>
                    <tr className="bg-slate-50 border-b border-slate-200 text-[11px] font-black text-slate-500 uppercase tracking-widest">
                      <th className="p-6 text-left min-w-[280px] sticky left-0 bg-slate-50 z-20 border-r border-slate-200">Chỉ số (Cùng kỳ lọc)</th>
                      {years.map(y => <th key={y} className="p-6 text-center w-[180px] border-r border-slate-100">Năm {y}</th>)}
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-50">
                    {financialMatrixData.map((row) => (
                      <tr key={row.key} className="group hover:bg-slate-50/80 transition-all">
                        <td className="p-5 sticky left-0 z-10 border-r border-slate-100 bg-white group-hover:bg-slate-50"><span className="text-xs uppercase font-black text-slate-700">{row.label}</span></td>
                        {years.map(y => {
                          const val = row.yearValues[y] || 0;
                          return <td key={y} className={`p-5 text-center tabular-nums text-xs border-r border-slate-50 transition-all ${getHeatmapColor(val)}`}>{val !== 0 ? formatNumber(val) : '0'}</td>;
                        })}
                      </tr>
                    ))}
                  </tbody>
               </table>
            </div>
          )}
        </div>
      )}

      {activeSubTab === 'ledger' && !isShopee && (
        <div className="space-y-6 animate-in slide-in-from-bottom-4 duration-500">
          {/* ... existing ledger content ... */}
        </div>
      )}

      {/* NEW SHOPEE SUB-TABS */}
      {isShopee && activeSubTab === 'source' && (
        <div className="bg-white rounded-[2.5rem] p-8 md:p-12 border border-slate-200 shadow-xl space-y-8">
          <div className="flex items-center justify-between border-b border-slate-100 pb-8">
            <div className="flex items-center gap-4">
              <div className="p-3 bg-emerald-600 rounded-2xl text-white shadow-lg"><Database className="w-6 h-6" /></div>
              <div>
                <h3 className="text-xl font-black text-slate-900 uppercase tracking-tight">Dữ liệu nguồn SKU</h3>
                <p className="text-[10px] text-slate-400 font-bold uppercase tracking-widest">Quản lý danh mục sản phẩm và giá nhập</p>
              </div>
            </div>
            <button className="px-6 py-3 bg-emerald-600 text-white rounded-xl font-black text-[10px] uppercase tracking-widest shadow-lg flex items-center gap-2">
              <Plus className="w-4 h-4" /> Thêm SKU mới
            </button>
          </div>
          <div className="overflow-x-auto rounded-2xl border border-slate-100">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="bg-slate-50 text-[10px] font-black text-slate-500 uppercase tracking-widest border-b border-slate-200">
                  <th className="p-6">Mã sản phẩm</th>
                  <th className="p-6">Tên sản phẩm</th>
                  <th className="p-6 text-right">Giá nhập</th>
                  <th className="p-6 text-right">Giá bán</th>
                  <th className="p-6 text-center">Tình trạng</th>
                  <th className="p-6 text-center">Thao tác</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-50 text-xs font-bold">
                {shopeeSourceData.length > 0 ? shopeeSourceData.map(item => (
                  <tr key={item.id} className="hover:bg-slate-50 transition-all">
                    <td className="p-6 text-slate-900">{item.sku}</td>
                    <td className="p-6 text-slate-600">{item.name}</td>
                    <td className="p-6 text-right text-rose-600">{formatNumber(item.importPrice)}đ</td>
                    <td className="p-6 text-right text-blue-600">{formatNumber(item.salePrice)}đ</td>
                    <td className="p-6 text-center">
                      <span className="px-3 py-1 bg-emerald-100 text-emerald-700 rounded-full text-[9px] uppercase font-black">{item.status}</span>
                    </td>
                    <td className="p-6 text-center">
                      <button className="p-2 text-slate-300 hover:text-rose-500"><Trash2 className="w-4 h-4" /></button>
                    </td>
                  </tr>
                )) : (
                  <tr>
                    <td colSpan={6} className="p-20 text-center text-slate-400 font-bold uppercase tracking-widest">Chưa có dữ liệu nguồn</td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {isShopee && activeSubTab === 'costs' && (
        <div className="space-y-8 animate-in fade-in duration-700">
          {/* Top Summary Cards */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            <div className="bg-white p-8 rounded-[2.5rem] border border-slate-200 shadow-xl flex flex-col items-center text-center">
              <div className="p-4 bg-indigo-100 text-indigo-600 rounded-2xl mb-4"><DollarSign className="w-6 h-6" /></div>
              <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1">Tổng chi phí vận hành</p>
              <h4 className="text-2xl font-black text-slate-900">{formatNumber(totalFixedCosts)}đ</h4>
            </div>
            <div className="bg-white p-8 rounded-[2.5rem] border border-slate-200 shadow-xl flex flex-col items-center text-center">
              <div className="p-4 bg-emerald-100 text-emerald-600 rounded-2xl mb-4"><Target className="w-6 h-6" /></div>
              <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1">Định phí / Đơn hàng</p>
              <h4 className="text-2xl font-black text-emerald-600">{formatNumber(fixedCostPerOrder)}đ</h4>
              <p className="text-[9px] text-slate-400 font-bold mt-2 italic">Dựa trên mục tiêu {shopeeCosts?.targetOrders || 0} đơn</p>
            </div>
            <div className="bg-white p-8 rounded-[2.5rem] border border-slate-200 shadow-xl flex flex-col items-center text-center">
              <div className="p-4 bg-rose-100 text-rose-600 rounded-2xl mb-4"><Zap className="w-6 h-6" /></div>
              <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1">Biến phí / Đơn hàng</p>
              <h4 className="text-2xl font-black text-rose-600">{formatNumber(totalVariableCosts)}đ</h4>
            </div>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
            {/* Left Column: ĐỊNH PHÍ */}
            <div className="bg-white rounded-[3rem] p-10 border border-slate-200 shadow-xl flex flex-col gap-8">
              <div className="flex items-center justify-between border-b border-slate-100 pb-6">
                <div className="flex items-center gap-4">
                  <div className="p-3 bg-indigo-600 rounded-2xl text-white shadow-lg"><Settings className="w-6 h-6" /></div>
                  <div>
                    <h3 className="text-xl font-black text-slate-900 uppercase tracking-tight">ĐỊNH PHÍ</h3>
                    <p className="text-[10px] text-slate-400 font-bold uppercase tracking-widest">Chi phí cố định hàng tháng</p>
                  </div>
                </div>
                <button 
                  onClick={() => handleAddShopeeCostItem('fixed')}
                  className="p-2 bg-indigo-50 text-indigo-600 rounded-xl hover:bg-indigo-100 transition-all"
                >
                  <Plus className="w-5 h-5" />
                </button>
              </div>

              <div className="overflow-x-auto">
                <table className="w-full text-left border-collapse">
                  <thead>
                    <tr className="text-[9px] font-black text-slate-400 uppercase tracking-widest border-b border-slate-100">
                      <th className="pb-4 w-12">STT</th>
                      <th className="pb-4">Nội dung chi</th>
                      <th className="pb-4 text-center w-20">SL</th>
                      <th className="pb-4 text-right w-32">Đơn giá</th>
                      <th className="pb-4 text-right w-32">Tổng cộng</th>
                      <th className="pb-4 w-10"></th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-50">
                    {(shopeeCosts?.fixedCosts || []).map((item, idx) => (
                      <tr key={item.id} className="group">
                        <td className="py-4 text-[10px] font-black text-slate-300">{idx + 1}</td>
                        <td className="py-4">
                          <input 
                            type="text" 
                            value={item.name} 
                            onChange={(e) => handleUpdateShopeeCostItem('fixed', item.id, 'name', e.target.value)}
                            className="w-full bg-transparent border-none outline-none text-xs font-bold text-slate-700 focus:text-indigo-600"
                          />
                        </td>
                        <td className="py-4">
                          <input 
                            type="number" 
                            value={item.quantity} 
                            onChange={(e) => handleUpdateShopeeCostItem('fixed', item.id, 'quantity', Number(e.target.value))}
                            className="w-full bg-transparent border-none outline-none text-xs font-bold text-center text-slate-600"
                          />
                        </td>
                        <td className="py-4">
                          <input 
                            type="number" 
                            value={item.unitPrice} 
                            onChange={(e) => handleUpdateShopeeCostItem('fixed', item.id, 'unitPrice', Number(e.target.value))}
                            className="w-full bg-transparent border-none outline-none text-xs font-bold text-right text-slate-600"
                          />
                        </td>
                        <td className="py-4 text-right text-xs font-black text-slate-900">
                          {formatNumber(item.quantity * item.unitPrice)}
                        </td>
                        <td className="py-4 text-right">
                          <button 
                            onClick={() => handleRemoveShopeeCostItem('fixed', item.id)}
                            className="p-1 text-slate-200 hover:text-rose-500 opacity-0 group-hover:opacity-100 transition-all"
                          >
                            <X className="w-4 h-4" />
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

              <div className="mt-auto pt-8 border-t border-slate-100 space-y-6">
                <div className="flex items-center justify-between">
                  <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Ước tính mục tiêu đơn hàng</span>
                  <div className="flex items-center gap-3 bg-slate-50 px-4 py-2 rounded-xl border border-slate-100">
                    <input 
                      type="number" 
                      value={shopeeCosts?.targetOrders || 0} 
                      onChange={(e) => handleUpdateShopeeCostConfig({ targetOrders: Number(e.target.value) })}
                      className="w-16 bg-transparent border-none outline-none text-sm font-black text-indigo-600 text-center"
                    />
                    <span className="text-[10px] font-black text-slate-400 uppercase">Đơn</span>
                  </div>
                </div>
                <div className="p-6 bg-indigo-600 rounded-3xl text-white shadow-xl flex items-center justify-between">
                  <div>
                    <p className="text-[10px] font-black uppercase opacity-60">Định phí / Đơn hàng</p>
                    <h4 className="text-2xl font-black mt-1">{formatNumber(fixedCostPerOrder)}đ</h4>
                  </div>
                  <div className="text-right">
                    <p className="text-[10px] font-black uppercase opacity-60">Tổng chi vận hành</p>
                    <p className="text-sm font-bold mt-1">{formatNumber(totalFixedCosts)}đ</p>
                  </div>
                </div>
              </div>
            </div>

            {/* Right Column: BIẾN PHÍ */}
            <div className="bg-white rounded-[3rem] p-10 border border-slate-200 shadow-xl flex flex-col gap-8">
              <div className="flex items-center justify-between border-b border-slate-100 pb-6">
                <div className="flex items-center gap-4">
                  <div className="p-3 bg-rose-600 rounded-2xl text-white shadow-lg"><Package className="w-6 h-6" /></div>
                  <div>
                    <h3 className="text-xl font-black text-slate-900 uppercase tracking-tight">BIẾN PHÍ</h3>
                    <p className="text-[10px] text-slate-400 font-bold uppercase tracking-widest">Chi phí cho mỗi đơn hàng</p>
                  </div>
                </div>
                <button 
                  onClick={() => handleAddShopeeCostItem('variable')}
                  className="p-2 bg-rose-50 text-rose-600 rounded-xl hover:bg-rose-100 transition-all"
                >
                  <Plus className="w-5 h-5" />
                </button>
              </div>

              <div className="overflow-x-auto">
                <table className="w-full text-left border-collapse">
                  <thead>
                    <tr className="text-[9px] font-black text-slate-400 uppercase tracking-widest border-b border-slate-100">
                      <th className="pb-4 w-12">STT</th>
                      <th className="pb-4">Nội dung chi</th>
                      <th className="pb-4 text-center w-20">SL</th>
                      <th className="pb-4 text-right w-32">Đơn giá</th>
                      <th className="pb-4 text-right w-32">Tổng cộng</th>
                      <th className="pb-4 w-10"></th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-50">
                    {(shopeeCosts?.variableCosts || []).map((item, idx) => (
                      <tr key={item.id} className="group">
                        <td className="py-4 text-[10px] font-black text-slate-300">{idx + 1}</td>
                        <td className="py-4">
                          <input 
                            type="text" 
                            value={item.name} 
                            onChange={(e) => handleUpdateShopeeCostItem('variable', item.id, 'name', e.target.value)}
                            className="w-full bg-transparent border-none outline-none text-xs font-bold text-slate-700 focus:text-rose-600"
                          />
                        </td>
                        <td className="py-4">
                          <input 
                            type="number" 
                            value={item.quantity} 
                            onChange={(e) => handleUpdateShopeeCostItem('variable', item.id, 'quantity', Number(e.target.value))}
                            className="w-full bg-transparent border-none outline-none text-xs font-bold text-center text-slate-600"
                          />
                        </td>
                        <td className="py-4">
                          <input 
                            type="number" 
                            value={item.unitPrice} 
                            onChange={(e) => handleUpdateShopeeCostItem('variable', item.id, 'unitPrice', Number(e.target.value))}
                            className="w-full bg-transparent border-none outline-none text-xs font-bold text-right text-slate-600"
                          />
                        </td>
                        <td className="py-4 text-right text-xs font-black text-slate-900">
                          {formatNumber(item.quantity * item.unitPrice)}
                        </td>
                        <td className="py-4 text-right">
                          <button 
                            onClick={() => handleRemoveShopeeCostItem('variable', item.id)}
                            className="p-1 text-slate-200 hover:text-rose-500 opacity-0 group-hover:opacity-100 transition-all"
                          >
                            <X className="w-4 h-4" />
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

              <div className="mt-auto pt-8 border-t border-slate-100">
                <div className="p-6 bg-rose-600 rounded-3xl text-white shadow-xl flex items-center justify-between">
                  <div>
                    <p className="text-[10px] font-black uppercase opacity-60">Biến phí / Đơn hàng</p>
                    <h4 className="text-2xl font-black mt-1">{formatNumber(totalVariableCosts)}đ</h4>
                  </div>
                  <div className="text-right">
                    <p className="text-[10px] font-black uppercase opacity-60">Tổng cộng</p>
                    <p className="text-sm font-bold mt-1">{formatNumber(totalVariableCosts)}đ</p>
                  </div>
                </div>
              </div>
            </div>
          </div>

          {/* Platform Fees Configuration (Collapsed or Secondary) */}
          <div className="bg-slate-50 rounded-[2.5rem] p-10 border border-slate-200">
             <div className="flex items-center gap-4 mb-8">
                <div className="p-3 bg-slate-900 rounded-2xl text-white"><Settings className="w-5 h-5" /></div>
                <h3 className="text-lg font-black text-slate-900 uppercase tracking-tight">Cấu hình phí sàn Shopee (%)</h3>
             </div>
             <div className="grid grid-cols-2 md:grid-cols-5 gap-6">
                <InputWrapper label="Phí sàn" icon={Hash} color="text-slate-600">
                  <input type="number" value={shopeeCosts?.platformFeePercent || 0} onChange={e => handleUpdateShopeeCostConfig({ platformFeePercent: Number(e.target.value) })} className="bg-transparent border-none outline-none w-full text-xs font-bold" />
                </InputWrapper>
                <InputWrapper label="Phí thanh toán" icon={Hash} color="text-slate-600">
                  <input type="number" value={shopeeCosts?.paymentFeePercent || 0} onChange={e => handleUpdateShopeeCostConfig({ paymentFeePercent: Number(e.target.value) })} className="bg-transparent border-none outline-none w-full text-xs font-bold" />
                </InputWrapper>
                <InputWrapper label="Freeship Extra" icon={Hash} color="text-slate-600">
                  <input type="number" value={shopeeCosts?.freeshipExtraPercent || 0} onChange={e => handleUpdateShopeeCostConfig({ freeshipExtraPercent: Number(e.target.value) })} className="bg-transparent border-none outline-none w-full text-xs font-bold" />
                </InputWrapper>
                <InputWrapper label="Phí vận hành" icon={DollarSign} color="text-slate-600">
                  <div className="text-xs font-black text-slate-900">{formatNumber(totalVariableCosts)} đ</div>
                </InputWrapper>
                <InputWrapper label="Thuế TNCN" icon={Hash} color="text-slate-600">
                  <input type="number" value={shopeeCosts?.taxPercent || 0} onChange={e => handleUpdateShopeeCostConfig({ taxPercent: Number(e.target.value) })} className="bg-transparent border-none outline-none w-full text-xs font-bold" />
                </InputWrapper>
                <InputWrapper label="Thuế QC" icon={Hash} color="text-slate-600">
                  <input type="number" value={shopeeCosts?.adsTaxPercent || 0} onChange={e => handleUpdateShopeeCostConfig({ adsTaxPercent: Number(e.target.value) })} className="bg-transparent border-none outline-none w-full text-xs font-bold" />
                </InputWrapper>
             </div>
          </div>
        </div>
      )}

      {isShopee && activeSubTab === 'inventory_in' && (
        <div className="bg-white rounded-[2.5rem] p-8 md:p-12 border border-slate-200 shadow-xl space-y-8">
          <div className="flex items-center justify-between border-b border-slate-100 pb-8">
            <div className="flex items-center gap-4">
              <div className="p-3 bg-sky-600 rounded-2xl text-white shadow-lg"><ArrowDownToLine className="w-6 h-6" /></div>
              <div>
                <h3 className="text-xl font-black text-slate-900 uppercase tracking-tight">Nhập kho sản phẩm</h3>
                <p className="text-[10px] text-slate-400 font-bold uppercase tracking-widest">Ghi nhận lịch sử nhập hàng hóa</p>
              </div>
            </div>
            <button className="px-6 py-3 bg-sky-600 text-white rounded-xl font-black text-[10px] uppercase tracking-widest shadow-lg flex items-center gap-2">
              <Plus className="w-4 h-4" /> Tạo phiếu nhập
            </button>
          </div>
          <div className="overflow-x-auto rounded-2xl border border-slate-100">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="bg-slate-50 text-[10px] font-black text-slate-500 uppercase tracking-widest border-b border-slate-200">
                  <th className="p-6">Ngày nhập</th>
                  <th className="p-6">Mã sản phẩm</th>
                  <th className="p-6 text-right">Số lượng</th>
                  <th className="p-6 text-right">Giá nhập</th>
                  <th className="p-6 text-right">Thành tiền</th>
                  <th className="p-6">Ghi chú</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-50 text-xs font-bold">
                {shopeeInventoryIn.length > 0 ? shopeeInventoryIn.map(item => (
                  <tr key={item.id} className="hover:bg-slate-50 transition-all">
                    <td className="p-6 text-slate-900">{item.date.split('-').reverse().join('/')}</td>
                    <td className="p-6 text-slate-600 font-black uppercase">{item.sku}</td>
                    <td className="p-6 text-right text-blue-600">{item.quantity.toLocaleString()}</td>
                    <td className="p-6 text-right text-rose-600">{formatNumber(item.importPrice)}đ</td>
                    <td className="p-6 text-right font-black text-slate-900">{formatNumber(item.quantity * item.importPrice)}đ</td>
                    <td className="p-6 text-slate-400 italic">{item.note || '-'}</td>
                  </tr>
                )) : (
                  <tr>
                    <td colSpan={6} className="p-20 text-center text-slate-400 font-bold uppercase tracking-widest">Chưa có lịch sử nhập kho</td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {isShopee && activeSubTab === 'inventory_out' && (
        <div className="space-y-4">
          {/* Top Section: Upload & Manual Entry */}
          <div className="grid grid-cols-1 md:grid-cols-12 gap-4">
            {/* Left: Upload Area (Smaller) */}
            <div className="md:col-span-3 bg-white p-4 rounded-2xl border border-slate-200 shadow-sm flex flex-col items-center justify-center border-dashed border-2 hover:border-rose-300 transition-all group cursor-pointer"
                 onClick={() => shopeeFileInputRef.current?.click()}>
              <input 
                type="file" 
                ref={shopeeFileInputRef} 
                className="hidden" 
                accept=".xlsx, .xls" 
                onChange={handleShopeeFileUpload} 
              />
              <div className="w-10 h-10 bg-rose-50 rounded-full flex items-center justify-center mb-2 group-hover:scale-110 transition-transform">
                <Upload className="w-5 h-5 text-rose-600" />
              </div>
              <h4 className="text-[11px] font-black text-slate-900 uppercase">Tải file Shopee</h4>
              <p className="text-[8px] text-slate-400 font-bold uppercase mt-1 text-center">Tự động phân tích đơn hàng</p>
            </div>

            {/* Right: Ads & Manual Entry (2 Rows) */}
            <div className="md:col-span-9 space-y-4">
              {/* Row 1: Ads */}
              <div className="bg-white p-4 rounded-2xl border border-slate-200 shadow-sm">
                <div className="flex flex-col md:flex-row items-center gap-4">
                  <div className="flex items-center gap-2 min-w-[150px]">
                    <div className="p-2 bg-rose-100 rounded-lg text-rose-600"><TrendingUp className="w-4 h-4" /></div>
                    <h4 className="text-[11px] font-black text-slate-900 uppercase">Quảng cáo ngày</h4>
                  </div>
                  <div className="flex-1 flex items-center gap-3 bg-slate-50 p-2 rounded-xl border border-slate-100 w-full">
                    <input 
                      type="date"
                      value={selectedAdsDate}
                      onChange={(e) => setSelectedAdsDate(e.target.value)}
                      className="bg-transparent border-none outline-none text-[11px] font-bold text-slate-600 w-32"
                    />
                    <div className="h-6 w-[1px] bg-slate-200"></div>
                    <div className="flex-1 flex items-center gap-2">
                      <DollarSign className="w-3.5 h-3.5 text-rose-600" />
                      <input 
                        type="number"
                        value={dailyAdsConfig[selectedAdsDate] || 0}
                        onChange={(e) => handleDistributeAdsCost(Number(e.target.value), selectedAdsDate)}
                        className="bg-transparent border-none outline-none text-slate-900 font-black text-xs w-full"
                        placeholder="Nhập tổng tiền QC của ngày..."
                      />
                    </div>
                  </div>
                </div>
              </div>

              {/* Row 2: Manual Entry Form */}
              <div className={`bg-white p-5 rounded-2xl border ${editingInventoryOutId ? 'border-indigo-500 shadow-indigo-100 ring-2 ring-indigo-500/20' : 'border-slate-200'} shadow-sm transition-all`}>
                <div className="flex items-center justify-between mb-4">
                  <div className="flex items-center gap-3">
                    <div className={`p-2 ${editingInventoryOutId ? 'bg-indigo-600' : 'bg-slate-900'} rounded-lg text-white shadow-md transition-colors`}>
                      {editingInventoryOutId ? <Pencil className="w-3.5 h-3.5" /> : <Plus className="w-3.5 h-3.5" />}
                    </div>
                    <div>
                      <h4 className="text-[11px] font-black text-slate-900 uppercase">{editingInventoryOutId ? 'Cập nhật đơn hàng' : 'Nhập đơn hàng mới'}</h4>
                      {editingInventoryOutId && (
                        <p className="text-[8px] font-bold text-indigo-600 uppercase tracking-widest mt-0.5">Đang sửa bản ghi: {shopeeInventoryOut.find(r => r.id === editingInventoryOutId)?.trackingNumber}</p>
                      )}
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    {editingInventoryOutId && (
                      <button 
                        onClick={() => {
                          setEditingInventoryOutId(null);
                          setInventoryOutForm({
                            date: localTodayStr,
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
                            profitStatus: 'LÃI 2'
                          });
                        }}
                        className="text-[9px] font-black text-slate-400 hover:text-rose-600 uppercase tracking-widest px-3 py-1 bg-slate-100 rounded-full transition-colors"
                      >
                        Hủy sửa
                      </button>
                    )}
                    <span className="text-[9px] font-bold text-slate-400 uppercase italic">* Nhập nhanh đơn hàng lẻ</span>
                  </div>
                </div>
                
                <div className="space-y-3">
                  <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-6 gap-3">
                    <div className="space-y-1">
                      <label className="text-[9px] font-black text-slate-400 uppercase ml-1">Ngày gửi</label>
                      <input type="date" value={inventoryOutForm.date} onChange={e => setInventoryOutForm({...inventoryOutForm, date: e.target.value})} className="w-full bg-slate-50 border border-slate-100 rounded-lg px-3 py-2 text-[10px] font-bold focus:outline-none focus:ring-1 focus:ring-rose-500" />
                    </div>
                    <div className="space-y-1">
                      <label className="text-[9px] font-black text-slate-400 uppercase ml-1">Mã Vận Đơn</label>
                      <input type="text" placeholder="Mã vận đơn..." value={inventoryOutForm.orderId || ''} onChange={e => setInventoryOutForm({...inventoryOutForm, orderId: e.target.value})} className="w-full bg-slate-50 border border-slate-100 rounded-lg px-3 py-2 text-[10px] font-bold focus:outline-none focus:ring-1 focus:ring-rose-500" />
                    </div>
                    <div className="space-y-1">
                      <label className="text-[9px] font-black text-slate-400 uppercase ml-1">SKU</label>
                      <select 
                        value={inventoryOutForm.sku || ''} 
                        onChange={e => {
                          const sku = e.target.value;
                          const skuData = shopeeSourceData.find(s => s.sku === sku);
                          setInventoryOutForm({
                            ...inventoryOutForm, 
                            sku, 
                            salePrice: skuData?.salePrice || 0,
                            customerPaid: skuData?.salePrice || 0
                          });
                        }} 
                        className="w-full bg-slate-50 border border-slate-100 rounded-lg px-3 py-2 text-[10px] font-bold focus:outline-none focus:ring-1 focus:ring-rose-500"
                      >
                        <option value="">Chọn SKU</option>
                        {shopeeSourceData.map(s => <option key={s.id} value={s.sku}>{s.sku}</option>)}
                      </select>
                    </div>
                    <div className="space-y-1">
                      <label className="text-[9px] font-black text-slate-400 uppercase ml-1">Số lượng</label>
                      <input type="number" value={inventoryOutForm.quantity || 0} onChange={e => setInventoryOutForm({...inventoryOutForm, quantity: Number(e.target.value)})} className="w-full bg-slate-50 border border-slate-100 rounded-lg px-3 py-2 text-[10px] font-bold focus:outline-none focus:ring-1 focus:ring-rose-500" />
                    </div>
                    <div className="space-y-1">
                      <label className="text-[9px] font-black text-slate-400 uppercase ml-1">Giá bán</label>
                      <input type="number" value={inventoryOutForm.salePrice || 0} onChange={e => setInventoryOutForm({...inventoryOutForm, salePrice: Number(e.target.value)})} className="w-full bg-slate-50 border border-slate-100 rounded-lg px-3 py-2 text-[10px] font-bold focus:outline-none focus:ring-1 focus:ring-rose-500" />
                    </div>
                    <div className="space-y-1">
                      <label className="text-[9px] font-black text-slate-400 uppercase ml-1">Khách trả</label>
                      <input type="number" value={inventoryOutForm.customerPaid || 0} onChange={e => setInventoryOutForm({...inventoryOutForm, customerPaid: Number(e.target.value)})} className="w-full bg-slate-50 border border-slate-100 rounded-lg px-3 py-2 text-[10px] font-bold focus:outline-none focus:ring-1 focus:ring-rose-500" />
                    </div>
                    <div className="space-y-1">
                      <label className="text-[9px] font-black text-slate-400 uppercase ml-1">Phí sàn (đ)</label>
                      <input type="number" value={inventoryOutForm.platformFee ?? 0} onChange={e => setInventoryOutForm({...inventoryOutForm, platformFee: Number(e.target.value)})} className="w-full bg-slate-50 border border-slate-100 rounded-lg px-3 py-2 text-[10px] font-bold focus:outline-none focus:ring-1 focus:ring-rose-500" />
                    </div>
                    <div className="space-y-1">
                      <label className="text-[9px] font-black text-slate-400 uppercase ml-1">Phí thanh toán (đ)</label>
                      <input type="number" value={inventoryOutForm.paymentFee ?? 0} onChange={e => setInventoryOutForm({...inventoryOutForm, paymentFee: Number(e.target.value)})} className="w-full bg-slate-50 border border-slate-100 rounded-lg px-3 py-2 text-[10px] font-bold focus:outline-none focus:ring-1 focus:ring-rose-500" />
                    </div>
                    <div className="space-y-1">
                      <label className="text-[9px] font-black text-slate-400 uppercase ml-1">Freeship Extra (đ)</label>
                      <input type="number" value={inventoryOutForm.freeshipExtra ?? 0} onChange={e => setInventoryOutForm({...inventoryOutForm, freeshipExtra: Number(e.target.value)})} className="w-full bg-slate-50 border border-slate-100 rounded-lg px-3 py-2 text-[10px] font-bold focus:outline-none focus:ring-1 focus:ring-rose-500" />
                    </div>
                    <div className="space-y-1">
                      <label className="text-[9px] font-black text-slate-400 uppercase ml-1">Phí Affiliate (đ)</label>
                      <input type="number" value={inventoryOutForm.affiliateFee ?? 0} onChange={e => setInventoryOutForm({...inventoryOutForm, affiliateFee: Number(e.target.value)})} className="w-full bg-slate-50 border border-slate-100 rounded-lg px-3 py-2 text-[10px] font-bold focus:outline-none focus:ring-1 focus:ring-rose-500" />
                    </div>
                  </div>
                  
                  <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-6 gap-3">
                    <div className="space-y-1">
                      <label className="text-[9px] font-black text-slate-400 uppercase ml-1">Nền tảng</label>
                      <select value={inventoryOutForm.platform || 'Shopee 2'} onChange={e => setInventoryOutForm({...inventoryOutForm, platform: e.target.value})} className="w-full bg-slate-50 border border-slate-100 rounded-lg px-3 py-2 text-[10px] font-bold focus:outline-none focus:ring-1 focus:ring-rose-500">
                        <option value="Shopee 1">Shopee 1</option>
                        <option value="Shopee 2">Shopee 2</option>
                        <option value="Lazada">Lazada</option>
                        <option value="TikTok">TikTok</option>
                      </select>
                    </div>
                    <div className="space-y-1">
                      <label className="text-[9px] font-black text-slate-400 uppercase ml-1">ĐVVC</label>
                      <select value={inventoryOutForm.shippingUnit || 'GHN'} onChange={e => setInventoryOutForm({...inventoryOutForm, shippingUnit: e.target.value})} className="w-full bg-slate-50 border border-slate-100 rounded-lg px-3 py-2 text-[10px] font-bold focus:outline-none focus:ring-1 focus:ring-rose-500">
                        <option value="GHN">GHN</option>
                        <option value="SPX">SPX</option>
                        <option value="GHTK">GHTK</option>
                        <option value="J&T">J&T</option>
                      </select>
                    </div>
                    <div className="lg:col-span-3 space-y-1">
                      <label className="text-[9px] font-black text-slate-400 uppercase ml-1">Địa chỉ (Tỉnh/Thành)</label>
                      <input type="text" placeholder="VD: ĐÀ NẴNG" value={inventoryOutForm.address || ''} onChange={e => setInventoryOutForm({...inventoryOutForm, address: e.target.value})} className="w-full bg-slate-50 border border-slate-100 rounded-lg px-3 py-2 text-[10px] font-bold focus:outline-none focus:ring-1 focus:ring-rose-500" />
                    </div>
                    <div className="flex items-end">
                      <button 
                        onClick={handleAddInventoryOut}
                        className={`w-full ${editingInventoryOutId ? 'bg-indigo-600 hover:bg-indigo-700' : 'bg-rose-600 hover:bg-rose-700'} text-white py-2 rounded-lg font-black text-[9px] uppercase tracking-widest transition-all shadow-lg flex items-center justify-center gap-2`}
                      >
                        <Save className="w-3.5 h-3.5" /> {editingInventoryOutId ? 'Cập nhật' : 'Ghi nhận'}
                      </button>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>

          <div className="space-y-0 border border-slate-200 shadow-xl overflow-hidden bg-white rounded-2xl">
            {/* 2. Scrollable Container for both Summary and Table */}
            <div className="overflow-x-auto overflow-y-auto max-h-[800px] no-scrollbar relative flex flex-col">
              <table className="w-full text-left border-collapse min-w-[2200px] text-[11px] relative">
                <thead className="sticky top-0 z-30">
                  {/* Totals Row with Title */}
                  <tr className="bg-rose-600 text-white font-black tabular-nums border-b border-rose-500">
                    <td colSpan={8} className="p-4 border-r border-white/20">
                      <div className="flex items-center justify-between gap-3">
                        <div className="flex items-center gap-3">
                          <ArrowUpFromLine className="w-5 h-5" />
                          <h3 className="text-lg font-black uppercase tracking-tighter">THEO DÕI ĐƠN HÀNG {dynamicTitle}</h3>
                        </div>
                        {clearAllConfirm ? (
                          <div className="flex items-center gap-2">
                             <button 
                              onClick={handleClearAllInventoryOut}
                              className="bg-rose-500 hover:bg-rose-600 text-white text-[10px] px-3 py-1.5 rounded-lg flex items-center gap-1 transition-all shadow-lg animate-pulse"
                            >
                              <Check className="w-3.5 h-3.5" /> XÁC NHẬN XOÁ HẾT
                            </button>
                            <button 
                              onClick={() => setClearAllConfirm(false)}
                              className="bg-slate-500 hover:bg-slate-600 text-white text-[10px] px-3 py-1.5 rounded-lg flex items-center gap-1 transition-all"
                            >
                              <X className="w-3.5 h-3.5" /> HUỶ
                            </button>
                          </div>
                        ) : (
                          <button 
                            onClick={() => setClearAllConfirm(true)}
                            className="bg-white/10 hover:bg-white/30 text-[10px] px-4 py-2 rounded-xl flex items-center gap-2 transition-all border border-white/20 group cursor-pointer"
                          >
                            <Trash2 className="w-4 h-4 text-white" />
                            <span>XOÁ TOÀN BỘ</span>
                          </button>
                        )}
                      </div>
                    </td>
                    <td className="p-2 border-r border-white/20 text-center">{shopeeInventoryOut.reduce((sum, i) => sum + i.quantity, 0)}</td>
                    <td className="p-2 border-r border-white/20 text-right">{formatNumber(shopeeInventoryOut.reduce((sum, i) => sum + i.salePrice, 0))} đ</td>
                    <td className="p-2 border-r border-white/20 text-right">{formatNumber(shopeeInventoryOut.reduce((sum, i) => sum + i.customerPaid, 0))} đ</td>
                    <td className="p-2 border-r border-white/20 text-right">{formatNumber(shopeeInventoryOut.reduce((sum, i) => sum + i.platformFee, 0))} đ</td>
                    <td className="p-2 border-r border-white/20 text-right">{formatNumber(shopeeInventoryOut.reduce((sum, i) => sum + i.paymentFee, 0))} đ</td>
                    <td className="p-2 border-r border-white/20 text-right">{formatNumber(shopeeInventoryOut.reduce((sum, i) => sum + i.freeshipExtra, 0))} đ</td>
                    <td className="p-2 border-r border-white/20 text-right">{formatNumber(shopeeInventoryOut.reduce((sum, i) => sum + i.affiliateFee, 0))} đ</td>
                    <td className="p-2 border-r border-white/20 text-right">{formatNumber(shopeeInventoryOut.reduce((sum, i) => sum + (i.salePrice - i.platformFee - i.paymentFee - i.freeshipExtra - i.affiliateFee), 0))} đ</td>
                    <td className="p-2 border-r border-white/20 text-right">{formatNumber(shopeeInventoryOut.reduce((sum, i) => sum + i.handlingFee, 0))} đ</td>
                    <td className="p-2 border-r border-white/20 text-right">{formatNumber(shopeeInventoryOut.reduce((sum, i) => sum + i.adsCost, 0))} đ</td>
                    <td className="p-2 border-r border-white/20 text-right">{formatNumber(shopeeInventoryOut.reduce((sum, i) => sum + i.adsTax, 0))} đ</td>
                    <td className="p-2 border-r border-white/20 text-right">{formatNumber(shopeeInventoryOut.reduce((sum, i) => sum + i.personalIncomeTax, 0))} đ</td>
                    <td className="p-2 border-r border-white/20 text-right">{formatNumber(shopeeInventoryOut.reduce((sum, i) => sum + i.netProfit, 0))} đ</td>
                    <td className="p-2 border-r border-white/20"></td>
                    <td className="p-2 border-r border-white/20"></td>
                    <td className="p-2 border-r border-white/20"></td>
                    <td className="p-2 border-r border-white/20"></td>
                    <td className="p-2 border-r border-white/20"></td>
                  </tr>
                  {/* Percentage Row */}
                  <tr className="bg-white border-b border-slate-200 font-bold text-rose-500 tabular-nums text-[10px]">
                    <td className="p-2 border-r border-slate-200 bg-slate-50"></td>
                    <td className="p-2 border-r border-slate-200"></td>
                    <td className="p-2 border-r border-slate-200"></td>
                    <td className="p-2 border-r border-slate-200"></td>
                    <td className="p-2 border-r border-slate-200"></td>
                    <td className="p-2 border-r border-slate-200"></td>
                    <td className="p-2 border-r border-slate-200"></td>
                    <td className="p-2 border-r border-slate-200"></td>
                    <td className="p-2 border-r border-slate-200"></td>
                    <td className="p-2 border-r border-slate-200"></td>
                    <td className="p-2 border-r border-slate-200"></td>
                    <td className="p-2 border-r border-slate-200 text-center">
                      {shopeeTotals.platformFeeRatio.toFixed(1)}%
                    </td>
                    <td className="p-2 border-r border-slate-200 text-center bg-blue-50 border-2 border-blue-500">
                      {shopeeTotals.paymentFeeRatio.toFixed(1)}%
                    </td>
                    <td className="p-2 border-r border-slate-200 text-center">
                      {shopeeTotals.freeshipExtraRatio.toFixed(1)}%
                    </td>
                    <td className="p-2 border-r border-slate-200 text-center">
                      {shopeeTotals.affiliateFeeRatio.toFixed(1)}%
                    </td>
                    <td className="p-2 border-r border-slate-200 text-center">
                      {(100 - (
                        (shopeeCosts?.platformFeePercent || 0) + 
                        (shopeeCosts?.paymentFeePercent || 0) + 
                        (shopeeCosts?.freeshipExtraPercent || 0) + 
                        (shopeeCosts?.affiliateFeePercent || 0)
                      )).toFixed(1)}%
                    </td>
                    <td className="p-2 border-r border-slate-200 text-center">{formatNumber(totalVariableCosts)} đ</td>
                    <td className="p-2 border-r border-slate-200 text-center">{shopeeTotals.adsRatio.toFixed(1)}%</td>
                    <td className="p-2 border-r border-slate-200 text-center">
                      <input 
                        type="number" 
                        value={shopeeCosts?.adsTaxPercent || 0} 
                        onChange={e => onUpdateShopeeCosts?.({...shopeeCosts!, adsTaxPercent: Number(e.target.value)})}
                        className="w-8 bg-slate-50 text-center focus:outline-none focus:ring-1 focus:ring-rose-500 rounded"
                      />%
                    </td>
                    <td className="p-2 border-r border-slate-200 text-center">
                      <input 
                        type="number" 
                        value={shopeeCosts?.taxPercent || 0} 
                        onChange={e => onUpdateShopeeCosts?.({...shopeeCosts!, taxPercent: Number(e.target.value)})}
                        className="w-8 bg-slate-50 text-center focus:outline-none focus:ring-1 focus:ring-rose-500 rounded"
                      />%
                    </td>
                    <td className="p-2 border-r border-slate-200 text-center">{shopeeTotals.profitMargin.toFixed(1)}%</td>
                    <td className="p-2 border-r border-slate-200"></td>
                    <td className="p-2 border-r border-slate-200"></td>
                    <td className="p-2 border-r border-slate-200"></td>
                    <td className="p-2 border-r border-slate-200"></td>
                  </tr>
                  {/* Header Row */}
                  <tr className="bg-yellow-400 text-black font-bold border-b border-slate-300 sticky top-[calc(100%)]">
                  <th className="p-3 border-r border-slate-300 w-12 text-center">STT</th>
                  <th className="p-3 border-r border-slate-300 w-40 text-center">Tình Trạng</th>
                  <th className="p-3 border-r border-slate-300 w-32 text-center">Ngày gửi</th>
                  <th className="p-3 border-r border-slate-300 w-32 text-center">Số đơn/ngày</th>
                  <th className="p-3 border-r border-slate-300 w-32 text-center">Nền tảng</th>
                  <th className="p-3 border-r border-slate-300 w-48 text-center">Mã Vận Đơn</th>
                  <th className="p-3 border-r border-slate-300 w-40 text-center">SKU Biến Thể</th>
                  <th className="p-3 border-r border-slate-300 w-60 text-center">Tên Sản Phẩm</th>
                  <th className="p-3 border-r border-slate-300 w-20 text-center">Số lượng</th>
                  <th className="p-3 border-r border-slate-300 w-32 text-center">Giá trị hàng</th>
                  <th className="p-3 border-r border-slate-300 w-32 text-center">Khách Thanh Toán</th>
                  <th className="p-3 border-r border-slate-300 w-32 text-center">Phí Sàn</th>
                  <th className="p-3 border-r border-slate-300 w-32 text-center">Phí thanh toán</th>
                  <th className="p-3 border-r border-slate-300 w-32 text-center">Freeship Extra</th>
                  <th className="p-3 border-r border-slate-300 w-32 text-center">Phi Affiliate</th>
                  <th className="p-3 border-r border-slate-300 w-32 text-center">Sàn Thanh Toán</th>
                  <th className="p-3 border-r border-slate-300 w-32 text-center">Phí vận hành</th>
                  <th className="p-3 border-r border-slate-300 w-32 text-center">Quảng cáo</th>
                  <th className="p-3 border-r border-slate-300 w-32 text-center">Thuế QC</th>
                  <th className="p-3 border-r border-slate-300 w-32 text-center">Thuế TNCN</th>
                  <th className="p-3 border-r border-slate-300 w-32 text-center">Lợi Nhuận</th>
                  <th className="p-3 border-r border-slate-300 w-40 text-center">Địa chỉ</th>
                  <th className="p-3 border-r border-slate-300 w-32 text-center">ĐVVC</th>
                  <th className="p-3 border-r border-slate-300 w-32 text-center">LÃI/LỖ</th>
                  <th className="p-3 border-r border-slate-300 w-32 text-center">Hành động</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-200 tabular-nums">
                {shopeeInventoryOut.length > 0 ? shopeeInventoryOut.map((item, idx) => (
                  <tr key={item.id} className="hover:bg-slate-50 transition-all group border-b border-slate-200">
                    <td className="p-2 border-r border-slate-200 text-center font-bold text-slate-500">{idx + 1}</td>
                    <td className="p-2 border-r border-slate-200">
                      <div className="flex items-center gap-1 bg-emerald-700 text-white px-2 py-1 rounded-md text-[10px] font-black cursor-pointer">
                        <span>{item.status === 'OK' ? 'OK' : item.status}</span>
                        <ArrowDownToLine className="w-3 h-3 rotate-180" />
                      </div>
                    </td>
                    <td className="p-2 border-r border-slate-200 text-center">{(item.shipDate || item.date).split('-').reverse().join('/')}</td>
                    <td className="p-2 border-r border-slate-200 text-center font-bold">{item.dailyOrderIndex || 1}</td>
                    <td className="p-2 border-r border-slate-200">
                      <div className="flex items-center justify-between bg-orange-200 text-orange-800 px-2 py-1 rounded-md text-[10px] font-black cursor-pointer">
                        <span>{item.platform || 'Shopee 2'}</span>
                        <ArrowDownToLine className="w-3 h-3 rotate-180" />
                      </div>
                    </td>
                    <td className="p-2 border-r border-slate-200 font-mono text-indigo-600">
                      <div className="flex flex-col">
                        <span className="text-[9px] font-bold text-slate-500 uppercase tracking-tighter text-indigo-400">Vận Đơn</span>
                        <span className="truncate max-w-[150px]">{item.trackingNumber || '-'}</span>
                      </div>
                    </td>
                    <td className="p-2 border-r border-slate-200">
                      <div className="flex items-center justify-between bg-slate-100 text-slate-800 px-2 py-1 rounded-md text-[10px] font-black cursor-pointer">
                        <span>{item.sku}</span>
                        <ArrowDownToLine className="w-3 h-3 rotate-180" />
                      </div>
                    </td>
                    <td className="p-2 border-r border-slate-200 text-slate-500 truncate max-w-[200px]">{item.productName || '-'}</td>
                    <td className="p-2 border-r border-slate-200 text-center font-bold">{item.quantity}</td>
                    <td className="p-2 border-r border-slate-200 text-right font-bold">{formatNumber(item.salePrice)} đ</td>
                    <td className="p-2 border-r border-slate-200 text-right font-bold">{formatNumber(item.customerPaid)} đ</td>
                    <td className="p-2 border-r border-slate-200 text-right text-slate-500">{formatNumber(item.platformFee)} đ</td>
                    <td className="p-2 border-r border-slate-200 text-right text-slate-500">{formatNumber(item.paymentFee)} đ</td>
                    <td className="p-2 border-r border-slate-200 text-right text-slate-500">{formatNumber(item.freeshipExtra)} đ</td>
                    <td className="p-2 border-r border-slate-200 text-right text-slate-500">{formatNumber(item.affiliateFee)} đ</td>
                    <td className="p-2 border-r border-slate-200 text-right font-bold text-slate-700 bg-slate-50">{formatNumber(item.salePrice - item.platformFee - item.paymentFee - item.freeshipExtra - item.affiliateFee)} đ</td>
                    <td className="p-2 border-r border-slate-200 text-right text-slate-500">{formatNumber(item.handlingFee)} đ</td>
                    <td className="p-2 border-r border-slate-200 text-right text-slate-500">{formatNumber(item.adsCost)} đ</td>
                    <td className="p-2 border-r border-slate-200 text-right text-slate-500">{formatNumber(item.adsTax)} đ</td>
                    <td className="p-2 border-r border-slate-200 text-right text-slate-500">{formatNumber(item.personalIncomeTax)} đ</td>
                    <td className={`p-2 border-r border-slate-200 text-right font-black ${item.netProfit >= 0 ? 'text-emerald-700' : 'text-rose-600'}`}>{formatNumber(item.netProfit)} đ</td>
                    <td className="p-2 border-r border-slate-200 text-slate-500 uppercase">{item.address || '-'}</td>
                    <td className="p-2 border-r border-slate-200">
                      <div className="flex items-center justify-between bg-slate-100 text-slate-800 px-2 py-1 rounded-md text-[10px] font-black cursor-pointer">
                        <span>{item.shippingUnit || 'GHN'}</span>
                        <ArrowDownToLine className="w-3 h-3 rotate-180" />
                      </div>
                    </td>
                    <td className="p-2 border-r border-slate-200">
                      <div className={`flex items-center justify-between px-2 py-1 rounded-md text-[10px] font-black cursor-pointer ${item.netProfit >= 0 ? 'bg-emerald-700 text-white' : 'bg-rose-700 text-white'}`}>
                        <span>{item.profitStatus || (item.netProfit >= 0 ? 'LÃI 2' : 'LỖ 1')}</span>
                        <ArrowDownToLine className="w-3 h-3 rotate-180" />
                      </div>
                    </td>
                    <td className="p-2 border-r border-slate-200">
                      <div className="flex items-center justify-center gap-2">
                        {deleteConfirmId === item.id ? (
                          <div className="flex items-center gap-1">
                            <button 
                              onClick={() => handleRemoveInventoryOut(item.id)}
                              className="p-1 bg-rose-600 text-white rounded hover:bg-rose-700 transition-colors shadow-sm"
                              title="Xác nhận xoá"
                            >
                              <Check className="w-3 h-3" />
                            </button>
                            <button 
                              onClick={() => setDeleteConfirmId(null)}
                              className="p-1 bg-slate-400 text-white rounded hover:bg-slate-500 transition-colors shadow-sm"
                              title="Huỷ"
                            >
                              <X className="w-3 h-3" />
                            </button>
                          </div>
                        ) : (
                          <>
                            <button 
                              onClick={() => handleEditInventoryOut(item)}
                              className="p-1.5 bg-indigo-50 text-indigo-600 rounded-md hover:bg-indigo-600 hover:text-white transition-all shadow-sm cursor-pointer"
                              title="Sửa"
                            >
                              <Pencil className="w-3.5 h-3.5" />
                            </button>
                            <button 
                              onClick={() => setDeleteConfirmId(item.id)}
                              className="p-1.5 bg-rose-50 text-rose-600 rounded-md hover:bg-rose-600 hover:text-white transition-all shadow-sm cursor-pointer"
                              title="Xoá"
                            >
                              <Trash2 className="w-3.5 h-3.5" />
                            </button>
                          </>
                        )}
                      </div>
                    </td>
                  </tr>
                )) : (
                  <tr>
                    <td colSpan={24} className="p-20 text-center text-slate-400 font-bold uppercase tracking-widest">Chưa có dữ liệu xuất kho</td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
      </div>
      )}

      {isShopee && activeSubTab === 'report' && (
        <div className="bg-white rounded-[2.5rem] p-8 md:p-12 border border-slate-200 shadow-xl space-y-8">
          <div className="flex items-center justify-between border-b border-slate-100 pb-8">
            <div className="flex items-center gap-4">
              <div className="p-3 bg-indigo-600 rounded-2xl text-white shadow-lg"><ClipboardList className="w-6 h-6" /></div>
              <div>
                <h3 className="text-xl font-black text-slate-900 uppercase tracking-tight">Báo cáo tổng hợp sản phẩm</h3>
                <p className="text-[10px] text-slate-400 font-bold uppercase tracking-widest">Hiệu quả kinh doanh theo từng mã hàng</p>
              </div>
            </div>
            <div className="px-6 py-3 bg-slate-50 rounded-2xl border border-slate-100">
              <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Khoảng lọc: </span>
              <span className="text-xs font-black text-slate-900 ml-2">
                {timeContext.start.split('-').reverse().join('/')} → {timeContext.end.split('-').reverse().join('/')}
              </span>
            </div>
          </div>
          
          <div className="overflow-x-auto rounded-2xl border border-slate-100">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="bg-slate-50 text-[10px] font-black text-slate-500 uppercase tracking-widest border-b border-slate-200">
                  <th className="p-6">Mã sản phẩm</th>
                  <th className="p-6 text-right">Số lượng bán</th>
                  <th className="p-6 text-right">Doanh thu thuần</th>
                  <th className="p-6 text-right">Giá vốn tổng</th>
                  <th className="p-6 text-right">Phí sàn tổng</th>
                  <th className="p-6 text-right">Quảng cáo tổng</th>
                  <th className="p-6 text-right font-black bg-emerald-50 text-emerald-800">Lợi nhuận ròng</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-50 text-xs font-bold tabular-nums">
                {shopeeSourceData.length > 0 ? shopeeSourceData.map(skuItem => {
                  const skuOrders = shopeeInventoryOut.filter(o => o.sku === skuItem.sku && o.date >= timeContext.start && o.date <= timeContext.end);
                  const totalQty = skuOrders.reduce((sum, o) => sum + o.quantity, 0);
                  const totalRev = skuOrders.reduce((sum, o) => sum + o.salePrice, 0);
                  const totalCogs = totalQty * skuItem.importPrice;
                  const totalFees = skuOrders.reduce((sum, o) => sum + o.platformFee + o.paymentFee + o.freeshipExtra + o.handlingFee + o.affiliateFee, 0);
                  const totalAds = skuOrders.reduce((sum, o) => sum + o.adsCost + o.adsTax, 0);
                  const totalProfit = skuOrders.reduce((sum, o) => sum + o.netProfit, 0);

                  return (
                    <tr key={skuItem.id} className="hover:bg-slate-50 transition-all">
                      <td className="p-6 font-black uppercase text-slate-900">{skuItem.sku}</td>
                      <td className="p-6 text-right text-blue-600">{totalQty.toLocaleString()}</td>
                      <td className="p-6 text-right">{formatNumber(totalRev)}đ</td>
                      <td className="p-6 text-right text-slate-400">{formatNumber(totalCogs)}đ</td>
                      <td className="p-6 text-right text-amber-600">{formatNumber(totalFees)}đ</td>
                      <td className="p-6 text-right text-rose-400">{formatNumber(totalAds)}đ</td>
                      <td className={`p-6 text-right font-black bg-emerald-50/30 ${totalProfit > 0 ? 'text-emerald-700' : 'text-rose-600'}`}>{formatNumber(totalProfit)}đ</td>
                    </tr>
                  );
                }) : (
                  <tr>
                    <td colSpan={7} className="p-20 text-center text-slate-400 font-bold uppercase tracking-widest">Chưa có dữ liệu báo cáo</td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {activeSubTab === 'ledger' && !isShopee && (
        <div className="space-y-6 animate-in slide-in-from-bottom-4 duration-500">
          <div className="grid grid-cols-1 lg:grid-cols-10 gap-6">
            <div className="lg:col-span-4 bg-white rounded-[2.5rem] border-2 border-dashed border-slate-200 hover:border-blue-400 hover:bg-blue-50/20 transition-all p-10 shadow-sm relative group flex flex-col items-center justify-center text-center">
              <input type="file" accept=".csv, .xlsx, .xls" ref={fileInputRef} className="hidden" onChange={handleFileUpload} />
              <button onClick={() => fileInputRef.current?.click()} className="w-20 h-20 rounded-full bg-slate-50 flex items-center justify-center border-2 border-dashed border-slate-200 group-hover:border-blue-300 group-hover:bg-white transition-all shadow-sm mb-6"><Upload className="w-8 h-8 text-blue-600" /></button>
              <h3 className="text-sm font-black text-slate-900 uppercase tracking-widest">Đồng bộ Báo cáo KiotViet</h3>
            </div>
            <div className="lg:col-span-6 bg-white p-8 rounded-[2.5rem] border border-slate-200 shadow-xl">
              <h3 className="text-xs font-black text-slate-900 mb-6 flex items-center gap-3"><div className="p-2 bg-blue-600 rounded-lg text-white"><Plus className="w-3.5 h-3.5" /></div> NHẬP NHANH DOANH THU</h3>
              <form onSubmit={handleAdd} className="space-y-4">
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                  <InputWrapper label="Thời gian" icon={Calendar}><input type="date" required value={formData.date} onChange={e => setFormData({...formData, date: e.target.value})} className="input-field py-2.5 font-bold text-[10px] border-none" /></InputWrapper>
                  <InputWrapper label="Tiền hàng" icon={DollarSign} color="text-blue-600"><input type="number" placeholder="0" required value={formData.totalGrossRevenue} onChange={e => setFormData({...formData, totalGrossRevenue: e.target.value})} className="input-field py-2.5 font-bold text-[10px] border-none" /></InputWrapper>
                  <InputWrapper label="Giảm giá" icon={Tag} color="text-rose-500"><input type="number" placeholder="0" value={formData.discount} onChange={e => setFormData({...formData, discount: e.target.value})} className="input-field py-2.5 font-bold text-[10px] border-none" /></InputWrapper>
                </div>
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                  <InputWrapper label="Giá trị trả" icon={ArrowRightLeft} color="text-amber-500"><input type="number" placeholder="0" value={formData.returnsValue} onChange={e => setFormData({...formData, returnsValue: e.target.value})} className="input-field py-2.5 font-bold text-[10px] border-none" /></InputWrapper>
                  <InputWrapper label="Doanh thu khác" icon={HandCoins} color="text-indigo-500"><input type="number" placeholder="0" value={formData.revenueOther} onChange={e => setFormData({...formData, revenueOther: e.target.value})} className="input-field py-2.5 font-bold text-[10px] border-none" /></InputWrapper>
                  <InputWrapper label="Giá vốn" icon={ShoppingCart} color="text-rose-600"><input type="number" placeholder="0" required value={formData.totalCogs} onChange={e => setFormData({...formData, totalCogs: e.target.value})} className="input-field py-2.5 font-bold text-[10px] border-none" /></InputWrapper>
                </div>
                <button 
                  type="submit" 
                  disabled={isSaving}
                  className={`w-full py-3.5 rounded-xl font-black text-[9px] uppercase tracking-widest transition-all shadow-xl flex items-center justify-center gap-2 ${
                    isSaving ? 'bg-slate-400 cursor-not-allowed' : 'bg-slate-900 hover:bg-black text-white'
                  }`}
                >
                  {isSaving ? (
                    <>
                      <Loader2 className="w-3.5 h-3.5 animate-spin" />
                      ĐANG ĐỒNG BỘ CLOUD...
                    </>
                  ) : (
                    'GHI NHẬN DOANH THU'
                  )}
                </button>
              </form>
            </div>
          </div>

          <div className="bg-white rounded-[2.5rem] border border-slate-200 shadow-xl overflow-hidden relative flex flex-col max-h-[800px]">
            <div className="px-8 py-6 bg-slate-50 border-b border-slate-100 flex flex-col xl:flex-row justify-between items-start xl:items-center gap-6 sticky top-0 z-20">
              <div className="flex items-center gap-4"><div className="p-2.5 bg-white border border-slate-100 rounded-xl text-slate-400 shadow-sm"><FileSpreadsheet className="w-5 h-5" /></div><h3 className="text-sm font-black text-slate-900 uppercase tracking-tight">Sổ cái Doanh thu Đã lọc</h3></div>
              <div className="px-6 py-2.5 bg-white border border-slate-200 rounded-xl font-black text-[9px] uppercase tracking-widest">
                 Dữ liệu: {timeContext.start.split('-').reverse().join('/')} → {timeContext.end.split('-').reverse().join('/')}
              </div>
            </div>
            <div className="overflow-x-auto overflow-y-auto flex-1 no-scrollbar scroll-smooth">
              <table className="w-full text-left border-collapse table-fixed min-w-[1200px] relative">
                <thead className="sticky top-0 z-10 bg-slate-50 shadow-sm">
                  <tr className="text-[9px] font-black text-slate-400 uppercase tracking-tighter bg-slate-50 border-b border-slate-100">
                  <th className="px-6 py-6 w-[120px] bg-slate-50/30">Thời gian</th>
                  <th className="px-1 py-6 text-right text-blue-600">Tổng tiền hàng</th>
                  <th className="px-1 py-6 text-right text-rose-500">Giảm giá</th>
                  <th className="px-1 py-6 text-right text-amber-600">Giá trị trả</th>
                  <th className="px-1 py-6 text-right font-black bg-blue-50/50 text-blue-800">Doanh thu</th>
                  <th className="px-1 py-6 text-right text-indigo-500">Doanh thu khác</th>
                  <th className="px-1 py-6 text-right text-rose-600">Tổng giá vốn</th>
                  <th className="px-1 py-6 text-right font-black bg-emerald-50 text-emerald-800">Lợi nhuận gộp</th>
                  <th className="px-1 py-6 text-center w-[60px] bg-slate-50/30">Xóa</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-50 tabular-nums text-[11px] font-bold">
                {filteredListByRange.map(item => (
                  <tr key={item.id} className="group hover:bg-slate-50/80 transition-all odd:bg-white even:bg-slate-50/30">
                    <td className="px-6 py-5 text-slate-900 bg-slate-50/20">{item.date ? item.date.split('-').reverse().join('/') : 'N/A'}</td>
                    <td className="px-1 py-5 text-right text-blue-600">{formatNumber(item.totalGrossRevenue)}</td>
                    <td className="px-1 py-5 text-right text-rose-400">{formatNumber(Math.abs(item.discount))}</td>
                    <td className="px-1 py-5 text-right text-amber-500">{formatNumber(Math.abs(item.returnsValue))}</td>
                    <td className="px-1 py-5 text-right font-black text-blue-900 bg-blue-50/40">{formatNumber(item.netRevenue)}</td>
                    <td className="px-1 py-5 text-right text-indigo-600">{formatNumber(item.revenueOther)}</td>
                    <td className="px-1 py-5 text-right text-rose-500">{formatNumber(Math.abs(item.totalCogs))}</td>
                    <td className="px-1 py-5 text-right font-black text-emerald-700 bg-emerald-50/40">{formatNumber(item.grossProfit)}</td>
                    <td className="px-1 py-5 text-center bg-slate-50/20"><button onClick={() => onUpdate(list.filter(i => i.id !== item.id), item.id)} className="p-2 text-slate-200 hover:text-rose-500 opacity-0 group-hover:opacity-100 transition-all"><Trash2 className="w-4 h-4" /></button></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </div>
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

const MetricCard = ({ title, value, icon: Icon, color, desc }: any) => {
  const colorMap: any = { indigo: 'bg-indigo-50 text-indigo-600', rose: 'bg-rose-50 text-rose-600', emerald: 'bg-emerald-50 text-emerald-600', amber: 'bg-amber-50 text-amber-600', sky: 'bg-sky-50 text-sky-600' };
  return (
    <motion.div 
      initial={{ opacity: 0, y: 15 }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once: true }}
      className="bg-white p-8 rounded-[2.5rem] border border-slate-200 shadow-xl flex flex-col justify-between transition-all hover:scale-[1.02] active:scale-95 duration-300"
    >
      <div>
        <div className={`p-4 rounded-2xl ${colorMap[color]} w-fit mb-6 shadow-sm`}><Icon className="w-6 h-6" /></div>
        <p className="text-[9px] font-black text-slate-400 uppercase tracking-widest mb-1">{title}</p>
        <h4 className="text-xl font-black text-slate-900 tabular-nums">{value}</h4>
      </div>
      <p className="text-[8px] font-black text-slate-400 uppercase tracking-tighter mt-4 pt-4 border-t border-slate-50 leading-relaxed">{desc}</p>
    </motion.div>
  );
};

const InputWrapper = ({ label, icon: Icon, children, color = "text-slate-400" }: any) => (
  <div className="space-y-1.5">
    <label className="text-[9px] font-black text-slate-400 uppercase tracking-widest ml-1">{label}</label>
    <div className="relative bg-slate-50 border border-slate-100 focus-within:bg-white focus-within:border-blue-500 rounded-xl transition-all shadow-inner overflow-hidden flex items-center">
      <Icon className={`absolute left-3 w-3.5 h-3.5 ${color}`} />
      <div className="pl-9 w-full">{children}</div>
    </div>
  </div>
);

export default RevenueManager;
