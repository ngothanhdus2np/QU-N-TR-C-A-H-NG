import { useState, useRef, useMemo, type ChangeEvent } from 'react';
import * as XLSX from 'xlsx';
import {
  ShopeeInventoryOutRecord,
  ShopeeSourceItem,
  ShopeeCostConfig,
  AppDataSurgicalUpdate,
} from '../../types';
import { cleanVNNumber, parseVNDate, normalizeHeader, generateId } from '../../src/lib';

// Chuẩn hóa tên đơn vị vận chuyển từ tên đầy đủ Shopee sang tên viết tắt
const SHIPPING_UNIT_MAP: [string, string][] = [
  ['giao hang nhanh', 'GHN'],
  ['giao hàng nhanh', 'GHN'],
  ['giao hang tiet kiem', 'GHTK'],
  ['giao hàng tiết kiệm', 'GHTK'],
  ['spx', 'SPX'],
  ['j&t', 'J&T'],
  ['ninja van', 'NJV'],
  ['ninjavan', 'NJV'],
];

function normalizeShippingUnit(raw: string): string {
  if (!raw) return '';
  const lower = raw.toLowerCase().trim();
  for (const [key, val] of SHIPPING_UNIT_MAP) {
    if (lower.includes(key)) return val;
  }
  return raw;
}

interface UseShopeeInventoryOutProps {
  shopeeInventoryOut: ShopeeInventoryOutRecord[];
  shopeeSourceData: ShopeeSourceItem[];
  shopeeCosts: ShopeeCostConfig | undefined;
  dailyAdsConfig: Record<string, number>;
  onUpdateShopeeInventoryOut: ((list: ShopeeInventoryOutRecord[]) => Promise<void>) | undefined;
  onUpdateShopeeCosts: ((costs: ShopeeCostConfig) => Promise<void>) | undefined;
  onUpdateDailyAdsConfig: ((config: Record<string, number>) => Promise<void>) | undefined;
  onUpdateSurgical: ((updates: AppDataSurgicalUpdate[]) => Promise<void>) | undefined;
}

