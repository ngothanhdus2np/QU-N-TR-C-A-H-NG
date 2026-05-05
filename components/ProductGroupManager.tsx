
import React, { useState, useRef, useMemo } from 'react';
import { ProductGroup, ProductGroupRevenue, RevenueRecord } from '../types';
import { 
  Plus, Trash2, Calendar, DollarSign, Layers, Sparkles, 
  Loader2, Upload, Activity, Search, 
  ChevronRight, ChevronDown, LayoutGrid, ListTree,
  ShoppingCart, Hash, Circle, Info, TrendingUp,
  DatabaseZap, X, Settings, Target, BarChart3, TrendingDown,
  Box, FileText, Filter, FileSpreadsheet, Download, Save,
  ArrowRightLeft, HandCoins, Zap, PieChart as PieChartIcon, ShieldAlert, Star, CheckCircle2, AlertTriangle,
  History, ArrowUpDown, Boxes, Award, ArrowUp, Briefcase, Percent
} from 'lucide-react';
import { calculateStrategicSuggestions, calculateSeasonalityAnalysis, cleanVNNumber, parseVNDate, parseHierarchyGroups, normalizeHeader, generateId, processExcelRawData, isUUID } from '../businessLogic';
import { AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, BarChart, Bar, Cell, PieChart, Pie, Legend } from 'recharts';
import { GoogleGenAI } from "@google/genai";
import { marked } from "marked";
import * as XLSX from 'xlsx';

type AnalysisMode = 'range' | 'seasonality';
type ViewMode = 'revenue' | 'quantity';

interface SeasonalRow {
  month: string;
  groupName: string;
  fullPath: string;
  displayName: string;
  level: number;
  quantity: number;
  amount: number;
  returnsQuantity: number;
  returnsValue: number;
  net: number;
  cogs: number;
  profit: number;
  margin: number;
  hasChildren: boolean;
}

interface Props {
  productGroups: ProductGroup[];
  groupRevenue: ProductGroupRevenue[];
  list: RevenueRecord[];
  onUpdateGroups: (newList: ProductGroup[]) => void;
  onUpdateGroupRevenue: (newList: ProductGroupRevenue[]) => void;
  onUpdateRevenue: (newList: RevenueRecord[]) => void;
}

