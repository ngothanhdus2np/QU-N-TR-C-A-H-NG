import { Router, Request, RequestHandler } from 'express';
import { inflateRawSync } from 'node:zlib';
import { callClaude, callClaudeWithFile, callClaudeChat } from '../services/agents/claudeClient';
import { CFO_TOOLS, buildAgentSystem } from '../services/agents/cfoAgent';
import { CONTENT_PROMPTS, type PlatformPrivateConfig } from '../services/agents/contentPrompts';

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

// [FIX] Lỗi PostgrestError từ supabase.rpc()/query không phải instance Error chuẩn —
// nhánh cũ chỉ bắt `instanceof Error` nên mất hết message thật, rơi về fallback chung chung.
const getErrorMessage = (error: unknown): string => {
  if (error instanceof Error) return error.message;
  if (error && typeof error === 'object') {
    const record = error as Record<string, unknown>;
    const parts = [record.message, record.details, record.hint, record.code]
      .filter(Boolean)
      .map(String);
    if (parts.length > 0) return parts.join(' | ');
    try {
      return JSON.stringify(error);
    } catch {
      return String(error);
    }
  }
  return 'AI service error';
};

const AI_SERVICE_ERROR = 'AI service error';

const isDocxUpload = (mimeType: string, fileName?: string) =>
  mimeType === 'application/vnd.openxmlformats-officedocument.wordprocessingml.document' ||
  String(fileName || '').toLowerCase().endsWith('.docx');

