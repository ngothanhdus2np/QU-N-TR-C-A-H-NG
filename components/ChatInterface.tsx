import React, { useState, useRef, useEffect } from 'react';
import DOMPurify from 'dompurify';
import {
  Send,
  User,
  Bot,
  BrainCircuit,
  Loader2,
  Sparkles,
  ShieldAlert,
  Database,
  PieChart,
  TrendingUp,
  Package,
  Users,
  Megaphone,
  Wrench,
  Star,
} from 'lucide-react';
import { AppData, ChatMessage } from '../types';
import { marked } from 'marked';
import {
  calculateFinancialHealthScore,
  auditFinancials,
  calculateSeniority,
  calculateExpenseAnalysis,
  calculateDailyBreakEven,
  isStaffActive,
} from '../src/lib';
import { calcOrderRevenue } from '../src/lib/reportCalculations';

interface ChatInterfaceProps {
  data: AppData;
  messages: ChatMessage[];
  setMessages: React.Dispatch<React.SetStateAction<ChatMessage[]>>;
  isCFOReady: boolean;
}

const AGENT_META: Record<
  string,
  { label: string; color: string; icon: React.ElementType; questions: string[] }
> = {
  finance: {
    label: 'CFO Agent',
    color: 'indigo',
    icon: PieChart,
    questions: [
      'Kiểm tra rò rỉ dòng tiền: Chi phí nào đang chiếm tỷ trọng cao bất thường trong 30 ngày qua?',
      'So sánh doanh thu và lợi nhuận thuần tuần này so với tuần trước.',
      'Dựa trên chi phí cố định, dự báo ngày nào tháng này chúng ta đạt điểm hòa vốn?',
      'Phân tích sức khỏe tài chính tháng này theo điểm số.',
    ],
  },
  hr: {
    label: 'HR Agent',
    color: 'amber',
    icon: Users,
    questions: [
      'Danh sách nhân sự đang làm việc và dự toán quỹ lương tháng này là bao nhiêu?',
      'Ai có thâm niên sắp chạm ngưỡng nhảy bậc lương trong 30 ngày tới?',
      'So sánh chi phí nhân sự tháng này với doanh thu — tỉ lệ có hợp lý không?',
    ],
  },
  sales: {
    label: 'Sales Agent',
    color: 'emerald',
    icon: TrendingUp,
    questions: [
      'So sánh doanh thu cửa hàng và Shopee tháng này — kênh nào đang tốt hơn?',
      'Tuần nào trong tháng này có doanh thu cao nhất? Nguyên nhân có thể là gì?',
      'Xu hướng doanh thu 3 tháng gần nhất đang tăng hay giảm?',
    ],
  },
  inventory: {
    label: 'Inventory Agent',
    color: 'orange',
    icon: Package,
    questions: [
      'Sản phẩm nào đang sắp hết hàng hoặc đã hết? Cần nhập ngay gì?',
      'Hàng nào bán chậm trong tháng này — có nên giảm giá hay trả NCC không?',
    ],
  },
  marketing: {
    label: 'Marketing Agent',
    color: 'rose',
    icon: Megaphone,
    questions: [
      'Chương trình khuyến mãi nào đang có ROI tốt nhất?',
      'So sánh hiệu quả các campaign đã chạy — cái nào nên nhân rộng?',
    ],
  },
  operations: {
    label: 'Operations Agent',
    color: 'slate',
    icon: Wrench,
    questions: [
      'Tóm tắt phiên bán hàng POS hôm nay — doanh thu, số hóa đơn, phương thức thanh toán.',
      'Nhà cung cấp nào đang có công nợ chưa thanh toán quá hạn?',
      'Công nợ tổng với các NCC hiện tại là bao nhiêu?',
    ],
  },
  customers: {
    label: 'Customer Agent',
    color: 'violet',
    icon: Star,
    questions: [
      'Phân loại tệp khách hàng theo hạng VIP — bao nhiêu khách Gold, Diamond?',
      'Top 10 khách hàng chi tiêu nhiều nhất là ai?',
      'Tổng điểm tích lũy và công nợ khách hàng hiện tại là bao nhiêu?',
    ],
  },
};