const ProductGroupManager: React.FC<Props> = ({ productGroups, groupRevenue, list, onUpdateGroups, onUpdateGroupRevenue, onUpdateRevenue }) => {
  const [activeSubTab, setActiveSubTab] = useState<'seasonality' | 'matrix' | 'ledger'>('seasonality');
  const [analysisMode, setAnalysisMode] = useState<AnalysisMode>('seasonality');
  const [viewMode, setViewMode] = useState<ViewMode>('quantity'); 
  const [selectedMonthNum, setSelectedMonthNum] = useState<number>(new Date().getMonth() + 1);
  
  const [filterStartDate, setFilterStartDate] = useState<string>('');
  const [filterEndDate, setFilterEndDate] = useState<string>('');
  
  const [expandedNodesStrategic, setExpandedNodesStrategic] = useState<Set<string>>(new Set());
  const [expandedLedgerRows, setExpandedLedgerRows] = useState<Set<string>>(new Set());
  
  const [isDiagnosing, setIsDiagnosing] = useState(false);
  const [diagnosisResult, setDiagnosisResult] = useState<string | null>(null);

  const [isAuditMode, setIsAuditMode] = useState(false);
  const [isCommitting, setIsCommitting] = useState(false);
  const [pendingGroups, setPendingGroups] = useState<{ name: string; level: number; fullPath: string; selected: boolean }[]>([]);
  const [pendingGroupRevenue, setPendingGroupRevenue] = useState<any[]>([]);
  const [groupConflicts, setGroupConflicts] = useState<{ date: string; groupName: string; currentAmount: number; newAmount: number }[]>([]);
  const [conflictResolution, setConflictResolution] = useState<'overwrite' | 'skip' | 'add'>('overwrite');
  const [syncAccountingMonth, setSyncAccountingMonth] = useState(new Date().toISOString().slice(0, 7));

  const fileInputRef = useRef<HTMLInputElement>(null);
  const formatNumber = (num: number) => Math.round(num || 0).toLocaleString('vi-VN');
  
  const [groupFormData, setGroupFormData] = useState({
    date: new Date().toISOString().split('T')[0],
    groupId: '',
    amount: '',
    quantity: '',
    netRevenue: '',
    returnsQuantity: '',
    returnsValue: '',
    cogs: ''
  });

  const effectiveGroups = useMemo(() => {
    if (productGroups && productGroups.length > 0) return productGroups;
    const uniqueGroupNames = Array.from(new Set(groupRevenue.map(r => r.groupName))).filter(Boolean);
    return uniqueGroupNames.map(name => ({
      id: groupRevenue.find(r => r.groupName === name)?.groupId || generateId(),
      name: name
    }));
  }, [productGroups, groupRevenue]);

  const filteredGroupRevenue = useMemo(() => {
    if (analysisMode === 'seasonality') {
      return groupRevenue.filter(r => {
        const month = parseInt(r.date.split('-')[1]);
        return month === selectedMonthNum;
      });
    }
    return groupRevenue;
  }, [groupRevenue, analysisMode, selectedMonthNum]);

  const seasonalityStats = useMemo(() => calculateSeasonalityAnalysis(filteredGroupRevenue, effectiveGroups), [filteredGroupRevenue, effectiveGroups]);

  const strategicKPIs = useMemo(() => {
    if (seasonalityStats.length === 0) return { totalRev: 0, totalQty: 0, avgReturn: 0, inventory: 0, stars: 0 };
    const totalRev = seasonalityStats.reduce((sum, s) => sum + (s.totalHistorical || 0), 0);
    const totalQty = filteredGroupRevenue.reduce((sum, r) => sum + (r.quantity || 0), 0);
    const avgReturn = seasonalityStats.reduce((sum, s) => sum + (s.avgReturnRate || 0), 0) / (seasonalityStats.length || 1);
    const inventory = seasonalityStats.reduce((sum, s) => sum + (s.inventoryExpection || 0), 0);
    return { totalRev, totalQty, avgReturn, inventory };
  }, [seasonalityStats, filteredGroupRevenue]);

  // --- NEW MIS TACTICAL LOGIC ---
  const nextMonthNum = selectedMonthNum === 12 ? 1 : selectedMonthNum + 1;
  const years = useMemo(() => {
    const ySet = new Set<string>();
    groupRevenue.forEach(r => ySet.add(r.date.split('-')[0]));
    return Array.from(ySet).sort((a, b) => b.localeCompare(a));
  }, [groupRevenue]);

  const thisMonthTactical = useMemo(() => {
    const data = groupRevenue.filter(r => parseInt(r.date.split('-')[1]) === selectedMonthNum);
    const totalRev = data.reduce((s, r) => s + (r.netRevenue || (r.amount - (r.returnsValue || 0))), 0);
    const totalQty = data.reduce((s, r) => s + (r.quantity || 0), 0);
    
    const groupsMap: Record<string, { name: string, rev: number, qty: number }> = {};
    data.forEach(r => {
      if (!groupsMap[r.groupName]) groupsMap[r.groupName] = { name: r.groupName, rev: 0, qty: 0 };
      groupsMap[r.groupName].rev += (r.netRevenue || (r.amount - (r.returnsValue || 0)));
      groupsMap[r.groupName].qty += (r.quantity || 0);
    });

    return Object.values(groupsMap)
      .sort((a, b) => viewMode === 'revenue' ? b.rev - a.rev : b.qty - a.qty)
      .slice(0, 10)
      .map(g => ({ 
        ...g, 
        percent: viewMode === 'revenue' 
          ? (totalRev > 0 ? (g.rev / totalRev) * 100 : 0)
          : (totalQty > 0 ? (g.qty / totalQty) * 100 : 0)
      }));
  }, [groupRevenue, selectedMonthNum, viewMode]);

  const nextMonthTactical = useMemo(() => {
    return calculateStrategicSuggestions(groupRevenue, nextMonthNum, viewMode);
  }, [groupRevenue, nextMonthNum, viewMode]);

  const matrixData = useMemo(() => {
    const sortedGroups = [...effectiveGroups];
    const getMetricForCell = (fullPath: string, year: string) => {
      const records = groupRevenue.filter(r => {
        const rYear = r.date.split('-')[0];
        const rMonth = parseInt(r.date.split('-')[1]);
        return rYear === year && rMonth === selectedMonthNum && (r.groupName === fullPath || r.groupName.startsWith(fullPath + ' >> '));
      });
      return viewMode === 'revenue' 
        ? records.reduce((sum, r) => sum + (r.netRevenue || (r.amount - (r.returnsValue || 0))), 0)
        : records.reduce((sum, r) => sum + (r.quantity || 0), 0);
    };

    return sortedGroups.map(g => {
      const parts = g.name.split(' >> ');
      const yearValues: Record<string, number> = {};
      let totalAllYearsMetric = 0;
      years.forEach(y => {
        const val = getMetricForCell(g.name, y);
        yearValues[y] = val;
        totalAllYearsMetric += val;
      });
      return { 
        ...g, 
        displayName: parts[parts.length - 1], 
        level: parts.length, 
        isParent: effectiveGroups.some(s => s.name.startsWith(g.name + ' >> ')),
        yearValues,
        totalAllYearsMetric
      };
    }).filter(row => row.totalAllYearsMetric > 0).sort((a, b) => b.totalAllYearsMetric - a.totalAllYearsMetric);
  }, [effectiveGroups, groupRevenue, years, selectedMonthNum, viewMode]);

  const maxMatrixValue = useMemo(() => {
    let max = 0;
    matrixData.forEach(row => {
      (Object.values(row.yearValues) as number[]).forEach(v => { if (v > max) max = v; });
    });
    return max || 1;
  }, [matrixData]);

  const getHeatmapColor = (value: number) => {
    if (value <= 0) return 'transparent';
    const intensity = value / maxMatrixValue;
    const baseColor = viewMode === 'revenue' ? 'emerald' : 'indigo';
    if (intensity > 0.8) return `bg-${baseColor}-500 text-white font-black`;
    if (intensity > 0.5) return `bg-${baseColor}-400 text-white font-black`;
    if (intensity > 0.3) return `bg-${baseColor}-200 text-${baseColor}-900 font-bold`;
    return `bg-${baseColor}-50 text-${baseColor}-700 font-bold`;
  };

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    const isExcel = file.name.endsWith('.xlsx') || file.name.endsWith('.xls');
    reader.onload = (event) => {
      try {
        const fileContent = event.target?.result;
        if (!fileContent) return;
        const results = processExcelRawData(fileContent, isExcel);
        const mappedResults = results.map(r => {
           const gKey = Object.keys(r).find(k => ['nhomhang', 'nhomhanghoa', 'group'].includes(k));
           const amount = cleanVNNumber(r[Object.keys(r).find(k => ['doanhthu', 'tienhang', 'revenue'].includes(k))!]);
           let rawGroupName = (gKey && r[gKey]) ? String(r[gKey]).trim() : (amount > 0 ? 'Chưa phân loại' : '');
           return { ...r, _smartGroup: rawGroupName, _amount: amount };
        }).filter(r => r._smartGroup !== '');
        const rawGroupNames = Array.from(new Set(mappedResults.map(r => r._smartGroup)));
        const hierarchyFound: any[] = [];
        const existingPaths = effectiveGroups.map(g => g.name);
        rawGroupNames.forEach((raw: any) => {
          parseHierarchyGroups(raw).forEach(node => {
            if (!existingPaths.includes(node.fullPath) && !hierarchyFound.some(h => h.fullPath === node.fullPath)) {
              hierarchyFound.push({ ...node, selected: true });
            }
          });
        });
        const mappedGroupRev = mappedResults.map(r => ({
            date: parseVNDate(r[Object.keys(r).find(k => ['ngay', 'thoigian', 'date', 'time'].includes(k))!]) || 'AUTO_MONTH',
            fullPath: r._smartGroup,
            amount: r._amount,
            quantity: cleanVNNumber(r[Object.keys(r).find(k => ['slban', 'soluong', 'qty'].includes(k))!]),
            returnsQuantity: cleanVNNumber(r.sltra || r.soluongtra),
            returnsValue: cleanVNNumber(r.giatritra || r.trahang),
            netRevenue: cleanVNNumber(r.doanhthuthuan || r.netrevenue),
            cogs: cleanVNNumber(r.tonggiavon || r.giavon)
        }));

        // Detect conflicts
        const conflicts: any[] = [];
        const [year, month] = syncAccountingMonth.split('-').map(Number);
        const lastDay = new Date(year, month, 0).getDate();
        const resolvedDate = `${syncAccountingMonth}-${lastDay.toString().padStart(2, '0')}`;

        mappedGroupRev.forEach(p => {
          const pDate = p.date === 'AUTO_MONTH' ? resolvedDate : p.date;
          const existing = groupRevenue.find(r => r.date === pDate && r.groupName === p.fullPath);
          if (existing) {
            conflicts.push({
              date: pDate,
              groupName: p.fullPath,
              currentAmount: existing.amount,
              newAmount: p.amount
            });
          }
        });

        setGroupConflicts(conflicts);
        setPendingGroups(hierarchyFound.sort((a, b) => a.fullPath.localeCompare(b.fullPath)));
        setPendingGroupRevenue(mappedGroupRev);
        setIsAuditMode(true);
      } catch (err) { alert("Lỗi hệ thống khi xử lý file Excel."); }
    };
    if (isExcel) reader.readAsArrayBuffer(file); else reader.readAsText(file);
  };

  const handleCommitSync = async () => {
    setIsCommitting(true);
    try {
      const [year, month] = syncAccountingMonth.split('-').map(Number);
      const lastDay = new Date(year, month, 0).getDate();
      const resolvedDate = `${syncAccountingMonth}-${lastDay.toString().padStart(2, '0')}`;
      
      const newGroupsToSave: ProductGroup[] = pendingGroups.filter(g => g.selected).map(g => ({ id: generateId(), name: g.fullPath }));
      const allGroupsMerged = [...effectiveGroups, ...newGroupsToSave];
      await onUpdateGroups(allGroupsMerged);

      const recordsToCommit: ProductGroupRevenue[] = pendingGroupRevenue.map(p => {
        const matchingGroup = allGroupsMerged.find(g => g.name === p.fullPath);
        let finalGroupId = matchingGroup?.id || allGroupsMerged.find(g => p.fullPath.startsWith(g.name + ' >> '))?.id;
        return {
          id: generateId(), 
          date: p.date === 'AUTO_MONTH' ? resolvedDate : p.date,
          groupId: finalGroupId || '', 
          groupName: p.fullPath,
          amount: p.amount, 
          quantity: p.quantity, 
          returnsQuantity: p.returnsQuantity, 
          returnsValue: p.returnsValue,
          netRevenue: p.netRevenue || (p.amount - p.returnsValue), 
          cogs: p.cogs
        };
      }).filter(r => isUUID(r.groupId));

      let finalList = [...groupRevenue];

      if (conflictResolution === 'overwrite') {
        // Remove existing records that match date and groupName of new records
        const commitKeys = new Set(recordsToCommit.map(r => `${r.date}_${r.groupName}`));
        finalList = finalList.filter(r => !commitKeys.has(`${r.date}_${r.groupName}`));
        finalList = [...recordsToCommit, ...finalList];
      } else if (conflictResolution === 'skip') {
        // Only add records that don't already exist
        const existingKeys = new Set(groupRevenue.map(r => `${r.date}_${r.groupName}`));
        const filteredNew = recordsToCommit.filter(r => !existingKeys.has(`${r.date}_${r.groupName}`));
        finalList = [...filteredNew, ...groupRevenue];
      } else {
        // Add (current behavior)
        finalList = [...recordsToCommit, ...groupRevenue];
      }

      await onUpdateGroupRevenue(finalList);
      setIsAuditMode(false);
      setGroupConflicts([]);
      alert("Đồng bộ dữ liệu Nhóm hàng thành công!");
    } catch (err: any) { alert(`Lỗi khi lưu dữ liệu: ${err.message}`); } finally { setIsCommitting(false); }
  };

  const runStrategicDiagnosis = async () => {
    setIsDiagnosing(true);
    setDiagnosisResult(null);
    try {
      const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY });
      const prompt = `
        BẠN LÀ: SIÊU CHUYÊN GIA MIS & CHIẾN LƯỢC NGÀNH HÀNG.
        BỐI CẢNH: Phân tích so sánh trọng tâm Tháng ${selectedMonthNum} và dự báo Tháng ${nextMonthNum}.
        DỮ LIỆU THỰC TẾ THÁNG ${selectedMonthNum}:
        ${thisMonthTactical.map(g => `- Nhóm ${g.name}: Chiếm ${g.percent.toFixed(1)}% tổng ${viewMode === 'revenue' ? 'doanh thu' : 'số lượng'}`).join('\n')}
        DỮ LIỆU LỊCH SỬ THÁNG ${nextMonthNum}:
        ${nextMonthTactical.map(g => `- Nhóm ${g.name}: Thường đạt TB ${viewMode === 'revenue' ? formatNumber(g.avgRev) + 'đ' : formatNumber(g.avgQty) + ' đv'}`).join('\n')}
        YÊU CẦU:
        1. Nhận định về sự chuyển dịch trọng tâm giữa 2 tháng.
        2. Cảnh báo "Điểm rơi doanh số" nếu có nhóm hàng sụt giảm mạnh vào tháng tới.
        3. Đề xuất hành động cụ thể (Nhập hàng, Clear stock, Marketing) cho 3 nhóm hàng quan trọng nhất.
        Dùng Markdown, phong cách MIS Executive.
      `;
      const result = await ai.models.generateContent({ model: 'gemini-3-flash-preview', contents: prompt });
      setDiagnosisResult(result.text || "Lỗi AI.");
    } catch (err) { setDiagnosisResult("Lỗi kết nối AI Advisor."); }
    finally { setIsDiagnosing(false); }
  };

  const handleAddGroupRevenue = (e: React.FormEvent) => {
    e.preventDefault();
    const amountVal = Number(groupFormData.amount) || 0;
    const quantityVal = Number(groupFormData.quantity) || 0;
    const cogsVal = Number(groupFormData.cogs) || 0;
    
    const selectedGroup = effectiveGroups.find(g => g.id === groupFormData.groupId);
    if (!selectedGroup) return;

    const newRecord: ProductGroupRevenue = {
      id: generateId(),
      date: groupFormData.date,
      groupId: groupFormData.groupId,
      groupName: selectedGroup.name,
      amount: amountVal,
      quantity: quantityVal,
      netRevenue: amountVal, // Simplified for manual entry
      cogs: cogsVal
    };

    onUpdateGroupRevenue([newRecord, ...groupRevenue]);
    setGroupFormData({
      ...groupFormData,
      amount: '',
      quantity: '',
      netRevenue: '',
      returnsQuantity: '',
      returnsValue: '',
      cogs: ''
    });
  };

  const toggleNode = (fullPath: string) => {
    const newExpanded = new Set(expandedNodesStrategic);
    if (newExpanded.has(fullPath)) newExpanded.delete(fullPath);
    else newExpanded.add(fullPath);
    setExpandedNodesStrategic(newExpanded);
  };

  const toggleLedgerRow = (month: string, fullPath: string) => {
    const key = `${month}_${fullPath}`;
    const newExpanded = new Set(expandedLedgerRows);
    if (newExpanded.has(key)) newExpanded.delete(key);
    else newExpanded.add(key);
    setExpandedLedgerRows(newExpanded);
  };

  const visibleLedgerRows = useMemo(() => {
    let filteredRevenue = [...groupRevenue];
    if (filterStartDate) filteredRevenue = filteredRevenue.filter(r => r.date >= filterStartDate);
    if (filterEndDate) filteredRevenue = filteredRevenue.filter(r => r.date <= filterEndDate);
    const monthMap: Record<string, Record<string, any>> = {};
    filteredRevenue.forEach(rev => {
      const mY = rev.date.slice(0, 7); 
      if (!monthMap[mY]) monthMap[mY] = {};
      const path = rev.groupName;
      if (!monthMap[mY][path]) monthMap[mY][path] = { quantity: 0, amount: 0, returnsQuantity: 0, returnsValue: 0, net: 0, cogs: 0 };
      monthMap[mY][path].quantity += (rev.quantity || 0);
      monthMap[mY][path].amount += (rev.amount || 0);
      monthMap[mY][path].returnsValue += (rev.returnsValue || 0);
      monthMap[mY][path].net += (rev.netRevenue || (rev.amount || 0) - (rev.returnsValue || 0));
      monthMap[mY][path].cogs += (rev.cogs || 0);
    });
    const finalData: SeasonalRow[] = [];
    Object.keys(monthMap).sort((a,b) => b.localeCompare(a)).forEach(month => {
      const monthData = monthMap[month];
      const monthPaths = new Set<string>();
      Object.keys(monthData).forEach(path => {
        const parts = path.split(' >> ');
        let current = "";
        parts.forEach(p => { current = current ? `${current} >> ${p}` : p; monthPaths.add(current); });
      });
      const monthRows = Array.from(monthPaths).map(path => {
        const parts = path.split(' >> ');
        let q = 0, a = 0, rv = 0, n = 0, c = 0;
        Object.keys(monthData).forEach(dk => { if (dk === path || dk.startsWith(path + ' >> ')) { const m = monthData[dk]; q += m.quantity; a += m.amount; rv += m.returnsValue; n += m.net; c += m.cogs; } });
        return { month, groupName: path, fullPath: path, displayName: parts[parts.length-1], level: parts.length, quantity: q, amount: a, returnsQuantity: 0, returnsValue: rv, net: n, cogs: c, profit: n-c, margin: n > 0 ? ((n-c)/n)*100 : 0, hasChildren: Array.from(monthPaths).some(p => p.startsWith(path + ' >> ')) };
      });
      monthRows.sort((a,b) => a.fullPath.localeCompare(b.fullPath));
      finalData.push(...monthRows);
    });
    return finalData.filter(row => {
      if (row.level === 1) return true;
      const parts = row.fullPath.split(' >> ');
      let currentPath = "";
      for (let i = 0; i < parts.length - 1; i++) {
        currentPath = currentPath ? `${currentPath} >> ${parts[i]}` : parts[i];
        if (!expandedLedgerRows.has(`${row.month}_${currentPath}`)) return false;
      }
      return true;
    });
  }, [groupRevenue, expandedLedgerRows, filterStartDate, filterEndDate]);

  return (
    <div className="space-y-8 pb-20 max-w-full animate-in fade-in duration-500">
      
      {/* BỘ LỌC CHU KỲ HÀNG THÁNG */}
      <div className="bg-white p-8 md:p-10 rounded-[3.5rem] border border-slate-200 shadow-xl space-y-10">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-6">
           <div className="flex items-center gap-5">
              <div className="p-4 bg-indigo-600 text-white rounded-[1.5rem] shadow-lg"><History className="w-8 h-8" /></div>
              <div>
                 <h3 className="text-2xl font-black text-slate-900 uppercase tracking-tight">Đối Soát Quy Luật Chu Kỳ</h3>
                 <p className="text-[11px] text-indigo-600 font-bold uppercase tracking-widest mt-1">Tìm quy luật bán hàng qua nhiều năm</p>
              </div>
           </div>
           
           <div className="flex items-center gap-4 bg-slate-100 p-1.5 rounded-2xl border border-slate-200 shadow-inner">
              <button onClick={() => setViewMode('quantity')} className={`flex items-center gap-2 px-6 py-2.5 rounded-xl text-[10px] font-black uppercase tracking-widest transition-all ${viewMode === 'quantity' ? 'bg-white text-indigo-600 shadow-md' : 'text-slate-400 hover:text-slate-600'}`}>
                <Boxes className="w-4 h-4" /> Số lượng
              </button>
              <button onClick={() => setViewMode('revenue')} className={`flex items-center gap-2 px-6 py-2.5 rounded-xl text-[10px] font-black uppercase tracking-widest transition-all ${viewMode === 'revenue' ? 'bg-white text-emerald-600 shadow-md' : 'text-slate-400 hover:text-slate-600'}`}>
                <DollarSign className="w-4 h-4" /> Doanh thu
              </button>
           </div>
        </div>

        <div className="grid grid-cols-4 md:grid-cols-6 lg:grid-cols-12 gap-3">
           {Array.from({ length: 12 }, (_, i) => i + 1).map(m => (
             <button key={m} onClick={() => setSelectedMonthNum(m)} className={`group relative py-6 rounded-[1.5rem] text-[12px] font-black transition-all border-2 overflow-hidden ${selectedMonthNum === m ? 'bg-indigo-600 border-indigo-600 text-white shadow-2xl scale-110 z-10' : 'bg-white border-slate-100 text-slate-400 hover:border-indigo-200 hover:bg-slate-50'}`}>
               <span className="relative z-10">THÁNG {m}</span>
               {selectedMonthNum === m && <div className="absolute inset-0 bg-gradient-to-br from-white/20 to-transparent opacity-50"></div>}
             </button>
           ))}
        </div>
      </div>

      <div className="flex bg-slate-100 p-1.5 rounded-[2rem] w-fit mx-auto shadow-sm border border-slate-200">
        <button onClick={() => setActiveSubTab('seasonality')} className={`flex items-center gap-2 px-8 py-4 rounded-[1.5rem] font-black text-[10px] uppercase tracking-widest transition-all ${activeSubTab === 'seasonality' ? 'bg-white text-emerald-600 shadow-xl' : 'text-slate-400 hover:text-slate-600'}`}>
          <Sparkles className="w-4 h-4" /> Dự Báo Chiến Lược
        </button>
        <button onClick={() => setActiveSubTab('matrix')} className={`flex items-center gap-2 px-8 py-4 rounded-[1.5rem] font-black text-[10px] uppercase tracking-widest transition-all ${activeSubTab === 'matrix' ? 'bg-white text-indigo-600 shadow-xl' : 'text-slate-400 hover:text-slate-600'}`}>
          <Filter className="w-4 h-4" /> Ma Trận Phân Tích Năm
        </button>
        <button onClick={() => setActiveSubTab('ledger')} className={`flex items-center gap-2 px-8 py-4 rounded-[1.5rem] font-black text-[10px] uppercase tracking-widest transition-all ${activeSubTab === 'ledger' ? 'bg-white text-blue-600 shadow-xl' : 'text-slate-400 hover:text-slate-600'}`}>
          <FileSpreadsheet className="w-4 h-4" /> Sổ Cái Nhóm Hàng
        </button>
      </div>

      {activeSubTab === 'seasonality' && (
        <div className="space-y-10 animate-in fade-in duration-700">
           <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
              <MetricCard title={`Sản lượng Tháng ${selectedMonthNum}`} value={formatNumber(strategicKPIs.totalQty) + ' đv'} icon={Boxes} color="indigo" desc="Tổng bán trong tháng này (Tất cả các năm)" />
              <MetricCard title={`Doanh thu Tháng ${selectedMonthNum}`} value={formatNumber(strategicKPIs.totalRev) + 'đ'} icon={DollarSign} color="emerald" desc="Tổng thu hạch toán" />
              <MetricCard title="Dự báo Tháng Sau" value={`T${nextMonthNum}`} icon={TrendingUp} color="emerald" desc="Chu kỳ bùng nổ tiếp theo" />
              <MetricCard title="Nhóm chủ lực" value={`${thisMonthTactical.length} Nhóm`} icon={Star} color="indigo" desc="Số lượng nhóm hàng đóng góp chính" />
           </div>

           <div className="grid grid-cols-1 lg:grid-cols-10 gap-8">
              {/* TACTICAL COLUMN LEFT: CURRENT MONTH FOCUS */}
              <div className="lg:col-span-5 bg-white p-10 rounded-[3.5rem] border border-slate-200 shadow-xl flex flex-col">
                 <div className="flex items-center justify-between mb-10">
                    <div className="flex items-center gap-4">
                       <div className="p-3 bg-emerald-100 text-emerald-600 rounded-2xl shadow-sm"><Target className="w-6 h-6" /></div>
                       <div>
                          <h3 className="text-xl font-black text-slate-900 uppercase tracking-tight">Trọng tâm Tháng {selectedMonthNum}</h3>
                          <p className="text-[10px] text-emerald-600 font-bold uppercase tracking-widest">Xếp hạng thực tế theo {viewMode === 'revenue' ? 'Doanh thu' : 'Số lượng'}</p>
                       </div>
                    </div>
                 </div>
                 
                 <div className="space-y-6 flex-1 pr-2 overflow-y-auto no-scrollbar max-h-[500px]">
                    {thisMonthTactical.map((g, idx) => (
                       <div key={g.name} className="space-y-2 group">
                          <div className="flex justify-between items-end">
                             <div className="flex items-center gap-3">
                                <span className={`w-6 h-6 rounded-lg flex items-center justify-center text-[10px] font-black ${idx === 0 ? 'bg-emerald-600 text-white shadow-lg' : 'bg-slate-100 text-slate-400'}`}>{idx + 1}</span>
                                <span className="text-sm font-black text-slate-800 uppercase truncate max-w-[200px]">{g.name}</span>
                                {idx === 0 && <span className="px-2 py-0.5 bg-amber-100 text-amber-600 rounded text-[8px] font-black uppercase flex items-center gap-1"><Award className="w-2.5 h-2.5" /> Best Seller</span>}
                             </div>
                             <div className="text-right">
                                <span className="text-xs font-black text-emerald-700">{g.percent.toFixed(1)}%</span>
                             </div>
                          </div>
                          <div className="w-full h-2 bg-slate-50 rounded-full overflow-hidden border border-slate-100/50">
                             <div className="h-full bg-emerald-500 rounded-full transition-all duration-1000 group-hover:bg-emerald-400" style={{ width: `${g.percent}%` }}></div>
                          </div>
                          <p className="text-[9px] font-bold text-slate-400 uppercase tracking-tighter">Đạt: {viewMode === 'revenue' ? formatNumber(g.rev) + 'đ' : formatNumber(g.qty) + ' đv'}</p>
                       </div>
                    ))}
                 </div>
              </div>

              {/* TACTICAL COLUMN RIGHT: NEXT MONTH STRATEGY */}
              <div className="lg:col-span-5 bg-white p-10 rounded-[3.5rem] border border-indigo-100 shadow-xl flex flex-col relative overflow-hidden">
                 <div className="absolute top-0 right-0 p-8 opacity-5"><Zap className="w-32 h-32 text-indigo-600" /></div>
                 <div className="flex items-center justify-between mb-10 relative z-10">
                    <div className="flex items-center gap-4">
                       <div className="p-3 bg-indigo-100 text-indigo-600 rounded-2xl shadow-sm"><Briefcase className="w-6 h-6" /></div>
                       <div>
                          <h3 className="text-xl font-black text-slate-900 uppercase tracking-tight">Gợi ý Chiến lược Tháng {nextMonthNum}</h3>
                          <p className="text-[10px] text-indigo-600 font-bold uppercase tracking-widest">Dự báo dựa trên TB lịch sử {years.length} năm</p>
                       </div>
                    </div>
                 </div>

                 <div className="space-y-4 flex-1 pr-2 overflow-y-auto no-scrollbar max-h-[500px] relative z-10">
                    {nextMonthTactical.map((g, idx) => (
                       <div key={g.name} className="p-5 bg-indigo-50/30 border border-indigo-100/50 rounded-[1.5rem] hover:bg-white hover:shadow-lg transition-all group">
                          <div className="flex justify-between items-start mb-3">
                             <div className="flex items-center gap-3">
                                <div className="p-2 bg-white rounded-xl shadow-sm group-hover:bg-indigo-600 group-hover:text-white transition-colors"><TrendingUp className="w-4 h-4" /></div>
                                <span className="text-xs font-black text-slate-800 uppercase truncate max-w-[180px]">{g.name}</span>
                             </div>
                             <div className="text-right">
                                <div className="flex items-center gap-1 text-indigo-600">
                                   <ArrowUp className="w-3 h-3" />
                                   <span className="text-[10px] font-black uppercase">Trend Up</span>
                                </div>
                             </div>
                          </div>
                          <div className="flex items-center justify-between">
                             <div className="space-y-1">
                                <p className="text-[9px] font-black text-slate-400 uppercase tracking-widest">Dự báo hiệu suất</p>
                                <p className="text-sm font-black text-indigo-700">{viewMode === 'revenue' ? formatNumber(g.avgRev) + 'đ' : formatNumber(g.avgQty) + ' đv'}</p>
                             </div>
                             <div className="px-3 py-1.5 bg-white border border-indigo-100 rounded-lg text-[8px] font-black text-indigo-500 uppercase tracking-widest group-hover:bg-indigo-600 group-hover:text-white transition-all">
                                {idx < 3 ? 'Ưu tiên nhập hàng' : 'Đẩy mạnh Marketing'}
                             </div>
                          </div>
                       </div>
                    ))}
                 </div>
              </div>
           </div>

           {/* AI ADVISOR & DIAGNOSIS */}
           <div className="grid grid-cols-1 lg:grid-cols-10 gap-8">
              <div className="lg:col-span-10 bg-slate-900 p-10 md:p-14 rounded-[4rem] text-white shadow-2xl relative overflow-hidden">
                 <div className="absolute top-0 right-0 p-10 opacity-10"><Sparkles className="w-48 h-48 text-emerald-400" /></div>
                 <div className="flex flex-col md:flex-row md:items-center justify-between gap-10 relative z-10">
                    <div>
                       <div className="flex items-center gap-3 text-emerald-400 font-black uppercase text-[10px] tracking-widest mb-4">
                          <Activity className="w-4 h-4" /> Strategic MIS Intelligence
                       </div>
                       <h3 className="text-4xl font-black uppercase tracking-tighter leading-tight">Seasonal Advisor</h3>
                       <p className="text-slate-400 text-lg mt-4 max-w-2xl font-medium">Đối soát sự chuyển dịch thị trường từ Tháng {selectedMonthNum} sang Tháng {nextMonthNum} để tối ưu kho vận.</p>
                    </div>
                    <button onClick={runStrategicDiagnosis} disabled={isDiagnosing} className="px-12 py-7 bg-emerald-600 hover:bg-emerald-500 text-white rounded-[2.5rem] font-black text-xs uppercase tracking-[0.2em] shadow-2xl flex items-center justify-center gap-4 active:scale-95 transition-all disabled:opacity-50">
                       {isDiagnosing ? <Loader2 className="w-6 h-6 animate-spin" /> : <DatabaseZap className="w-6 h-6" />}
                       {isDiagnosing ? "Đang giải mã chu kỳ..." : "Khởi tạo Chẩn đoán Chiến lược"}
                    </button>
                 </div>

                 {diagnosisResult && (
                    <div className="mt-12 bg-white border border-slate-200 rounded-[3.5rem] p-12 shadow-2xl animate-in slide-in-from-top-4 duration-500 relative z-10">
                       <div className="flex items-center justify-between mb-8 border-b border-slate-50 pb-8">
                          <div className="flex items-center gap-4">
                             <div className="p-3 bg-emerald-100 text-emerald-600 rounded-2xl shadow-lg"><FileText className="w-6 h-6" /></div>
                             <h4 className="text-xl font-black text-slate-900 uppercase tracking-tight">Báo Cáo Phân Tích Chu Kỳ Kinh Doanh</h4>
                          </div>
                          <button onClick={() => setDiagnosisResult(null)} className="p-2 text-slate-300 hover:text-rose-500 transition-colors"><X className="w-6 h-6" /></button>
                       </div>
                       <div className="markdown-content text-slate-800" dangerouslySetInnerHTML={{ __html: String(marked.parse(String(diagnosisResult))) }} />
                    </div>
                 )}
              </div>
           </div>
        </div>
      )}

      {activeSubTab === 'matrix' && (
        <div className="bg-white rounded-[3.5rem] p-8 md:p-12 border border-slate-200 shadow-xl flex flex-col gap-10">
          <div className="flex flex-col md:flex-row items-center justify-between gap-6 border-b border-slate-100 pb-10">
             <div className="flex items-center gap-5">
                <div className={`p-4 ${viewMode === 'revenue' ? 'bg-emerald-600' : 'bg-indigo-600'} rounded-[1.5rem] text-white shadow-lg transition-colors`}>
                   {viewMode === 'revenue' ? <DollarSign className="w-6 h-6" /> : <Boxes className="w-6 h-6" />}
                </div>
                <div>
                   <h3 className="text-2xl font-black text-slate-900 uppercase tracking-tight">Ma Trận Đối Soát: Tháng {selectedMonthNum} Qua Các Năm</h3>
                   <p className="text-[10px] text-indigo-600 font-bold uppercase tracking-widest mt-1">Tự động sắp xếp nhóm hàng từ cao xuống thấp.</p>
                </div>
             </div>
             <div className="px-6 py-3 bg-slate-50 rounded-2xl border border-slate-100 flex items-center gap-3">
                <div className="flex flex-col items-end">
                   <span className="text-[9px] font-black text-slate-400 uppercase tracking-widest">Tiêu chí hiển thị</span>
                   <span className={`text-xs font-black uppercase ${viewMode === 'revenue' ? 'text-emerald-600' : 'text-indigo-600'}`}>{viewMode === 'revenue' ? 'Doanh thu (đ)' : 'Số lượng (đv)'}</span>
                </div>
                <ArrowUpDown className="w-4 h-4 text-slate-300" />
             </div>
          </div>
          
          <div className="bg-white rounded-[2rem] border border-slate-200 shadow-sm overflow-x-auto no-scrollbar">
             <table className="w-full border-collapse">
                <thead>
                  <tr className="bg-slate-50 border-b border-slate-200 text-[11px] font-black text-slate-500 uppercase tracking-widest">
                    <th className="p-6 text-left min-w-[280px] sticky left-0 bg-slate-50 z-20 border-r border-slate-200">Nhóm Hàng (Xếp hạng)</th>
                    {years.map(y => <th key={y} className="p-6 text-center w-[180px] border-r border-slate-100">Tháng {selectedMonthNum}/{y}</th>) }
                    <th className="p-6 text-center w-[180px] bg-slate-100 font-black text-slate-900 border-l border-slate-200">Tổng Chu Kỳ</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-50">
                  {matrixData.map((row, idx) => {
                    const isExpanded = expandedNodesStrategic.has(row.name);
                    return (
                      <tr key={String(row.id)} className="group hover:bg-slate-50 transition-all">
                        <td className="p-5 sticky left-0 z-10 border-r border-slate-100 bg-white group-hover:bg-slate-50" style={{ paddingLeft: `${row.level * 20}px` }}>
                          <div className="flex items-center gap-3">
                             <span className="text-[10px] font-black text-slate-300">#{idx + 1}</span>
                             {row.isParent && (
                               <button onClick={() => toggleNode(row.name)} className="p-1 rounded bg-slate-100 text-slate-500">
                                 {isExpanded ? <ChevronDown className="w-3 h-3" /> : <ChevronRight className="w-3 h-3" />}
                               </button>
                             )}
                             <span className={`text-xs uppercase ${row.level === 1 ? 'font-black text-slate-900' : 'font-bold text-slate-500'}`}>{String(row.displayName)}</span>
                          </div>
                        </td>
                        {years.map(y => {
                          const val = row.yearValues[y] || 0;
                          return <td key={y} className={`p-5 text-center tabular-nums text-xs border-r border-slate-50 ${getHeatmapColor(val)}`}>{val > 0 ? formatNumber(val) : '0'}</td>;
                        })}
                        <td className="p-5 text-center tabular-nums text-xs font-black bg-slate-50 border-l border-slate-100">
                           {formatNumber(row.totalAllYearsMetric)}
                           <span className="ml-1 opacity-40">{viewMode === 'revenue' ? 'đ' : 'đv'}</span>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
             </table>
          </div>
        </div>
      )}

      {activeSubTab === 'ledger' && (
        <div className="space-y-8 animate-in slide-in-from-bottom-4">
          <div className="grid grid-cols-1 lg:grid-cols-10 gap-6">
            <div className="lg:col-span-4 bg-white rounded-[2.5rem] border-2 border-dashed border-slate-200 hover:border-blue-400 hover:bg-blue-50/20 transition-all p-10 shadow-sm relative group flex flex-col items-center justify-center text-center">
              <input type="file" accept=".csv, .xlsx, .xls" ref={fileInputRef} className="hidden" onChange={handleFileUpload} />
              <button onClick={() => fileInputRef.current?.click()} className="w-20 h-20 rounded-full bg-slate-50 flex items-center justify-center border-2 border-dashed border-slate-200 group-hover:border-blue-300 group-hover:bg-white transition-all shadow-sm mb-6"><Upload className="w-8 h-8 text-blue-600" /></button>
              <h3 className="text-sm font-black text-slate-900 uppercase tracking-widest">Đồng bộ Báo cáo KiotViet</h3>
            </div>
            <div className="lg:col-span-6 bg-white p-8 rounded-[2.5rem] border border-slate-200 shadow-xl">
              <h3 className="text-xs font-black text-slate-900 mb-6 flex items-center gap-3"><div className="p-2 bg-blue-600 rounded-lg text-white"><Plus className="w-3.5 h-3.5" /></div> NHẬP NHANH CHỈ SỐ</h3>
              <form onSubmit={handleAddGroupRevenue} className="space-y-3">
                <div className="grid grid-cols-2 gap-3">
                   <InputWrapper label="Ngày" icon={Calendar}><input type="date" required value={groupFormData.date} onChange={e => setGroupFormData({...groupFormData, date: e.target.value})} className="input-field py-2.5 font-bold text-[10px] border-none" /></InputWrapper>
                   <InputWrapper label="SL bán" icon={Hash}><input type="number" required placeholder="0" value={groupFormData.quantity} onChange={e => setGroupFormData({...groupFormData, quantity: e.target.value})} className="input-field py-2.5 font-bold text-[10px] border-none" /></InputWrapper>
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <InputWrapper label="Doanh thu" icon={DollarSign} color="text-blue-600"><input type="number" required placeholder="0" value={groupFormData.amount} onChange={e => setGroupFormData({...groupFormData, amount: e.target.value})} className="input-field py-2.5 font-bold text-[10px] border-none" /></InputWrapper>
                  <InputWrapper label="Giá vốn" icon={ShoppingCart} color="text-slate-600"><input type="number" placeholder="0" value={groupFormData.cogs} onChange={e => setGroupFormData({...groupFormData, cogs: e.target.value})} className="input-field py-2.5 font-bold text-[10px] border-none" /></InputWrapper>
                </div>
                <InputWrapper label="Nhóm Hàng" icon={Layers}>
                  <select value={groupFormData.groupId} required onChange={e => setGroupFormData({...groupFormData, groupId: e.target.value})} className="input-field py-2.5 font-bold text-[10px] border-none appearance-none bg-transparent">
                    <option value="">Chọn nhóm...</option>
                    {effectiveGroups.map(g => <option key={g.id} value={g.id}>{String(g.name)}</option>)}
                  </select>
                </InputWrapper>
                <button type="submit" className="w-full bg-slate-900 hover:bg-black text-white py-3.5 rounded-xl font-black text-[9px] uppercase tracking-widest transition-all shadow-xl">GHI NHẬN CHỈ SỐ</button>
              </form>
            </div>
          </div>

          <div className="bg-white rounded-[2.5rem] border border-slate-200 shadow-xl overflow-hidden">
             <div className="px-8 py-6 bg-slate-50 border-b border-slate-100 flex flex-col xl:flex-row justify-between items-start xl:items-center gap-6">
                <div className="flex items-center gap-4">
                   <div className="p-2.5 bg-blue-600 text-white rounded-xl shadow-lg"><FileSpreadsheet className="w-5 h-5" /></div>
                   <h3 className="text-sm font-black text-slate-900 uppercase tracking-tight">Sổ Cái Nhóm Hàng Chi Tiết</h3>
                </div>
                <div className="flex items-center gap-3">
                   <div className="flex items-center gap-2 bg-white border border-slate-200 p-1.5 rounded-xl shadow-sm">
                      <input type="date" value={filterStartDate} onChange={e => setFilterStartDate(e.target.value)} className="bg-transparent text-[10px] font-bold text-slate-600 outline-none" />
                      <input type="date" value={filterEndDate} onChange={e => setFilterEndDate(e.target.value)} className="bg-transparent text-[10px] font-bold text-slate-600 outline-none ml-2" />
                   </div>
                </div>
             </div>
             <div className="overflow-x-auto">
                <table className="w-full text-left border-collapse">
                  <thead>
                    <tr className="text-[9px] font-black text-slate-400 uppercase tracking-widest bg-white border-b border-slate-100">
                      <th className="px-8 py-6 w-[220px]">Thời gian / Nhóm</th>
                      <th className="px-4 py-6 text-right">SL bán</th>
                      <th className="px-4 py-6 text-right text-blue-600">Doanh thu thuần</th>
                      <th className="px-4 py-6 text-right text-rose-600">Giá vốn</th>
                      <th className="px-4 py-6 text-right font-black bg-emerald-50 text-emerald-800">Lợi nhuận gộp</th>
                      <th className="px-4 py-6 text-center text-indigo-600 font-black w-[100px]">Tỉ suất LN</th>
                      <th className="px-4 py-6 text-center w-[60px]">Xóa</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-50 tabular-nums text-[10px] font-bold">
                    {visibleLedgerRows.map((row) => {
                        const isExp = expandedLedgerRows.has(`${row.month}_${row.fullPath}`);
                        const marginColor = row.margin > 30 ? 'text-emerald-600 bg-emerald-50' : row.margin >= 15 ? 'text-indigo-600 bg-indigo-50' : 'text-rose-600 bg-rose-50';
                        
                        return (
                          <tr key={`${row.month}_${row.fullPath}`} className="group hover:bg-slate-50 transition-all">
                            <td className="px-8 py-4" style={{ paddingLeft: `${row.level * 20}px` }}>
                              <div className="flex items-center gap-2">
                                 {row.hasChildren && (
                                   <button onClick={() => toggleLedgerRow(row.month, row.fullPath)} className="p-1 rounded bg-slate-100 text-slate-500">
                                     {isExp ? <ChevronDown className="w-3 h-3" /> : <ChevronRight className="w-3 h-3" />}
                                   </button>
                                 )}
                                 <div>
                                   {row.level === 1 && <p className="text-[8px] font-black text-slate-400 mb-0.5">{String(row.month)}</p>}
                                   <p className={`uppercase ${row.level === 1 ? 'text-slate-900' : 'text-slate-500 font-medium'}`}>{String(row.displayName)}</p>
                                 </div>
                              </div>
                            </td>
                            <td className="px-4 py-4 text-right">{String(row.quantity)}</td>
                            <td className="px-4 py-4 text-right text-blue-900 bg-blue-50/20">{formatNumber(row.net)}</td>
                            <td className="px-4 py-4 text-right text-rose-500">{formatNumber(Math.abs(row.cogs))}</td>
                            <td className="px-4 py-4 text-right font-black text-emerald-700 bg-emerald-50/20">{formatNumber(row.profit)}</td>
                            <td className="px-4 py-4 text-center">
                               <div className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl font-black text-[10px] ${marginColor}`}>
                                  <Percent className="w-3 h-3" />
                                  {row.margin.toFixed(1)}%
                               </div>
                            </td>
                            <td className="px-4 py-4 text-center">
                               <button onClick={() => onUpdateGroupRevenue(groupRevenue.filter(r => !(r.date.startsWith(row.month) && r.groupName === row.fullPath)))} className="text-slate-200 hover:text-rose-500 transition-colors"><Trash2 className="w-4 h-4" /></button>
                            </td>
                          </tr>
                        );
                      })
                    }
                  </tbody>
                </table>
             </div>
          </div>
        </div>
      )}

      {/* SYNC AUDIT MODAL */}
      {isAuditMode && (
        <div className="fixed inset-0 z-[110] flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-slate-900/60 backdrop-blur-md" onClick={() => setIsAuditMode(false)}></div>
          <div className="relative bg-white w-full max-w-4xl max-h-[90vh] overflow-hidden rounded-[3.5rem] shadow-2xl animate-in zoom-in-95 duration-200 flex flex-col">
            <div className="p-10 border-b border-slate-100 bg-indigo-50 flex items-center justify-between">
              <div className="flex items-center gap-5">
                <div className="p-4 bg-indigo-600 text-white rounded-3xl shadow-xl"><ShieldAlert className="w-8 h-8" /></div>
                <div>
                   <h3 className="text-2xl font-black text-slate-900 uppercase tracking-tight">Đối Soát Nhóm Hàng</h3>
                   <p className="text-[10px] text-indigo-600 font-bold uppercase tracking-widest mt-1">Phát hiện cấu trúc mới</p>
                </div>
              </div>
              <button onClick={() => setIsAuditMode(false)} className="p-3 bg-white text-slate-400 hover:text-rose-600 rounded-2xl transition-all"><X className="w-6 h-6" /></button>
            </div>
            
            <div className="flex-1 overflow-y-auto p-10 space-y-10 no-scrollbar">
              <div className="bg-amber-50 p-6 rounded-[2rem] border-2 border-dashed border-amber-200 flex items-start gap-5">
                 <div className="p-2 bg-amber-500 text-white rounded-xl"><Info className="w-6 h-6" /></div>
                 <div>
                    <p className="text-xs font-black text-amber-900 uppercase">Thông tin đồng bộ</p>
                    <p className="text-sm text-amber-800 mt-1 font-medium">Tìm thấy <strong>{pendingGroupRevenue.length}</strong> dòng doanh thu.</p>
                 </div>
              </div>

              {pendingGroups.length > 0 && (
                <div className="space-y-6">
                   <h4 className="text-sm font-black text-slate-800 uppercase flex items-center gap-3">
                      <div className="w-2 h-2 bg-indigo-600 rounded-full"></div>
                      NHÓM HÀNG MỚI PHÁT HIỆN
                   </h4>
                   <div className="grid grid-cols-1 md:grid-cols-2 gap-3 max-h-[200px] overflow-y-auto pr-2">
                      {pendingGroups.map((g, idx) => (
                        <div key={idx} className="flex items-center gap-4 p-4 bg-slate-50 rounded-2xl border border-slate-100">
                           <input type="checkbox" checked={g.selected} onChange={() => { const next = [...pendingGroups]; next[idx].selected = !next[idx].selected; setPendingGroups(next); }} className="w-5 h-5 rounded text-indigo-600" />
                           <div><p className="text-[10px] font-black text-slate-400 uppercase">Cấp {g.level}</p><p className="text-xs font-bold text-slate-800 truncate">{g.fullPath}</p></div>
                        </div>
                      ))}
                   </div>
                </div>
              )}

              {groupConflicts.length > 0 && (
                <div className="space-y-6">
                   <h4 className="text-sm font-black text-rose-600 uppercase flex items-center gap-3">
                      <div className="w-2 h-2 bg-rose-600 rounded-full"></div>
                      PHÁT HIỆN {groupConflicts.length} DÒNG DỮ LIỆU TRÙNG LẶP
                   </h4>
                   
                   <div className="bg-rose-50 p-6 rounded-3xl border border-rose-100 space-y-4">
                      <p className="text-xs font-bold text-rose-800 uppercase tracking-tight">Chọn phương án xử lý trùng lặp:</p>
                      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                        {[
                          { id: 'overwrite', label: 'Ghi đè số mới', desc: 'Thay thế số cũ' },
                          { id: 'skip', label: 'Bỏ qua trùng', desc: 'Chỉ lấy dòng mới' },
                          { id: 'add', label: 'Cộng dồn thêm', desc: 'Cộng vào số cũ' }
                        ].map(opt => (
                          <button
                            key={opt.id}
                            onClick={() => setConflictResolution(opt.id as any)}
                            className={`p-4 rounded-2xl border-2 text-left transition-all ${conflictResolution === opt.id ? 'bg-white border-rose-500 shadow-md' : 'bg-white/50 border-transparent text-slate-400 hover:bg-white'}`}
                          >
                            <p className={`text-[10px] font-black uppercase ${conflictResolution === opt.id ? 'text-rose-600' : 'text-slate-400'}`}>{opt.label}</p>
                            <p className="text-[9px] font-medium mt-1">{opt.desc}</p>
                          </button>
                        ))}
                      </div>
                   </div>

                   <div className="max-h-[200px] overflow-y-auto pr-2 border border-slate-100 rounded-2xl">
                      <table className="w-full text-[10px] text-left">
                        <thead className="bg-slate-50 sticky top-0">
                          <tr className="text-slate-400 font-black uppercase">
                            <th className="p-3">Ngày</th>
                            <th className="p-3">Nhóm hàng</th>
                            <th className="p-3 text-right">Số cũ</th>
                            <th className="p-3 text-right text-rose-600">Số mới</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-50">
                          {groupConflicts.map((c, i) => (
                            <tr key={i} className="hover:bg-slate-50">
                              <td className="p-3 font-bold">{c.date}</td>
                              <td className="p-3 font-bold truncate max-w-[150px]">{c.groupName}</td>
                              <td className="p-3 text-right">{formatNumber(c.currentAmount)}</td>
                              <td className="p-3 text-right font-black text-rose-600">{formatNumber(c.newAmount)}</td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                   </div>
                </div>
              )}

              <div className="p-8 bg-slate-900 rounded-[2.5rem] text-white flex items-center justify-between">
                 <div className="flex items-center gap-6">
                    <div className="text-center">
                       <p className="text-[10px] font-black text-slate-400 uppercase mb-1">Tổng bản ghi</p>
                       <p className="text-2xl font-black">{pendingGroupRevenue.length}</p>
                    </div>
                    <div className="text-center">
                       <p className="text-[10px] font-black text-slate-400 uppercase mb-1">Tổng doanh thu</p>
                       <p className="text-2xl font-black text-emerald-400">{formatNumber(pendingGroupRevenue.reduce((s,r) => s + (r.amount || 0), 0))}đ</p>
                    </div>
                 </div>
                 <div className="flex items-center gap-3">
                    <span className="text-[10px] font-black text-slate-400 uppercase">Tháng hạch toán:</span>
                    <input type="month" value={syncAccountingMonth} onChange={e => setSyncAccountingMonth(e.target.value)} className="bg-white/10 border border-white/20 rounded-xl px-4 py-2 text-xs font-bold text-white" />
                 </div>
              </div>
            </div>

            <div className="p-10 border-t border-slate-100 bg-slate-50/50 flex items-center justify-between">
               <button onClick={() => setIsAuditMode(false)} className="px-10 py-5 rounded-2xl font-black text-xs text-slate-400 uppercase tracking-widest">Hủy bỏ</button>
               <button onClick={handleCommitSync} disabled={isCommitting} className="px-14 py-5 bg-indigo-600 text-white rounded-2xl font-black text-xs uppercase tracking-widest shadow-2xl flex items-center gap-4 transition-all disabled:opacity-50">
                 {isCommitting ? <Loader2 className="w-5 h-5 animate-spin" /> : <DatabaseZap className="w-5 h-5" />}
                 Xác nhận đồng bộ lên Cloud
               </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

const MetricCard = ({ title, value, icon: Icon, color, desc }: any) => {
  const colorMap: any = { indigo: 'bg-indigo-50 text-indigo-600', rose: 'bg-rose-50 text-rose-600', emerald: 'bg-emerald-50 text-emerald-600', amber: 'bg-amber-50 text-amber-600' };
  return (
    <div className="bg-white p-8 rounded-[2.5rem] border border-slate-200 shadow-xl flex flex-col justify-between transition-all hover:-translate-y-1">
      <div>
        <div className={`p-4 rounded-2xl ${colorMap[color]} w-fit mb-6 shadow-sm`}><Icon className="w-6 h-6" /></div>
        <p className="text-[9px] font-black text-slate-400 uppercase tracking-widest mb-1">{String(title)}</p>
        <h4 className="text-xl font-black text-slate-900 tabular-nums">{String(value)}</h4>
      </div>
      <p className="text-[8px] font-black text-slate-400 uppercase tracking-tighter mt-4 pt-4 border-t border-slate-50 leading-relaxed">{String(desc)}</p>
    </div>
  );
};

const InputWrapper = ({ label, icon: Icon, children, color = "text-slate-400" }: any) => (
  <div className="space-y-1.5">
    <label className="text-[9px] font-black text-slate-400 uppercase tracking-widest ml-1">{String(label)}</label>
    <div className="relative bg-slate-50 border border-slate-100 focus-within:bg-white focus-within:border-blue-500 rounded-xl transition-all shadow-inner overflow-hidden flex items-center">
      <Icon className={`absolute left-3 w-3.5 h-3.5 ${color}`} />
      <div className="pl-9 w-full">{children}</div>
    </div>
  </div>
);

export default ProductGroupManager;