export function useShopeeInventoryOut({
  shopeeInventoryOut,
  shopeeSourceData,
  shopeeCosts,
  dailyAdsConfig,
  onUpdateShopeeInventoryOut,
  onUpdateShopeeCosts,
  onUpdateDailyAdsConfig,
  onUpdateSurgical,
}: UseShopeeInventoryOutProps) {
  const localTodayStr = new Date().toLocaleDateString('sv-SE');

  const shopeeFileInputRef = useRef<HTMLInputElement>(null);
  const [selectedAdsDate, setSelectedAdsDate] = useState(new Date().toISOString().split('T')[0]);
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
    profitStatus: 'LÃI 2',
  });
  const [editingInventoryOutId, setEditingInventoryOutId] = useState<string | null>(null);
  const [deleteConfirmId, setDeleteConfirmId] = useState<string | null>(null);
  const [clearAllConfirm, setClearAllConfirm] = useState(false);

  const totalFixedCosts = useMemo(
    () =>
      (shopeeCosts?.fixedCosts || []).reduce(
        (sum, item) => sum + item.quantity * item.unitPrice,
        0
      ),
    [shopeeCosts?.fixedCosts]
  );

  const totalVariableCosts = useMemo(
    () =>
      (shopeeCosts?.variableCosts || []).reduce(
        (sum, item) => sum + item.quantity * item.unitPrice,
        0
      ),
    [shopeeCosts?.variableCosts]
  );

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

  const fixedCostPerOrder = useMemo(
    () => totalFixedCosts / (shopeeCosts?.targetOrders || 1),
    [totalFixedCosts, shopeeCosts?.targetOrders]
  );

  const handleShopeeFileUpload = (e: ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !onUpdateShopeeInventoryOut) return;

    const reader = new FileReader();
    reader.onload = async event => {
      try {
        const data = event.target?.result;
        if (!data) return;
        const workbook = XLSX.read(data, { type: 'array', cellDates: true });
        const firstSheet = workbook.Sheets[workbook.SheetNames[0]];
        const rows = XLSX.utils.sheet_to_json(firstSheet, { header: 1 }) as unknown[][];

        if (rows.length < 2) return;

        const shopeeKeywords = [
          'madonhang',
          'mavandon',
          'masku',
          'skuphanloaihang',
          'skusanpham',
          'tensanpham',
          'soluong',
          'ngaydathang',
          'ngaydat',
          'ngaydatdon',
          'ngaytaodon',
          'thoigiantaodon',
          'giauudai',
          'phicodinh',
          'phithanhtoan',
        ];

        let headerIdx = -1;
        for (let i = 0; i < Math.min(rows.length, 20); i++) {
          const cells = (rows[i] as unknown[]).map(c => normalizeHeader(c));
          if (cells.some(c => shopeeKeywords.includes(c))) {
            headerIdx = i;
            break;
          }
        }

        if (headerIdx === -1) {
          alert('Không tìm thấy định dạng file Shopee hợp lệ. Vui lòng kiểm tra lại tiêu đề file.');
          return;
        }

        const headers = (rows[headerIdx] as unknown[]).map(h => normalizeHeader(h));
        const dataRows = rows.slice(headerIdx + 1);

        const newRecords: ShopeeInventoryOutRecord[] = dataRows
          .map(row => {
            const obj: Record<string, unknown> = {};
            headers.forEach((h, idx) => {
              if (h) obj[h] = (row as unknown[])[idx];
            });

            const trackingNumber = String(
              obj.mavandon || obj.trackingnumber || obj.waybillid || ''
            ).trim();
            const orderId = String(obj.madonhang || obj.orderid || '').trim();
            const sku = String(
              obj.skuphanloaihang || obj.masku || obj.skusanpham || obj.sku || ''
            ).trim();

            if (!trackingNumber || !sku) return null;

            const salePrice = cleanVNNumber(obj.giauudai || obj.giaban || obj.price || 0);
            const quantity = cleanVNNumber(obj.soluong || obj.quantity || 1);
            let date = parseVNDate(
              obj.ngaydathang ||
                obj.ngaydat ||
                obj.ngaydatdon ||
                obj.ngaytaodon ||
                obj.thoigiantaodon ||
                obj.orderdate ||
                obj.ordercreationdate ||
                localTodayStr
            );
            if (!date) date = localTodayStr;
            const shipDate = date;

            const productName = String(obj.tensanpham || obj.productname || '');
            const address = String(obj.diachinhanhang || obj.address || '');
            const shippingUnit = normalizeShippingUnit(String(obj.donvivanchuyen || obj.shippingcarrier || ''));
            const platformStatus = String(obj.trangthaidonhang || '').toLowerCase();

            let status: ShopeeInventoryOutRecord['status'] = 'OK';
            if (platformStatus.includes('huy')) status = 'CANCEL';
            else if (platformStatus.includes('hoan thanh') && (platformStatus.includes('tra') || platformStatus.includes('hoan')))
              status = 'RETURNED'; // "Hoàn hàng thành công" / "Trả hàng hoàn thành"
            else if (platformStatus.includes('tra hang') || platformStatus.includes('hoan tien') || platformStatus.includes('dang hoan'))
              status = 'RETURN';
            else if (platformStatus.includes('hoan thanh')) status = 'OK';
            else if (platformStatus.includes('dang giao') || platformStatus.includes('van chuyen'))
              status = 'SHIPPING';

            const platformFee = cleanVNNumber(
              obj.phicodinh || obj.commissionfee || 0
            );
            const paymentFee = cleanVNNumber(
              obj.phithanhtoan || obj.paymentfee || 0
            );
            const freeshipExtra = cleanVNNumber(
              obj.phidichvu || obj.servicefee || obj.freeshipextra || 0
            );
            const affiliateFee = cleanVNNumber(
              obj.phitiepthilienket || obj.phitiepthilienketshopee || obj.affiliatefee || 0
            );
            const handlingFee = totalVariableCosts;
            const pishipFee = 0;
            const vatTax = 0;
            const adsCost = 0;
            const adsTax = 0;
            const personalIncomeTax = 0;

            const skuData = shopeeSourceData.find(s => s.sku === sku);
            const importPrice = skuData?.importPrice || 0;
            const platformNet =
              salePrice - platformFee - pishipFee - freeshipExtra
              - paymentFee - vatTax - personalIncomeTax - affiliateFee;
            const netProfit =
              status === 'OK' || status === 'SHIPPING'
                ? platformNet - adsCost - adsTax - handlingFee - importPrice
                : 0;

            const customerPaid = cleanVNNumber(
              obj.tongsotiennguoimuanthanhtoan ||
                obj.tonggiatridonhang ||
                obj.buyerpaid ||
                salePrice
            );

            return {
              id: crypto.randomUUID(),
              date,
              shipDate,
              orderId,
              trackingNumber,
              sku,
              productName,
              platform: (String(obj.nentang || obj.platform || 'Shopee 2').trim()) as 'Shopee 1' | 'Shopee 2',
              quantity,
              salePrice,
              customerPaid,
              platformFee,
              paymentFee,
              freeshipExtra,
              affiliateFee,
              handlingFee,
              pishipFee,
              vatTax,
              adsCost,
              adsTax,
              personalIncomeTax,
              netProfit,
              address,
              shippingUnit,
              status,
              profitStatus: status === 'CANCEL' ? 'HỦY' : netProfit >= 0 ? 'LÃI 2' : 'LỖ 1',
              dailyOrderIndex: 0,
            };
          })
          .filter(Boolean) as ShopeeInventoryOutRecord[];

        const updatedList = [...shopeeInventoryOut];
        const addedItems: ShopeeInventoryOutRecord[] = [];
        newRecords.forEach(nr => {
          const existingIdx = updatedList.findIndex(
            r => r.trackingNumber === nr.trackingNumber && r.sku === nr.sku
          );
          if (existingIdx === -1) {
            updatedList.unshift(nr);
            addedItems.push(nr);
          } else {
            if (!updatedList[existingIdx].date || updatedList[existingIdx].date === '') {
              updatedList[existingIdx] = { ...updatedList[existingIdx], ...nr };
              addedItems.push(nr);
            }
          }
        });

        if (addedItems.length === 0) {
          alert('Không có dữ liệu mới để cập nhật.');
          return;
        }

        const groupedByDate: Record<string, number> = {};
        const finalList = updatedList.map(r => {
          groupedByDate[r.date] = (groupedByDate[r.date] || 0) + 1;
          return { ...r, dailyOrderIndex: groupedByDate[r.date] };
        });

        if (onUpdateSurgical) {
          const updates = addedItems.map(item => ({
            key: 'shopeeInventoryOut' as const,
            item,
          }));
          await onUpdateSurgical(updates);
        } else {
          await onUpdateShopeeInventoryOut(finalList);
        }
        alert(`Đã nhập thành công ${addedItems.length} đơn hàng từ Shopee.`);
      } catch (err) {
        console.error(err);
        alert('Lỗi xử lý file Shopee.');
      }
    };
    reader.readAsArrayBuffer(file);
  };

  const handleDistributeAdsCost = (totalAds: number, date: string) => {
    if (!onUpdateShopeeInventoryOut || !onUpdateDailyAdsConfig) return;

    const newConfig = { ...dailyAdsConfig, [date]: totalAds };
    onUpdateDailyAdsConfig(newConfig);

    const recordsForDate = shopeeInventoryOut.filter(r => r.date === date);
    if (recordsForDate.length === 0) return;

    const adsPerOrder = totalAds / recordsForDate.length;

    const newList = shopeeInventoryOut.map(r => {
      if (r.date === date) {
        const adsTax = 0;
        const skuData = shopeeSourceData.find(s => s.sku === r.sku);
        const importPrice = (skuData?.importPrice || 0) * (r.quantity || 1);
        const netProfit =
          r.salePrice -
          r.platformFee -
          r.paymentFee -
          r.freeshipExtra -
          r.affiliateFee -
          r.handlingFee -
          adsPerOrder -
          adsTax -
          importPrice;
        return { ...r, adsCost: adsPerOrder, adsTax, netProfit };
      }
      return r;
    });

    onUpdateShopeeInventoryOut(newList);
  };

  const handleAddInventoryOut = async () => {
    if (!onUpdateShopeeInventoryOut || !inventoryOutForm.sku || !inventoryOutForm.orderId) {
      alert('Vui lòng nhập đầy đủ Mã đơn hàng và Mã SKU');
      return;
    }

    const skuData = shopeeSourceData.find(s => s.sku === inventoryOutForm.sku);
    const salePrice = Number(inventoryOutForm.salePrice) || 0;
    const platformFee = Number(inventoryOutForm.platformFee) || 0;
    const paymentFee = Number(inventoryOutForm.paymentFee) || 0;
    const freeshipExtra = Number(inventoryOutForm.freeshipExtra) || 0;
    const affiliateFee = Number(inventoryOutForm.affiliateFee) || 0;
    const handlingFee = totalVariableCosts;

    const dailyTotalAds = dailyAdsConfig[inventoryOutForm.date || localTodayStr] || 0;
    const ordersToday =
      shopeeInventoryOut.filter(r => r.date === (inventoryOutForm.date || localTodayStr)).length +
      (editingInventoryOutId ? 0 : 1);
    const adsCost =
      dailyTotalAds > 0 ? dailyTotalAds / ordersToday : Number(inventoryOutForm.adsCost) || 0;
    const adsTax = 0;
    const personalIncomeTax = 0;

    const quantity = Number(inventoryOutForm.quantity) || 1;
    const platformNet2 =
      salePrice - platformFee - freeshipExtra - paymentFee - affiliateFee;
    const netProfit =
      platformNet2 - adsCost - adsTax - handlingFee
      - (skuData?.importPrice || 0) * quantity;

    const newRecord: ShopeeInventoryOutRecord = {
      id: editingInventoryOutId || generateId(),
      date: inventoryOutForm.date || localTodayStr,
      shipDate: inventoryOutForm.date || localTodayStr,
      orderId: inventoryOutForm.orderId || '',
      sku: inventoryOutForm.sku || '',
      productName: skuData?.name || '',
      platform: inventoryOutForm.platform || 'Shopee 2',
      quantity: Number(inventoryOutForm.quantity) || 1,
      salePrice,
      customerPaid: Number(inventoryOutForm.customerPaid) || salePrice,
      platformFee,
      paymentFee,
      freeshipExtra,
      affiliateFee,
      handlingFee,
      pishipFee: 0,
      vatTax: 0,
      adsCost,
      adsTax,
      personalIncomeTax,
      netProfit,
      address: inventoryOutForm.address || '',
      shippingUnit: inventoryOutForm.shippingUnit || 'GHN',
      status: inventoryOutForm.status || 'OK',
      profitStatus: netProfit >= 0 ? 'LÃI 2' : 'LỖ 1',
      dailyOrderIndex: editingInventoryOutId
        ? shopeeInventoryOut.find(r => r.id === editingInventoryOutId)?.dailyOrderIndex || 1
        : ordersToday,
    };

    if (onUpdateSurgical) {
      if (dailyTotalAds > 0) {
        const adsPerOrder = dailyTotalAds / ordersToday;

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
            const newAdsTax = 0;
            const newNetProfit =
              r.salePrice -
              r.platformFee -
              r.paymentFee -
              r.freeshipExtra -
              r.affiliateFee -
              r.handlingFee -
              adsPerOrder -
              newAdsTax -
              importPrice;
            return {
              key: 'shopeeInventoryOut' as const,
              item: { ...r, adsCost: adsPerOrder, adsTax: newAdsTax, netProfit: newNetProfit },
            };
          });
        try {
          await onUpdateSurgical(updates);
        } catch (err) {
          console.error('[useShopeeInventoryOut] handleAddInventoryOut (ads batch) failed', err);
          return;
        }
      } else {
        try {
          await onUpdateSurgical([{ key: 'shopeeInventoryOut', item: newRecord }]);
        } catch (err) {
          console.error('[useShopeeInventoryOut] handleAddInventoryOut failed', err);
          return;
        }
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
      profitStatus: 'LÃI 2',
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
      status: item.status || 'OK',
    });
  };

  const handleRemoveInventoryOut = async (id: string) => {
    if (!onUpdateShopeeInventoryOut) return;
    try {
      if (onUpdateSurgical) {
        await onUpdateSurgical([{ key: 'shopeeInventoryOut', item: { id }, isDelete: true }]);
      } else {
        const newList = shopeeInventoryOut.filter(i => i.id !== id);
        await onUpdateShopeeInventoryOut(newList);
      }
    } catch (err) {
      console.error('[useShopeeInventoryOut] handleRemoveInventoryOut failed', err);
      return;
    }
    setDeleteConfirmId(null);
  };

  const handleClearAllInventoryOut = async () => {
    if (!onUpdateShopeeInventoryOut) return;
    await onUpdateShopeeInventoryOut([]);
    setClearAllConfirm(false);
  };


  const handleUpdateShopeeCostConfig = (updates: Partial<ShopeeCostConfig>) => {
    if (!shopeeCosts || !onUpdateShopeeCosts) return;
    onUpdateShopeeCosts({ ...shopeeCosts, ...updates });
  };

  const handleAddShopeeCostItem = (type: 'fixed' | 'variable') => {
    if (!shopeeCosts || !onUpdateShopeeCosts) return;
    const newItem = { id: crypto.randomUUID(), name: 'Mục mới', quantity: 1, unitPrice: 0 };
    if (type === 'fixed') {
      onUpdateShopeeCosts({
        ...shopeeCosts,
        fixedCosts: [...(shopeeCosts.fixedCosts || []), newItem],
      });
    } else {
      onUpdateShopeeCosts({
        ...shopeeCosts,
        variableCosts: [...(shopeeCosts.variableCosts || []), newItem],
      });
    }
  };

  const handleUpdateShopeeCostItem = (
    type: 'fixed' | 'variable',
    id: string,
    field: string,
    value: string | number
  ) => {
    if (!shopeeCosts || !onUpdateShopeeCosts) return;
    const list =
      type === 'fixed'
        ? [...(shopeeCosts.fixedCosts || [])]
        : [...(shopeeCosts.variableCosts || [])];
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
    const list =
      type === 'fixed'
        ? [...(shopeeCosts.fixedCosts || [])]
        : [...(shopeeCosts.variableCosts || [])];
    const filtered = list.filter(i => i.id !== id);
    if (type === 'fixed') {
      onUpdateShopeeCosts({ ...shopeeCosts, fixedCosts: filtered });
    } else {
      onUpdateShopeeCosts({ ...shopeeCosts, variableCosts: filtered });
    }
  };

  return {
    shopeeFileInputRef,
    selectedAdsDate,
    setSelectedAdsDate,
    inventoryOutForm,
    setInventoryOutForm,
    editingInventoryOutId,
    setEditingInventoryOutId,
    deleteConfirmId,
    setDeleteConfirmId,
    clearAllConfirm,
    setClearAllConfirm,
    totalFixedCosts,
    totalVariableCosts,
    shopeeTotals,
    fixedCostPerOrder,
    handleShopeeFileUpload,
    handleDistributeAdsCost,
    handleAddInventoryOut,
    handleEditInventoryOut,
    handleRemoveInventoryOut,
    handleClearAllInventoryOut,
    handleUpdateShopeeCostConfig,
    handleAddShopeeCostItem,
    handleUpdateShopeeCostItem,
    handleRemoveShopeeCostItem,
  };
}
