
import React, { useState, useRef, useEffect, useMemo } from 'react';
import { Send, User, Bot, BrainCircuit, Loader2, Sparkles, ShieldAlert, Database, PieChart, TrendingUp, Search } from 'lucide-react';
import { AppData, ChatMessage, RevenueRecord, ExpenseRecord, ShopeeInventoryOutRecord, PayrollRecord } from '../types';
import { GoogleGenAI, Type, FunctionDeclaration } from "@google/genai";
import { marked } from "marked";
import { 
  calculateFinancialHealthScore, 
  auditFinancials, 
  calculateSeniority, 
  getPolicyLogicDescription,
  calculateExpenseAnalysis,
  calculateDailyBreakEven,
  isStaffActive
} from '../businessLogic';

interface ChatInterfaceProps {
  data: AppData;
  messages: ChatMessage[];
  setMessages: React.Dispatch<React.SetStateAction<ChatMessage[]>>;
  isCFOReady: boolean;
}

const ChatInterface: React.FC<ChatInterfaceProps> = ({ data, messages, setMessages, isCFOReady }) => {
  const [input, setInput] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [isQuerying, setIsQuerying] = useState(false);
  const [currentTool, setCurrentTool] = useState<string | null>(null);
  const scrollRef = useRef<HTMLDivElement>(null);

  useEffect(() => { marked.setOptions({ breaks: true, gfm: true }); }, []);
  useEffect(() => { if (scrollRef.current) scrollRef.current.scrollTop = scrollRef.current.scrollHeight; }, [messages]);

  // Define Function Tools for AI
  const tools: { functionDeclarations: FunctionDeclaration[] }[] = useMemo(() => [{
    functionDeclarations: [
      {
        name: "get_metadata",
        description: "Lấy thông tin cấu hình hệ thống bao gồm: Danh sách nhân sự, Chính sách lương (Ma trận nhảy bậc), Danh mục chi phí, và các Quy trình vận hành (SOP).",
        parameters: { type: Type.OBJECT, properties: {} }
      },
      {
        name: "query_ledgers",
        description: "Truy vấn dữ liệu chi tiết từ các sổ cái trong một khoảng thời gian cụ thể.",
        parameters: {
          type: Type.OBJECT,
          properties: {
            ledgerType: {
              type: Type.STRING,
              description: "Loại sổ cái cần truy vấn.",
              enum: ["revenue", "shopee_revenue", "expenses", "payroll"]
            },
            startDate: {
              type: Type.STRING,
              description: "Ngày bắt đầu (YYYY-MM-DD)."
            },
            endDate: {
              type: Type.STRING,
              description: "Ngày kết thúc (YYYY-MM-DD)."
            }
          },
          required: ["ledgerType", "startDate", "endDate"]
        }
      },
      {
        name: "get_financial_analysis",
        description: "Lấy các chỉ số phân tích tài chính chuyên sâu, điểm sức khỏe, rò rỉ dòng tiền và phân tích điểm hòa vốn.",
        parameters: {
          type: Type.OBJECT,
          properties: {
            month: {
              type: Type.STRING,
              description: "Tháng cần phân tích (YYYY-MM). Nếu không có, hệ thống sẽ lấy tháng gần nhất."
            }
          }
        }
      }
    ]
  }], []);

  // Tool Implementation Handlers
  const callTool = async (name: string, args: any) => {
    setCurrentTool(name);
    switch (name) {
      case "get_metadata":
        return {
          employees: data.employees.map(e => ({ 
            name: e.name, 
            position: e.position, 
            joinDate: e.joinDate, 
            resignedDate: e.resignedDate || e.resigned_date || null,
            status: isStaffActive(e) ? 'Active' : 'Resigned',
            seniority: calculateSeniority(e.joinDate) 
          })),
          salaryPolicies: data.salaryPolicies.map(p => ({ 
            name: p.name, 
            base: p.baseSalary, 
            range: `${p.startThreshold} - ${p.endThreshold === 0 ? '∞' : p.endThreshold} ngày` 
          })),
          expenseCategories: data.expenseCategories.map(c => c.name),
          sopSummary: data.knowledgeBase.map(k => ({ title: k.title, category: k.category }))
        };

      case "query_ledgers":
        const { ledgerType, startDate, endDate } = args;
        const start = new Date(startDate);
        const end = new Date(endDate);
        
        if (ledgerType === "revenue") {
          return data.revenue.filter(r => {
            const d = new Date(r.date);
            return d >= start && d <= end;
          }).slice(0, 100);
        }
        if (ledgerType === "shopee_revenue") {
          return data.shopeeInventoryOut.filter(r => {
            const d = new Date(r.date);
            return d >= start && d <= end;
          }).slice(0, 50); // Limit to avoid context bloat but enough for analysis
        }
        if (ledgerType === "expenses") {
          return data.expenses.filter(e => {
            const d = new Date(e.date);
            return d >= start && d <= end;
          }).slice(0, 100);
        }
        if (ledgerType === "payroll") {
          return data.payroll.filter(p => {
            return p.month >= startDate.slice(0, 7) && p.month <= endDate.slice(0, 7);
          });
        }
        return { error: "Loại sổ cái không hợp lệ" };

      case "get_financial_analysis":
        const targetMonth = args.month || new Date().toISOString().slice(0, 7);
        const monthRevenue = data.revenue.filter(r => r.date.startsWith(targetMonth));
        const monthExpenses = data.expenses.filter(e => e.date.startsWith(targetMonth));
        const monthPayroll = data.payroll.filter(p => p.month === targetMonth);
        
        const health = calculateFinancialHealthScore({ ...data, revenue: monthRevenue, expenses: monthExpenses, payroll: monthPayroll });
        const analysis = calculateExpenseAnalysis(monthExpenses, monthRevenue, monthPayroll, data.expenseCategories);
        const breakEven = calculateDailyBreakEven(data.revenue, data.dailyBreakEvenConfig, `${targetMonth}-01`);
        
        return {
          healthScore: health.score,
          leaks: auditFinancials({ ...data, revenue: monthRevenue, expenses: monthExpenses, payroll: monthPayroll }),
          expenseBreakdown: analysis.analysis.slice(0, 5),
          breakEvenDay: breakEven.breakEvenDay,
          netMargin: health.netMargin,
          payrollRatio: health.payrollRatio
        };

      default:
        return { error: "Công cụ không tồn tại" };
    }
  };

  const handleSend = async () => {
    if (!input.trim() || isLoading) return;

    const userMessage: ChatMessage = { role: 'user', content: input };
    const history = Array.isArray(messages) ? messages : [];
    const newMessages = [...history, userMessage];
    setMessages(newMessages);
    setInput('');
    setIsLoading(true);
    setIsQuerying(false);
    setCurrentTool(null);

    try {
      const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY });
      const modelName = 'gemini-3.1-pro-preview';
      const today = new Date().toISOString().split('T')[0];
      
      const systemInstruction = `
        BẠN LÀ: SIÊU AI CFO & CHUYÊN GIA PHÂN TÍCH TÀI CHÍNH TỐI CAO.
        NGÀY HIỆN TẠI: ${today}
        PHONG CÁCH: Executive, cực kỳ khắt khe về con số, phân tích sâu, chuyên nghiệp.
        
        NHIỆM VỤ:
        1. AI TỰ QUYẾT ĐỊNH TRUY VẤN: Bạn PHẢI sử dụng các công cụ (tools) được cung cấp để lấy dữ liệu thực tế trước khi đưa ra bất kỳ nhận xét nào. Không được đoán dựa trên dữ liệu cũ.
        2. QUẢN TRỊ NHÂN SỰ: Khi gọi 'get_metadata', bạn PHẢI kiểm tra kỹ trường 'status' và 'resignedDate' của từng nhân viên. Tuyệt đối không tính lương hoặc tính vào định biên nhân sự cho những người có trạng thái 'Resigned' ở thời điểm hiện tại.
        3. PHÂN TÍCH KHOẢNG THỜI GIAN: Khi người dùng hỏi về bất kỳ khoảng thời gian nào (hôm nay, tuần trước, quý 1, hoặc ngày cụ thể), bạn phải tự tính toán ngày bắt đầu/kết thúc và gọi 'query_ledgers'.
        4. TƯ DUY PHÂN TÍCH:
           - Luôn so sánh tương quan (Ví dụ: Doanh thu vs Chi phí, Lương vs Doanh thu).
           - Sử dụng 'get_financial_analysis' để có cái nhìn tổng quát về sức khỏe tài chính.
           - Nếu người dùng hỏi về nhân sự, hãy gọi 'get_metadata' để xem thâm niên và chính sách lương thực tế.
        5. CẤU TRÚC PHẢN HỒI: 
           - Bắt đầu bằng một cái nhìn tổng quát (Executive Summary).
           - Sử dụng bảng Markdown để trình bày số liệu.
           - Đưa ra nhận xét sắc bén về các "điểm rò rỉ" hoặc cơ hội tối ưu.
           - Kết thúc bằng 2-3 đề xuất hành động cụ thể.

        LƯU Ý: Nếu dữ liệu truy vấn trả về trống, hãy thông báo rõ ràng cho người dùng thay vì phân tích dựa trên dữ liệu mặc định.
      `;

      // Function Calling Loop
      let currentIteration = 0;
      const maxIterations = 5;
      let contents: any[] = [
        ...history.map(m => ({ role: m.role, parts: [{ text: m.content }] })),
        { role: 'user', parts: [{ text: input }] }
      ];

      let finalResponse = "";

      while (currentIteration < maxIterations) {
        const response = await ai.models.generateContent({
          model: modelName,
          contents,
          config: { systemInstruction, temperature: 0.1, tools },
        });

        const functionCalls = response.functionCalls;
        
        if (functionCalls && functionCalls.length > 0) {
          setIsQuerying(true);
          const toolResponses: any[] = [];
          
          for (const call of functionCalls) {
            const result = await callTool(call.name, call.args);
            toolResponses.push({
              functionResponse: {
                name: call.name,
                response: { result },
                id: call.id
              }
            });
          }

          // Add the model's call and our response back to history
          contents.push(response.candidates?.[0]?.content);
          contents.push({ role: 'user', parts: toolResponses });
          currentIteration++;
        } else {
          finalResponse = response.text || "Bộ não AI CFO đang tái khởi động. Vui lòng hỏi lại.";
          break;
        }
      }

      setMessages([...newMessages, { role: 'model', content: finalResponse }]);
    } catch (error) {
      console.error(error);
      setMessages([...newMessages, { role: 'model', content: "Hệ thống AI đang gặp khó khăn khi truy cập dữ liệu chuyên sâu. Vui lòng thử lại với câu hỏi ngắn hơn." }]);
    } finally {
      setIsLoading(false);
      setIsQuerying(false);
      setCurrentTool(null);
    }
  };

  if (!isCFOReady) return null;

  return (
    <div className="flex flex-col h-[calc(100vh-12rem)] bg-white rounded-[3.5rem] border border-slate-200 overflow-hidden shadow-2xl relative">
      <div className="p-8 bg-slate-900 text-white flex items-center justify-between">
        <div className="flex items-center gap-5">
          <div className="w-14 h-14 bg-indigo-600 rounded-2xl flex items-center justify-center shadow-2xl ring-4 ring-indigo-500/20"><BrainCircuit className="w-8 h-8" /></div>
          <div>
            <h4 className="font-black text-base uppercase tracking-[0.2em] flex items-center gap-2">
              AI CFO SUPREME <Sparkles className="w-4 h-4 text-amber-400" />
            </h4>
            <div className="flex items-center gap-2 mt-1">
               <div className="w-2 h-2 bg-emerald-400 rounded-full animate-pulse"></div>
               <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Logic Brain Matrix Active</span>
            </div>
          </div>
        </div>
      </div>

      <div ref={scrollRef} className="flex-1 overflow-y-auto p-10 space-y-10 bg-slate-50/20 no-scrollbar">
        {(!messages || messages.length === 0) && (
          <div className="flex flex-col items-center justify-center h-full text-center space-y-8 opacity-60 max-w-lg mx-auto">
            <div className="w-28 h-28 bg-white rounded-[2.5rem] flex items-center justify-center shadow-2xl border border-slate-100 relative">
               <div className="absolute -top-2 -right-2 bg-indigo-500 p-2 rounded-xl text-white shadow-lg"><ShieldAlert className="w-4 h-4" /></div>
               <Bot className="w-14 h-14 text-indigo-600" />
            </div>
            <div>
               <p className="text-slate-900 font-black text-2xl uppercase tracking-tight">Kế Toán Trưởng AI (Audit Core)</p>
               <p className="text-sm text-slate-500 font-bold uppercase tracking-widest mt-2 leading-relaxed">Tôi đã được nâng cấp cơ chế Truy vấn thông minh. Tôi có thể lọc dữ liệu theo bất kỳ khoảng thời gian nào bạn yêu cầu.</p>
            </div>
            <div className="grid grid-cols-2 gap-4 w-full">
               <button onClick={() => setInput("Kiểm tra rò rỉ dòng tiền: Chi phí nào đang chiếm tỷ trọng cao bất thường trong 30 ngày qua?")} className="p-4 bg-white border border-slate-200 rounded-2xl text-[10px] font-black uppercase tracking-widest hover:bg-indigo-50 hover:border-indigo-200 transition-all flex items-center gap-2 group italic">
                 <ShieldAlert className="w-4 h-4 text-rose-500 group-hover:scale-110 transition-transform" /> Đối soát rò rỉ
               </button>
               <button onClick={() => setInput("So sánh doanh thu và lợi nhuận thuần của tuần này so với tuần trước. Chúng ta đang tốt lên hay tệ đi?")} className="p-4 bg-white border border-slate-200 rounded-2xl text-[10px] font-black uppercase tracking-widest hover:bg-emerald-50 hover:border-emerald-200 transition-all flex items-center gap-2 group italic">
                 <TrendingUp className="w-4 h-4 text-emerald-500 group-hover:scale-110 transition-transform" /> So sánh hiệu suất
               </button>
               <button onClick={() => setInput("Danh sách nhân sự thực tế đang làm việc và dự toán quỹ lương tháng này là bao nhiêu? Có ai mới nhảy bậc thâm niên không?")} className="p-4 bg-white border border-slate-200 rounded-2xl text-[10px] font-black uppercase tracking-widest hover:bg-amber-50 hover:border-amber-200 transition-all flex items-center gap-2 group italic">
                 <User className="w-4 h-4 text-amber-500 group-hover:scale-110 transition-transform" /> Kiểm tra định biên
               </button>
               <button onClick={() => setInput("Dựa trên chi phí cố định, dự báo ngày nào trong tháng này chúng ta sẽ đạt điểm hòa vốn?")} className="p-4 bg-white border border-slate-200 rounded-2xl text-[10px] font-black uppercase tracking-widest hover:bg-indigo-50 hover:border-indigo-200 transition-all flex items-center gap-2 group italic">
                 <PieChart className="w-4 h-4 text-indigo-500 group-hover:scale-110 transition-transform" /> Phân tích hòa vốn
               </button>
            </div>
          </div>
        )}
        
        {Array.isArray(messages) && messages.map((msg, idx) => (
          <div key={idx} className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}>
            <div className={`flex max-w-[85%] gap-5 ${msg.role === 'user' ? 'flex-row-reverse' : ''}`}>
              <div className={`w-12 h-12 rounded-[1.25rem] flex items-center justify-center flex-shrink-0 shadow-lg ${msg.role === 'user' ? 'bg-indigo-600 text-white' : 'bg-white border-2 border-slate-100 text-indigo-600'}`}>{msg.role === 'user' ? <User className="w-6 h-6" /> : <Bot className="w-6 h-6" />}</div>
              <div className={`p-8 rounded-[2.5rem] text-sm leading-relaxed ${msg.role === 'user' ? 'bg-indigo-600 text-white font-black shadow-xl' : 'bg-white text-slate-700 border border-slate-100 shadow-xl'}`}>
                {msg.role === 'model' ? <div className="markdown-content" dangerouslySetInnerHTML={{ __html: marked.parse(msg.content) }} /> : <p className="text-base">{msg.content}</p>}
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
              <div className="px-8 py-5 rounded-[2rem] bg-white border border-slate-100 text-slate-400 italic text-[10px] font-black uppercase tracking-widest shadow-sm">
                AI CFO đang {isQuerying ? "tự động truy vấn sổ sách..." : "phân tích dữ liệu chuyên sâu..."}
              </div>
            </div>
            {isQuerying && currentTool && (
              <div className="ml-16 flex items-center gap-2 text-indigo-500 text-[10px] font-black uppercase tracking-widest animate-pulse">
                <Database className="w-4 h-4" /> Truy xuất: {currentTool}
              </div>
            )}
          </div>
        )}
      </div>

      <div className="p-8 bg-white border-t border-slate-100">
        <div className="relative flex items-center max-w-5xl mx-auto">
          <input 
            type="text" value={input} onChange={(e) => setInput(e.target.value)} onKeyDown={(e) => e.key === 'Enter' && handleSend()}
            placeholder="Ví dụ: Phân tích lợi nhuận tuần đầu tháng 4 so với chi phí..."
            className="w-full bg-slate-50 pl-8 pr-24 py-6 rounded-[2.5rem] border-2 border-transparent focus:border-indigo-500 outline-none text-base font-bold transition-all shadow-inner"
          />
          <button onClick={handleSend} disabled={!input.trim() || isLoading} className="absolute right-4 p-4 bg-slate-900 text-white rounded-[1.5rem] transition-all shadow-xl active:scale-90 disabled:bg-slate-200">
            <Send className="w-7 h-7" />
          </button>
        </div>
      </div>
    </div>
  );
};

export default ChatInterface;
