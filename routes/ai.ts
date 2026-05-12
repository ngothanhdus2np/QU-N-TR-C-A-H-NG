import { Router, Request } from 'express';
import { callClaude, callClaudeWithFile, callClaudeChat } from '../services/agents/claudeClient';
import { CFO_TOOLS, buildAgentSystem } from '../services/agents/cfoAgent';

// In-memory rate limiter — đủ cho single-instance deployment
const rateLimitWindows = new Map<string, { count: number; resetAt: number }>();

function checkRateLimit(req: Request, maxPerMinute: number): boolean {
  const ip = (req.ip || req.socket.remoteAddress || 'unknown').replace(/^::ffff:/, '');
  const key = `${ip}:${req.path}`;
  const now = Date.now();
  const window = rateLimitWindows.get(key);

  if (!window || now > window.resetAt) {
    rateLimitWindows.set(key, { count: 1, resetAt: now + 60_000 });
    return true;
  }
  if (window.count >= maxPerMinute) return false;
  window.count++;
  return true;
}

const getErrorMessage = (error: unknown): string => {
  if (error instanceof Error) return error.message;
  return 'AI service error';
};

// Dọn map mỗi 5 phút để tránh memory leak
setInterval(() => {
  const now = Date.now();
  for (const [key, val] of rateLimitWindows) {
    if (now > val.resetAt) rateLimitWindows.delete(key);
  }
}, 5 * 60_000);

