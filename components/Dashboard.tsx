
import React, { useMemo, useState } from 'react';
import { AppData, DiagnosisRange } from '../types';
import { 
  PieChart, Pie, Cell, ResponsiveContainer, Tooltip,
  BarChart, Bar, XAxis, YAxis, CartesianGrid, LabelList,
  LineChart, Line, Legend, AreaChart, Area
} from 'recharts';
import { 
  DollarSign, Wallet, Users, AlertCircle, 
  ShieldCheck, ShieldAlert, Zap, Activity, HeartPulse, Search, ArrowUpRight, 
  Sparkles, BrainCircuit, Loader2, FileText, ChevronRight, Target, X as XIcon,
  ShoppingCart, Fingerprint, Lightbulb, Bell, ArrowRight, Gauge, Briefcase, 
  Trophy, AlertTriangle, Calendar, ArrowRightLeft, Info, Filter, MousePointer2,
  Maximize2, BarChart3, PieChart as PieChartIcon, Settings2
} from 'lucide-react';
import { calculateFinancialHealthScore, auditFinancials, calculateTimeContext, getCategoryType, getTopLevelCategory } from '../businessLogic';
import DailyBreakEven from './DailyBreakEven';
import TimeFilter from './TimeFilter';
import { GoogleGenAI } from "@google/genai";
import { marked } from "marked";

interface DashboardProps {
  data: AppData;
  breakEvenAnalysis: any;
  onUpdateData: (key: any, newList: any) => void;
  diagnosisRange: DiagnosisRange;
  setDiagnosisRange: (range: DiagnosisRange) => void;
  diagStartDate: string;
  setDiagStartDate: (date: string) => void;
  diagEndDate: string;
  setDiagEndDate: (date: string) => void;
}

