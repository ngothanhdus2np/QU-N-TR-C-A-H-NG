import { useState, useRef, type ChangeEvent, type FormEvent } from 'react';
import {
  RevenueRecord,
  RevenueSubTab,
  AppDataSurgicalUpdate,
  RevenueAuditColumnKey,
  RevenueAuditConflict,
} from '../../types';
import { cleanVNNumber, parseVNDate, processExcelRawData, generateId } from '../../src/lib';

interface UseRevenueLedgerProps {
  list: RevenueRecord[];
  isShopee: boolean | undefined;
  onUpdate: (newList: RevenueRecord[], idToRemove?: string) => Promise<void>;
  onUpdateSurgical: ((updates: AppDataSurgicalUpdate[]) => Promise<void>) | undefined;
  setActiveSubTab: (tab: RevenueSubTab) => void;
}

export function useRevenueLedger({
  list,
  isShopee,
  onUpdate,
  onUpdateSurgical,
  setActiveSubTab,
}: UseRevenueLedgerProps) {
  const localTodayStr = new Date().toLocaleDateString('sv-SE');

  const [formData, setFormData] = useState({
    date: localTodayStr,
    totalGrossRevenue: '',
    discount: '',
    revenueOther: '',
    returnsValue: '',
    totalCogs: '',
  });
  const [isSaving, setIsSaving] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [auditConflicts, setAuditConflicts] = useState<RevenueAuditConflict[]>([]);
  const [showAuditModal, setShowAuditModal] = useState(false);
  const [pendingRecords, setPendingRecords] = useState<RevenueRecord[]>([]);

  const handleFileUpload = async (e: ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    const isExcel = file.name.endsWith('.xlsx') || file.name.endsWith('.xls');

    reader.onload = async event => {
      try {
        const fileContent = event.target?.result;
        if (!fileContent) return;
        const results = processExcelRawData(fileContent, isExcel);
        if (results.length === 0) {
          alert('Không tìm thấy tiêu đề hợp lệ.');
          return;
        }
        // KiotViet xuất file theo giao dịch: mỗi đơn hàng 1 dòng, nhưng cột tổng ngày
        // (Tổng tiền hàng, Giảm giá, Giá trị trả...) lặp lại giống nhau cho mọi dòng cùng ngày.
        // Nhận biết qua cột "Mã giao dịch" → chỉ lấy dòng đầu tiên mỗi ngày, bỏ qua các dòng sau.
        const isTransactionLevel = results.length > 0 && 'magiaodich' in results[0];
        const groupedByDate: Record<string, RevenueRecord> = {};
        results.forEach(r => {
          const date = parseVNDate(r.thoigian || r.ngay || r.time);
          if (!date) return;
          const tg = cleanVNNumber(r.tongtienhang || r.totalgrossrevenue || r.tongtien);
          const gg = cleanVNNumber(r.giamgia || r.discount || r.chietkhau);
          // Lưu returns dương để nhất quán với công thức net = gross - |discount| - |returns|
          const th = Math.abs(cleanVNNumber(r.giatritra || r.returnsvalue || r.trahang));
          const gv = cleanVNNumber(r.tonggiavon || r.totalcogs || r.giavon);
          // Ưu tiên "Doanh thu thuần" (sau trả hàng) trước "Doanh thu" (chưa trừ trả hàng)
          const dt = cleanVNNumber(r.doanhthuthuan || r.doanhthu || r.revenue);
          const ln = cleanVNNumber(r.loinhuangop || r.grossprofit);
          const discountAbs = Math.abs(gg);
          if (!groupedByDate[date]) {
            groupedByDate[date] = {
              id: generateId(),
              date,
              totalGrossRevenue: tg,
              discount: gg,
              revenueOther: 0,
              returnsValue: th,
              netRevenue: dt || tg - discountAbs - th,
              totalCogs: gv,
              grossProfit: ln || (dt || tg - discountAbs - th) - gv,
            };
          } else if (!isTransactionLevel) {
            // File daily-summary: mỗi dòng là dữ liệu riêng biệt → cộng dồn
            const existing = groupedByDate[date];
            existing.totalGrossRevenue += tg;
            existing.discount += gg;
            existing.returnsValue += th;
            existing.netRevenue += dt || tg - discountAbs - th;
            existing.totalCogs += gv;
            existing.grossProfit += ln || (dt || tg - discountAbs - th) - gv;
          }
          // File transaction-level: tổng ngày đã đúng ở dòng đầu → bỏ qua dòng trùng
        });

        const conflicts: RevenueAuditConflict[] = [];
        const updatedFullList = [...list];
        const newProcessedItems: RevenueRecord[] = [];
        const changedItems: AppDataSurgicalUpdate[] = [];

        Object.values(groupedByDate).forEach(fileRec => {
          const existingIdx = updatedFullList.findIndex(item => item.date === fileRec.date);
          if (existingIdx === -1) {
            newProcessedItems.push(fileRec);
            changedItems.push({ key: isShopee ? 'shopeeRevenue' : 'revenue', item: fileRec });
          } else {
            const current = { ...updatedFullList[existingIdx] };
            const columnsToAudit: { key: RevenueAuditColumnKey; label: string }[] = [
              { key: 'totalGrossRevenue', label: 'Tổng tiền hàng' },
              { key: 'discount', label: 'Giảm giá' },
              { key: 'returnsValue', label: 'Giá trị trả' },
              { key: 'totalCogs', label: 'Tổng giá vốn' },
            ];
            let isModified = false;
            columnsToAudit.forEach(col => {
              const curVal = current[col.key] as number;
              const fileVal = fileRec[col.key] as number;
              if (curVal === 0 || curVal === null || curVal === undefined) {
                current[col.key] = fileVal;
                isModified = true;
              } else if (curVal !== fileVal) {
                conflicts.push({
                  date: fileRec.date,
                  columnKey: col.key,
                  columnLabel: col.label,
                  currentValue: curVal,
                  newValue: fileVal,
                  resolution: 'keep',
                });
              }
            });

            if (isModified) {
              current.netRevenue =
                (current.totalGrossRevenue || 0) -
                Math.abs(current.discount || 0) -
                Math.abs(current.returnsValue || 0);
              current.grossProfit =
                current.netRevenue + (current.revenueOther || 0) - (current.totalCogs || 0);
              updatedFullList[existingIdx] = current;
              changedItems.push({ key: isShopee ? 'shopeeRevenue' : 'revenue', item: current });
            }
          }
        });

        if (conflicts.length > 0) {
          setAuditConflicts(conflicts);
          setPendingRecords([...updatedFullList, ...newProcessedItems]);
          setShowAuditModal(true);
        } else {
          try {
            if (onUpdateSurgical && changedItems.length > 0) {
              await onUpdateSurgical(changedItems);
            } else {
              await onUpdate(
                [...updatedFullList, ...newProcessedItems].sort((a, b) =>
                  (b.date || '').localeCompare(a.date || '')
                )
              );
            }
            alert('Đồng bộ thành công!');
          } catch (e) {
            console.error('Cloud Sync Error:', e);
            alert('Lỗi đồng bộ dữ liệu lên hệ thống. Dữ liệu đã được lưu tạm trên máy tính này.');
          }
        }
      } catch (err) {
        console.error('Revenue file processing error:', err);
        alert('Lỗi xử lý file.');
      }
    };
    if (isExcel) reader.readAsArrayBuffer(file);
    else reader.readAsText(file);
    if (e.target) e.target.value = '';
  };

  const handleResolveConflicts = async () => {
    const finalRecords = [...pendingRecords];
    const changedItems: AppDataSurgicalUpdate[] = [];

    auditConflicts.forEach(conflict => {
      if (conflict.resolution === 'update') {
        const idx = finalRecords.findIndex(r => r.date === conflict.date);
        if (idx > -1) {
          finalRecords[idx][conflict.columnKey] = conflict.newValue;
          finalRecords[idx].netRevenue =
            (finalRecords[idx].totalGrossRevenue || 0) -
            Math.abs(finalRecords[idx].discount || 0) -
            Math.abs(finalRecords[idx].returnsValue || 0);
          finalRecords[idx].grossProfit =
            finalRecords[idx].netRevenue +
            (finalRecords[idx].revenueOther || 0) -
            (finalRecords[idx].totalCogs || 0);
          changedItems.push({
            key: isShopee ? 'shopeeRevenue' : 'revenue',
            item: finalRecords[idx],
          });
        }
      }
    });

    try {
      if (onUpdateSurgical && changedItems.length > 0) {
        await onUpdateSurgical(changedItems);
      } else {
        await onUpdate(finalRecords.sort((a, b) => (b.date || '').localeCompare(a.date || '')));
      }
      setShowAuditModal(false);
      setAuditConflicts([]);
      setPendingRecords([]);
      setActiveSubTab('ledger');
      alert('Đồng bộ thành công!');
    } catch (e) {
      console.error('Conflict Resolution Sync Error:', e);
      alert('Lỗi đồng bộ dữ liệu lên hệ thống. Vui lòng kiểm tra kết nối.');
    }
  };

  const handleAdd = async (e: FormEvent) => {
    e.preventDefault();
    const net =
      (Number(formData.totalGrossRevenue) || 0) -
      (Number(formData.discount) || 0) -
      (Number(formData.returnsValue) || 0);
    const profit = net + (Number(formData.revenueOther) || 0) - (Number(formData.totalCogs) || 0);

    const existingRecord = list.find(item => item.date === formData.date);

    if (existingRecord) {
      if (
        !confirm(
          `Dữ liệu ngày ${formData.date.split('-').reverse().join('/')} đã tồn tại. Bạn có muốn cập nhật không?`
        )
      )
        return;
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
        grossProfit: profit,
      };

      if (onUpdateSurgical) {
        await onUpdateSurgical([{ key: isShopee ? 'shopeeRevenue' : 'revenue', item: newRecord }]);
      } else {
        if (existingRecord) {
          await onUpdate(list.map(r => (r.id === newRecord.id ? newRecord : r)));
        } else {
          await onUpdate([newRecord, ...list]);
        }
      }
      setFormData(prev => ({
        ...prev,
        totalGrossRevenue: '',
        discount: '',
        revenueOther: '',
        returnsValue: '',
        totalCogs: '',
      }));
    } catch (error) {
      console.error('Lỗi khi lưu dữ liệu:', error);
      alert('Lỗi đồng bộ Cloud. Dữ liệu đã được lưu tạm trên máy tính này.');
    } finally {
      setIsSaving(false);
    }
  };

  return {
    formData,
    setFormData,
    isSaving,
    fileInputRef,
    auditConflicts,
    setAuditConflicts,
    showAuditModal,
    setShowAuditModal,
    pendingRecords,
    handleFileUpload,
    handleResolveConflicts,
    handleAdd,
  };
}