const ChatInterface: React.FC<ChatInterfaceProps> = ({
  data,
  messages,
  setMessages,
  isCFOReady,
}) => {
  const [input, setInput] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [isQuerying, setIsQuerying] = useState(false);
  const [currentTool, setCurrentTool] = useState<string | null>(null);
  const [activeAgent, setActiveAgent] = useState<string>('finance');
  const scrollRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    marked.setOptions({ breaks: true, gfm: true });
  }, []);
  useEffect(() => {
    if (scrollRef.current) scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
  }, [messages]);

  // Tool Implementation Handlers
  const callTool = async (name: string, args: any) => {
    setCurrentTool(name);
    switch (name) {
      case 'get_metadata':
        return {
          employees: data.employees.map(e => ({
            name: e.name,
            position: e.position,
            joinDate: e.joinDate,
            resignedDate: e.resignedDate || null,
            status: isStaffActive(e) ? 'Active' : 'Resigned',
            seniority: calculateSeniority(e.joinDate),
          })),
          salaryPolicies: data.salaryPolicies.map(p => ({
            name: p.name,
            base: p.baseSalary,
            range: `${p.startThreshold} - ${p.endThreshold === 0 ? '∞' : p.endThreshold} ngày`,
          })),
          expenseCategories: data.expenseCategories.map(c => c.name),
          sopSummary: data.knowledgeBase.map(k => ({ title: k.title, category: k.category })),
        };

      case 'query_ledgers':
        const { ledgerType, startDate, endDate } = args;
        const start = new Date(startDate);
        const end = new Date(endDate);

        if (ledgerType === 'revenue') {
          return data.revenue
            .filter(r => {
              const d = new Date(r.date);
              return d >= start && d <= end;
            })
            .slice(0, 100);
        }
        if (ledgerType === 'shopee_revenue') {
          return data.shopeeInventoryOut
            .filter(r => {
              const d = new Date(r.date);
              return d >= start && d <= end;
            })
            .slice(0, 50); // Limit to avoid context bloat but enough for analysis
        }
        if (ledgerType === 'expenses') {
          return data.expenses
            .filter(e => {
              const d = new Date(e.date);
              return d >= start && d <= end;
            })
            .slice(0, 100);
        }
        if (ledgerType === 'payroll') {
          return data.payroll.filter(p => {
            return p.month >= startDate.slice(0, 7) && p.month <= endDate.slice(0, 7);
          });
        }
        return { error: 'Loại sổ cái không hợp lệ' };

      case 'get_financial_analysis':
        const targetMonth = args.month || new Date().toISOString().slice(0, 7);
        const monthRevenue = data.revenue.filter(r => r.date.startsWith(targetMonth));
        const monthExpenses = data.expenses.filter(e => e.date.startsWith(targetMonth));
        const monthPayroll = data.payroll.filter(p => p.month === targetMonth);

        const health = calculateFinancialHealthScore({
          ...data,
          revenue: monthRevenue,
          expenses: monthExpenses,
          payroll: monthPayroll,
        });
        const analysis = calculateExpenseAnalysis(
          monthExpenses,
          monthRevenue,
          monthPayroll,
          data.expenseCategories
        );
        const breakEven = calculateDailyBreakEven(
          data.revenue,
          data.dailyBreakEvenConfig,
          `${targetMonth}-01`
        );

        return {
          healthScore: health.score,
          leaks: auditFinancials({
            ...data,
            revenue: monthRevenue,
            expenses: monthExpenses,
            payroll: monthPayroll,
          }),
          expenseBreakdown: analysis.analysis.slice(0, 5),
          breakEvenDay: breakEven.breakEvenDay,
          netMargin: health.netMargin,
          payrollRatio: health.payrollRatio,
        };

      case 'get_payroll_preview': {
        const targetMonth = args?.month || new Date().toISOString().slice(0, 7);
        const activeStaff = data.employees.filter(e => isStaffActive(e));
        return {
          month: targetMonth,
          activeCount: activeStaff.length,
          staff: activeStaff.map(e => {
            const seniority = calculateSeniority(e.joinDate);
            const policy = (data.salaryPolicies || []).find(p =>
              e.assignedPolicyId
                ? p.id === e.assignedPolicyId
                : seniority >= p.startThreshold &&
                  (p.endThreshold === 0 || seniority <= p.endThreshold)
            );
            return {
              name: e.name,
              position: e.position,
              joinDate: e.joinDate,
              seniorityDays: seniority,
              policyName: policy?.name || 'Chưa xác định',
              estimatedBase: policy?.baseSalary || 0,
              estimatedAllowances: policy
                ? (policy.attendanceAllowance || 0) +
                  (policy.cleaningAllowance || 0) +
                  (policy.customerServiceAllowance || 0) +
                  (policy.dinnerAllowance || 0) +
                  (policy.housingAllowance || 0)
                : 0,
            };
          }),
          existingPayroll: (data.payroll || [])
            .filter(p => p.month === targetMonth)
            .map(p => ({ name: p.employeeName, netPay: p.netPay, isOfficial: p.isOfficial })),
        };
      }

      case 'get_inventory_alerts': {
        const products = data.posProducts || [];
        const outOfStock = products.filter(p => p.status === 'Active' && p.stock <= 0);
        const lowStock = products.filter(
          p => p.status === 'Active' && p.stock > 0 && p.stock <= (p.minStock ?? 5)
        );
        return {
          outOfStockCount: outOfStock.length,
          lowStockCount: lowStock.length,
          outOfStock: outOfStock.map(p => ({
            name: p.name,
            sku: p.sku,
            stock: p.stock,
            minStock: p.minStock ?? 5,
          })),
          lowStock: lowStock.map(p => ({
            name: p.name,
            sku: p.sku,
            stock: p.stock,
            minStock: p.minStock ?? 5,
          })),
        };
      }

      case 'get_supplier_debt_summary': {
        const debtMap = new Map<
          string,
          { supplierName: string; balance: number; lastActivity: string }
        >();
        for (const r of data.supplierDebts || []) {
          if (!debtMap.has(r.supplierId)) {
            debtMap.set(r.supplierId, {
              supplierName: r.supplierName,
              balance: 0,
              lastActivity: r.date,
            });
          }
          const entry = debtMap.get(r.supplierId)!;
          entry.balance += r.type === 'purchase' ? r.amount : -r.amount;
          if (r.date > entry.lastActivity) entry.lastActivity = r.date;
        }
        const thirtyDaysAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000)
          .toISOString()
          .split('T')[0];
        const summaries = Array.from(debtMap.values()).filter(e => e.balance > 0);
        return {
          totalDebt: summaries.reduce((s, e) => s + e.balance, 0),
          supplierCount: summaries.length,
          details: summaries
            .map(e => ({ ...e, isOverdue: e.lastActivity < thirtyDaysAgo }))
            .sort((a, b) => b.balance - a.balance),
        };
      }

      case 'get_promotion_roi': {
        const statusFilter = args?.status;
        const promos = (data.promotions || [])
          .filter(p => !statusFilter || p.status === statusFilter)
          .map(p => ({
            name: p.name,
            status: p.status,
            type: p.type,
            startDate: p.startDate,
            endDate: p.endDate,
            budget: p.budget,
            targetRevenue: p.targetRevenue,
            actualRevenue: p.actualRevenue || 0,
            actualCost: p.actualCost || p.budget,
            roi:
              p.actualRoi ??
              (p.actualRevenue && p.budget
                ? +(
                    ((p.actualRevenue - (p.actualCost || p.budget)) / (p.actualCost || p.budget)) *
                    100
                  ).toFixed(1)
                : null),
            achieved: p.actualRevenue
              ? ((p.actualRevenue / p.targetRevenue) * 100).toFixed(1) + '%'
              : 'Chưa có dữ liệu',
          }));
        return { total: promos.length, promotions: promos };
      }

      case 'get_pos_session_summary': {
        const sessionDate = args?.date || new Date().toISOString().split('T')[0];
        const orders = (data.posOrders || []).filter(
          o => o.date.startsWith(sessionDate) && !o.isReturn
        );
        const returns = (data.posOrders || []).filter(
          o => o.date.startsWith(sessionDate) && o.isReturn
        );
        const productMap = new Map<string, { name: string; quantity: number; revenue: number }>();
        for (const o of orders) {
          for (const item of o.items) {
            const cur = productMap.get(item.productId) || {
              name: item.name,
              quantity: 0,
              revenue: 0,
            };
            cur.quantity += item.quantity;
            cur.revenue += item.total;
            productMap.set(item.productId, cur);
          }
        }
        return {
          date: sessionDate,
          orderCount: orders.length,
          returnCount: returns.length,
          totalRevenue: orders.reduce((s, o) => s + calcOrderRevenue(o), 0),
          totalReturns: returns.reduce((s, o) => s + Math.abs(Number(o.totalAmount) || 0), 0),
          cashOrders: orders.filter(o => o.paymentMethod === 'Cash').length,
          bankOrders: orders.filter(o => o.paymentMethod === 'Bank').length,
          topProducts: Array.from(productMap.values())
            .sort((a, b) => b.quantity - a.quantity)
            .slice(0, 5),
        };
      }

      case 'query_pos_orders': {
        const { startDate: s, endDate: e, topN: n = 10 } = args || {};
        const orders = (data.posOrders || []).filter(
          o => !o.isReturn && o.status !== 'cancelled' && o.date >= s && o.date <= e
        );
        const returns = (data.posOrders || []).filter(
          o => o.isReturn && o.date >= s && o.date <= e
        );
        const productMap = new Map<string, { name: string; quantity: number; revenue: number }>();
        for (const o of orders) {
          for (const item of o.items) {
            const cur = productMap.get(item.productId) || { name: item.name, quantity: 0, revenue: 0 };
            cur.quantity += item.quantity;
            cur.revenue += item.total;
            productMap.set(item.productId, cur);
          }
        }
        const totalRevenue = orders.reduce((sum, o) => sum + calcOrderRevenue(o), 0);
        const totalReturns = returns.reduce((sum, o) => sum + Math.abs(Number(o.totalAmount) || 0), 0);
        return {
          period: `${s} đến ${e}`,
          orderCount: orders.length,
          returnCount: returns.length,
          totalRevenue,
          totalReturns,
          netRevenue: totalRevenue - totalReturns,
          avgOrderValue: orders.length > 0 ? Math.round(totalRevenue / orders.length) : 0,
          paymentBreakdown: {
            Cash: orders.filter(o => o.paymentMethod === 'Cash').reduce((sum, o) => sum + calcOrderRevenue(o), 0),
            Bank: orders.filter(o => o.paymentMethod === 'Bank').reduce((sum, o) => sum + calcOrderRevenue(o), 0),
            Momo: orders.filter(o => o.paymentMethod === 'Momo').reduce((sum, o) => sum + calcOrderRevenue(o), 0),
            Other: orders.filter(o => o.paymentMethod === 'Other').reduce((sum, o) => sum + calcOrderRevenue(o), 0),
          },
          topProducts: Array.from(productMap.values())
            .sort((a, b) => b.revenue - a.revenue)
            .slice(0, n),
        };
      }

      case 'get_product_details': {
        const { query: q, stockFilter = 'all', activeOnly = true } = args || {};
        let products = (data.posProducts || []);
        if (activeOnly) products = products.filter(p => p.status === 'Active');
        if (q) {
          const lower = q.toLowerCase();
          products = products.filter(
            p => p.name.toLowerCase().includes(lower) || p.sku.toLowerCase().includes(lower)
          );
        }
        if (stockFilter === 'out_of_stock') products = products.filter(p => p.stock <= 0);
        else if (stockFilter === 'low_stock') products = products.filter(p => p.stock > 0 && p.stock <= (p.minStock ?? 5));
        else if (stockFilter === 'in_stock') products = products.filter(p => p.stock > 0);
        return {
          totalFound: products.length,
          products: products.slice(0, 30).map(p => ({
            name: p.name,
            sku: p.sku,
            salePrice: p.salePrice,
            importPrice: p.importPrice,
            stock: p.stock,
            minStock: p.minStock,
            unit: p.unit,
            status: p.status,
          })),
        };
      }

      case 'get_customer_stats': {
        const topN = args?.topN ?? 10;
        const customers = data.posCustomers || [];
        const tierCount: Record<string, number> = { Standard: 0, Silver: 0, Gold: 0, Diamond: 0 };
        for (const c of customers) tierCount[c.tier] = (tierCount[c.tier] ?? 0) + 1;
        return {
          totalCustomers: customers.length,
          tierBreakdown: tierCount,
          totalPoints: customers.reduce((s, c) => s + c.points, 0),
          totalDebt: customers.reduce((s, c) => s + (c.debtAmount ?? 0), 0),
          topBySpending: customers
            .filter(c => c.totalSpent > 0)
            .sort((a, b) => b.totalSpent - a.totalSpent)
            .slice(0, topN)
            .map(c => ({
              name: c.name,
              phone: c.phone,
              tier: c.tier,
              totalSpent: c.totalSpent,
              points: c.points,
              lastVisit: c.lastVisit,
            })),
        };
      }

      case 'get_product_group_revenue': {
        const { startDate: gs, endDate: ge } = args || {};
        const records = (data.productGroupRevenue || []).filter(
          r => r.date >= gs && r.date <= ge
        );
        const groupMap = new Map<string, { name: string; revenue: number; netRevenue: number; quantity: number }>();
        for (const r of records) {
          const cur = groupMap.get(r.groupId) || { name: r.groupName, revenue: 0, netRevenue: 0, quantity: 0 };
          cur.revenue += r.amount;
          cur.netRevenue += r.netRevenue ?? r.amount;
          cur.quantity += r.quantity ?? 0;
          groupMap.set(r.groupId, cur);
        }
        const totalRevenue = Array.from(groupMap.values()).reduce((s, v) => s + v.revenue, 0);
        return {
          period: `${gs} đến ${ge}`,
          totalRevenue,
          groups: Array.from(groupMap.values())
            .sort((a, b) => b.revenue - a.revenue)
            .map(g => ({ ...g, pct: totalRevenue > 0 ? +((g.revenue / totalRevenue) * 100).toFixed(1) : 0 })),
        };
      }

      default:
        return { error: 'Công cụ không tồn tại' };
    }
  };

  const handleSend = async () => {
    if (!input.trim() || isLoading) return;

    const userMessage: ChatMessage = { role: 'user', content: input };
    // Giữ tối đa 6 message cuối (3 turns) — tránh input tokens tăng không giới hạn
    const history = (Array.isArray(messages) ? messages : []).slice(-6);
    const newMessages = [...(Array.isArray(messages) ? messages : []), userMessage];
    setMessages(newMessages);
    setInput('');
    setIsLoading(true);
    setIsQuerying(false);
    setCurrentTool(null);

    try {
      // Step 1: classify domain (fast haiku call, ~200ms)
      let domain = 'finance';
      try {
        const classifyRes = await fetch('/api/ai/classify', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ message: input }),
        });
        if (classifyRes.ok) {
          const classifyData = await classifyRes.json();
          domain = classifyData.domain || 'finance';
        }
      } catch {
        /* fallback to finance */
      }
      setActiveAgent(domain);

      // Claude tool use loop — tool execution happens on frontend (data is local)
      type ClaudeMsg = { role: 'user' | 'assistant'; content: any };
      const claudeMessages: ClaudeMsg[] = [
        ...history.map(m => ({
          role: (m.role === 'model' ? 'assistant' : 'user') as 'user' | 'assistant',
          content: m.content,
        })),
        { role: 'user', content: input },
      ];

      let currentIteration = 0;
      const maxIterations = 5;
      let finalResponse = '';

      while (currentIteration < maxIterations) {
        const response = await fetch('/api/ai/chat', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ messages: claudeMessages, domain }),
        });
        const data = await response.json();
        if (!response.ok) throw new Error(data.error || 'AI service error');

        const content: any[] = data.content;
        const toolUseBlocks = content.filter((b: any) => b.type === 'tool_use');
        const textBlock = content.find((b: any) => b.type === 'text');

        if (toolUseBlocks.length > 0) {
          setIsQuerying(true);
          // Append assistant turn (contains tool_use blocks)
          claudeMessages.push({ role: 'assistant', content });
          // Execute each tool locally and collect results
          const toolResults: any[] = [];
          for (const block of toolUseBlocks) {
            const result = await callTool(block.name, block.input);
            toolResults.push({
              type: 'tool_result',
              tool_use_id: block.id,
              content: JSON.stringify(result),
            });
          }
          // Append user turn with tool results
          claudeMessages.push({ role: 'user', content: toolResults });
          currentIteration++;
        } else {
          finalResponse = textBlock?.text || 'Bộ não AI CFO đang tái khởi động. Vui lòng hỏi lại.';
          break;
        }
      }

      if (!finalResponse)
        finalResponse = 'Đã đạt giới hạn số vòng truy vấn. Vui lòng thử câu hỏi ngắn hơn.';
      setMessages([...newMessages, { role: 'model', content: finalResponse }]);
    } catch (error) {
      console.error(error);
      setMessages([
        ...newMessages,
        {
          role: 'model',
          content:
            'Hệ thống AI đang gặp khó khăn khi truy cập dữ liệu chuyên sâu. Vui lòng thử lại với câu hỏi ngắn hơn.',
        },
      ]);
    } finally {
      setIsLoading(false);
      setIsQuerying(false);
      setCurrentTool(null);
    }
  };

  if (!isCFOReady) return null;

  return (
    <div className="flex flex-col h-[calc(100vh-12rem)] bg-white rounded-[3.5rem] border border-slate-200 overflow-hidden shadow-2xl relative">
      <div className="p-8 bg-slate-800 text-white flex items-center justify-between border-b border-slate-700">
        <div className="flex items-center gap-5">
          <div className="w-14 h-14 bg-indigo-600 rounded-2xl flex items-center justify-center shadow-2xl ring-4 ring-indigo-500/20">
            <BrainCircuit className="w-8 h-8" />
          </div>
          <div>
            <h4 className="font-semibold text-base uppercase tracking-[0.2em] flex items-center gap-2">
              AI CFO SUPREME <Sparkles className="w-4 h-4 text-amber-400" />
            </h4>
            <div className="flex items-center gap-2 mt-1">
              <div className="w-2 h-2 bg-emerald-400 rounded-full animate-pulse"></div>
              <span className="text-2xs font-normal text-slate-400 uppercase tracking-widest">
                Logic Brain Matrix Active
              </span>
            </div>
          </div>
        </div>
        {/* Active agent badge */}
        {(() => {
          const meta = AGENT_META[activeAgent] ?? AGENT_META['finance'];
          const AgentIcon = meta.icon;
          return (
            <div className="flex items-center gap-2 bg-slate-700 px-4 py-2 rounded-xl border border-slate-600">
              <AgentIcon className="w-3.5 h-3.5 text-slate-300" />
              <span className="text-2xs font-normal text-slate-300 uppercase tracking-widest">
                {meta.label}
              </span>
            </div>
          );
        })()}
      </div>

      <div
        ref={scrollRef}
        className="flex-1 overflow-y-auto p-10 space-y-10 bg-slate-50/20 no-scrollbar"
      >
        {(!messages || messages.length === 0) && (
          <div className="flex flex-col items-center justify-center h-full text-center space-y-8 opacity-60 max-w-lg mx-auto">
            <div className="w-28 h-28 bg-white rounded-[2.5rem] flex items-center justify-center shadow-2xl border border-slate-100 relative">
              <div className="absolute -top-2 -right-2 bg-indigo-500 p-2 rounded-xl text-white shadow-lg">
                <ShieldAlert className="w-4 h-4" />
              </div>
              <Bot className="w-14 h-14 text-indigo-600" />
            </div>
            <div>
              <p className="text-slate-900 font-normal text-2xl uppercase tracking-tight">
                Kế Toán Trưởng AI (Audit Core)
              </p>
              <p className="text-sm text-slate-500 font-normal uppercase tracking-widest mt-2 leading-relaxed">
                Tôi đã được nâng cấp cơ chế Truy vấn thông minh. Tôi có thể lọc dữ liệu theo bất kỳ
                khoảng thời gian nào bạn yêu cầu.
              </p>
            </div>
            {/* Agent selector tabs */}
            <div className="flex flex-wrap gap-2 justify-center">
              {Object.entries(AGENT_META).map(([domain, meta]) => {
                const Icon = meta.icon;
                const isActive = activeAgent === domain;
                return (
                  <button
                    key={domain}
                    onClick={() => setActiveAgent(domain)}
                    className={`flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-[9px] font-normal uppercase tracking-widest transition-all ${isActive ? 'bg-indigo-600 text-white shadow-lg' : 'bg-white border border-slate-200 text-slate-500 hover:border-indigo-200 hover:text-indigo-600'}`}
                  >
                    <Icon className="w-3 h-3" /> {meta.label}
                  </button>
                );
              })}
            </div>
            {/* Dynamic quick questions for active agent */}
            <div className="grid grid-cols-1 gap-3 w-full">
              {(AGENT_META[activeAgent]?.questions ?? AGENT_META['finance'].questions).map(
                (q, i) => (
                  <button
                    key={i}
                    onClick={() => setInput(q)}
                    className="p-4 bg-white border border-slate-200 rounded-2xl text-2xs font-normal hover:bg-indigo-50 hover:border-indigo-200 transition-all text-left text-slate-600 italic leading-relaxed"
                  >
                    {q}
                  </button>
                )
              )}
            </div>
          </div>
        )}

        {Array.isArray(messages) &&
          messages.map((msg, idx) => (
            <div
              key={idx}
              className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}
            >
              <div
                className={`flex max-w-[85%] gap-5 ${msg.role === 'user' ? 'flex-row-reverse' : ''}`}
              >
                <div
                  className={`w-12 h-12 rounded-[1.25rem] flex items-center justify-center flex-shrink-0 shadow-lg ${msg.role === 'user' ? 'bg-indigo-600 text-white' : 'bg-white border-2 border-slate-100 text-indigo-600'}`}
                >
                  {msg.role === 'user' ? <User className="w-6 h-6" /> : <Bot className="w-6 h-6" />}
                </div>
                <div
                  className={`p-8 rounded-[2.5rem] text-sm leading-relaxed ${msg.role === 'user' ? 'bg-indigo-600 text-white font-normal shadow-xl' : 'bg-white text-slate-700 border border-slate-100 shadow-xl'}`}
                >
                  {msg.role === 'model' ? (
                    <div
                      className="markdown-content"
                      dangerouslySetInnerHTML={{
                        __html: DOMPurify.sanitize(marked.parse(msg.content) as string),
                      }}
                    />
                  ) : (
                    <p className="text-base">{msg.content}</p>
                  )}
                </div>
              </div>
            </div>
          ))}

        {isLoading && (
          <div className="flex flex-col items-start gap-4">
            <div className="flex justify-start items-center gap-5">
              <div className="w-12 h-12 rounded-[1.25rem] bg-white border-2 border-slate-100 flex items-center justify-center shadow-md">
                <Loader2 className="w-6 h-6 text-indigo-600 animate-spin" />
              </div>
              <div className="px-8 py-5 rounded-[2rem] bg-white border border-slate-100 text-slate-400 italic text-2xs font-normal uppercase tracking-widest shadow-sm">
                AI CFO đang{' '}
                {isQuerying ? 'tự động truy vấn sổ sách...' : 'phân tích dữ liệu chuyên sâu...'}
              </div>
            </div>
            {isQuerying && currentTool && (
              <div className="ml-16 flex items-center gap-2 text-indigo-500 text-2xs font-normal uppercase tracking-widest animate-pulse">
                <Database className="w-4 h-4" /> Truy xuất: {currentTool}
              </div>
            )}
          </div>
        )}
      </div>

      <div className="p-8 bg-white border-t border-slate-100">
        <div className="relative flex items-center max-w-5xl mx-auto">
          <input
            type="text"
            value={input}
            onChange={e => setInput(e.target.value)}
            onKeyDown={e => e.key === 'Enter' && handleSend()}
            placeholder="Ví dụ: Phân tích lợi nhuận tuần đầu tháng 4 so với chi phí..."
            className="w-full bg-slate-50 pl-8 pr-24 py-6 rounded-[2.5rem] border-2 border-transparent focus:border-indigo-500 outline-none text-base font-normal transition-all shadow-inner"
          />
          <button
            onClick={handleSend}
            disabled={!input.trim() || isLoading}
            className="absolute right-4 p-4 bg-slate-900 text-white rounded-[1.5rem] transition-all shadow-xl active:scale-90 disabled:bg-slate-200"
          >
            <Send className="w-7 h-7" />
          </button>
        </div>
      </div>
    </div>
  );
};

export default ChatInterface;