const Dashboard: React.FC<DashboardProps> = ({ 
  data, 
  breakEvenAnalysis,
  onUpdateData,
  diagnosisRange,
  setDiagnosisRange,
  diagStartDate,
  setDiagStartDate,
  diagEndDate,
  setDiagEndDate
}) => {
  const [isDiagnosing, setIsDiagnosing] = useState(false);
  const [diagnosisResult, setDiagnosisResult] = useState<string | null>(null);
  const [activeSubTab, setActiveSubTab] = useState<'kpi' | 'trends' | 'ai' | 'structure'>('kpi');
  const [selectedParentCategory, setSelectedParentCategory] = useState<string | null>(null);
  const [selectedTrendMonth, setSelectedTrendMonth] = useState<string | null>(null);
  const [isShrunk, setIsShrunk] = useState(false);

  React.useEffect(() => {
    const mainContainer = document.querySelector('main');
    if (!mainContainer) return;

    const handleScroll = () => {
      setIsShrunk(mainContainer.scrollTop > 10);
    };

    mainContainer.addEventListener('scroll', handleScroll);
    return () => mainContainer.removeEventListener('scroll', handleScroll);
  }, []);
  
  const timeContext = useMemo(() => {
    return calculateTimeContext(diagnosisRange, diagStartDate, diagEndDate);
  }, [diagnosisRange, diagStartDate, diagEndDate]);

  // LOGIC LỌC DỮ LIỆU THEO KHOẢNG THỜI GIAN
  const filteredData = useMemo(() => {
    const { start, end } = timeContext;
    
    const filterFn = (item: { date: string }) => item.date >= start && item.date <= end;
    
    // Payroll usually has a 'month' field (YYYY-MM)
    // We'll try to match it if the range covers the whole month or contains it
    const payrollFilterFn = (p: { month: string }) => {
      const monthStart = `${p.month}-01`;
      const monthEnd = `${p.month}-31`; // Rough check
      return (monthStart >= start && monthStart <= end) || (monthEnd >= start && monthEnd <= end) || (start >= monthStart && start <= monthEnd);
    };

    return {
      ...data,
      revenue: data.revenue.filter(filterFn),
      expenses: data.expenses.filter(filterFn),
      sales: data.sales.filter(filterFn),
      attendance: data.attendance.filter(filterFn),
      overtime: data.overtime.filter(filterFn),
      payroll: data.payroll.filter(payrollFilterFn),
      timeContext,
    };
  }, [data, timeContext]);

  // RE-CALCULATE INSIGHTS BASED ON FILTERED DATA
  const insights = useMemo(() => {
    const revList = filteredData.revenue;
    const expenseCategories = data.expenseCategories || [];
    
    let ledgerSalaryTotal = 0;
    const expList = filteredData.expenses.filter(e => {
      const topLevel = getTopLevelCategory(e.category, expenseCategories);
      const isSalary = topLevel === 'Nhân sự' || topLevel === 'Nhân viên' || topLevel === 'Lương';
      if (isSalary) ledgerSalaryTotal += (Number(e.amount) || 0);
      return !isSalary;
    });
    const payrollList = filteredData.payroll;

    const totalRev = revList.reduce((sum, r) => sum + (Number(r.netRevenue) || 0) + (Number(r.revenueOther) || 0), 0);
    const payrollNetPayTotal = payrollList.reduce((sum, p) => sum + (Number(p.netPay) || 0), 0);
    
    // Smart Priority: Use payroll records if available, otherwise use ledger entries marked as Personnel
    const finalPersonnelTotal = payrollNetPayTotal > 0 ? payrollNetPayTotal : ledgerSalaryTotal;

    const totalExp = expList.reduce((sum, e) => sum + (Number(e.amount) || 0), 0) + finalPersonnelTotal;
    const totalGross = revList.reduce((sum, r) => sum + (Number(r.grossProfit) || 0), 0);
    
    const netProfit = totalGross - totalExp;

    const activeStaff = data.employees.filter(e => {
        const resigned = e.resignedDate || e.resigned_date;
        return !resigned || String(resigned).trim() === "";
    });

    const totalCogsFromRevenue = revList.reduce((sum, r) => sum + (Number(r.totalCogs) || 0), 0);

    // Breakdown costs strictly by user-defined category type
    let fixedCosts = finalPersonnelTotal; // Default personnel to fixed, but respect ledger categorization if it's there
    let variableCosts = 0;
    let depreciationCosts = 0;
    let interestCosts = 0;
    let ledgerCogs = 0;

    expList.forEach(e => {
      const type = getCategoryType(e.category, expenseCategories);
      const amount = Number(e.amount) || 0;
      if (type === 'fixed') fixedCosts += amount;
      else if (type === 'variable') variableCosts += amount;
      else if (type === 'depreciation') depreciationCosts += amount;
      else if (type === 'interest') interestCosts += amount;
      else if (type === 'cogs') ledgerCogs += amount;
    });

    const totalCogs = totalCogsFromRevenue + ledgerCogs;
    // Gross profit needs to be adjusted if there are ledger cogs
    const adjustedTotalGross = totalGross - ledgerCogs;
    const finalNetProfit = adjustedTotalGross - (totalExp - finalPersonnelTotal) - finalPersonnelTotal; 
    // Wait, totalExp already includes ledgerCogs if we aren't careful.
    // Let's recalculate netProfit clearly
    const finalNetProfitCorrect = totalGross - totalExp; // totalGross is from revenue records, totalExp is all expenses + payroll

    return {
      periodRev: totalRev,
      periodExp: totalExp,
      periodProfit: finalNetProfitCorrect,
      periodGross: totalGross,
      activeStaffCount: activeStaff.length,
      netProfitMargin: totalRev > 0 ? (finalNetProfitCorrect / totalRev) * 100 : 0,
      opExRatio: totalRev > 0 ? (totalExp / totalRev) * 100 : 0,
      laborCostRatio: totalRev > 0 ? (finalPersonnelTotal / totalRev) * 100 : 0,
      fixedCosts,
      variableCosts,
      depreciationCosts,
      interestCosts,
      totalCogs,
      ledgerCogs
    };
  }, [filteredData, data.employees, data.expenseCategories]);

  // CALCULATE PREVIOUS PERIOD DATA FOR COMPARISON
  const prevInsights = useMemo(() => {
    const { start, end } = timeContext;
    const startDate = new Date(start);
    const endDate = new Date(end);
    const diffTime = Math.abs(endDate.getTime() - startDate.getTime());
    
    const prevEnd = new Date(startDate.getTime() - 86400000); // Day before current start
    const prevStart = new Date(prevEnd.getTime() - diffTime);
    
    const pStart = prevStart.toISOString().split('T')[0];
    const pEnd = prevEnd.toISOString().split('T')[0];

    const filterFn = (item: { date: string }) => item.date >= pStart && item.date <= pEnd;
    
    const pRev = data.revenue.filter(filterFn);
    const pExp = data.expenses.filter(filterFn);
    
    const totalRev = pRev.reduce((sum, r) => sum + (Number(r.netRevenue) || 0) + (Number(r.revenueOther) || 0), 0);
    const totalGross = pRev.reduce((sum, r) => sum + (Number(r.grossProfit) || 0), 0);
    const totalExp = pExp.reduce((sum, e) => sum + (Number(e.amount) || 0), 0);
    const netProfit = totalGross - totalExp;

    return {
      rev: totalRev,
      profit: netProfit,
      gross: totalGross,
      exp: totalExp
    };
  }, [data, timeContext]);

  const productGroupData = useMemo(() => {
    if (!data.productGroupRevenue) return [];
    const { start, end } = timeContext;
    
    const groups: Record<string, { name: string, revenue: number, profit: number }> = {};
    
    data.productGroupRevenue
      .filter(r => r.date >= start && r.date <= end)
      .forEach(r => {
        if (!groups[r.groupName]) groups[r.groupName] = { name: r.groupName, revenue: 0, profit: 0 };
        groups[r.groupName].revenue += (Number(r.netRevenue) || 0);
        groups[r.groupName].profit += (Number(r.netRevenue) || 0) - (Number(r.cogs) || 0);
      });
      
    return Object.values(groups).sort((a, b) => b.revenue - a.revenue).slice(0, 10);
  }, [data.productGroupRevenue, timeContext]);

  const monthlyTrendData = useMemo(() => {
    const months: Record<string, { month: string, revenue: number, grossProfit: number, netProfit: number }> = {};
    
    // Process all revenue
    data.revenue.forEach(r => {
      const monthKey = r.date.substring(0, 7);
      if (!months[monthKey]) months[monthKey] = { month: monthKey, revenue: 0, grossProfit: 0, netProfit: 0 };
      months[monthKey].revenue += (Number(r.netRevenue) || 0) + (Number(r.revenueOther) || 0);
      months[monthKey].grossProfit += (Number(r.grossProfit) || 0);
    });

    // Process expenses - Ensure months with only expenses are included
    data.expenses.forEach(e => {
      const monthKey = e.date.substring(0, 7);
      if (!months[monthKey]) months[monthKey] = { month: monthKey, revenue: 0, grossProfit: 0, netProfit: 0 };
      months[monthKey].netProfit -= Number(e.amount);
    });

    // Process payroll
    data.payroll.forEach(p => {
      const monthKey = p.month;
      if (!months[monthKey]) months[monthKey] = { month: monthKey, revenue: 0, grossProfit: 0, netProfit: 0 };
      months[monthKey].netProfit -= Number(p.netPay);
    });

    // Finalize net profit
    Object.keys(months).forEach(key => {
      months[key].netProfit += months[key].grossProfit;
    });

    return Object.values(months).sort((a, b) => a.month.localeCompare(b.month));
  }, [data.revenue, data.expenses, data.payroll]);

  const dailyTrendData = useMemo(() => {
    if (!selectedTrendMonth) return [];
    
    const days: Record<string, { date: string, revenue: number, grossProfit: number, netProfit: number }> = {};
    
    // Filter revenue for the selected month
    data.revenue.filter(r => r.date.startsWith(selectedTrendMonth)).forEach(r => {
      if (!days[r.date]) days[r.date] = { date: r.date, revenue: 0, grossProfit: 0, netProfit: 0 };
      days[r.date].revenue += (Number(r.netRevenue) || 0) + (Number(r.revenueOther) || 0);
      days[r.date].grossProfit += (Number(r.grossProfit) || 0);
    });

    // Filter expenses for the selected month
    data.expenses.filter(e => e.date.startsWith(selectedTrendMonth)).forEach(e => {
      if (!days[e.date]) days[e.date] = { date: e.date, revenue: 0, grossProfit: 0, netProfit: 0 };
      days[e.date].netProfit -= Number(e.amount);
    });

    // Note: Payroll is usually monthly, so we don't distribute it daily here for simplicity, 
    // or we could distribute it evenly if needed. For now, we'll focus on revenue/expenses.
    
    Object.keys(days).forEach(key => {
      days[key].netProfit += days[key].grossProfit;
    });

    return Object.values(days).sort((a, b) => a.date.localeCompare(b.date));
  }, [data.revenue, data.expenses, selectedTrendMonth]);

  const expensePieData = useMemo(() => {
    const cats: Record<string, number> = {};
    const expenseCategories = data.expenseCategories || [];
    
    let ledgerSalaryTotal = 0;
    filteredData.expenses.forEach(e => {
      const topLevel = getTopLevelCategory(e.category, expenseCategories);
      if (topLevel === 'Nhân sự' || topLevel === 'Nhân viên' || topLevel === 'Lương') {
        ledgerSalaryTotal += Number(e.amount) || 0;
      } else {
        cats[topLevel] = (cats[topLevel] || 0) + Number(e.amount);
      }
    });
    
    const payrollNetPayTotal = filteredData.payroll.reduce((sum, p) => sum + (Number(p.netPay) || 0), 0);
    const finalPersonnelTotal = payrollNetPayTotal > 0 ? payrollNetPayTotal : ledgerSalaryTotal;

    if (finalPersonnelTotal > 0) {
      cats['Nhân sự'] = finalPersonnelTotal;
    }

    return Object.entries(cats)
      .map(([name, value]) => ({ name, value }))
      .sort((a, b) => b.value - a.value);
  }, [filteredData.expenses, filteredData.payroll, data.expenseCategories]);

  const detailedExpenses = useMemo(() => {
    if (!selectedParentCategory) return [];
    
    const salaryKeywords = ['lương', 'hoa hồng', 'thưởng doanh số', 'thưởng nhân viên', 'phụ cấp', 'tăng ca', 'thực nhận'];
    
    if (selectedParentCategory === 'Nhân sự') {
      const payrollList = filteredData.payroll;
      if (payrollList.length > 0) {
        // Return payroll records as detailed items
        return payrollList.map(p => ({
          id: p.id,
          date: p.month,
          category: 'Nhân sự',
          description: `Lương tháng ${p.month} - ${p.employeeName}`,
          amount: Number(p.netPay) || 0
        }));
      } else {
        // Fallback to ledger items
        return filteredData.expenses.filter(e => {
          const topLevel = getTopLevelCategory(e.category, data.expenseCategories || []);
          return topLevel === 'Nhân sự';
        });
      }
    }

    return filteredData.expenses.filter(e => {
      const topLevel = getTopLevelCategory(e.category, data.expenseCategories || []);
      return topLevel === selectedParentCategory;
    });
  }, [selectedParentCategory, filteredData.expenses, filteredData.payroll, data.expenseCategories]);

  const waterfallData = useMemo(() => {
    const revList = filteredData.revenue;
    const totalGrossBeforeLeak = revList.reduce((sum, r) => sum + (Number(r.totalGrossRevenue) || 0) + (Number(r.revenueOther) || 0), 0);
    const totalDisc = revList.reduce((sum, r) => sum + (Number(r.discount) || 0), 0);
    const totalRet = revList.reduce((sum, r) => sum + (Number(r.returnsValue) || 0), 0);
    const totalRev = insights.periodRev;
    const totalCogs = insights.totalCogs;
    const grossProfit = insights.periodGross - (insights.ledgerCogs || 0);
    
    const varCosts = insights.variableCosts;
    const fixedCosts = insights.fixedCosts;
    const depCosts = insights.depreciationCosts;
    const intCosts = insights.interestCosts;
    const netProfit = insights.periodProfit;

    const data = [];
    const blueColor = '#1e293b';  // Dark Navy/Blue
    const greenColor = '#10b981'; // Green

    // 1. Doanh thu tổng (100%)
    data.push({ name: 'Doanh thu tổng', value: [0, totalGrossBeforeLeak], fill: blueColor, label: '100%' });
    
    // 2. Giảm giá
    let current = totalGrossBeforeLeak;
    const discPerc = totalGrossBeforeLeak > 0 ? ((totalDisc / totalGrossBeforeLeak) * 100).toFixed(0) + '%' : '0%';
    data.push({ name: 'Giảm giá', value: [current - totalDisc, current], fill: blueColor, label: discPerc });
    current -= totalDisc;

    // 3. Hàng trả lại
    const retPerc = totalGrossBeforeLeak > 0 ? ((totalRet / totalGrossBeforeLeak) * 100).toFixed(0) + '%' : '0%';
    data.push({ name: 'Hàng trả lại', value: [current - totalRet, current], fill: blueColor, label: retPerc });
    current -= totalRet;
    
    // 4. Doanh thu thuần
    const netRevPerc = totalGrossBeforeLeak > 0 ? ((totalRev / totalGrossBeforeLeak) * 100).toFixed(0) + '%' : '0%';
    data.push({ name: 'Doanh thu thuần', value: [0, totalRev], fill: blueColor, label: netRevPerc });
    
    // 5. Giá vốn
    current = totalRev;
    if (totalCogs > 0) {
      const perc = totalRev > 0 ? ((totalCogs / totalRev) * 100).toFixed(0) + '%' : '0%';
      data.push({ name: 'Giá vốn', value: [current - totalCogs, current], fill: blueColor, label: perc });
      current -= totalCogs;
    }
    
    // 6. Lợi nhuận gộp
    const grossPerc = totalRev > 0 ? ((grossProfit / totalRev) * 100).toFixed(0) + '%' : '0%';
    data.push({ name: 'Lợi nhuận gộp', value: [0, grossProfit], fill: greenColor, label: grossPerc });

    // 7. Chi phí biến đổi
    current = grossProfit;
    if (varCosts > 0) {
      const perc = totalRev > 0 ? ((varCosts / totalRev) * 100).toFixed(0) + '%' : '0%';
      data.push({ name: 'Chi phí biến đổi', value: [Math.max(0, current - varCosts), current], fill: blueColor, label: perc });
      current -= varCosts;
    }

    // 8. Chi phí cố định
    if (fixedCosts > 0) {
      const perc = totalRev > 0 ? ((fixedCosts / totalRev) * 100).toFixed(0) + '%' : '0%';
      data.push({ name: 'Chi phí cố định', value: [Math.max(0, current - fixedCosts), current], fill: blueColor, label: perc });
      current -= fixedCosts;
    }

    // 9. Khấu hao
    if (depCosts > 0) {
      const perc = totalRev > 0 ? ((depCosts / totalRev) * 100).toFixed(0) + '%' : '0%';
      data.push({ name: 'Khấu hao', value: [Math.max(0, current - depCosts), current], fill: blueColor, label: perc });
      current -= depCosts;
    }

    // 10. Lãi vay
    if (intCosts > 0) {
      const perc = totalRev > 0 ? ((intCosts / totalRev) * 100).toFixed(0) + '%' : '0%';
      data.push({ name: 'Lãi vay', value: [Math.max(0, current - intCosts), current], fill: blueColor, label: perc });
      current -= intCosts;
    }

    // 11. Lợi nhuận ròng
    const netPerc = totalRev > 0 ? ((netProfit / totalRev) * 100).toFixed(0) + '%' : '0%';
    const roseColor = '#f43f5e'; // Red for negative
    data.push({ 
      name: 'Lợi nhuận ròng', 
      value: [0, netProfit], 
      fill: netProfit >= 0 ? greenColor : roseColor, 
      label: netPerc 
    });

    return data;
  }, [filteredData.revenue, insights]);

  const COLORS = ['#6366f1', '#f43f5e', '#10b981', '#f59e0b', '#8b5cf6', '#06b6d4', '#ec4899', '#0ea5e9'];

  const runExecutiveBriefing = async () => {
    setIsDiagnosing(true);
    setDiagnosisResult(null);
    try {
      const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY });
      
      const revGrowth = prevInsights.rev > 0 ? ((insights.periodRev - prevInsights.rev) / prevInsights.rev * 100).toFixed(1) : 'N/A';
      const profitGrowth = prevInsights.profit !== 0 ? ((insights.periodProfit - prevInsights.profit) / Math.abs(prevInsights.profit) * 100).toFixed(1) : 'N/A';

      const contextPrompt = `
        BẠN LÀ: CHUYÊN GIA TƯ VẤN TÀI CHÍNH CẤP CAO (CFO) CHO CHUỖI BÁN LẺ GIÀY DÉP.
        NHIỆM VỤ: Phân tích sâu sắc, so sánh và đưa ra giải pháp thực thi cho giai đoạn ${timeContext.start} đến ${timeContext.end}.

        DỮ LIỆU TÀI CHÍNH HIỆN TẠI:
        - Doanh thu thuần: ${insights.periodRev.toLocaleString()}đ (Tăng trưởng so kỳ trước: ${revGrowth}%)
        - Lợi nhuận ròng: ${insights.periodProfit.toLocaleString()}đ (Tăng trưởng: ${profitGrowth}%)
        - Biên LN Gộp: ${(insights.periodGross / insights.periodRev * 100).toFixed(1)}%
        - Biên LN Ròng: ${insights.netProfitMargin.toFixed(1)}%
        
        CƠ CẤU CHI PHÍ TRÊN DOANH THU:
        - Giá vốn hàng bán (COGS): ${(insights.totalCogs / insights.periodRev * 100).toFixed(1)}%
        - Chi phí nhân sự: ${insights.laborCostRatio.toFixed(1)}%
        - Chi phí cố định khác: ${(insights.fixedCosts / insights.periodRev * 100).toFixed(1)}%
        - Chi phí biến đổi: ${(insights.variableCosts / insights.periodRev * 100).toFixed(1)}%

        NGƯỠNG AN TOÀN NGÀNH BÁN LẺ GIÀY DÉP (THAM CHIẾU):
        - COGS: 50% - 60% (Nếu > 65% là nguy hiểm)
        - Chi phí nhân sự: 10% - 15% (Nếu > 20% là quá cao)
        - Chi phí mặt bằng/Cố định: 5% - 10%
        - Biên LN Ròng: 10% - 20%

        YÊU CẦU PHÂN TÍCH:
        1. SO SÁNH & ĐÁNH GIÁ: So sánh trực tiếp các chỉ số trên với ngưỡng an toàn. Chỉ rõ chỉ số nào đang "Báo động đỏ".
        2. PHÂN TÍCH CHI PHÍ: Nhóm chi phí nào đang tăng quá mức hoặc chiếm tỷ trọng bất hợp lý? Tại sao?
        3. NHẬN XÉT SẮC BÉN: Đưa ra nhận định "Thẳng & Thật" về sức khỏe cửa hàng (Ví dụ: "Đang bán lỗ để lấy doanh thu", "Chi phí nhân sự đang nuốt chửng lợi nhuận",...).
        4. HƯỚNG GIẢI QUYẾT CỤ THỂ: Đưa ra ít nhất 3 giải pháp thực tế để đưa các chỉ số về ngưỡng an toàn (Ví dụ: Cắt giảm ca làm việc, đàm phán lại giá nhập, đẩy mạnh xả kho mẫu cũ,...).

        PHONG CÁCH: Quyết đoán, chuyên nghiệp, số liệu dẫn chứng cụ thể, không nói chung chung.
        ĐỊNH DẠNG: Markdown, sử dụng bảng nếu cần để so sánh.
      `;
      const result = await ai.models.generateContent({
        model: 'gemini-3-flash-preview',
        contents: contextPrompt,
        config: { temperature: 0.2 }
      });
      setDiagnosisResult(result.text || "Lỗi khởi tạo bản tin.");
    } catch (err) {
      setDiagnosisResult("Không thể kết nối AI Advisor.");
    } finally {
      setIsDiagnosing(false);
    }
  };

  // Generate month options for filter
  const monthOptions = useMemo(() => {
    const options = [];
    const start = new Date(2024, 0, 1);
    const end = new Date();
    let current = new Date(end.getFullYear(), end.getMonth(), 1);
    
    while (current >= start) {
      options.push(current.toISOString().slice(0, 7));
      current.setMonth(current.getMonth() - 1);
    }
    return options;
  }, []);

  const hasData = data.revenue.length > 0 || data.employees.length > 0;

  if (!hasData) {
    return (
      <div className="h-full flex flex-col items-center justify-center text-center p-12 bg-white rounded-[3rem] border-2 border-dashed border-slate-200">
        <div className="w-24 h-24 bg-slate-50 rounded-full flex items-center justify-center mb-8 shadow-inner">
          <Briefcase className="w-10 h-10 text-slate-300" />
        </div>
        <h3 className="text-3xl font-black text-slate-800 mb-4 uppercase tracking-tight">Hệ Thống Đang Sẵn Sàng</h3>
        <p className="text-slate-400 max-w-md mx-auto font-medium">Chào mừng bạn đến với <strong>CFO Brain</strong>. Vui lòng nhập liệu hoặc đồng bộ dữ liệu KiotViet để bắt đầu nhận phân tích chiến lược.</p>
      </div>
    );
  }

  return (
    <div className="animate-in fade-in slide-in-from-bottom-6 duration-700 pb-20 max-w-[1600px] mx-auto">
      
      {/* STICKY CONTROL PANEL (FILTERS + SUB-TABS) */}
      <div className={`sticky top-0 z-30 -mx-8 px-8 transition-all duration-500 ease-in-out ${
        isShrunk 
          ? 'py-2 bg-white/95 backdrop-blur-2xl border-b border-slate-200 shadow-xl' 
          : 'pt-6 pb-6 bg-transparent'
      }`}>
        {/* TOP FILTER BAR - Shrinks when scrolled */}
        <div className={`transition-all duration-500 origin-top ${isShrunk ? 'scale-90 opacity-70 -mb-5' : 'mb-6 opacity-100'}`}>
          <TimeFilter 
            diagnosisRange={diagnosisRange}
            setDiagnosisRange={setDiagnosisRange}
            diagStartDate={diagStartDate}
            setDiagStartDate={setDiagStartDate}
            diagEndDate={diagEndDate}
            setDiagEndDate={setDiagEndDate}
          />
        </div>

        {/* SUB-TAB NAVIGATION */}
        <div className={`flex bg-slate-100/50 rounded-[2.5rem] w-fit mx-auto border border-white/50 shadow-sm backdrop-blur-md transition-all duration-500 ${
          isShrunk ? 'p-0.5 scale-90 opacity-95' : 'p-1.5'
        }`}>
          <button 
            onClick={() => setActiveSubTab('kpi')}
            className={`flex items-center gap-3 rounded-[2rem] font-black text-[10px] uppercase tracking-[0.2em] transition-all duration-300 ${
              isShrunk ? 'px-6 py-2' : 'px-10 py-3'
            } ${
              activeSubTab === 'kpi' ? 'bg-white text-emerald-600 shadow-md scale-105' : 'text-slate-500 hover:text-slate-900'
            }`}
          >
            <Gauge className={isShrunk ? "w-3 h-3" : "w-4 h-4"} /> Tổng quan KPI
          </button>
          <button 
            onClick={() => setActiveSubTab('trends')}
            className={`flex items-center gap-3 rounded-[2rem] font-black text-[10px] uppercase tracking-[0.2em] transition-all duration-300 ${
              isShrunk ? 'px-6 py-2' : 'px-10 py-3'
            } ${
              activeSubTab === 'trends' ? 'bg-white text-indigo-600 shadow-md scale-105' : 'text-slate-500 hover:text-slate-900'
            }`}
          >
            <BarChart3 className={isShrunk ? "w-3 h-3" : "w-4 h-4"} /> Xu hướng
          </button>
          <button 
            onClick={() => setActiveSubTab('structure')}
            className={`flex items-center gap-3 rounded-[2rem] font-black text-[10px] uppercase tracking-[0.2em] transition-all duration-300 ${
              isShrunk ? 'px-6 py-2' : 'px-10 py-3'
            } ${
              activeSubTab === 'structure' ? 'bg-white text-orange-600 shadow-md scale-105' : 'text-slate-500 hover:text-slate-900'
            }`}
          >
            <PieChartIcon className={isShrunk ? "w-3 h-3" : "w-4 h-4"} /> Cơ cấu
          </button>
          <button 
            onClick={() => setActiveSubTab('ai')}
            className={`flex items-center gap-3 rounded-[2rem] font-black text-[10px] uppercase tracking-[0.2em] transition-all duration-300 ${
              isShrunk ? 'px-6 py-2' : 'px-10 py-3'
            } ${
              activeSubTab === 'ai' ? 'bg-white text-slate-900 shadow-md scale-105' : 'text-slate-500 hover:text-slate-900'
            }`}
          >
            <BrainCircuit className={isShrunk ? "w-3 h-3" : "w-4 h-4"} /> AI CFO Advisor
          </button>
        </div>
      </div>

      <div className="grid grid-cols-1 gap-8">
        
        {activeSubTab === 'kpi' && (
          <div className="space-y-10 animate-in fade-in zoom-in-95 duration-500">
            {/* KPI Cards */}
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
              {/* 1. DOANH THU */}
              <div className="bg-white rounded-[3rem] p-9 border border-slate-100 shadow-[0_15px_40px_-20px_rgba(0,0,0,0.05)] hover:shadow-[0_20px_50px_-15px_rgba(0,0,0,0.1)] transition-all duration-500 group">
                <div className="flex items-center justify-between mb-8">
                  <div className="p-5 rounded-2xl bg-emerald-50 text-emerald-600 group-hover:scale-110 transition-transform duration-500">
                    <DollarSign className="w-7 h-7" />
                  </div>
                  <div className="text-right">
                    <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest block">Net Revenue</span>
                    <div className="flex items-center justify-end text-emerald-500 gap-1 font-black text-xs mt-1">
                      <ArrowUpRight className="w-3 h-3" />
                      <span>{prevInsights.rev > 0 ? ((insights.periodRev - prevInsights.rev) / prevInsights.rev * 100).toFixed(0) : 0}%</span>
                    </div>
                  </div>
                </div>
                <h4 className="text-[10px] font-black text-slate-400 uppercase tracking-[0.25em] mb-2">Doanh thu</h4>
                <p className="text-4xl font-black text-slate-900 tracking-tighter leading-none">{insights.periodRev.toLocaleString()}<span className="text-sm ml-1 text-slate-400 font-bold">đ</span></p>
                <p className="text-[9px] text-slate-400 mt-4 font-bold uppercase tracking-widest">Kỳ trước: {prevInsights.rev.toLocaleString()} đ</p>
              </div>

              {/* 2. GIÁ VỐN (COGS) */}
              <div className="bg-white rounded-[3rem] p-9 border border-slate-100 shadow-[0_15px_40px_-20px_rgba(0,0,0,0.05)] hover:shadow-[0_20px_50px_-15px_rgba(0,0,0,0.1)] transition-all duration-500 group">
                <div className="flex items-center justify-between mb-8">
                  <div className="p-5 rounded-2xl bg-orange-50 text-orange-600 group-hover:scale-110 transition-transform duration-500">
                    <ShoppingCart className="w-7 h-7" />
                  </div>
                  <div className="text-right">
                    <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest block">COGS Ratio</span>
                    <span className="text-[10px] font-black text-orange-500 uppercase tracking-widest block mt-1">
                      {insights.periodRev > 0 ? ((insights.totalCogs / insights.periodRev) * 100).toFixed(1) : 0}%
                    </span>
                  </div>
                </div>
                <h4 className="text-[10px] font-black text-slate-400 uppercase tracking-[0.25em] mb-2">Giá vốn (COGS)</h4>
                <p className="text-4xl font-black text-slate-900 tracking-tighter leading-none">{insights.totalCogs.toLocaleString()}<span className="text-sm ml-1 text-slate-400 font-bold">đ</span></p>
                <div className="h-1 bg-slate-100 rounded-full mt-4 overflow-hidden">
                  <div 
                    className="h-full bg-orange-500 transition-all duration-1000" 
                    style={{ width: `${Math.min(100, insights.periodRev > 0 ? (insights.totalCogs / insights.periodRev) * 100 : 0)}%` }}
                  />
                </div>
              </div>

              {/* 3. LỢI NHUẬN GỘP */}
              <div className="bg-white rounded-[3rem] p-9 border border-slate-100 shadow-[0_15px_40px_-20px_rgba(0,0,0,0.05)] hover:shadow-[0_20px_50px_-15px_rgba(0,0,0,0.1)] transition-all duration-500 group">
                <div className="flex items-center justify-between mb-8">
                  <div className="p-5 rounded-2xl bg-indigo-50 text-indigo-600 group-hover:scale-110 transition-transform duration-500">
                    <Gauge className="w-7 h-7" />
                  </div>
                  <div className="text-right">
                    <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest block">Gross Margin</span>
                    <div className="flex items-center justify-end text-indigo-500 gap-1 font-black text-xs mt-1">
                      <span>{insights.periodRev > 0 ? ((insights.periodGross / insights.periodRev) * 100).toFixed(1) : 0}%</span>
                    </div>
                  </div>
                </div>
                <h4 className="text-[10px] font-black text-slate-400 uppercase tracking-[0.25em] mb-2">Lợi nhuận gộp</h4>
                <p className="text-4xl font-black text-indigo-600 tracking-tighter leading-none">{insights.periodGross.toLocaleString()}<span className="text-sm ml-1 opacity-50 font-bold">đ</span></p>
                <p className="text-[9px] text-slate-400 mt-4 font-bold uppercase tracking-widest">Kỳ trước: {prevInsights.gross.toLocaleString()} đ</p>
              </div>

              {/* 4. CHI PHÍ HOẠT ĐỘNG */}
              <div className="bg-white rounded-[3rem] p-9 border border-slate-100 shadow-[0_15px_40px_-20px_rgba(0,0,0,0.05)] hover:shadow-[0_20px_50px_-15px_rgba(0,0,0,0.1)] transition-all duration-500 group">
                <div className="flex items-center justify-between mb-8">
                  <div className="p-5 rounded-2xl bg-rose-50 text-rose-600 group-hover:scale-110 transition-transform duration-500">
                    <Wallet className="w-7 h-7" />
                  </div>
                  <div className="text-right">
                    <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest block">OPEX Ratio</span>
                    <div className="flex items-center justify-end text-rose-500 gap-1 font-black text-xs mt-1">
                      <span>{insights.periodRev > 0 ? ((insights.periodExp / insights.periodRev) * 100).toFixed(1) : 0}%</span>
                    </div>
                  </div>
                </div>
                <h4 className="text-[10px] font-black text-slate-400 uppercase tracking-[0.25em] mb-2">Chi phí hoạt động</h4>
                <p className="text-4xl font-black text-slate-900 tracking-tighter leading-none">{insights.periodExp.toLocaleString()}<span className="text-sm ml-1 text-slate-400 font-bold">đ</span></p>
                <p className="text-[9px] text-slate-400 mt-4 font-bold uppercase tracking-widest">Kỳ trước: {prevInsights.exp.toLocaleString()} đ</p>
              </div>

              {/* 5. LỢI NHUẬN TRƯỚC THUẾ */}
              <div className="bg-white rounded-[3rem] p-9 border border-slate-100 shadow-[0_15px_40px_-20px_rgba(0,0,0,0.05)] hover:shadow-[0_20px_50px_-15px_rgba(0,0,0,0.1)] transition-all duration-500 group">
                <div className="flex items-center justify-between mb-8">
                  <div className="p-5 rounded-2xl bg-blue-50 text-blue-600 group-hover:scale-110 transition-transform duration-500">
                    <Activity className="w-7 h-7" />
                  </div>
                  <div className="text-right">
                    <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest block">EBT Margin</span>
                    <div className="flex items-center justify-end text-blue-500 gap-1 font-black text-xs mt-1">
                      <span>{insights.periodRev > 0 ? ((insights.periodProfit / insights.periodRev) * 100).toFixed(1) : 0}%</span>
                    </div>
                  </div>
                </div>
                <h4 className="text-[10px] font-black text-slate-400 uppercase tracking-[0.25em] mb-2">Lợi nhuận trước thuế</h4>
                <p className="text-4xl font-black text-slate-900 tracking-tighter leading-none">{insights.periodProfit.toLocaleString()}<span className="text-sm ml-1 text-slate-400 font-bold">đ</span></p>
                <p className="text-[9px] text-slate-400 mt-4 font-bold uppercase tracking-widest">Sức khỏe tài chính</p>
              </div>

              {/* 6. LỢI NHUẬN RÒNG */}
              <div className="bg-white rounded-[3rem] p-9 border border-slate-100 shadow-[0_15px_40px_-20px_rgba(0,0,0,0.05)] hover:shadow-[0_20px_50px_-15px_rgba(0,0,0,0.1)] transition-all duration-500 group">
                <div className="flex items-center justify-between mb-8">
                  <div className="p-5 rounded-2xl bg-teal-50 text-teal-600 group-hover:scale-110 transition-transform duration-500">
                    <ShieldCheck className="w-7 h-7" />
                  </div>
                  <div className="text-right">
                    <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest block">Net Profit</span>
                    <div className="flex items-center justify-end text-teal-500 gap-1 font-black text-xs mt-1">
                      <ArrowUpRight className="w-3 h-3" />
                      <span>{prevInsights.profit !== 0 ? ((insights.periodProfit - prevInsights.profit) / Math.abs(prevInsights.profit) * 100).toFixed(0) : 0}%</span>
                    </div>
                  </div>
                </div>
                <h4 className="text-[10px] font-black text-slate-400 uppercase tracking-[0.25em] mb-2">Lợi nhuận ròng</h4>
                <p className={`text-4xl font-black tracking-tighter leading-none ${insights.periodProfit >= 0 ? 'text-teal-600' : 'text-rose-600'}`}>
                  {insights.periodProfit.toLocaleString()}<span className="text-sm ml-1 opacity-50 font-bold">đ</span>
                </p>
                <div className="flex items-center gap-1.5 mt-4">
                  <div className={`w-2 h-2 rounded-full ${insights.periodProfit >= 0 ? 'bg-teal-500 animate-pulse' : 'bg-rose-500'}`} />
                  <span className="text-[9px] font-black text-slate-400 uppercase tracking-[0.1em]">
                    {insights.periodProfit >= 0 ? 'Có lãi' : 'Đang lỗ'}
                  </span>
                </div>
              </div>
            </div>

            <DailyBreakEven 
              revenue={data.revenue} 
              targetDate={timeContext.start} 
              config={{
                monthlyFixedCosts: breakEvenAnalysis?.dailyFixedCost * (new Date(new Date().getFullYear(), new Date().getMonth() + 1, 0).getDate()) || data.dailyBreakEvenConfig?.monthlyFixedCosts || 50000000,
                grossMarginPercent: (breakEvenAnalysis?.avgGrossMargin * 100) || data.dailyBreakEvenConfig?.grossMarginPercent || 35
              }}
              onUpdateConfig={(newConfig) => onUpdateData('dailyBreakEvenConfig', newConfig)}
              autoCalculated={!!breakEvenAnalysis}
            />
          </div>
        )}

        {activeSubTab === 'trends' && (
          <div className="animate-in fade-in zoom-in-95 duration-500">
            <div className="bg-white rounded-[3rem] p-10 border border-slate-200 shadow-xl">
              <div className="flex items-center justify-between mb-10">
                <div>
                  <h3 className="text-xl font-black text-slate-900 uppercase tracking-tight">Xu hướng Tài chính</h3>
                  <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mt-1">Biến động Doanh thu & Lợi nhuận qua các tháng</p>
                </div>
                <div className="p-3 bg-indigo-50 text-indigo-600 rounded-2xl"><BarChart3 className="w-5 h-5" /></div>
              </div>
              
              <div className="h-[500px] w-full">
                <ResponsiveContainer width="100%" height="100%">
                  <LineChart 
                    data={monthlyTrendData} 
                    margin={{ top: 20, right: 30, left: 40, bottom: 20 }}
                    onClick={(data) => {
                      if (data && data.activeLabel) {
                        setSelectedTrendMonth(data.activeLabel);
                      }
                    }}
                    style={{ cursor: 'pointer' }}
                  >
                    <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
                    <XAxis 
                      dataKey="month" 
                      axisLine={false} 
                      tickLine={false} 
                      tick={{ fontSize: 10, fontWeight: 800, fill: '#64748b' }}
                      tickFormatter={(val) => {
                        const [y, m] = val.split('-');
                        return `${m}/${y}`;
                      }}
                    />
                    <YAxis 
                      axisLine={false} 
                      tickLine={false} 
                      tick={{ fontSize: 10, fontWeight: 700, fill: '#94a3b8' }}
                      tickFormatter={(v) => (v / 1000000).toFixed(1) + 'M'}
                    />
                    <Tooltip 
                      contentStyle={{ borderRadius: '1.5rem', border: 'none', boxShadow: '0 20px 25px -5px rgb(0 0 0 / 0.1)' }}
                      formatter={(v: number) => v.toLocaleString() + 'đ'}
                    />
                    <Legend 
                      verticalAlign="top" 
                      align="right" 
                      iconType="circle"
                      wrapperStyle={{ fontSize: '10px', fontWeight: '900', textTransform: 'uppercase', paddingBottom: '20px' }}
                    />
                    <Line 
                      type="monotone" 
                      dataKey="revenue" 
                      name="Doanh thu" 
                      stroke="#6366f1" 
                      strokeWidth={4} 
                      dot={{ r: 4, fill: '#6366f1', strokeWidth: 2, stroke: '#fff' }}
                      activeDot={{ r: 6, strokeWidth: 0 }}
                    />
                    <Line 
                      type="monotone" 
                      dataKey="grossProfit" 
                      name="LN Gộp" 
                      stroke="#10b981" 
                      strokeWidth={4} 
                      dot={{ r: 4, fill: '#10b981', strokeWidth: 2, stroke: '#fff' }}
                      activeDot={{ r: 6, strokeWidth: 0 }}
                    />
                    <Line 
                      type="monotone" 
                      dataKey="netProfit" 
                      name="LN Ròng" 
                      stroke="#f43f5e" 
                      strokeWidth={4} 
                      dot={{ r: 4, fill: '#f43f5e', strokeWidth: 2, stroke: '#fff' }}
                      activeDot={{ r: 6, strokeWidth: 0 }}
                    />
                  </LineChart>
                </ResponsiveContainer>
              </div>

              {selectedTrendMonth && (
                <div className="mt-12 pt-12 border-t border-slate-100 animate-in slide-in-from-top-4 duration-500">
                  <div className="flex items-center justify-between mb-8">
                    <div>
                      <h4 className="text-lg font-black text-slate-800 uppercase tracking-tight">
                        Chi tiết tháng {selectedTrendMonth.split('-')[1]}/{selectedTrendMonth.split('-')[0]}
                      </h4>
                      <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mt-1">Biến động chi tiết theo từng ngày</p>
                    </div>
                    <button 
                      onClick={() => setSelectedTrendMonth(null)}
                      className="p-2 hover:bg-slate-100 rounded-xl text-slate-400 transition-colors"
                    >
                      <XIcon className="w-5 h-5" />
                    </button>
                  </div>

                  <div className="h-[400px] w-full">
                    <ResponsiveContainer width="100%" height="100%">
                      <AreaChart data={dailyTrendData} margin={{ top: 10, right: 10, left: 40, bottom: 0 }}>
                        <defs>
                          <linearGradient id="colorRev" x1="0" y1="0" x2="0" y2="1">
                            <stop offset="5%" stopColor="#6366f1" stopOpacity={0.1}/>
                            <stop offset="95%" stopColor="#6366f1" stopOpacity={0}/>
                          </linearGradient>
                        </defs>
                        <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
                        <XAxis 
                          dataKey="date" 
                          axisLine={false} 
                          tickLine={false} 
                          tick={{ fontSize: 9, fontWeight: 700, fill: '#94a3b8' }}
                          tickFormatter={(val) => val.split('-')[2]}
                        />
                        <YAxis 
                          axisLine={false} 
                          tickLine={false} 
                          tick={{ fontSize: 9, fontWeight: 700, fill: '#94a3b8' }}
                          tickFormatter={(v) => (v / 1000000).toFixed(1) + 'M'}
                        />
                        <Tooltip 
                          contentStyle={{ borderRadius: '1rem', border: 'none', boxShadow: '0 10px 15px -3px rgb(0 0 0 / 0.1)' }}
                          formatter={(v: number) => v.toLocaleString() + 'đ'}
                          labelFormatter={(label) => `Ngày ${label.split('-')[2]}/${label.split('-')[1]}`}
                        />
                        <Area 
                          type="monotone" 
                          dataKey="revenue" 
                          name="Doanh thu" 
                          stroke="#6366f1" 
                          strokeWidth={3} 
                          fillOpacity={1} 
                          fill="url(#colorRev)" 
                        />
                        <Area 
                          type="monotone" 
                          dataKey="grossProfit" 
                          name="LN Gộp" 
                          stroke="#10b981" 
                          strokeWidth={3} 
                          fill="transparent"
                        />
                        <Area 
                          type="monotone" 
                          dataKey="netProfit" 
                          name="LN Ròng" 
                          stroke="#f43f5e" 
                          strokeWidth={3} 
                          fill="transparent"
                        />
                      </AreaChart>
                    </ResponsiveContainer>
                  </div>
                </div>
              )}
            </div>
          </div>
        )}

        {activeSubTab === 'structure' && (
          <div className="space-y-8 animate-in fade-in zoom-in-95 duration-500">
            {/* Waterfall Chart P&L */}
            <div className="bg-white rounded-[3rem] p-10 border border-slate-200 shadow-xl">
              <div className="flex items-center justify-between mb-10">
                <div>
                  <h3 className="text-xl font-black text-slate-900 uppercase tracking-tight">Thác đổ dòng tiền P&L</h3>
                  <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mt-1">Phân tích dòng tiền từ doanh thu đến lợi nhuận ròng</p>
                </div>
                <div className="p-3 bg-indigo-50 text-indigo-600 rounded-2xl"><BarChart3 className="w-5 h-5" /></div>
              </div>
              <div className="h-[500px] w-full">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={waterfallData} margin={{ top: 40, right: 30, left: 40, bottom: 120 }}>
                    <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
                    <XAxis 
                      dataKey="name" 
                      axisLine={false} 
                      tickLine={false} 
                      tick={{ fontSize: 10, fontWeight: 800, fill: '#64748b' }}
                      interval={0}
                      angle={-45}
                      textAnchor="end"
                      height={100}
                    />
                    <YAxis 
                      axisLine={false} 
                      tickLine={false} 
                      tick={{ fontSize: 10, fontWeight: 700, fill: '#94a3b8' }}
                      tickFormatter={(v) => (v / 1000000).toFixed(1) + 'M'}
                    />
                    <Tooltip 
                      cursor={{ fill: '#f8fafc' }}
                      contentStyle={{ borderRadius: '1.5rem', border: 'none', boxShadow: '0 20px 25px -5px rgb(0 0 0 / 0.1)' }}
                      formatter={(v: any) => {
                        const val = Math.abs(v[1] - v[0]);
                        return [val.toLocaleString() + 'đ', 'Giá trị'];
                      }}
                    />
                    <Bar dataKey="value" radius={[8, 8, 0, 0]} minPointSize={2}>
                      {waterfallData.map((entry: any, index: number) => (
                        <Cell key={`cell-${index}`} fill={entry.fill} />
                      ))}
                      <LabelList 
                        dataKey="label" 
                        position="top" 
                        style={{ fill: '#64748b', fontSize: '10px', fontWeight: 'bold' }} 
                      />
                    </Bar>
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </div>

            <div className="bg-white rounded-[3rem] p-8 border border-slate-200 shadow-xl flex flex-col">
              <div className="flex items-center justify-between mb-8">
                <div>
                  <h3 className="text-xl font-black text-slate-900 uppercase tracking-tight">Phân bổ chi phí</h3>
                  <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mt-1">Cơ cấu chi tiêu theo nhóm cha</p>
                </div>
                <div className="p-3 bg-rose-50 text-rose-600 rounded-2xl"><PieChartIcon className="w-5 h-5" /></div>
              </div>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-8 items-center mb-10">
                <div className="h-[400px] w-full">
                  <ResponsiveContainer width="100%" height="100%">
                    <PieChart>
                      <Pie
                        data={expensePieData}
                        cx="50%"
                        cy="50%"
                        innerRadius={100}
                        outerRadius={140}
                        paddingAngle={5}
                        dataKey="value"
                        onClick={(data) => setSelectedParentCategory(data.name)}
                        className="cursor-pointer"
                      >
                        {expensePieData.map((entry, index) => (
                          <Cell 
                            key={`cell-${index}`} 
                            fill={COLORS[index % COLORS.length]} 
                            stroke={selectedParentCategory === entry.name ? '#000' : 'none'}
                            strokeWidth={2}
                          />
                        ))}
                      </Pie>
                      <Tooltip 
                        contentStyle={{ borderRadius: '1rem', border: 'none', boxShadow: '0 10px 15px -3px rgb(0 0 0 / 0.1)' }}
                        formatter={(val: number) => val.toLocaleString() + 'đ'}
                      />
                    </PieChart>
                  </ResponsiveContainer>
                </div>
                <div className="space-y-3 overflow-y-auto no-scrollbar pr-2 max-h-[400px]">
                  {expensePieData.map((item, idx) => (
                    <button 
                      key={idx} 
                      onClick={() => setSelectedParentCategory(item.name)}
                      className={`w-full flex items-center justify-between p-4 rounded-2xl border transition-all ${
                        selectedParentCategory === item.name 
                        ? 'bg-rose-50 border-rose-200 shadow-md' 
                        : 'bg-slate-50 border-transparent hover:border-slate-200'
                      }`}
                    >
                      <div className="flex items-center gap-3">
                        <div className="w-3 h-3 rounded-full" style={{ backgroundColor: COLORS[idx % COLORS.length] }}></div>
                        <span className="text-[11px] font-black text-slate-700 uppercase truncate max-w-[150px]">{item.name}</span>
                      </div>
                      <div className="text-right">
                        <span className="text-[11px] font-black text-slate-900 block">{item.value.toLocaleString()}đ</span>
                        <span className="text-[10px] font-bold text-slate-400">{(item.value / (insights.periodExp || 1) * 100).toFixed(1)}%</span>
                      </div>
                    </button>
                  ))}
                </div>
              </div>

              {/* Detailed Table */}
              {selectedParentCategory && (
                <div className="mt-4 animate-in fade-in slide-in-from-top-4 duration-500">
                  <div className="flex items-center justify-between mb-6">
                    <h4 className="text-sm font-black text-slate-800 uppercase tracking-tight flex items-center gap-2">
                      <ChevronRight className="w-4 h-4 text-rose-500" />
                      Chi tiết nhóm: {selectedParentCategory}
                    </h4>
                    <button 
                      onClick={() => setSelectedParentCategory(null)}
                      className="text-[10px] font-black text-slate-400 uppercase hover:text-slate-600"
                    >
                      Đóng chi tiết
                    </button>
                  </div>
                  <div className="overflow-hidden rounded-2xl border border-slate-100">
                    <table className="w-full text-left border-collapse">
                      <thead>
                        <tr className="bg-slate-50 border-b border-slate-100">
                          <th className="px-6 py-4 text-[10px] font-black text-slate-400 uppercase tracking-widest">Ngày</th>
                          <th className="px-6 py-4 text-[10px] font-black text-slate-400 uppercase tracking-widest">Danh mục</th>
                          <th className="px-6 py-4 text-[10px] font-black text-slate-400 uppercase tracking-widest">Nội dung</th>
                          <th className="px-6 py-4 text-[10px] font-black text-slate-400 uppercase tracking-widest text-right">Số tiền</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-50">
                        {detailedExpenses.length > 0 ? detailedExpenses.map((exp, idx) => (
                          <tr key={idx} className="hover:bg-slate-50/50 transition-colors">
                            <td className="px-6 py-4 text-[11px] font-bold text-slate-500">{exp.date}</td>
                            <td className="px-6 py-4">
                              <span className="px-2 py-1 bg-slate-100 text-slate-600 rounded-lg text-[9px] font-black uppercase">
                                {exp.category}
                              </span>
                            </td>
                            <td className="px-6 py-4 text-[11px] font-bold text-slate-700">{exp.description}</td>
                            <td className="px-6 py-4 text-[11px] font-black text-slate-900 text-right">
                              {exp.amount.toLocaleString()}đ
                            </td>
                          </tr>
                        )) : (
                          <tr>
                            <td colSpan={4} className="px-6 py-12 text-center text-slate-400 font-bold uppercase text-[10px]">
                              Không có dữ liệu chi tiết
                            </td>
                          </tr>
                        )}
                      </tbody>
                    </table>
                  </div>
                </div>
              )}
            </div>
          </div>
        )}

        {activeSubTab === 'ai' && (
          <div className="animate-in fade-in zoom-in-95 duration-500">
            <div className="bg-white rounded-[3rem] p-10 shadow-xl border border-slate-200 relative overflow-hidden text-slate-900 flex flex-col min-h-[600px]">
              <div className="absolute top-0 right-0 w-96 h-96 bg-indigo-500/5 rounded-full blur-[100px] -translate-y-1/2 translate-x-1/2"></div>
              <div className="relative z-10 flex flex-col h-full">
                <div className="flex items-center gap-3 mb-8 text-indigo-600 font-black uppercase text-[12px] tracking-[0.4em]">
                  <BrainCircuit className="w-6 h-6" /> AI CFO Advisor
                </div>
                <h2 className="text-4xl font-black text-slate-900 uppercase tracking-tighter leading-tight mb-8">
                  Phân tích chiến lược
                </h2>
                
                <button 
                  onClick={runExecutiveBriefing}
                  disabled={isDiagnosing}
                  className="w-full py-6 bg-slate-900 text-white rounded-2xl font-black text-[12px] uppercase tracking-[0.2em] shadow-xl hover:scale-[1.02] active:scale-98 transition-all flex items-center justify-center gap-4 disabled:opacity-50 mb-10"
                >
                  {isDiagnosing ? <Loader2 className="w-5 h-5 animate-spin" /> : <Sparkles className="w-5 h-5 text-indigo-400" />}
                  {isDiagnosing ? "Đang phân tích..." : "Phân tích dữ liệu giai đoạn này"}
                </button>
                
                <div className="flex-1 bg-slate-50 rounded-[2rem] p-10 border border-slate-200 overflow-y-auto no-scrollbar">
                  {diagnosisResult ? (
                    <div className="markdown-content text-slate-700 text-sm leading-relaxed" dangerouslySetInnerHTML={{ __html: marked.parse(diagnosisResult) }} />
                  ) : (
                    <div className="h-full flex flex-col items-center justify-center text-center opacity-40">
                      <Lightbulb className="w-12 h-12 mb-6 text-slate-400" />
                      <p className="text-[12px] font-black uppercase tracking-widest text-slate-500">Nhấn nút bên trên để nhận phân tích từ AI</p>
                    </div>
                  )}
                </div>
              </div>
            </div>
          </div>
        )}

      </div>
    </div>
  );
};

export default Dashboard;