export function createAiRouter(): Router {
  const router = Router();

  // Rate limit mặc định: 10 req/phút cho các endpoint phân tích haiku
  // Rate limit chặt hơn: 5 req/phút cho các endpoint dùng sonnet hoặc upload file
  const RL_STANDARD = 10;
  const RL_STRICT = 5;

  router.post('/api/ai/executive-briefing', async (req, res) => {
    if (!checkRateLimit(req, RL_STANDARD))
      return res.status(429).json({ error: 'Quá nhiều yêu cầu. Vui lòng thử lại sau 1 phút.' });
    try {
      const { contextData } = req.body as { contextData?: string };
      if (!contextData) return res.status(400).json({ error: 'contextData là bắt buộc' });
      const result = await callClaude({
        model: 'claude-haiku-4-5',
        system: [
          'Bạn là chuyên gia tư vấn tài chính cấp cao (CFO) cho chuỗi bán lẻ giày dép Việt Nam.',
          'Phân tích sắc bén, quyết đoán, dẫn chứng bằng số liệu cụ thể — không nói chung chung.',
          'Trả lời bằng Tiếng Việt, định dạng Markdown, dùng bảng khi cần so sánh.',
        ].join(' '),
        userMessage: contextData,
        temperature: 0.2,
        maxTokens: 1200,
      });
      res.json({ result });
    } catch (err: unknown) {
      const message = getErrorMessage(err);
      console.error('[AI /executive-briefing]', message);
      res.status(500).json({ error: message || 'AI service error' });
    }
  });

  router.post('/api/ai/promotion-analysis', async (req, res) => {
    if (!checkRateLimit(req, RL_STANDARD))
      return res.status(429).json({ error: 'Quá nhiều yêu cầu. Vui lòng thử lại sau 1 phút.' });
    try {
      const { contextData } = req.body as { contextData?: string };
      if (!contextData) return res.status(400).json({ error: 'contextData là bắt buộc' });
      const result = await callClaude({
        model: 'claude-haiku-4-5',
        system:
          'Bạn là Giám đốc Marketing & Tài chính (CMO/CFO) cho chuỗi bán lẻ giày dép Việt Nam. Phân tích hiệu quả khuyến mãi sắc bén, dẫn chứng bằng ROI cụ thể. Trả lời bằng Tiếng Việt, định dạng Markdown chuyên nghiệp.',
        userMessage: contextData,
        temperature: 0.2,
        maxTokens: 1200,
      });
      res.json({ result });
    } catch (err: unknown) {
      const message = getErrorMessage(err);
      console.error('[AI /promotion-analysis]', message);
      res.status(500).json({ error: message || 'AI service error' });
    }
  });

  router.post('/api/ai/product-group-analysis', async (req, res) => {
    if (!checkRateLimit(req, RL_STANDARD))
      return res.status(429).json({ error: 'Quá nhiều yêu cầu. Vui lòng thử lại sau 1 phút.' });
    try {
      const { contextData } = req.body as { contextData?: string };
      if (!contextData) return res.status(400).json({ error: 'contextData là bắt buộc' });
      const result = await callClaude({
        model: 'claude-haiku-4-5',
        system:
          'Bạn là chuyên gia MIS & Chiến lược ngành hàng cho chuỗi bán lẻ giày dép Việt Nam. Phân tích dịch chuyển trọng tâm ngành hàng, đưa ra khuyến nghị nhập/clear hàng cụ thể. Trả lời bằng Tiếng Việt, định dạng Markdown.',
        userMessage: contextData,
        temperature: 0.2,
        maxTokens: 1200,
      });
      res.json({ result });
    } catch (err: unknown) {
      const message = getErrorMessage(err);
      console.error('[AI /product-group-analysis]', message);
      res.status(500).json({ error: message || 'AI service error' });
    }
  });

  router.post('/api/ai/revenue-analysis', async (req, res) => {
    if (!checkRateLimit(req, RL_STANDARD))
      return res.status(429).json({ error: 'Quá nhiều yêu cầu. Vui lòng thử lại sau 1 phút.' });
    try {
      const { contextData } = req.body as { contextData?: string };
      if (!contextData) return res.status(400).json({ error: 'contextData là bắt buộc' });
      const result = await callClaude({
        model: 'claude-haiku-4-5',
        system:
          'Bạn là CFO chiến lược & chuyên gia Data Science cho chuỗi bán lẻ giày dép Việt Nam. Chẩn đoán sức khoẻ tài chính, đưa ra Actionable Insights dựa trên số liệu thực tế. Trả lời bằng Tiếng Việt, Markdown chuyên nghiệp, tránh lý thuyết suông.',
        userMessage: contextData,
        temperature: 0.2,
        maxTokens: 1200,
      });
      res.json({ result });
    } catch (err: unknown) {
      const message = getErrorMessage(err);
      console.error('[AI /revenue-analysis]', message);
      res.status(500).json({ error: message || 'AI service error' });
    }
  });

  router.post('/api/ai/expense-classify', async (req, res) => {
    if (!checkRateLimit(req, RL_STANDARD))
      return res.status(429).json({ error: 'Quá nhiều yêu cầu. Vui lòng thử lại sau 1 phút.' });
    try {
      const { contextData } = req.body as { contextData?: string };
      if (!contextData) return res.status(400).json({ error: 'contextData là bắt buộc' });
      const result = await callClaude({
        model: 'claude-haiku-4-5',
        system:
          'Bạn là kế toán trưởng chuyên nghiệp. Phân tích và phân loại chi phí vào hệ thống MIS 3 cấp. QUAN TRỌNG: Chỉ trả về JSON hợp lệ, không có text hay markdown nào khác bên ngoài JSON. Format: {"level1Id":"...","level1Name":"...","level2Name":"...","level3Name":"..."}',
        userMessage: contextData,
        temperature: 0.1,
        maxTokens: 512,
      });
      res.json({ result });
    } catch (err: unknown) {
      const message = getErrorMessage(err);
      console.error('[AI /expense-classify]', message);
      res.status(500).json({ error: message || 'AI service error' });
    }
  });

  router.post('/api/ai/expense-scan', async (req, res) => {
    if (!checkRateLimit(req, RL_STANDARD))
      return res.status(429).json({ error: 'Quá nhiều yêu cầu. Vui lòng thử lại sau 1 phút.' });
    try {
      const { contextData } = req.body as { contextData?: string };
      if (!contextData) return res.status(400).json({ error: 'contextData là bắt buộc' });
      const result = await callClaude({
        model: 'claude-haiku-4-5',
        system:
          'Bạn là chuyên gia dọn dẹp dữ liệu kế toán. Tìm các hạng mục chi phí trùng lặp hoặc có tên tương tự. QUAN TRỌNG: Chỉ trả về JSON array hợp lệ, không có text hay markdown nào khác. Format: [{"originalId":"...","duplicateId":"...","originalName":"...","duplicateName":"..."}] hoặc [] nếu không có trùng lặp.',
        userMessage: contextData,
        temperature: 0.1,
        maxTokens: 1024,
      });
      res.json({ result });
    } catch (err: unknown) {
      const message = getErrorMessage(err);
      console.error('[AI /expense-scan]', message);
      res.status(500).json({ error: message || 'AI service error' });
    }
  });

  router.post('/api/ai/knowledge-ocr', async (req, res) => {
    if (!checkRateLimit(req, 5))
      return res.status(429).json({ error: 'Quá nhiều yêu cầu. Vui lòng thử lại sau 1 phút.' });
    try {
      const { base64Data, mimeType } = req.body as { base64Data?: string; mimeType?: string };
      if (!base64Data || !mimeType)
        return res.status(400).json({ error: 'base64Data và mimeType là bắt buộc' });
      const result = await callClaudeWithFile({
        model: 'claude-haiku-4-5',
        system: [
          'Bạn là chuyên gia Hệ thống Quản lý (MIS) và Kế toán trưởng.',
          'Đọc tài liệu đính kèm và trích xuất nội dung quan trọng.',
          'QUAN TRỌNG: Chỉ trả về JSON hợp lệ duy nhất, không có text hay markdown nào khác.',
          'Format bắt buộc: {"title":"Tiêu đề súc tích","category":"Nhân sự|Vận hành|Bán hàng|Tài chính|Khác","content":"Nội dung Markdown chi tiết"}',
        ].join(' '),
        textPrompt:
          'Đọc tài liệu này và trả về JSON theo format đã yêu cầu. Nội dung Markdown phải đầy đủ, chuyên nghiệp.',
        file: { base64: base64Data, mimeType },
        maxTokens: 3000,
      });
      res.json({ result });
    } catch (err: unknown) {
      const message = getErrorMessage(err);
      console.error('[AI /knowledge-ocr]', message);
      res.status(500).json({ error: message || 'AI service error' });
    }
  });

  router.post('/api/ai/marketing-monthly-advice', async (req, res) => {
    if (!checkRateLimit(req, RL_STANDARD))
      return res.status(429).json({ error: 'Quá nhiều yêu cầu. Vui lòng thử lại sau 1 phút.' });
    try {
      const { contextData } = req.body as { contextData?: string };
      if (!contextData) return res.status(400).json({ error: 'contextData là bắt buộc' });
      const result = await callClaude({
        model: 'claude-haiku-4-5',
        system: [
          'Bạn là chuyên gia Marketing cho shop giày dép Việt Nam.',
          'QUAN TRỌNG: Chỉ trả về JSON hợp lệ duy nhất, không có text hay markdown nào khác bên ngoài JSON.',
          'Format bắt buộc: {"holidays":["..."],"marketInsight":"...","suggestedDistribution":[{"strategyId":"...","percentage":0}]}',
          'Tổng percentage của suggestedDistribution phải bằng 100.',
        ].join(' '),
        userMessage: contextData,
        temperature: 0.2,
        maxTokens: 1024,
      });
      res.json({ result });
    } catch (err: unknown) {
      const message = getErrorMessage(err);
      console.error('[AI /marketing-monthly-advice]', message);
      res.status(500).json({ error: message || 'AI service error' });
    }
  });

  router.post('/api/ai/marketing-content-plan', async (req, res) => {
    if (!checkRateLimit(req, RL_STRICT))
      return res.status(429).json({ error: 'Quá nhiều yêu cầu. Vui lòng thử lại sau 1 phút.' });
    try {
      const { contextData } = req.body as { contextData?: string };
      if (!contextData) return res.status(400).json({ error: 'contextData là bắt buộc' });
      const result = await callClaude({
        model: 'claude-sonnet-4-6',
        system: [
          'Bạn là Quản lý Nội dung chuyên nghiệp cho thương hiệu "Giày Dép Phúc Sang".',
          'QUAN TRỌNG: Chỉ trả về JSON array hợp lệ duy nhất, không có text hay markdown nào khác bên ngoài JSON.',
          'Mỗi phần tử: {"date":"YYYY-MM-DD","topic":"...","type":"...","imageInstruction":"...","caption":"..."}',
          'caption tối thiểu 150 chữ, bao gồm Call to Action và thông tin liên hệ.',
        ].join(' '),
        userMessage: contextData,
        temperature: 0.7,
        maxTokens: 4096,
      });
      res.json({ result });
    } catch (err: unknown) {
      const message = getErrorMessage(err);
      console.error('[AI /marketing-content-plan]', message);
      res.status(500).json({ error: message || 'AI service error' });
    }
  });

  router.get('/api/ai/test-connection', async (req, res) => {
    if (!checkRateLimit(req, RL_STRICT))
      return res.status(429).json({ error: 'Quá nhiều yêu cầu. Vui lòng thử lại sau 1 phút.' });
    try {
      const result = await callClaude({
        model: 'claude-haiku-4-5',
        system: 'Trả lời ngắn gọn bằng Tiếng Việt.',
        userMessage: 'Xác nhận kết nối thành công. Trả lời đúng 5 từ.',
        temperature: 0,
        maxTokens: 32,
      });
      res.json({ ok: true, message: result });
    } catch (err: unknown) {
      const message = getErrorMessage(err);
      console.error('[AI /test-connection]', message);
      res.status(500).json({ ok: false, error: message || 'Claude API không phản hồi' });
    }
  });

  router.post('/api/ai/classify', async (req, res) => {
    if (!checkRateLimit(req, RL_STANDARD))
      return res.status(429).json({ error: 'Quá nhiều yêu cầu. Vui lòng thử lại sau 1 phút.' });
    try {
      const { message } = req.body as { message?: string };
      if (!message) return res.status(400).json({ error: 'message là bắt buộc' });
      const result = await callClaude({
        model: 'claude-haiku-4-5',
        system: [
          'Phân loại câu hỏi vào đúng 1 trong 6 domain sau: finance, hr, sales, inventory, marketing, operations.',
          'finance: P&L, lợi nhuận, chi phí, điểm hòa vốn, dòng tiền, tài chính tổng hợp.',
          'hr: nhân viên, lương, thâm niên, nghỉ phép, định biên.',
          'sales: doanh thu, đơn hàng, so sánh kênh, xu hướng bán.',
          'inventory: tồn kho, sản phẩm, nhập hàng, hàng hóa.',
          'marketing: khuyến mãi, ROI, nội dung, Fanpage, thương hiệu.',
          'operations: nhà cung cấp, công nợ NCC, phiên POS, vận hành hàng ngày.',
          'QUAN TRỌNG: Chỉ trả về JSON hợp lệ duy nhất. Format: {"domain":"finance"}',
        ].join(' '),
        userMessage: message,
        temperature: 0,
        maxTokens: 32,
      });
      const jsonStr = result.match(/\{[^}]+\}/)?.[0] ?? result;
      const parsed = JSON.parse(jsonStr);
      res.json({ domain: parsed.domain || 'finance' });
    } catch (err: unknown) {
      console.error('[AI /classify]', getErrorMessage(err));
      res.json({ domain: 'finance' });
    }
  });

  router.post('/api/ai/chat', async (req, res) => {
    if (!checkRateLimit(req, 15))
      return res.status(429).json({ error: 'Quá nhiều yêu cầu. Vui lòng thử lại sau 1 phút.' });
    try {
      const { messages, domain } = req.body;
      if (!messages) return res.status(400).json({ error: 'messages là bắt buộc' });
      const today = new Date().toISOString().split('T')[0];
      const system = buildAgentSystem(domain || 'finance', today);
      const content = await callClaudeChat({
        model: 'claude-sonnet-4-6',
        system,
        messages,
        tools: CFO_TOOLS,
        temperature: 0.1,
        maxTokens: 4096,
      });
      res.json({ content });
    } catch (err: unknown) {
      const message = getErrorMessage(err);
      console.error('[AI /chat]', message);
      res.status(500).json({ error: message || 'AI service error' });
    }
  });

  return router;
}
