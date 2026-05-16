
import React, { useState, useEffect } from 'react';
import { PromotionPlan, RevenueRecord, GiftTier, ExpenseRecord } from '../types';
import { generateId } from '../src/lib';
import PromotionAiPanel from './promotion/PromotionAiPanel';
import PromotionLedgerTable from './promotion/PromotionLedgerTable';
import PromotionSetupPanel from './promotion/PromotionSetupPanel';
import PromotionSubTabNav, { PromotionSubTab } from './promotion/PromotionSubTabNav';

interface PromotionManagerProps {
  promotions: PromotionPlan[];
  revenue: RevenueRecord[];
  expenses: ExpenseRecord[];
  onUpdate: (newList: PromotionPlan[], idToRemove?: string) => void;
}

const PromotionManager: React.FC<PromotionManagerProps> = ({ promotions, revenue, expenses, onUpdate }) => {
  const [activeSubTab, setActiveSubTab] = useState<PromotionSubTab>('setup');
  const [aiAnalysis, setAiAnalysis] = useState<string>('');
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [formData, setFormData] = useState<Partial<PromotionPlan>>({
    name: '',
    startDate: new Date().toISOString().split('T')[0],
    endDate: new Date().toISOString().split('T')[0],
    type: 'Gift',
    budget: 0,
    targetRevenue: 0,
    description: '',
    status: 'Planned',
    giftTiers: []
  });

  const [suggestedTarget, setSuggestedTarget] = useState<number>(0);

  const formatCurrency = (val: number | undefined) => {
    if (val === undefined || val === 0) return '';
    return val.toLocaleString('en-US');
  };

  const parseCurrency = (val: string) => {
    return Number(val.replace(/,/g, '')) || 0;
  };

  // Helper to find revenue from same month last year
  const getPreviousYearRevenue = (dateStr: string) => {
    const date = new Date(dateStr);
    const month = date.getMonth();
    const year = date.getFullYear();
    
    const lastYearRevenue = revenue.filter(r => {
      const rDate = new Date(r.date);
      return rDate.getMonth() === month && rDate.getFullYear() === year - 1;
    });

    return lastYearRevenue.reduce((sum, r) => sum + r.netRevenue, 0);
  };

  useEffect(() => {
    if (formData.startDate) {
      const prevRev = getPreviousYearRevenue(formData.startDate);
      setSuggestedTarget(prevRev);
    }
  }, [formData.startDate, revenue]);

  const handleApplySuggestion = () => {
    setFormData(prev => ({
      ...prev,
      targetRevenue: suggestedTarget,
      budget: Math.round(suggestedTarget * 0.07) // Suggest 7% as middle ground
    }));
  };

  const handleSave = () => {
    if (!formData.name || !formData.startDate || !formData.endDate) {
      alert('Vui lòng điền đầy đủ thông tin bắt buộc');
      return;
    }

    let newList: PromotionPlan[];
    if (editingId) {
      newList = promotions.map(p => p.id === editingId ? { ...p, ...formData } as PromotionPlan : p);
    } else {
      const newPromotion: PromotionPlan = {
        id: generateId(),
        ...formData as PromotionPlan
      };
      newList = [...promotions, newPromotion];
    }

    onUpdate(newList);
    setEditingId(null);
    setFormData({
      name: '',
      startDate: new Date().toISOString().split('T')[0],
      endDate: new Date().toISOString().split('T')[0],
      type: 'Gift',
      budget: 0,
      targetRevenue: 0,
      description: '',
      status: 'Planned',
      giftTiers: []
    });
  };

  const handleDelete = (id: string) => {
    if (window.confirm('Bạn có chắc chắn muốn xóa kế hoạch này?')) {
      const newList = promotions.filter(p => p.id !== id);
      onUpdate(newList, id);
    }
  };

  const handleEdit = (promotion: PromotionPlan) => {
    setFormData(promotion);
    setEditingId(promotion.id);
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const addGiftTier = () => {
    const newTier: GiftTier = {
      id: generateId(),
      minInvoiceValue: 0,
      giftValue: 0,
      giftName: ''
    };
    setFormData(prev => ({
      ...prev,
      giftTiers: [...(prev.giftTiers || []), newTier]
    }));
  };

  const updateGiftTier = (id: string, updates: Partial<GiftTier>) => {
    setFormData(prev => ({
      ...prev,
      giftTiers: prev.giftTiers?.map(t => t.id === id ? { ...t, ...updates } : t)
    }));
  };

  const removeGiftTier = (id: string) => {
    setFormData(prev => ({
      ...prev,
      giftTiers: prev.giftTiers?.filter(t => t.id !== id)
    }));
  };

  const totalBudget = promotions.reduce((sum, p) => sum + p.budget, 0);
  const totalTarget = promotions.reduce((sum, p) => sum + p.targetRevenue, 0);
  const avgROI = totalBudget > 0 ? (totalTarget / totalBudget).toFixed(2) : '0';

  const runAiAnalysis = async () => {
    setIsAnalyzing(true);
    try {
      // Format promotions as text table — compact hơn JSON serialization
      const promoLines = promotions.map(p => {
        const roi = p.budget > 0 ? ((p.actualRevenue || 0) / p.budget).toFixed(1) : 'N/A';
        return `- ${p.name} | ${p.type} | NS:${(p.budget/1e6).toFixed(1)}tr | Mục tiêu:${(p.targetRevenue/1e6).toFixed(1)}tr | TT:${((p.actualRevenue||0)/1e6).toFixed(1)}tr | Chi phí TT:${((p.actualCost||0)/1e6).toFixed(1)}tr | ROI:${roi}x | ${p.status}`;
      }).join('\n');

      // Aggregate 60 ngày gần nhất thành tổng theo tuần — giảm ~90% token so với raw JSON
      const recentSlice = revenue.slice(-60);
      const weeklyMap: Record<string, number> = {};
      for (const r of recentSlice) {
        const d = new Date(r.date);
        const weekStart = new Date(d);
        weekStart.setDate(d.getDate() - d.getDay());
        const key = weekStart.toISOString().slice(0, 10);
        weeklyMap[key] = (weeklyMap[key] || 0) + (r.netRevenue || 0);
      }
      const weeklyLines = Object.entries(weeklyMap)
        .sort(([a], [b]) => a.localeCompare(b))
        .map(([week, total]) => `  Tuần ${week}: ${total.toLocaleString('vi-VN')}đ`)
        .join('\n');
      const totalRev = recentSlice.reduce((s, r) => s + (r.netRevenue || 0), 0);
      const avgDaily = recentSlice.length > 0 ? Math.round(totalRev / recentSlice.length) : 0;

      const contextData = `Phân tích chiến lược khuyến mãi:

CHƯƠNG TRÌNH KHUYẾN MÃI:
${promoLines}

DOANH THU 60 NGÀY GẦN NHẤT (theo tuần):
${weeklyLines}
TB/ngày: ${avgDaily.toLocaleString('vi-VN')}đ

Yêu cầu:
1. Nhận xét hiệu quả từng chương trình (ROI, doanh thu tăng thêm so mục tiêu).
2. Loại hình nào hiệu quả nhất — nên đẩy mạnh tiếp?
3. Cảnh báo rủi ro nếu ngân sách hoặc mục tiêu không thực tế.
Súc tích, dẫn chứng bằng số cụ thể.`;

      const response = await fetch('/api/ai/promotion-analysis', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ contextData }),
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || 'AI service error');
      setAiAnalysis(data.result || 'Không có phản hồi từ AI.');
    } catch (error) {
      console.error('AI Analysis Error:', error);
      setAiAnalysis('Có lỗi xảy ra khi phân tích dữ liệu. Vui lòng kiểm tra ANTHROPIC_API_KEY trong .env.local.');
    } finally {
      setIsAnalyzing(false);
    }
  };

  useEffect(() => {
    // AI analysis is now triggered manually by the user
  }, [activeSubTab]);

  return (
    <div className="space-y-6">
      <PromotionSubTabNav activeSubTab={activeSubTab} onChange={setActiveSubTab} />

      {activeSubTab === 'ai' && (
        <PromotionAiPanel
          totalBudget={totalBudget}
          totalTarget={totalTarget}
          avgROI={avgROI}
          aiAnalysis={aiAnalysis}
          isAnalyzing={isAnalyzing}
          onRunAnalysis={runAiAnalysis}
        />
      )}
      {activeSubTab === 'setup' && (
        <PromotionSetupPanel
          promotions={promotions}
          editingId={editingId}
          formData={formData}
          setFormData={setFormData}
          setEditingId={setEditingId}
          suggestedTarget={suggestedTarget}
          formatCurrency={formatCurrency}
          parseCurrency={parseCurrency}
          handleApplySuggestion={handleApplySuggestion}
          handleSave={handleSave}
          handleEdit={handleEdit}
          handleDelete={handleDelete}
          addGiftTier={addGiftTier}
          updateGiftTier={updateGiftTier}
          removeGiftTier={removeGiftTier}
        />
      )}
      {activeSubTab === 'ledger' && (
        <PromotionLedgerTable promotions={promotions} revenue={revenue} expenses={expenses} />
      )}
    </div>
  );
};

export default PromotionManager;