const decodeXmlEntities = (value: string) =>
  value
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&amp;/g, '&')
    .replace(/&quot;/g, '"')
    .replace(/&apos;/g, "'")
    .replace(/&#(\d+);/g, (_, code) => String.fromCharCode(Number(code)));

const readZipEntry = (buffer: Buffer, targetName: string) => {
  const eocdSignature = 0x06054b50;
  let eocdOffset = -1;
  for (let i = buffer.length - 22; i >= Math.max(0, buffer.length - 0xffff - 22); i -= 1) {
    if (buffer.readUInt32LE(i) === eocdSignature) {
      eocdOffset = i;
      break;
    }
  }
  if (eocdOffset < 0) throw new Error('Không đọc được cấu trúc DOCX.');

  const centralDirectorySize = buffer.readUInt32LE(eocdOffset + 12);
  const centralDirectoryOffset = buffer.readUInt32LE(eocdOffset + 16);
  let offset = centralDirectoryOffset;
  const end = centralDirectoryOffset + centralDirectorySize;

  while (offset < end) {
    if (buffer.readUInt32LE(offset) !== 0x02014b50) break;
    const compressionMethod = buffer.readUInt16LE(offset + 10);
    const compressedSize = buffer.readUInt32LE(offset + 20);
    const fileNameLength = buffer.readUInt16LE(offset + 28);
    const extraLength = buffer.readUInt16LE(offset + 30);
    const commentLength = buffer.readUInt16LE(offset + 32);
    const localHeaderOffset = buffer.readUInt32LE(offset + 42);
    const entryName = buffer.toString('utf8', offset + 46, offset + 46 + fileNameLength);

    if (entryName === targetName) {
      if (buffer.readUInt32LE(localHeaderOffset) !== 0x04034b50) throw new Error('DOCX không hợp lệ.');
      const localNameLength = buffer.readUInt16LE(localHeaderOffset + 26);
      const localExtraLength = buffer.readUInt16LE(localHeaderOffset + 28);
      const dataStart = localHeaderOffset + 30 + localNameLength + localExtraLength;
      const compressed = buffer.subarray(dataStart, dataStart + compressedSize);
      if (compressionMethod === 0) return compressed.toString('utf8');
      if (compressionMethod === 8) return inflateRawSync(compressed).toString('utf8');
      throw new Error('DOCX dùng kiểu nén chưa hỗ trợ.');
    }

    offset += 46 + fileNameLength + extraLength + commentLength;
  }

  throw new Error('Không tìm thấy nội dung chính trong DOCX.');
};

const extractDocxText = (base64Data: string) => {
  const buffer = Buffer.from(base64Data, 'base64');
  const xml = readZipEntry(buffer, 'word/document.xml');
  return decodeXmlEntities(
    xml
      .replace(/<w:tab\b[^>]*\/>/g, '\t')
      .replace(/<w:br\b[^>]*\/>/g, '\n')
      .replace(/<\/w:tc>/g, '\t')
      .replace(/<\/w:p>/g, '\n')
      .replace(/<[^>]+>/g, '')
      .replace(/\n{3,}/g, '\n\n')
      .trim()
  );
};

// Dọn map mỗi 5 phút để tránh memory leak
setInterval(() => {
  const now = Date.now();
  for (const [key, val] of rateLimitWindows) {
    if (now > val.resetAt) rateLimitWindows.delete(key);
  }
}, 5 * 60_000);

export function createAiRouter(requireAuth: RequestHandler): Router {
  const router = Router();

  router.use('/api/ai', requireAuth);

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
      res.status(500).json({ error: AI_SERVICE_ERROR });
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
      res.status(500).json({ error: AI_SERVICE_ERROR });
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
      res.status(500).json({ error: AI_SERVICE_ERROR });
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
      res.status(500).json({ error: AI_SERVICE_ERROR });
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
      res.status(500).json({ error: AI_SERVICE_ERROR });
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
      res.status(500).json({ error: AI_SERVICE_ERROR });
    }
  });

  router.post('/api/ai/knowledge-ocr', async (req, res) => {
    if (!checkRateLimit(req, 5))
      return res.status(429).json({ error: 'Quá nhiều yêu cầu. Vui lòng thử lại sau 1 phút.' });
    try {
      const { base64Data, mimeType, fileName } = req.body as { base64Data?: string; mimeType?: string; fileName?: string };
      if (!base64Data || !mimeType)
        return res.status(400).json({ error: 'base64Data và mimeType là bắt buộc' });
      const system = [
        'Bạn là chuyên gia Hệ thống Quản lý (MIS) và Kế toán trưởng.',
        'Đọc tài liệu đính kèm và trích xuất nội dung quan trọng.',
        'Trường summary phải là bản tóm tắt nghiệp vụ thật sự: nói tài liệu dùng để làm gì, áp dụng cho ai, các ý chính và điều người dùng cần chú ý. Không được chỉ liệt kê các dòng đầu tiên của tài liệu.',
        'QUAN TRỌNG: Chỉ trả về JSON hợp lệ duy nhất, không có text hay markdown nào khác.',
        'Format bắt buộc: {"title":"Tiêu đề súc tích","category":"Nhân sự|Vận hành|Bán hàng|Tài chính|Biểu mẫu|Khác","summary":"Tóm tắt nội dung 3-5 câu hoặc 3-5 gạch đầu dòng","content":"Nội dung Markdown chi tiết"}',
      ].join(' ');
      const result = isDocxUpload(mimeType, fileName)
        ? await callClaude({
            model: 'claude-haiku-4-5',
            system,
            userMessage: [
              'Đọc nội dung được bóc tách từ file Word DOCX bên dưới và trả về JSON theo format đã yêu cầu.',
              'Tóm tắt phải diễn giải nội dung, mục đích sử dụng, phạm vi áp dụng và các điểm cần lưu ý.',
              'Nội dung Markdown phải đầy đủ, chuyên nghiệp.',
              '',
              extractDocxText(base64Data),
            ].join('\n'),
            maxTokens: 3000,
          })
        : await callClaudeWithFile({
        model: 'claude-haiku-4-5',
        system,
        textPrompt:
          'Đọc tài liệu này và trả về JSON theo format đã yêu cầu. Tóm tắt phải diễn giải nội dung, mục đích sử dụng, phạm vi áp dụng và các điểm cần lưu ý. Nội dung Markdown phải đầy đủ, chuyên nghiệp.',
        file: { base64: base64Data, mimeType },
        maxTokens: 3000,
      });
      res.json({ result });
    } catch (err: unknown) {
      const message = getErrorMessage(err);
      console.error('[AI /knowledge-ocr]', message);
      res.status(500).json({ error: AI_SERVICE_ERROR });
    }
  });

  router.post('/api/ai/vat-invoice-ocr', async (req, res) => {
    if (!checkRateLimit(req, RL_STRICT))
      return res.status(429).json({ error: 'Quá nhiều yêu cầu. Vui lòng thử lại sau 1 phút.' });
    try {
      const { base64Data, mimeType } = req.body as { base64Data?: string; mimeType?: string };
      if (!base64Data || !mimeType)
        return res.status(400).json({ error: 'base64Data và mimeType là bắt buộc' });

      const result = await callClaudeWithFile({
        model: 'claude-sonnet-4-6',
        system: [
          'Bạn là hệ thống OCR hóa đơn VAT Việt Nam cho phần mềm quản trị bán lẻ.',
          'Đọc PDF hóa đơn và trích xuất dữ liệu có cấu trúc.',
          'Đơn vị xuất hóa đơn là BÊN BÁN/người lập hóa đơn, thường nằm đầu hóa đơn. Không lấy thông tin người mua nếu không được yêu cầu.',
          'Với hóa đơn bán hàng không có nhãn bên bán rõ ràng, phần đầu trang phía trên tiêu đề hóa đơn thường là đơn vị xuất hóa đơn.',
          'Luôn cố gắng điền issuerName, issuerTaxCode, issuerPhone, issuerAddress từ phần bên bán. Nếu dòng Điện thoại trống thì trả chuỗi rỗng.',
          'Nếu thấy các nhãn "Mã số thuế", "Địa chỉ", "Điện thoại" ngay dưới tên bên bán, hãy đưa vào issuerTaxCode, issuerAddress, issuerPhone.',
          'Chỉ trả về JSON hợp lệ duy nhất, không markdown, không giải thích.',
          'Nếu không đọc được trường nào, trả chuỗi rỗng hoặc 0, không tự bịa.',
          'Ngày trả về dạng YYYY-MM-DD nếu xác định được.',
          'Với items, hãy đọc từng dòng trong bảng hàng hóa/dịch vụ, không gộp nhiều dòng thành một dòng. Ưu tiên tên hàng hóa, đơn vị tính, số lượng, đơn giá, thành tiền trước thuế, tiền thuế và tổng tiền từng dòng.',
          'Nếu bảng hàng hóa nằm trong ảnh PDF, vẫn cố đọc bằng thị giác từ bảng. Nếu không chắc số tiền từng dòng thì vẫn trả name và quantity nếu đọc được.',
          'Format bắt buộc:',
          '{"issuerName":"","issuerTaxCode":"","issuerPhone":"","issuerAddress":"","invoiceNo":"","invoiceDate":"","totalBeforeTax":0,"vatAmount":0,"totalAmount":0,"items":[{"name":"","unit":"","quantity":0,"unitPrice":0,"amountBeforeTax":0,"vatAmount":0,"totalAmount":0}],"confidence":{"issuer":0,"invoice":0,"items":0}}',
        ].join(' '),
        textPrompt:
          'Trích xuất thông tin đơn vị xuất hóa đơn, thông tin hóa đơn và từng dòng hàng hóa/dịch vụ. Chỉ trả JSON theo format đã yêu cầu.',
        file: { base64: base64Data, mimeType },
        maxTokens: 4096,
      });
      res.json({ result });
    } catch (err: unknown) {
      const message = getErrorMessage(err);
      console.error('[AI /vat-invoice-ocr]', message);
      res.status(500).json({ error: AI_SERVICE_ERROR });
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
      res.status(500).json({ error: AI_SERVICE_ERROR });
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
      res.status(500).json({ error: AI_SERVICE_ERROR });
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
      res.status(500).json({ ok: false, error: 'Claude API không phản hồi' });
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
          'Phân loại câu hỏi vào đúng 1 trong 7 domain sau: finance, hr, sales, inventory, marketing, operations, customers.',
          'finance: P&L, lợi nhuận, chi phí, điểm hòa vốn, dòng tiền, tài chính tổng hợp.',
          'hr: nhân viên, lương, thâm niên, nghỉ phép, định biên.',
          'sales: doanh thu, đơn hàng, so sánh kênh, xu hướng bán, nhóm hàng.',
          'inventory: tồn kho, sản phẩm, nhập hàng, hàng hóa, giá cả sản phẩm.',
          'marketing: khuyến mãi, ROI, nội dung, Fanpage, thương hiệu.',
          'operations: nhà cung cấp, công nợ NCC, phiên POS, vận hành hàng ngày.',
          'customers: khách hàng, VIP, điểm tích lũy, hạng khách, công nợ khách.',
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
      res.status(500).json({ error: AI_SERVICE_ERROR });
    }
  });

  router.post('/api/ai/profit-analysis', async (req, res) => {
    if (!checkRateLimit(req, RL_STANDARD))
      return res.status(429).json({ error: 'Quá nhiều yêu cầu. Vui lòng thử lại sau 1 phút.' });
    try {
      const { contextData } = req.body as { contextData?: string };
      if (!contextData) return res.status(400).json({ error: 'contextData là bắt buộc' });
      const result = await callClaude({
        model: 'claude-haiku-4-5',
        system: 'Bạn là CFO cho chuỗi bán lẻ giày dép Việt Nam. Đọc P&L, nhận xét tỷ lệ chi phí/doanh thu, chỉ rõ danh mục đang tăng bất thường, đề xuất 2-3 hành động cắt giảm cụ thể. Trả lời Tiếng Việt, Markdown.',
        userMessage: contextData,
        temperature: 0.2,
        maxTokens: 1200,
      });
      res.json({ result });
    } catch (err: unknown) {
      console.error('[AI /profit-analysis]', getErrorMessage(err));
      res.status(500).json({ error: AI_SERVICE_ERROR });
    }
  });

  router.post('/api/ai/financial-matrix', async (req, res) => {
    if (!checkRateLimit(req, RL_STANDARD))
      return res.status(429).json({ error: 'Quá nhiều yêu cầu. Vui lòng thử lại sau 1 phút.' });
    try {
      const { contextData } = req.body as { contextData?: string };
      if (!contextData) return res.status(400).json({ error: 'contextData là bắt buộc' });
      const result = await callClaude({
        model: 'claude-haiku-4-5',
        system: 'Bạn là chuyên gia phân tích tài chính cho chuỗi bán lẻ giày dép Việt Nam. Đọc ma trận tài chính nhiều năm, nhận xét xu hướng tăng/giảm, chỉ ra tháng/năm bất thường, dự báo ngắn cho kỳ tới. Trả lời Tiếng Việt, Markdown.',
        userMessage: contextData,
        temperature: 0.2,
        maxTokens: 1200,
      });
      res.json({ result });
    } catch (err: unknown) {
      console.error('[AI /financial-matrix]', getErrorMessage(err));
      res.status(500).json({ error: AI_SERVICE_ERROR });
    }
  });

  router.post('/api/ai/goods-overview', async (req, res) => {
    if (!checkRateLimit(req, RL_STANDARD))
      return res.status(429).json({ error: 'Quá nhiều yêu cầu. Vui lòng thử lại sau 1 phút.' });
    try {
      const { contextData } = req.body as { contextData?: string };
      if (!contextData) return res.status(400).json({ error: 'contextData là bắt buộc' });
      const result = await callClaude({
        model: 'claude-haiku-4-5',
        system: 'Bạn là chuyên gia ngành hàng cho chuỗi bán lẻ giày dép Việt Nam. Nhận xét top hàng bán chạy/chậm, phát hiện cơ hội bundle/upsell, cảnh báo hàng bán chạy có nguy cơ hết. Đề xuất 2-3 hành động cụ thể. Trả lời Tiếng Việt, Markdown.',
        userMessage: contextData,
        temperature: 0.2,
        maxTokens: 1200,
      });
      res.json({ result });
    } catch (err: unknown) {
      console.error('[AI /goods-overview]', getErrorMessage(err));
      res.status(500).json({ error: AI_SERVICE_ERROR });
    }
  });

  router.post('/api/ai/goods-stock', async (req, res) => {
    if (!checkRateLimit(req, RL_STANDARD))
      return res.status(429).json({ error: 'Quá nhiều yêu cầu. Vui lòng thử lại sau 1 phút.' });
    try {
      const { contextData } = req.body as { contextData?: string };
      if (!contextData) return res.status(400).json({ error: 'contextData là bắt buộc' });
      const result = await callClaude({
        model: 'claude-haiku-4-5',
        system: 'Bạn là chuyên gia quản lý kho cho chuỗi bán lẻ giày dép Việt Nam. Phân tích tình trạng tồn kho, dự báo hàng hết trong 7-14 ngày, chỉ rõ dead stock chiếm vốn, đề xuất số lượng nhập và hàng cần thanh lý. Trả lời Tiếng Việt, Markdown.',
        userMessage: contextData,
        temperature: 0.2,
        maxTokens: 1200,
      });
      res.json({ result });
    } catch (err: unknown) {
      console.error('[AI /goods-stock]', getErrorMessage(err));
      res.status(500).json({ error: AI_SERVICE_ERROR });
    }
  });

  router.post('/api/ai/goods-classify', async (req, res) => {
    if (!checkRateLimit(req, RL_STANDARD))
      return res.status(429).json({ error: 'Quá nhiều yêu cầu. Vui lòng thử lại sau 1 phút.' });
    try {
      const { contextData } = req.body as { contextData?: string };
      if (!contextData) return res.status(400).json({ error: 'contextData là bắt buộc' });
      const result = await callClaude({
        model: 'claude-haiku-4-5',
        system: 'Bạn là chuyên gia ngành hàng bán lẻ giày dép Việt Nam. Đọc phân loại ABC, giải thích chiến lược cụ thể cho từng nhóm: nhóm A ưu tiên gì, nhóm B phát triển thế nào, nhóm C nên loại bỏ hay giảm tồn. Trả lời Tiếng Việt, Markdown.',
        userMessage: contextData,
        temperature: 0.2,
        maxTokens: 1200,
      });
      res.json({ result });
    } catch (err: unknown) {
      console.error('[AI /goods-classify]', getErrorMessage(err));
      res.status(500).json({ error: AI_SERVICE_ERROR });
    }
  });

  router.post('/api/ai/customers-overview', async (req, res) => {
    if (!checkRateLimit(req, RL_STANDARD))
      return res.status(429).json({ error: 'Quá nhiều yêu cầu. Vui lòng thử lại sau 1 phút.' });
    try {
      const { contextData } = req.body as { contextData?: string };
      if (!contextData) return res.status(400).json({ error: 'contextData là bắt buộc' });
      const result = await callClaude({
        model: 'claude-haiku-4-5',
        system: 'Bạn là chuyên gia CRM cho chuỗi bán lẻ giày dép Việt Nam. Nhận xét tỷ lệ khách mới/cũ/lẻ, cảnh báo nếu khách quay lại đang giảm, đề xuất 2-3 hành động giữ chân khách hàng cụ thể. Trả lời Tiếng Việt, Markdown.',
        userMessage: contextData,
        temperature: 0.2,
        maxTokens: 1200,
      });
      res.json({ result });
    } catch (err: unknown) {
      console.error('[AI /customers-overview]', getErrorMessage(err));
      res.status(500).json({ error: AI_SERVICE_ERROR });
    }
  });

  router.post('/api/ai/customers-classify', async (req, res) => {
    if (!checkRateLimit(req, RL_STANDARD))
      return res.status(429).json({ error: 'Quá nhiều yêu cầu. Vui lòng thử lại sau 1 phút.' });
    try {
      const { contextData } = req.body as { contextData?: string };
      if (!contextData) return res.status(400).json({ error: 'contextData là bắt buộc' });
      const result = await callClaude({
        model: 'claude-haiku-4-5',
        system: 'Bạn là chuyên gia CRM & loyalty cho chuỗi bán lẻ giày dép Việt Nam. Đọc phân loại RFM, đề xuất chiến lược cụ thể cho từng segment: giữ chân Trung thành, nâng hạng Tiềm năng, win-back Sắp rời bỏ. Trả lời Tiếng Việt, Markdown.',
        userMessage: contextData,
        temperature: 0.2,
        maxTokens: 1200,
      });
      res.json({ result });
    } catch (err: unknown) {
      console.error('[AI /customers-classify]', getErrorMessage(err));
      res.status(500).json({ error: AI_SERVICE_ERROR });
    }
  });

  router.post('/api/ai/efficiency', async (req, res) => {
    if (!checkRateLimit(req, RL_STANDARD))
      return res.status(429).json({ error: 'Quá nhiều yêu cầu. Vui lòng thử lại sau 1 phút.' });
    try {
      const { contextData } = req.body as { contextData?: string };
      if (!contextData) return res.status(400).json({ error: 'contextData là bắt buộc' });
      const result = await callClaude({
        model: 'claude-haiku-4-5',
        system: 'Bạn là COO cho chuỗi bán lẻ giày dép Việt Nam. Nhận xét KPI hiệu quả vận hành, chỉ ra nhân viên hoặc kênh đang underperform, đề xuất hành động cải thiện tuần này. Trả lời Tiếng Việt, Markdown.',
        userMessage: contextData,
        temperature: 0.2,
        maxTokens: 1200,
      });
      res.json({ result });
    } catch (err: unknown) {
      console.error('[AI /efficiency]', getErrorMessage(err));
      res.status(500).json({ error: AI_SERVICE_ERROR });
    }
  });

  router.post('/api/ai/business-analysis', async (req, res) => {
    if (!checkRateLimit(req, RL_STANDARD))
      return res.status(429).json({ error: 'Quá nhiều yêu cầu. Vui lòng thử lại sau 1 phút.' });
    try {
      const { contextData } = req.body as { contextData?: string };
      if (!contextData) return res.status(400).json({ error: 'contextData là bắt buộc' });
      const result = await callClaude({
        model: 'claude-haiku-4-5',
        system:
          'Bạn là CFO chiến lược cho chuỗi bán lẻ giày dép Việt Nam. Phân tích sắc bén tình hình kinh doanh, so sánh hiệu quả đa kênh, đưa ra khuyến nghị thực tiễn dựa trên số liệu. Trả lời bằng Tiếng Việt, định dạng Markdown chuyên nghiệp, dùng bảng khi cần so sánh.',
        userMessage: contextData,
        temperature: 0.2,
        maxTokens: 1500,
      });
      res.json({ result });
    } catch (err: unknown) {
      const message = getErrorMessage(err);
      console.error('[AI /business-analysis]', message);
      res.status(500).json({ error: AI_SERVICE_ERROR });
    }
  });

  // ─── Product Content Engine ────────────────────────────────────────────────

  interface ProductContentInput {
    name: string;
    sku: string;
    category: string;
    price: number;
    brandName?: string;
    material?: string;
    colors?: string[];
    sizeRange?: string;
    origin?: string;
    warrantyPolicy?: string;
    description?: string;
    sellingPoints?: string[];
  }

  interface ContentWarning {
    type: 'forbidden_claim' | 'missing_data' | 'format_violation';
    phrase?: string;
    message: string;
  }

  interface AICallParams {
    system: string;
    userMessage: string;
    temperature: number;
    maxTokens: number;
  }

  async function callAI(model: string, params: AICallParams): Promise<string> {
    if (model.startsWith('claude-')) {
      return callClaude({
        model: model as 'claude-haiku-4-5' | 'claude-sonnet-4-6',
        system: params.system,
        userMessage: params.userMessage,
        temperature: params.temperature,
        maxTokens: params.maxTokens,
      });
    }
    // Phase 1.5+: thêm OpenAI, Gemini ở đây
    throw new Error(`Model chưa hỗ trợ trong Phase 1: ${model}`);
  }

  function buildProductFacts(p: ProductContentInput): { knownFacts: string[]; missingFacts: string[] } {
    const knownFacts: string[] = [];
    const missingFacts: string[] = [];
    if (p.brandName) knownFacts.push(`Thương hiệu: ${p.brandName}`); else missingFacts.push('Thương hiệu');
    if (p.material) knownFacts.push(`Chất liệu: ${p.material}`); else missingFacts.push('Chất liệu');
    if (p.colors?.length) knownFacts.push(`Màu sắc: ${p.colors.join(', ')}`); else missingFacts.push('Màu sắc');
    if (p.sizeRange) knownFacts.push(`Size: ${p.sizeRange}`); else missingFacts.push('Size range');
    if (p.origin) knownFacts.push(`Xuất xứ: ${p.origin}`); else missingFacts.push('Xuất xứ');
    if (p.warrantyPolicy) knownFacts.push(`Bảo hành: ${p.warrantyPolicy}`); else missingFacts.push('Bảo hành');
    if (p.description) knownFacts.push(`Mô tả thô: ${p.description}`);
    if (p.sellingPoints?.length) knownFacts.push(`Điểm bán hàng: ${p.sellingPoints.join(', ')}`);
    return { knownFacts, missingFacts };
  }

  const OBJECTIVE_CONTEXT: Record<string, string> = {
    sell_fast: 'Bán nhanh — nhấn vào giá trị, tiện lợi, CTA mạnh',
    clearance: 'Xả hàng — tạo urgency, nhấn giá ưu đãi, hàng còn ít',
    new_arrival: 'Ra mắt mẫu mới — nhấn điểm khác biệt, tạo tò mò',
    seo: 'SEO — từ khóa tự nhiên, heading chuẩn, meta description',
  };

  function buildUserMessage(
    p: ProductContentInput,
    knownFacts: string[],
    missingFacts: string[],
    config: PlatformPrivateConfig,
    objective?: string,
    extraInstruction?: string
  ): string {
    const parts: string[] = [
      '=== THÔNG TIN SẢN PHẨM ===',
      `Tên: ${p.name}`,
      `SKU: ${p.sku}`,
      `Danh mục: ${p.category}`,
      `Giá bán: ${p.price.toLocaleString('vi-VN')}đ`,
    ];
    if (knownFacts.length > 0) {
      parts.push('\n=== DỮ LIỆU CÓ SẴN (dùng trực tiếp) ===');
      knownFacts.forEach(f => parts.push(`• ${f}`));
    }
    if (missingFacts.length > 0) {
      parts.push('\n=== DỮ LIỆU CÒN THIẾU (không được bịa) ===');
      missingFacts.forEach(f => parts.push(`• ${f}: KHÔNG CÓ THÔNG TIN`));
    }
    if (objective && OBJECTIVE_CONTEXT[objective]) {
      parts.push(`\n=== MỤC TIÊU ===\n${OBJECTIVE_CONTEXT[objective]}`);
    }
    const extraRules = objective ? (config.ai.objectiveModifiers[objective]?.additionalRules ?? []) : [];
    const allRules = [...config.rules, ...extraRules];
    parts.push('\n=== QUY TẮC VIẾT ===');
    allRules.forEach(r => parts.push(`• ${r}`));
    if (extraInstruction?.trim()) {
      parts.push(`\n=== GHI CHÚ THÊM TỪ NGƯỜI DÙNG ===\n${extraInstruction.trim()}`);
    }
    return parts.join('\n');
  }

  function buildSystemPrompt(config: PlatformPrivateConfig): string {
    return [
      config.systemPrompt,
      `Claim tuyệt đối KHÔNG được viết: ${config.forbiddenClaims.join(', ')}.`,
    ].join('\n\n');
  }

  function resolveTemperature(config: PlatformPrivateConfig, objective?: string): number {
    if (!objective) return config.ai.temperature;
    const delta = config.ai.objectiveModifiers[objective]?.temperatureDelta ?? 0;
    return Math.min(1, Math.max(0, config.ai.temperature + delta));
  }

  function checkForbiddenClaims(text: string, claims: string[]): ContentWarning[] {
    const lower = text.toLowerCase();
    return claims
      .filter(c => lower.includes(c.toLowerCase()))
      .map(phrase => ({
        type: 'forbidden_claim' as const,
        phrase,
        message: `Phát hiện claim "${phrase}" — kiểm tra lại trước khi đăng.`,
      }));
  }

  function extractJSON(raw: string): Record<string, unknown> | null {
    let s = raw.trim();
    // Bỏ markdown fence nếu có
    const fence = s.match(/```(?:json)?\s*([\s\S]*?)```/);
    if (fence) s = fence[1].trim();
    try { return JSON.parse(s) as Record<string, unknown>; } catch { return null; }
  }

  function validateWebProductJSON(parsed: Record<string, unknown>): string | null {
    if (typeof parsed.shortDescription !== 'string' || parsed.shortDescription.length < 5)
      return 'shortDescription thiếu hoặc quá ngắn';
    if (typeof parsed.longDescription !== 'string' || parsed.longDescription.length < 30)
      return 'longDescription thiếu hoặc quá ngắn';
    if (typeof parsed.seoTitle !== 'string' || parsed.seoTitle.length < 5)
      return 'seoTitle thiếu hoặc quá ngắn';
    return null;
  }

  router.post('/api/ai/content/generate', async (req, res) => {
    if (!checkRateLimit(req, RL_STRICT))
      return res.status(429).json({ error: 'Quá nhiều yêu cầu. Vui lòng thử lại sau 1 phút.' });
    try {
      const { productInput, platformId, objective, extraInstruction } = req.body as {
        productInput?: ProductContentInput;
        platformId?: string;
        objective?: string;
        extraInstruction?: string;
      };

      if (!platformId) return res.status(400).json({ error: 'platformId là bắt buộc' });
      const config = CONTENT_PROMPTS[platformId];
      if (!config) return res.status(400).json({ error: `Nền tảng không hợp lệ: ${platformId}` });

      if (!productInput?.name || !productInput?.category || !productInput?.sku || productInput?.price === undefined) {
        return res.status(400).json({ error: 'productInput cần có đủ: name, category, price, sku' });
      }

      const { knownFacts, missingFacts } = buildProductFacts(productInput);
      const system = buildSystemPrompt(config);
      const userMessage = buildUserMessage(productInput, knownFacts, missingFacts, config, objective, extraInstruction);
      const temperature = resolveTemperature(config, objective);

      let rawResult = await callAI(config.ai.preferredModel, {
        system,
        userMessage,
        temperature,
        maxTokens: config.ai.maxTokens,
      });

      const warnings = checkForbiddenClaims(rawResult, config.forbiddenClaims);
      let parseError = false;

      // Validate JSON cho website_product_description
      if (platformId === 'website_product_description') {
        const parsed = extractJSON(rawResult);
        const validationError = parsed ? validateWebProductJSON(parsed) : 'Không parse được JSON';

        if (validationError) {
          // Retry 1 lần với prompt nhắc lại format
          const retryMessage = userMessage +
            '\n\nQUAN TRỌNG: Trả về JSON thuần túy, không có markdown fence, không có text giải thích.' +
            ' Chỉ object JSON với keys: shortDescription, longDescription, specs, seoTitle.';
          const retryRaw = await callAI(config.ai.preferredModel, {
            system,
            userMessage: retryMessage,
            temperature: 0.2,
            maxTokens: config.ai.maxTokens,
          });
          const retryParsed = extractJSON(retryRaw);
          const retryError = retryParsed ? validateWebProductJSON(retryParsed) : 'Không parse được JSON';

          if (retryError || !retryParsed) {
            rawResult = retryRaw;
            parseError = true;
            warnings.push({ type: 'format_violation', message: `JSON parse thất bại sau retry: ${retryError}. Đây là raw output — copy và chỉnh tay.` });
          } else {
            rawResult = JSON.stringify(retryParsed, null, 2);
          }
        } else if (parsed) {
          rawResult = JSON.stringify(parsed, null, 2);
        }
      }

      res.json({
        result: rawResult,
        platform: platformId.split('_')[0],
        task: platformId,
        model: config.ai.preferredModel,
        warnings,
        ...(parseError && { parseError: true }),
      });

    } catch (err: unknown) {
      console.error('[AI /content/generate]', getErrorMessage(err));
      res.status(500).json({ error: AI_SERVICE_ERROR });
    }
  });

  return router;
}
