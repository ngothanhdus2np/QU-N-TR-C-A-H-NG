
import React, { useState, useEffect, useMemo } from 'react';
import { Plus, Calendar, Tag, Target, DollarSign, Trash2, Edit2, CheckCircle2, Clock, AlertCircle, XCircle, BarChart3, ChevronRight, Gift, Ticket, Percent, TrendingUp, Info, MessageSquareText, Library, Sparkles, BrainCircuit, Loader2 } from 'lucide-react';
import { PromotionPlan, RevenueRecord, GiftTier, ExpenseRecord } from '../types';
import { generateId } from '../businessLogic';
import { GoogleGenAI } from "@google/genai";
import { marked } from "marked";

interface PromotionManagerProps {
  promotions: PromotionPlan[];
  revenue: RevenueRecord[];
  expenses: ExpenseRecord[];
  onUpdate: (newList: PromotionPlan[], idToRemove?: string) => void;
}

const PromotionManager: React.FC<PromotionManagerProps> = ({ promotions, revenue, expenses, onUpdate }) => {
  const [activeSubTab, setActiveSubTab] = useState<'ai' | 'setup' | 'ledger'>('setup');
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

  const getStatusBadge = (status: PromotionPlan['status']) => {
    switch (status) {
      case 'Planned':
        return <span className="flex items-center gap-1 text-xs font-bold text-blue-600 bg-blue-50 px-2 py-1 rounded-full"><Clock className="w-3 h-3" /> Dự kiến</span>;
      case 'Active':
        return <span className="flex items-center gap-1 text-xs font-bold text-green-600 bg-green-50 px-2 py-1 rounded-full"><AlertCircle className="w-3 h-3" /> Đang chạy</span>;
      case 'Completed':
        return <span className="flex items-center gap-1 text-xs font-bold text-slate-600 bg-slate-100 px-2 py-1 rounded-full"><CheckCircle2 className="w-3 h-3" /> Hoàn thành</span>;
      case 'Cancelled':
        return <span className="flex items-center gap-1 text-xs font-bold text-rose-600 bg-rose-50 px-2 py-1 rounded-full"><XCircle className="w-3 h-3" /> Đã hủy</span>;
    }
  };

  const getTypeIcon = (type: PromotionPlan['type']) => {
    switch (type) {
      case 'Discount': return <Percent className="w-4 h-4" />;
      case 'Buy1Get1': return <Plus className="w-4 h-4" />;
      case 'Voucher': return <Ticket className="w-4 h-4" />;
      case 'Gift': return <Gift className="w-4 h-4" />;
      default: return <Tag className="w-4 h-4" />;
    }
  };

  const totalBudget = promotions.reduce((sum, p) => sum + p.budget, 0);
  const totalTarget = promotions.reduce((sum, p) => sum + p.targetRevenue, 0);
  const avgROI = totalBudget > 0 ? (totalTarget / totalBudget).toFixed(2) : '0';

  const runAiAnalysis = async () => {
    setIsAnalyzing(true);
    try {
      const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY! });
      
      const context = {
        promotions: promotions.map(p => ({
          name: p.name,
          type: p.type,
          budget: p.budget,
          target: p.targetRevenue,
          status: p.status,
          actualRevenue: p.actualRevenue,
          actualCost: p.actualCost
        })),
        recentRevenue: revenue.slice(-60).map(r => ({ date: r.date, rev: r.netRevenue }))
      };

      const prompt = `Bạn là một Giám đốc Tài chính (CFO) chuyên nghiệp. Hãy phân tích chiến lược khuyến mãi của doanh nghiệp dựa trên dữ liệu sau:
      
      Dữ liệu khuyến mãi: ${JSON.stringify(context.promotions)}
      Dữ liệu doanh thu gần đây: ${JSON.stringify(context.recentRevenue)}
      
      Hãy đưa ra:
      1. Nhận xét về hiệu quả các chương trình đã chạy (ROI, Doanh thu tăng thêm).
      2. Gợi ý chiến lược cho các chương trình sắp tới (Loại hình nào hiệu quả nhất, mốc quà tặng nào nên áp dụng).
      3. Cảnh báo rủi ro nếu ngân sách quá cao hoặc mục tiêu không thực tế.
      
      Yêu cầu: Trả lời bằng tiếng Việt, định dạng Markdown chuyên nghiệp, súc tích, có các con số cụ thể.`;

      const response = await ai.models.generateContent({
        model: "gemini-3-flash-preview",
        contents: prompt,
      });

      setAiAnalysis(response.text || 'Không có phản hồi từ AI.');
    } catch (error) {
      console.error('AI Analysis Error:', error);
      setAiAnalysis('Có lỗi xảy ra khi phân tích dữ liệu. Vui lòng thử lại sau.');
    } finally {
      setIsAnalyzing(false);
    }
  };

  useEffect(() => {
    // AI analysis is now triggered manually by the user
  }, [activeSubTab]);

  const renderAI = () => (
    <div className="space-y-6">
      {/* Stats Overview moved from Setup */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-sm">
          <div className="flex items-center justify-between mb-2">
            <p className="text-xs font-bold text-slate-500 uppercase tracking-wider">Tổng Ngân Sách Năm</p>
            <div className="p-2 bg-indigo-50 rounded-lg text-indigo-600"><DollarSign className="w-4 h-4" /></div>
          </div>
          <h3 className="text-2xl font-black text-slate-900">{totalBudget.toLocaleString()}đ</h3>
        </div>
        <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-sm">
          <div className="flex items-center justify-between mb-2">
            <p className="text-xs font-bold text-slate-500 uppercase tracking-wider">Mục Tiêu Doanh Thu</p>
            <div className="p-2 bg-emerald-50 rounded-lg text-emerald-600"><Target className="w-4 h-4" /></div>
          </div>
          <h3 className="text-2xl font-black text-slate-900">{totalTarget.toLocaleString()}đ</h3>
        </div>
        <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-sm">
          <div className="flex items-center justify-between mb-2">
            <p className="text-xs font-bold text-slate-500 uppercase tracking-wider">ROI Dự Kiến Trung Bình</p>
            <div className="p-2 bg-amber-50 rounded-lg text-amber-600"><BarChart3 className="w-4 h-4" /></div>
          </div>
          <h3 className="text-2xl font-black text-slate-900">{avgROI}x</h3>
        </div>
      </div>

      <div className="bg-white p-8 rounded-2xl border border-slate-200 shadow-sm">
        <div className="flex items-center justify-between mb-8">
          <div className="flex items-center gap-3">
            <div className="p-3 bg-indigo-50 rounded-xl text-indigo-600">
              <BrainCircuit className="w-6 h-6" />
            </div>
            <div>
              <h3 className="text-lg font-black text-slate-900">Cố vấn Chiến lược Khuyến mãi (AI)</h3>
              <p className="text-sm text-slate-500">Phân tích dữ liệu thực tế để tối ưu hóa ROI</p>
            </div>
          </div>
          <button 
            onClick={runAiAnalysis}
            disabled={isAnalyzing}
            className="flex items-center gap-2 px-6 py-3 bg-indigo-600 text-white rounded-xl font-black text-xs uppercase tracking-widest hover:bg-indigo-700 transition-all disabled:opacity-50 shadow-lg shadow-indigo-200"
          >
            {isAnalyzing ? <Loader2 className="w-4 h-4 animate-spin" /> : <Sparkles className="w-4 h-4" />}
            {aiAnalysis ? 'Phân tích lại chiến lược' : 'Bắt đầu phân tích chiến lược'}
          </button>
        </div>

        {isAnalyzing ? (
          <div className="py-20 flex flex-col items-center justify-center text-slate-400">
            <Loader2 className="w-12 h-12 animate-spin mb-4 text-indigo-200" />
            <p className="italic animate-pulse">CFO AI đang quét dữ liệu doanh thu và chi phí...</p>
          </div>
        ) : aiAnalysis ? (
          <div className="prose prose-slate max-w-none prose-headings:font-black prose-headings:text-slate-900 prose-p:text-slate-600 prose-strong:text-indigo-600">
            <div dangerouslySetInnerHTML={{ __html: marked.parse(aiAnalysis) as string }} />
          </div>
        ) : (
          <div className="p-12 text-center border-2 border-dashed border-slate-100 rounded-2xl bg-slate-50/50">
            <Sparkles className="w-12 h-12 text-indigo-200 mx-auto mb-4" />
            <p className="text-slate-500 font-bold mb-2">Sẵn sàng phân tích dữ liệu của bạn</p>
            <p className="text-slate-400 text-xs italic mb-6">Nhấn nút phía trên để nhận gợi ý chiến lược từ CFO AI</p>
            <button 
              onClick={runAiAnalysis}
              className="px-8 py-3 bg-white border-2 border-indigo-600 text-indigo-600 rounded-xl font-black text-xs uppercase tracking-widest hover:bg-indigo-50 transition-all"
            >
              Bắt đầu ngay
            </button>
          </div>
        )}
      </div>
    </div>
  );

  const renderSubTabNav = () => (
    <div className="flex bg-slate-100 p-1.5 rounded-[2rem] w-fit mx-auto shadow-sm border border-slate-200 mb-10">
      <button
        onClick={() => setActiveSubTab('ai')}
        className={`flex items-center gap-3 px-8 py-4 rounded-[1.5rem] font-black text-[10px] uppercase tracking-widest transition-all ${
          activeSubTab === 'ai'
            ? 'bg-white text-indigo-600 shadow-xl'
            : 'text-slate-400 hover:text-slate-600'
        }`}
      >
        <MessageSquareText className="w-4 h-4" /> Phân tích & Gợi ý (AI)
      </button>
      <button
        onClick={() => setActiveSubTab('setup')}
        className={`flex items-center gap-3 px-8 py-4 rounded-[1.5rem] font-black text-[10px] uppercase tracking-widest transition-all ${
          activeSubTab === 'setup'
            ? 'bg-white text-indigo-600 shadow-xl'
            : 'text-slate-400 hover:text-slate-600'
        }`}
      >
        <Plus className="w-4 h-4" /> Thiết lập chương trình
      </button>
      <button
        onClick={() => setActiveSubTab('ledger')}
        className={`flex items-center gap-3 px-8 py-4 rounded-[1.5rem] font-black text-[10px] uppercase tracking-widest transition-all ${
          activeSubTab === 'ledger'
            ? 'bg-white text-indigo-600 shadow-xl'
            : 'text-slate-400 hover:text-slate-600'
        }`}
      >
        <Library className="w-4 h-4" /> Sổ cái khuyến mãi
      </button>
    </div>
  );

  const renderSetup = () => (
    <>
      <div className="flex justify-between items-center mb-6">
        <h2 className="text-xl font-black text-slate-900 flex items-center gap-2">
          <Calendar className="text-indigo-600 w-6 h-6" /> Kế Hoạch Khuyến Mãi Năm
        </h2>
      </div>

      <div className="bg-white p-6 rounded-2xl border-2 border-indigo-100 shadow-xl mb-10">
        <div className="flex justify-between items-start mb-6">
          <h3 className="text-lg font-black text-slate-900">{editingId ? 'Chỉnh Sửa Chương Trình' : 'Thêm Chương Trình Mới'}</h3>
          {suggestedTarget > 0 && (
              <div className="bg-indigo-50 p-3 rounded-xl border border-indigo-100 flex items-center gap-3">
                <div className="flex flex-col">
                  <span className="text-[10px] font-black text-indigo-400 uppercase tracking-widest">Gợi ý từ năm ngoái</span>
                  <span className="text-sm font-black text-indigo-700">{suggestedTarget.toLocaleString()}đ</span>
                </div>
                <button 
                  onClick={handleApplySuggestion}
                  className="bg-indigo-600 text-white text-[10px] font-black px-3 py-1.5 rounded-lg hover:bg-indigo-700 transition-colors uppercase"
                >
                  Áp dụng
                </button>
              </div>
            )}
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-8">
            <div className="space-y-4">
              <div>
                <label className="block text-xs font-black text-slate-500 uppercase mb-1 tracking-widest">Tên chương trình *</label>
                <input 
                  type="text" 
                  className="input-field" 
                  value={formData.name} 
                  onChange={e => setFormData({...formData, name: e.target.value})}
                  placeholder="VD: Sale Hè Rực Rỡ"
                />
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-black text-slate-500 uppercase mb-1 tracking-widest">Ngày bắt đầu *</label>
                  <input 
                    type="date" 
                    className="input-field" 
                    value={formData.startDate} 
                    onChange={e => setFormData({...formData, startDate: e.target.value})}
                  />
                </div>
                <div>
                  <label className="block text-xs font-black text-slate-500 uppercase mb-1 tracking-widest">Ngày kết thúc *</label>
                  <input 
                    type="date" 
                    className="input-field" 
                    value={formData.endDate} 
                    onChange={e => setFormData({...formData, endDate: e.target.value})}
                  />
                </div>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-black text-slate-500 uppercase mb-1 tracking-widest">Mục tiêu doanh thu (đ)</label>
                  <div className="relative">
                    <input 
                      type="text" 
                      className="input-field pr-10" 
                      value={formatCurrency(formData.targetRevenue)} 
                      onChange={e => setFormData({...formData, targetRevenue: parseCurrency(e.target.value)})}
                    />
                    <TrendingUp className="absolute right-3 top-2.5 w-4 h-4 text-slate-300" />
                  </div>
                </div>
                <div>
                  <label className="block text-xs font-black text-slate-500 uppercase mb-1 tracking-widest">Ngân sách dự kiến (đ)</label>
                  <div className="relative">
                    <input 
                      type="text" 
                      className="input-field pr-10" 
                      value={formatCurrency(formData.budget)} 
                      onChange={e => setFormData({...formData, budget: parseCurrency(e.target.value)})}
                    />
                    <DollarSign className="absolute right-3 top-2.5 w-4 h-4 text-slate-300" />
                  </div>
                  {formData.targetRevenue && formData.budget ? (
                    <p className={`text-[10px] mt-1 font-bold ${formData.budget / formData.targetRevenue >= 0.05 && formData.budget / formData.targetRevenue <= 0.1 ? 'text-emerald-500' : 'text-amber-500'}`}>
                      Tỷ lệ: {((formData.budget / formData.targetRevenue) * 100).toFixed(1)}% (Chuẩn: 5-10%)
                    </p>
                  ) : null}
                </div>
              </div>
            </div>

            <div className="space-y-4">
              <div>
                <label className="block text-xs font-black text-slate-500 uppercase mb-1 tracking-widest">Loại khuyến mãi</label>
                <select 
                  className="input-field"
                  value={formData.type}
                  onChange={e => setFormData({...formData, type: e.target.value as any})}
                >
                  <option value="Gift">Tặng quà theo mốc hóa đơn</option>
                  <option value="Discount">Giảm giá trực tiếp</option>
                  <option value="Buy1Get1">Mua 1 tặng 1</option>
                  <option value="Voucher">Voucher / Coupon</option>
                  <option value="Other">Khác</option>
                </select>
              </div>
              <div>
                <label className="block text-xs font-black text-slate-500 uppercase mb-1 tracking-widest">Mô tả chi tiết</label>
                <textarea 
                  className="input-field h-32" 
                  value={formData.description} 
                  onChange={e => setFormData({...formData, description: e.target.value})}
                  placeholder="Nội dung chương trình, điều kiện áp dụng..."
                />
              </div>
            </div>
          </div>

          {(formData.status === 'Active' || formData.status === 'Completed') && (
            <div className="mb-8 p-6 bg-emerald-50 rounded-2xl border border-emerald-100">
              <h4 className="text-sm font-black text-emerald-900 uppercase tracking-widest flex items-center gap-2 mb-4">
                <BarChart3 className="w-4 h-4 text-emerald-600" /> Kết quả thực tế (Tùy chọn ghi đè)
              </h4>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div>
                  <label className="block text-xs font-black text-emerald-700 uppercase mb-1 tracking-widest">Doanh thu thực tế đạt được (đ)</label>
                  <input 
                    type="text" 
                    className="input-field border-emerald-200 focus:border-emerald-500" 
                    value={formatCurrency(formData.actualRevenue)} 
                    onChange={e => setFormData({...formData, actualRevenue: parseCurrency(e.target.value)})}
                    placeholder="Để trống để hệ thống tự tính"
                  />
                </div>
                <div>
                  <label className="block text-xs font-black text-emerald-700 uppercase mb-1 tracking-widest">Chi phí thực tế đã chi (đ)</label>
                  <input 
                    type="text" 
                    className="input-field border-emerald-200 focus:border-emerald-500" 
                    value={formatCurrency(formData.actualCost)} 
                    onChange={e => setFormData({...formData, actualCost: parseCurrency(e.target.value)})}
                    placeholder="Để trống để hệ thống tự tính"
                  />
                </div>
              </div>
            </div>
          )}

          {/* Gift Tiers Section */}
          {formData.type === 'Gift' && (
            <div className="mb-8 p-6 bg-slate-50 rounded-2xl border border-slate-200">
              <div className="flex justify-between items-center mb-4">
                <h4 className="text-sm font-black text-slate-900 uppercase tracking-widest flex items-center gap-2">
                  <Gift className="w-4 h-4 text-indigo-600" /> Danh sách mốc quà tặng
                </h4>
                <button 
                  onClick={addGiftTier}
                  className="text-xs font-black text-indigo-600 hover:text-indigo-700 flex items-center gap-1"
                >
                  <Plus className="w-3 h-3" /> Thêm mốc
                </button>
              </div>
              
              <div className="space-y-3">
                {formData.giftTiers?.map((tier, index) => (
                  <div key={tier.id} className="grid grid-cols-1 md:grid-cols-5 gap-3 items-end bg-white p-4 rounded-xl border border-slate-200 shadow-sm">
                    <div>
                      <label className="block text-[10px] font-black text-slate-400 uppercase mb-1 tracking-widest">Mốc hóa đơn (đ)</label>
                      <input 
                        type="text" 
                        className="input-field" 
                        value={formatCurrency(tier.minInvoiceValue)}
                        onChange={e => updateGiftTier(tier.id, { minInvoiceValue: parseCurrency(e.target.value) })}
                      />
                    </div>
                    <div>
                      <label className="block text-[10px] font-black text-slate-400 uppercase mb-1 tracking-widest">Tên quà tặng</label>
                      <input 
                        type="text" 
                        className="input-field" 
                        placeholder="VD: Bình nước"
                        value={tier.giftName}
                        onChange={e => updateGiftTier(tier.id, { giftName: e.target.value })}
                      />
                    </div>
                    <div>
                      <label className="block text-[10px] font-black text-slate-400 uppercase mb-1 tracking-widest">Giá trị quà gợi ý</label>
                      <div className="input-field bg-slate-50 text-slate-500 font-bold flex items-center h-[38px]">
                        {tier.minInvoiceValue > 0 
                          ? `${Math.round(tier.minInvoiceValue * 0.05).toLocaleString()} - ${Math.round(tier.minInvoiceValue * 0.1).toLocaleString()}đ`
                          : '0đ'}
                      </div>
                    </div>
                    <div>
                      <label className="block text-[10px] font-black text-slate-400 uppercase mb-1 tracking-widest">Giá trị quà (đ)</label>
                      <input 
                        type="text" 
                        className="input-field" 
                        value={formatCurrency(tier.giftValue)}
                        onChange={e => updateGiftTier(tier.id, { giftValue: parseCurrency(e.target.value) })}
                      />
                      {tier.minInvoiceValue > 0 && tier.giftValue > 0 && (
                        <p className={`text-[9px] mt-1 font-bold ${tier.giftValue / tier.minInvoiceValue >= 0.05 && tier.giftValue / tier.minInvoiceValue <= 0.1 ? 'text-emerald-500' : 'text-amber-500'}`}>
                          Tỷ lệ: {((tier.giftValue / tier.minInvoiceValue) * 100).toFixed(1)}% (Chuẩn: 5-10%)
                        </p>
                      )}
                    </div>
                    <div className="flex justify-end">
                      <button 
                        onClick={() => removeGiftTier(tier.id)}
                        className="p-2 text-slate-400 hover:text-rose-600 hover:bg-rose-50 rounded-lg transition-colors"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>
                  </div>
                ))}
                {(!formData.giftTiers || formData.giftTiers.length === 0) && (
                  <div className="text-center py-8 text-slate-400 text-xs italic bg-white rounded-xl border border-dashed border-slate-300">
                    Chưa có mốc quà tặng nào. Nhấn "Thêm mốc" để bắt đầu.
                  </div>
                )}
              </div>
            </div>
          )}

          <div className="flex justify-between items-center pt-6 border-t border-slate-100">
            <div>
              <label className="block text-xs font-black text-slate-500 uppercase mb-1 tracking-widest">Trạng thái</label>
              <select 
                className="input-field w-40"
                value={formData.status}
                onChange={e => setFormData({...formData, status: e.target.value as any})}
              >
                <option value="Planned">Dự kiến</option>
                <option value="Active">Đang chạy</option>
                <option value="Completed">Hoàn thành</option>
                <option value="Cancelled">Đã hủy</option>
              </select>
            </div>
            <div className="flex gap-3">
              {editingId && (
                <button 
                  onClick={() => {
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
                  }}
                  className="px-6 py-2.5 text-sm font-black text-slate-500 hover:text-slate-700 uppercase tracking-widest"
                >
                  Hủy chỉnh sửa
                </button>
              )}
              <button 
                onClick={handleSave}
                className="btn-primary px-8"
              >
                <CheckCircle2 className="w-4 h-4" /> {editingId ? 'Cập Nhật Kế Hoạch' : 'Lưu Kế Hoạch'}
              </button>
            </div>
          </div>
        </div>

      <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="bg-slate-50 border-b border-slate-200">
                <th className="px-6 py-4 text-[10px] font-black text-slate-400 uppercase tracking-widest">Chương Trình</th>
                <th className="px-6 py-4 text-[10px] font-black text-slate-400 uppercase tracking-widest">Thời Gian</th>
                <th className="px-6 py-4 text-[10px] font-black text-slate-400 uppercase tracking-widest">Loại & Trạng Thái</th>
                <th className="px-6 py-4 text-[10px] font-black text-slate-400 uppercase tracking-widest text-right">Ngân Sách</th>
                <th className="px-6 py-4 text-[10px] font-black text-slate-400 uppercase tracking-widest text-right">Mục Tiêu</th>
                <th className="px-6 py-4 text-[10px] font-black text-slate-400 uppercase tracking-widest text-right">ROI</th>
                <th className="px-6 py-4 text-[10px] font-black text-slate-400 uppercase tracking-widest text-center">Thao Tác</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {promotions.length === 0 ? (
                <tr>
                  <td colSpan={7} className="px-6 py-12 text-center text-slate-400 italic">
                    Chưa có kế hoạch khuyến mãi nào được lập.
                  </td>
                </tr>
              ) : (
                promotions.sort((a, b) => new Date(a.startDate).getTime() - new Date(b.startDate).getTime()).map((p) => (
                  <tr key={p.id} className="hover:bg-slate-50 transition-colors group">
                    <td className="px-6 py-4">
                      <div className="flex flex-col">
                        <span className="text-sm font-black text-slate-900">{p.name}</span>
                        <div className="flex items-center gap-1 mt-1">
                          <Info className="w-3 h-3 text-slate-400" />
                          <span className="text-[10px] text-slate-500 line-clamp-1">{p.description || 'Không có mô tả'}</span>
                        </div>
                        {p.giftTiers && p.giftTiers.length > 0 && (
                          <div className="flex flex-wrap gap-1 mt-2">
                            {p.giftTiers.map(t => (
                              <span key={t.id} className="text-[9px] font-black bg-slate-100 text-slate-600 px-1.5 py-0.5 rounded border border-slate-200">
                                {`>${t.minInvoiceValue / 1000}k`}
                              </span>
                            ))}
                          </div>
                        )}
                      </div>
                    </td>
                    <td className="px-6 py-4">
                      <div className="flex flex-col text-xs font-bold text-slate-600">
                        <span>{new Date(p.startDate).toLocaleDateString('vi-VN')}</span>
                        <ChevronRight className="w-3 h-3 text-slate-300 my-0.5" />
                        <span>{new Date(p.endDate).toLocaleDateString('vi-VN')}</span>
                      </div>
                    </td>
                    <td className="px-6 py-4">
                      <div className="flex flex-col gap-2">
                        <div className="flex items-center gap-1.5 text-xs font-black text-indigo-600 uppercase">
                          {getTypeIcon(p.type)} {p.type === 'Gift' ? 'Tặng quà' : p.type}
                        </div>
                        {getStatusBadge(p.status)}
                      </div>
                    </td>
                    <td className="px-6 py-4 text-right">
                      <span className="text-sm font-black text-slate-900">{p.budget.toLocaleString()}đ</span>
                    </td>
                    <td className="px-6 py-4 text-right">
                      <span className="text-sm font-black text-emerald-600">{p.targetRevenue.toLocaleString()}đ</span>
                    </td>
                    <td className="px-6 py-4 text-right">
                      <span className="text-xs font-black text-amber-600 bg-amber-50 px-2 py-1 rounded-lg border border-amber-100">
                        {p.budget > 0 ? (p.targetRevenue / p.budget).toFixed(1) : '0'}x
                      </span>
                    </td>
                    <td className="px-6 py-4">
                      <div className="flex items-center justify-center gap-2 opacity-0 group-hover:opacity-100 transition-opacity">
                        <button 
                          onClick={() => handleEdit(p)}
                          className="p-2 text-slate-400 hover:text-indigo-600 hover:bg-indigo-50 rounded-lg transition-colors"
                        >
                          <Edit2 className="w-4 h-4" />
                        </button>
                        <button 
                          onClick={() => handleDelete(p.id)}
                          className="p-2 text-slate-400 hover:text-rose-600 hover:bg-rose-50 rounded-lg transition-colors"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>
    </>
  );

  const renderLedger = () => {
    const sortedPromotions = [...promotions].sort((a, b) => new Date(b.startDate).getTime() - new Date(a.startDate).getTime());

    const calculatePerformance = (p: PromotionPlan) => {
      const start = new Date(p.startDate);
      const end = new Date(p.endDate);
      const durationDays = Math.max(1, Math.ceil((end.getTime() - start.getTime()) / (1000 * 60 * 60 * 24)) + 1);

      // 1. Actual Revenue during promotion
      const actualRev = revenue
        .filter(r => {
          const d = new Date(r.date);
          return d >= start && d <= end;
        })
        .reduce((sum, r) => sum + r.netRevenue, 0);

      // 2. Baseline Revenue (Average of 30 days before)
      const thirtyDaysBefore = new Date(start);
      thirtyDaysBefore.setDate(thirtyDaysBefore.getDate() - 30);
      
      const baselineRevenueData = revenue.filter(r => {
        const d = new Date(r.date);
        return d >= thirtyDaysBefore && d < start;
      });
      
      const avgDailyBaseline = baselineRevenueData.length > 0 
        ? baselineRevenueData.reduce((sum, r) => sum + r.netRevenue, 0) / baselineRevenueData.length
        : 0;
      
      const expectedRevenue = avgDailyBaseline * durationDays;
      const incrementalRev = actualRev - expectedRevenue;

      // 3. Actual Cost (Marketing/Promotion expenses during period)
      // If user has actualCost field filled, use it, otherwise try to find in expenses
      let actCost = p.actualCost || 0;
      if (actCost === 0) {
        actCost = expenses
          .filter(e => {
            const d = new Date(e.date);
            const isMarketing = e.category.toLowerCase().includes('marketing') || e.category.toLowerCase().includes('khuyến mãi') || e.category.toLowerCase().includes('promotion');
            return d >= start && d <= end && isMarketing;
          })
          .reduce((sum, e) => sum + e.amount, 0);
      }
      
      // Fallback to budget if still 0 and status is completed
      if (actCost === 0 && p.status === 'Completed') actCost = p.budget;

      const roi = actCost > 0 ? (incrementalRev / actCost) : 0;

      return { actualRev, incrementalRev, actCost, roi };
    };

    return (
      <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
        <div className="p-6 border-b border-slate-100 flex justify-between items-center bg-slate-50/50">
          <div>
            <h3 className="text-lg font-black text-slate-900">Sổ cái & Hiệu quả Khuyến mãi</h3>
            <p className="text-xs text-slate-500 mt-1">So sánh kết quả thực tế với mục tiêu đề ra</p>
          </div>
          <div className="flex items-center gap-4">
            <div className="flex items-center gap-2 text-[10px] font-black uppercase tracking-widest text-slate-400">
              <div className="w-2 h-2 rounded-full bg-emerald-500"></div> Hiệu quả tốt
            </div>
            <div className="flex items-center gap-2 text-[10px] font-black uppercase tracking-widest text-slate-400">
              <div className="w-2 h-2 rounded-full bg-amber-500"></div> Cần tối ưu
            </div>
          </div>
        </div>
        
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="bg-slate-50/50 border-b border-slate-200">
                <th className="px-6 py-4 text-[10px] font-black text-slate-400 uppercase tracking-widest">Chương trình</th>
                <th className="px-6 py-4 text-[10px] font-black text-slate-400 uppercase tracking-widest text-right">Doanh thu thực tế</th>
                <th className="px-6 py-4 text-[10px] font-black text-slate-400 uppercase tracking-widest text-right">Doanh thu tăng thêm</th>
                <th className="px-6 py-4 text-[10px] font-black text-slate-400 uppercase tracking-widest text-right">Chi phí thực tế</th>
                <th className="px-6 py-4 text-[10px] font-black text-slate-400 uppercase tracking-widest text-right">ROI Thực tế</th>
                <th className="px-6 py-4 text-[10px] font-black text-slate-400 uppercase tracking-widest text-center">Đánh giá</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {sortedPromotions.length === 0 ? (
                <tr>
                  <td colSpan={6} className="px-6 py-12 text-center text-slate-400 italic">Chưa có dữ liệu khuyến mãi.</td>
                </tr>
              ) : (
                sortedPromotions.map(p => {
                  const perf = calculatePerformance(p);
                  const isPositive = perf.roi > 2; // ROI > 2 is generally good for retail
                  const isWarning = perf.roi < 1 && p.status === 'Completed';

                  return (
                    <tr key={p.id} className="hover:bg-slate-50 transition-colors">
                      <td className="px-6 py-4">
                        <div className="flex flex-col">
                          <span className="text-sm font-black text-slate-900">{p.name}</span>
                          <span className="text-[10px] text-slate-500">{new Date(p.startDate).toLocaleDateString('vi-VN')} - {new Date(p.endDate).toLocaleDateString('vi-VN')}</span>
                        </div>
                      </td>
                      <td className="px-6 py-4 text-right">
                        <span className="text-sm font-black text-slate-700">{perf.actualRev.toLocaleString()}đ</span>
                        <div className="text-[9px] font-bold text-slate-400">Mục tiêu: {p.targetRevenue.toLocaleString()}đ</div>
                      </td>
                      <td className="px-6 py-4 text-right">
                        <span className={`text-sm font-black ${perf.incrementalRev > 0 ? 'text-emerald-600' : 'text-rose-600'}`}>
                          {perf.incrementalRev > 0 ? '+' : ''}{perf.incrementalRev.toLocaleString()}đ
                        </span>
                      </td>
                      <td className="px-6 py-4 text-right">
                        <span className="text-sm font-black text-slate-700">{perf.actCost.toLocaleString()}đ</span>
                        <div className="text-[9px] font-bold text-slate-400">Ngân sách: {p.budget.toLocaleString()}đ</div>
                      </td>
                      <td className="px-6 py-4 text-right">
                        <div className={`inline-block px-3 py-1 rounded-lg border font-black text-xs ${
                          isPositive ? 'bg-emerald-50 text-emerald-600 border-emerald-100' : 
                          isWarning ? 'bg-rose-50 text-rose-600 border-rose-100' : 
                          'bg-slate-50 text-slate-600 border-slate-100'
                        }`}>
                          {perf.roi.toFixed(2)}x
                        </div>
                      </td>
                      <td className="px-6 py-4 text-center">
                        {p.status !== 'Completed' && p.status !== 'Active' ? (
                          <span className="text-[10px] font-bold text-slate-400 italic">Chưa diễn ra</span>
                        ) : (
                          <div className="flex justify-center">
                            {isPositive ? (
                              <div className="flex items-center gap-1 text-emerald-600 font-black text-[10px] uppercase">
                                <TrendingUp className="w-3 h-3" /> Hiệu quả cao
                              </div>
                            ) : isWarning ? (
                              <div className="flex items-center gap-1 text-rose-600 font-black text-[10px] uppercase">
                                <AlertCircle className="w-3 h-3" /> Cần xem lại
                              </div>
                            ) : (
                              <div className="flex items-center gap-1 text-amber-600 font-black text-[10px] uppercase">
                                <Clock className="w-3 h-3" /> Đạt yêu cầu
                              </div>
                            )}
                          </div>
                        )}
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </div>
    );
  };

  return (
    <div className="space-y-6">
      {renderSubTabNav()}

      {activeSubTab === 'ai' && renderAI()}
      {activeSubTab === 'setup' && renderSetup()}
      {activeSubTab === 'ledger' && renderLedger()}
    </div>
  );
};

export default PromotionManager;
