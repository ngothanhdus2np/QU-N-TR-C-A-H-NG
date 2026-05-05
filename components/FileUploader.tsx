
import React, { useState } from 'react';
import { AppData, RevenueRecord, ExpenseRecord, PayrollRecord } from '../types';
import { Upload, FileSpreadsheet, CheckCircle2, FileText, Loader2, AlertTriangle, Info, X } from 'lucide-react';
import { cleanVNNumber, parseVNDate, processExcelRawData } from '../businessLogic';
import { validationService } from '../services/validationService';

interface FileUploaderProps {
  onDataLoaded: (data: AppData) => void;
  currentData: AppData;
}

interface AuditReport {
  type: keyof AppData;
  newCount: number;
  updateCount: number;
  errorCount: number;
  errors: { row: number; msg: string }[];
  processedData: any[];
}

const FileUploader: React.FC<FileUploaderProps> = ({ onDataLoaded, currentData }) => {
  const [loading, setLoading] = useState(false);
  const [auditReport, setAuditReport] = useState<AuditReport | null>(null);

  const processFileResults = (results: any[], type: keyof AppData): any[] => {
    if (type === 'revenue') {
      const groupedByDate: Record<string, RevenueRecord> = {};
      results.forEach(r => {
        const rawDate = r.thoigian || r.ngay || r.time || r['ngay'] || r['thời gian'] || r['thoi gian'];
        const date = parseVNDate(rawDate);
        if (!date) return; 
        const totalGross = cleanVNNumber(r.tongtienhang || r.totalgrossrevenue || r.tongtien || r['doanh thu gộp'] || r['tổng tiền hàng'] || r['tổng tiền']);
        const discount = cleanVNNumber(r.giamgia || r.discount || r.chietkhau || r['chiết khấu'] || r['giảm giá']);
        const returns = cleanVNNumber(r.giatritra || r.returnsvalue || r.trahang || r['giá trị trả'] || r['trả hàng']);
        const cogs = cleanVNNumber(r.tonggiavon || r.totalcogs || r.giavon || r['giá vốn'] || r['tổng giá vốn']);
        const netKiot = cleanVNNumber(r.doanhthu || r.revenue || r.doanhthuthuan || r['doanh thu thuần']);
        const profit = cleanVNNumber(r.loinhuangop || r.grossprofit || r['lợi nhuận gộp']);

        if (!groupedByDate[date]) {
          groupedByDate[date] = {
            id: crypto.randomUUID(), date, totalGrossRevenue: totalGross, discount,
            revenueOther: 0, returnsValue: returns, netRevenue: netKiot || (totalGross - discount - returns),
            totalCogs: cogs, grossProfit: profit || ((netKiot || (totalGross - discount - returns)) - cogs)
          };
        } else {
          const current = groupedByDate[date];
          current.totalGrossRevenue = Math.max(current.totalGrossRevenue, totalGross);
          current.discount = Math.max(current.discount, discount);
          current.returnsValue = Math.max(current.returnsValue, returns);
          current.netRevenue = Math.max(current.netRevenue, netKiot || (totalGross - discount - returns));
          current.totalCogs = Math.max(current.totalCogs, cogs);
          current.grossProfit = Math.max(current.grossProfit, profit || (current.netRevenue - current.totalCogs));
        }
      });
      return Object.values(groupedByDate);
    }
    
    if (type === 'expenses') {
      return results
        .filter(r => (r.date || r.ngay || r['ngày']))
        .map(r => ({
          id: crypto.randomUUID(),
          date: parseVNDate(r.date || r.ngay || r['ngày']),
          category: r.category || r.hangmuc || r['hạng mục'] || 'Khác',
          amount: cleanVNNumber(r.amount || r.sotien || r['số tiền']),
          description: r.description || r.ghichu || r.noidung || r['nội dung'] || ''
        })).filter(e => e.date !== '');
    }

    if (type === 'payroll') {
      return results.map(r => {
        const basic = cleanVNNumber(r.basic || r.luongcoban || r['lương cơ bản']);
        const allowance = cleanVNNumber(r.allowance || r.phucap || r['phụ cấp']);
        const name = r.name || r.ten || r['tên'] || '';
        const month = r.month || r.thang || r['tháng'] || '';
        return {
          id: crypto.randomUUID(), employeeId: r.id || '', employeeName: name, month: month,
          basicSalary: basic, allowance: allowance, responsibilityPay: cleanVNNumber(r.responsibilitypay || r.trachnhiem),
          overtimePay: cleanVNNumber(r.overtime), commissionPay: cleanVNNumber(r.commission), 
          seniorityBonus: cleanVNNumber(r.senioritybonus), holidayBonus: cleanVNNumber(r.holidaybonus), 
          tetBonus: cleanVNNumber(r.tetbonus), advance: cleanVNNumber(r.advance), shortage: cleanVNNumber(r.shortage), fine: cleanVNNumber(r.fine),
          netPay: basic + allowance + cleanVNNumber(r.overtime) + cleanVNNumber(r.commission) - cleanVNNumber(r.advance) - cleanVNNumber(r.shortage) - cleanVNNumber(r.fine),
          seniorityDays: cleanVNNumber(r.senioritydays) || 0, isOfficial: !!r.isofficial, hasTetCommitment: !!r.hastetcommitment
        };
      });
    }
    return results;
  };

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>, type: keyof AppData) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setLoading(true);
    const reader = new FileReader();
    const isExcel = file.name.endsWith('.xlsx') || file.name.endsWith('.xls');

    reader.onload = (event) => {
      try {
        const fileContent = event.target?.result;
        if (!fileContent) { setLoading(false); return; }
        const results = processExcelRawData(fileContent, isExcel);
        if (results.length === 0) { alert("Không tìm thấy dữ liệu."); setLoading(false); return; }

        const processed = processFileResults(results, type);
        
        const report: AuditReport = {
          type, newCount: 0, updateCount: 0, errorCount: 0, errors: [], processedData: []
        };

        processed.forEach((item, index) => {
          const errors = validationService.validate(type, item);
          if (errors.length > 0) {
            report.errorCount++;
            report.errors.push({ row: index + 1, msg: errors[0].message });
          } else {
            const existingIdx = (currentData[type] as any[]).findIndex(old => {
              if (type === 'revenue') return old.date === item.date;
              if (type === 'payroll') return old.employeeId === item.employeeId && old.month === item.month;
              return old.id === item.id;
            });

            if (existingIdx > -1) {
              report.updateCount++;
              const updatedItem = { ...(currentData[type] as any[])[existingIdx], ...item };
              report.processedData.push(updatedItem);
            } else {
              report.newCount++;
              report.processedData.push(item);
            }
          }
        });

        setAuditReport(report);
      } catch (err) { 
        console.error(err);
        alert("Lỗi xử lý file."); 
      }
      setLoading(false);
      if (e.target) e.target.value = '';
    };

    if (isExcel) reader.readAsArrayBuffer(file);
    else reader.readAsText(file);
  };

  const confirmUpload = () => {
    if (!auditReport) return;
    const { type, processedData } = auditReport;
    
    if (type === 'revenue') {
      const newList = [...currentData.revenue];
      processedData.forEach(item => {
        const idx = newList.findIndex(old => old.date === item.date);
        if (idx > -1) newList[idx] = item;
        else newList.push(item);
      });
      onDataLoaded({ ...currentData, revenue: newList.sort((a, b) => b.date.localeCompare(a.date)) });
    } else {
      const newList = [...(currentData[type] as any[])];
      processedData.forEach(item => {
        const idx = newList.findIndex(old => old.id === item.id);
        if (idx > -1) newList[idx] = item;
        else newList.push(item);
      });
      onDataLoaded({ ...currentData, [type]: newList });
    }
    
    setAuditReport(null);
  };

  const uploadSections: { id: string; title: string; desc: string; icon: any; key: 'revenue' | 'expenses' | 'payroll' }[] = [
    { id: 'revenue', title: 'Nguồn Thu (KiotViet)', desc: 'Tự động đối soát ngày & ghi đè nếu trùng', icon: FileSpreadsheet, key: 'revenue' },
    { id: 'expenses', title: 'Nguồn Chi', desc: 'Hạng mục chi phí vận hành', icon: FileText, key: 'expenses' },
    { id: 'payroll', title: 'Bảng Lương', desc: 'Đồng bộ thâm niên & phụ cấp', icon: Upload, key: 'payroll' },
  ];

  return (
    <div className="max-w-4xl mx-auto space-y-6">
      <div className="bg-white p-8 rounded-3xl border border-slate-200 shadow-sm relative overflow-hidden">
        <h2 className="text-2xl font-black text-slate-800 mb-2 uppercase tracking-tight">Cấu Hình Dữ Liệu MIS</h2>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mt-8">
          {uploadSections.map((section) => {
            const hasData = (currentData[section.key] as any[])?.length > 0;
            return (
              <div key={section.id} className="relative group border-2 border-dashed border-slate-200 hover:border-indigo-400 hover:bg-indigo-50/20 p-6 rounded-2xl transition-all cursor-pointer text-center">
                <input type="file" accept=".csv, .xlsx, .xls" onChange={(e) => handleFileUpload(e, section.key)} className="absolute inset-0 w-full h-full opacity-0 cursor-pointer z-10" />
                <div className={`mx-auto p-4 rounded-full w-16 h-16 flex items-center justify-center mb-4 ${hasData ? 'bg-emerald-100 text-emerald-600' : 'bg-slate-100 text-slate-400'}`}>
                  {loading ? <Loader2 className="w-8 h-8 animate-spin" /> : <section.icon className="w-8 h-8" />}
                </div>
                <h4 className="font-black text-slate-800 uppercase text-xs tracking-widest">{section.title}</h4>
                <p className="text-[10px] text-slate-400 mt-1 font-bold">{section.desc}</p>
              </div>
            );
          })}
        </div>
      </div>

      {auditReport && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm z-[999] flex items-center justify-center p-4">
          <div className="bg-white w-full max-w-2xl rounded-3xl shadow-2xl overflow-hidden flex flex-col max-h-[90vh]">
            <div className="p-6 border-b border-slate-100 flex justify-between items-center bg-slate-50">
              <div className="flex items-center space-x-3">
                <div className="p-2 bg-indigo-100 text-indigo-600 rounded-lg">
                  <Info className="w-5 h-5" />
                </div>
                <h3 className="font-black text-slate-800 uppercase tracking-tight">Báo Cáo Kiểm Toán Dữ Liệu</h3>
              </div>
              <button onClick={() => setAuditReport(null)} className="p-2 hover:bg-slate-200 rounded-full transition-colors">
                <X className="w-5 h-5 text-slate-500" />
              </button>
            </div>
            
            <div className="p-6 overflow-y-auto space-y-6">
              <div className="grid grid-cols-3 gap-4">
                <div className="p-4 bg-emerald-50 rounded-2xl border border-emerald-100 text-center">
                  <div className="text-2xl font-black text-emerald-600">{auditReport.newCount}</div>
                  <div className="text-[10px] font-bold text-emerald-500 uppercase tracking-wider">Mới</div>
                </div>
                <div className="p-4 bg-amber-50 rounded-2xl border border-amber-100 text-center">
                  <div className="text-2xl font-black text-amber-600">{auditReport.updateCount}</div>
                  <div className="text-[10px] font-bold text-amber-500 uppercase tracking-wider">Cập nhật</div>
                </div>
                <div className="p-4 bg-rose-50 rounded-2xl border border-rose-100 text-center">
                  <div className="text-2xl font-black text-rose-600">{auditReport.errorCount}</div>
                  <div className="text-[10px] font-bold text-rose-500 uppercase tracking-wider">Lỗi chặn</div>
                </div>
              </div>

              {auditReport.errors.length > 0 && (
                <div className="p-4 bg-rose-50 rounded-2xl border border-rose-100">
                  <div className="flex items-center space-x-2 text-rose-600 mb-2">
                    <AlertTriangle className="w-4 h-4" />
                    <span className="text-xs font-black uppercase tracking-tight">Chi tiết lỗi logic</span>
                  </div>
                  <div className="space-y-1.5">
                    {auditReport.errors.map((err, i) => (
                      <div key={i} className="text-[11px] font-medium text-rose-500 flex items-start space-x-2">
                        <span className="opacity-50">• Dòng {err.row}:</span>
                        <span>{err.msg}</span>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              <div className="p-4 bg-slate-50 rounded-2xl border border-slate-100">
                <div className="flex items-center space-x-2 text-slate-600 mb-2">
                  <Info className="w-4 h-4" />
                  <span className="text-xs font-black uppercase tracking-tight">Lưu ý hệ thống</span>
                </div>
                <p className="text-[11px] text-slate-500 leading-relaxed font-bold">
                  Các bản ghi mâu thuẫn hoặc thiếu thông tin bắt buộc đã bị loại bỏ tự động. 
                  Nhấn xác nhận để ghi đè các cập nhật và nạp bản ghi mới vào dữ liệu cục bộ.
                </p>
              </div>
            </div>

            <div className="p-6 bg-slate-50 border-t border-white flex space-x-3">
              <button onClick={() => setAuditReport(null)} className="flex-1 py-3 font-black text-slate-500 uppercase text-xs tracking-widest hover:bg-slate-200 rounded-xl transition-all">
                Hủy bỏ
              </button>
              <button 
                onClick={confirmUpload}
                disabled={auditReport.processedData.length === 0}
                className="flex-[2] py-3 bg-indigo-500 text-white font-black uppercase text-xs tracking-widest hover:bg-indigo-600 rounded-xl transition-all shadow-lg shadow-indigo-200 disabled:opacity-50"
              >
                Xác nhận nạp {auditReport.processedData.length} dòng
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default FileUploader;
