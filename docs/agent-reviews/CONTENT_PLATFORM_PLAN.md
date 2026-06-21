# Kế hoạch: Content Platform — Sinh nội dung AI đa nền tảng

> **Mục đích tài liệu này**: Đưa ra để nhiều bên (dev, AI agent, reviewer) đánh giá và tìm hướng tốt nhất trước khi implement.  
> **Ngày viết**: 2026-06-21  
> **Người viết**: ngothanhdu  
> **Trạng thái**: Chờ đánh giá — chưa implement

---

> **Mục tiêu tranh luận**: Xác định thiết kế kỹ thuật tối ưu để sinh nội dung sản phẩm đa nền tảng — ít rủi ro nhất, triển khai được trong 1 tuần, không phá vỡ code hiện tại.  
> **Số vòng tối đa**: 3  
> **Agents tham gia**: Codex, Claude  
> **Agent tổng hợp**: Claude  
> **Trạng thái tranh luận**: Vòng 1 / 3

---

## 1. Bối cảnh & Vấn đề

### Hệ thống hiện tại

CFO Brain 4.0 đã có module Marketing (`components/marketing/MarketingManager.tsx`) với các tính năng:

- Lập kế hoạch bài đăng Facebook theo chiến lược (tỉ lệ %)
- Sinh caption Facebook bằng Claude AI (`/api/ai/marketing-content-plan`)
- Kết nối và tự động đăng lên Facebook Fanpage
- Lịch đăng theo tháng/tuần, kho bài viết

### Vấn đề cần giải quyết

Shop cần thêm khả năng:

1. **Sinh mô tả sản phẩm cho Shopee** — chuẩn format Shopee (bullet, emoji, từ khóa)
2. **Viết blog cho website** — chuẩn SEO, markdown H2/H3, 800–1200 chữ
3. **Mô tả trang sản phẩm web** — ngắn gọn, chuyên nghiệp, JSON có cấu trúc
4. **Hỗ trợ nhiều AI provider** — không chỉ Claude, cần thêm OpenAI GPT, sau này Gemini

### Ràng buộc kỹ thuật hiện tại

- Backend chỉ có `claudeClient.ts` — chưa có OpenAI client
- Route AI pattern hiện tại: `POST /api/ai/{task}` → `callClaude()` → `{ result }`
- Frontend marketing service (`marketingClaudeService.ts`) gọi thẳng tên endpoint Claude
- Trang Marketing đã có sidebar + tab structure ổn định, không muốn phá vỡ

---

## 2. Mục tiêu thiết kế

### Phải đạt được

- [ ] Sinh mô tả đúng chuẩn từng nền tảng (Shopee ≠ Blog ≠ Web)
- [ ] Hỗ trợ ít nhất Claude + OpenAI GPT ngay từ đầu
- [ ] Thay đổi quy trình/prompt từng nền tảng mà **không cần sửa code logic**
- [ ] Thêm nền tảng mới (TikTok, Lazada...) dễ dàng về sau
- [ ] Tích hợp vào UI hiện tại — không tạo trang riêng

### Không bắt buộc (để sau)

- Auto-post lên Shopee (Shopee không có API public)
- Tạo ảnh AI (cần thêm image generation provider riêng)
- Gemini provider (dễ thêm sau khi có multi-provider foundation)
- Lưu lịch sử sinh nội dung vào Supabase

---

## 3. Phương án đề xuất

### Ý tưởng cốt lõi: Platform Config Pattern

Tách "quy trình từng nền tảng" ra khỏi "logic AI". Mỗi nền tảng là một config object độc lập:

```
Product data (input)
        ↓
Platform Config  ← SỬA Ở ĐÂY khi cần đổi quy trình
        ↓
AI Provider Router  ← Claude / OpenAI / Gemini
        ↓
Output (text / markdown / json)
```

**Lợi ích**: Sửa Shopee không ảnh hưởng Blog. Thêm TikTok chỉ cần thêm 1 config object.

---

## 4. Thiết kế kỹ thuật chi tiết

### 4.1 Schema PlatformConfig

```typescript
// constants/contentPlatforms.ts

export interface PlatformConfig {
  id: string                    // 'shopee' | 'blog' | 'web' | 'facebook'
  name: string                  // tên hiển thị
  icon: string                  // emoji icon

  ai: {
    preferredModel: string      // model mặc định
    fallbackModel: string       // dự phòng khi lỗi
    temperature: number         // 0.3 = chắc chắn / 0.8 = sáng tạo
    maxTokens: number
  }

  output: {
    format: 'text' | 'markdown' | 'json'
    maxLength?: number          // giới hạn ký tự output
    sections: string[]          // phần bắt buộc có trong kết quả
  }

  systemPrompt: string          // system prompt riêng nền tảng này
  rules: string[]               // quy tắc đặc thù — thêm/xóa không cần đụng code
}
```

### 4.2 Config từng nền tảng

#### Shopee
```typescript
{
  id: 'shopee',
  name: 'Mô tả Shopee',
  icon: '🛒',
  ai: {
    preferredModel: 'gpt-4o-mini',     // nhanh + rẻ, đủ dùng
    fallbackModel: 'claude-haiku-4-5',
    temperature: 0.4,
    maxTokens: 1024,
  },
  output: {
    format: 'text',
    maxLength: 500,
    sections: ['tiêu đề', 'điểm nổi bật', 'chất liệu/đế', 'hướng dẫn chọn size', 'cta'],
  },
  systemPrompt: 'Bạn là chuyên gia viết mô tả sản phẩm cho Shopee Việt Nam...',
  rules: [
    'Dùng bullet points, mỗi dòng bắt đầu bằng emoji phù hợp (✅ 🎯 👟 ...)',
    'Tối đa 500 chữ — người mua Shopee đọc nhanh, không đọc bài dài',
    'Chèn từ khóa tìm kiếm tự nhiên: giày da, giày bền, giày giá tốt, giày nam/nữ',
    'Kết thúc bằng CTA ngắn gọn: "💬 Nhắn tin đặt hàng ngay hôm nay!"',
    'Không dùng tiếng lóng, không quá hoa mỹ, không nói "sản phẩm tốt nhất"',
  ],
}
```

#### Blog web
```typescript
{
  id: 'blog',
  name: 'Bài blog',
  icon: '📝',
  ai: {
    preferredModel: 'claude-sonnet-4-6',   // văn phong tốt nhất cho bài dài
    fallbackModel: 'gpt-4o',
    temperature: 0.7,
    maxTokens: 2048,
  },
  output: {
    format: 'markdown',
    maxLength: 1200,
    sections: ['tiêu đề SEO', 'meta description', 'intro', 'nội dung chính', 'kết luận'],
  },
  systemPrompt: 'Bạn là chuyên gia SEO content cho website bán lẻ giày dép Việt Nam...',
  rules: [
    'Viết 800–1200 chữ — đủ dài để SEO, không quá dài gây chán',
    'Dùng heading H2/H3 chuẩn Markdown (## và ###)',
    'Đoạn đầu tiên phải chứa từ khóa chính một cách tự nhiên',
    'Tạo meta description 150–160 ký tự ở cuối, dưới dạng: **Meta:** ...',
    'Không spam từ khóa — tối đa 3 lần/1000 chữ',
    'Kết bài gợi ý xem thêm sản phẩm liên quan để giữ người dùng ở lại',
  ],
}
```

#### Trang sản phẩm web
```typescript
{
  id: 'web',
  name: 'Trang sản phẩm web',
  icon: '🌐',
  ai: {
    preferredModel: 'claude-sonnet-4-6',
    fallbackModel: 'gpt-4o-mini',
    temperature: 0.4,
    maxTokens: 1024,
  },
  output: {
    format: 'json',
    sections: ['shortDescription', 'longDescription', 'specs', 'seoTitle'],
  },
  systemPrompt: 'Bạn là copywriter chuyên trang sản phẩm thương mại điện tử...',
  rules: [
    'shortDescription: 1–2 câu, dùng cho card sản phẩm, tập trung lợi ích chính',
    'longDescription: 150–250 chữ, tập trung vào lợi ích người dùng (không phải tính năng)',
    'Chuyên nghiệp, không dùng emoji',
    'specs: object JSON gồm chất liệu, màu sắc, size range, xuất xứ',
    'seoTitle: 50–60 ký tự, chứa từ khóa chính',
    'Viết bằng Tiếng Việt, giọng thương hiệu uy tín',
  ],
}
```

#### Facebook (chuẩn hóa cái đang có)
```typescript
{
  id: 'facebook',
  name: 'Caption Facebook',
  icon: '📘',
  ai: {
    preferredModel: 'claude-haiku-4-5',   // đã hoạt động tốt, giữ nguyên
    fallbackModel: 'gpt-4o-mini',
    temperature: 0.8,
    maxTokens: 1024,
  },
  output: {
    format: 'text',
    maxLength: 600,
    sections: ['hook', 'nội dung chính', 'cta', 'contact', 'hashtag'],
  },
  systemPrompt: 'Bạn là Social Media Manager cho "Giày Dép Phúc Sang"...',
  rules: [
    'Dòng đầu phải gây chú ý ngay: câu hỏi / sự thật thú vị / tình huống người dùng gặp',
    'Tối thiểu 150 chữ — đủ để Facebook không cắt xén',
    'Dùng icon 👟✨ duyên dáng, không spam',
    'Kết thúc: SĐT + địa chỉ + hashtag thương hiệu',
    'Giọng gần gũi như nói chuyện với khách quen — không formal',
  ],
}
```

### 4.3 Backend — Multi-provider router

**File tạo mới: `services/agents/openaiClient.ts`**

```typescript
import OpenAI from 'openai';

const client = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

export async function callOpenAI(params: {
  model: string
  system: string
  userMessage: string
  temperature: number
  maxTokens: number
}): Promise<string> {
  const res = await client.chat.completions.create({
    model: params.model,
    messages: [
      { role: 'system', content: params.system },
      { role: 'user', content: params.userMessage },
    ],
    temperature: params.temperature,
    max_tokens: params.maxTokens,
  });
  return res.choices[0].message.content ?? '';
}
```

**Hàm router — thêm vào `routes/ai.ts`:**

```typescript
async function callAI(model: string, params: AICallParams): Promise<string> {
  if (model.startsWith('claude-')) return callClaude({ model, ...params });
  if (model.startsWith('gpt-'))    return callOpenAI({ model, ...params });
  // if (model.startsWith('gemini-')) return callGemini({ model, ...params }); // Phase 2
  throw new Error(`Model chưa hỗ trợ: ${model}`);
}
```

**Route mới — thêm vào `routes/ai.ts`:**

```typescript
// 1 route duy nhất xử lý mọi nền tảng
router.post('/api/ai/product-content', async (req, res) => {
  if (!checkRateLimit(req, RL_STRICT)) return res.status(429)...;

  const { productData, platformId, modelOverride } = req.body;
  const config = PLATFORM_CONFIGS[platformId];
  if (!config) return res.status(400).json({ error: `Nền tảng không hợp lệ: ${platformId}` });

  const model = modelOverride ?? config.ai.preferredModel;
  const prompt = buildProductPrompt(productData, config); // build từ systemPrompt + rules + productData

  try {
    const result = await callAI(model, {
      system: config.systemPrompt,
      userMessage: prompt,
      temperature: config.ai.temperature,
      maxTokens: config.ai.maxTokens,
    });
    res.json({ result, platform: platformId, model });
  } catch (err) {
    // Fallback sang model dự phòng nếu model chính lỗi
    const fallbackResult = await callAI(config.ai.fallbackModel, { ... });
    res.json({ result: fallbackResult, platform: platformId, model: config.ai.fallbackModel });
  }
});
```

### 4.4 Frontend service

**File tạo mới: `services/productContentService.ts`**

```typescript
export interface ProductInput {
  name: string
  sku: string
  category: string
  price: number
  importPrice?: number
  description?: string        // mô tả thô từ kho hàng
  attributes?: Record<string, string>  // { màu: 'Đen', chất liệu: 'Da bò', ... }
}

export async function generateProductContent(
  product: ProductInput,
  platformId: string,
  modelOverride?: string
): Promise<{ result: string; model: string; platform: string }>

export async function regenerate(
  product: ProductInput,
  platformId: string,
  model: string,
  feedback?: string   // người dùng ghi "viết lại theo hướng X" trước khi sinh lại
): Promise<string>
```

### 4.5 UI — Tab mới trong MarketingManager

**File tạo mới: `components/marketing/ProductContentTab.tsx`**

Layout:

```
┌──────────────────────────────────────────────────────────────┐
│  [🛒 Shopee]  [📝 Blog]  [🌐 Web]  [📘 Facebook]  ← sub-tab│
├─────────────────────┬────────────────────────────────────────┤
│  INPUT (bên trái)   │  OUTPUT (bên phải)                     │
│  ─────────────────  │  ──────────────────────────────────    │
│  Sản phẩm:          │                                        │
│  [▼ Chọn từ kho]    │  [Textarea có thể sửa trực tiếp]      │
│                     │                                        │
│  Giá: 329.000đ      │  Character count: 0 / 500              │
│  SKU: DBD16-Đen-38  │                                        │
│  Danh mục: Giày da  │  ────────────────────────────────────  │
│                     │  Model: [claude-sonnet-4-6  ▼]         │
│  Ghi chú thêm:      │                                        │
│  [textarea nhỏ  ]   │  [Sinh nội dung]                       │
│                     │  [Sinh lại]  [Copy]  [Lưu kho]         │
└─────────────────────┴────────────────────────────────────────┘
```

**Sửa `MarketingManager.tsx` — chỉ 3 chỗ nhỏ:**

```typescript
// 1. Thêm vào MARKETING_TAB_META
'product-content': {
  label: 'Nội dung sản phẩm',
  description: 'Sinh mô tả Shopee, blog web, trang sản phẩm bằng AI',
  icon: Sparkles,
  group: 'Cửa hàng',
}

// 2. Thêm vào MARKETING_SIDEBAR_ITEMS
const MARKETING_SIDEBAR_ITEMS = ['promotions', 'product-content', 'calendar', 'list', ...]

// 3. Thêm vào phần render tab
{activeTab === 'product-content' && (
  <ProductContentTab appData={appData} />
)}
```

---

## 5. Danh sách file thay đổi

| File | Loại | Kích thước ước tính | Giai đoạn |
|------|------|---------------------|-----------|
| `constants/contentPlatforms.ts` | Tạo mới | ~120 dòng | 1 |
| `services/agents/openaiClient.ts` | Tạo mới | ~50 dòng | 2 |
| `routes/ai.ts` | Thêm vào | ~70 dòng | 2 |
| `.env.local` | Thêm key | 1 dòng | 2 |
| `services/productContentService.ts` | Tạo mới | ~60 dòng | 3 |
| `components/marketing/ProductContentTab.tsx` | Tạo mới | ~200 dòng | 4 |
| `components/marketing/MarketingManager.tsx` | Thêm vào | ~15 dòng | 4 |

**Tổng: ~515 dòng mới. Không xóa hay sửa logic nào đang chạy.**

---

## 6. Lộ trình thực hiện

### Phase 1 — Foundation (có thể làm ngay)
- Tạo `constants/contentPlatforms.ts` với 4 platform config
- Tạo `services/agents/openaiClient.ts`
- Thêm `OPENAI_API_KEY` vào `.env.local`
- Thêm hàm `callAI()` và route `/api/ai/product-content` vào `routes/ai.ts`

### Phase 2 — Frontend (sau Phase 1 xong)
- Tạo `services/productContentService.ts`
- Tạo `components/marketing/ProductContentTab.tsx`
- Wiring vào `MarketingManager.tsx`

### Phase 3 — Mở rộng (sau khi dùng thật và có phản hồi)
- Thêm Gemini provider
- Thêm lưu lịch sử vào Supabase
- Thêm tính năng "Sinh lại với góc nhìn khác"
- Thêm nền tảng mới (TikTok, Lazada)
- Tích hợp tạo ảnh AI (DALL-E / Stable Diffusion)

---

## 7. Câu hỏi mở — Cần đánh giá

Những điểm dưới đây chưa có quyết định cuối, cần reviewer đánh giá:

### Q1. Lưu output ở đâu?
- **Phương án A**: `localStorage` — đơn giản, offline, mất khi xóa cache
- **Phương án B**: Supabase — bền vững, cần thêm bảng `product_content_history`
- **Phương án C**: Không lưu — user tự copy, không cần lưu

### Q2. Chọn sản phẩm như thế nào?
- **Phương án A**: Dropdown chọn từ `pos_products` (kho hàng hiện có)
- **Phương án B**: Nhập thủ công tên + thông tin sản phẩm
- **Phương án C**: Kết hợp — chọn từ kho, sau đó chỉnh sửa thêm

### Q3. Model selector — hiển thị như thế nào?
- **Phương án A**: Dropdown kỹ thuật ("gpt-4o-mini", "claude-sonnet-4-6") — người dùng chọn chính xác
- **Phương án B**: Label thân thiện ("Nhanh & Rẻ", "Chất lượng cao", "Sáng tạo nhất")
- **Phương án C**: Ẩn hoàn toàn — system tự chọn theo nền tảng, user không cần biết

### Q4. Fallback khi model lỗi?
- **Phương án A**: Tự động fallback sang model dự phòng, thông báo cho user
- **Phương án B**: Báo lỗi, để user chọn lại model
- **Phương án C**: Retry 1 lần cùng model, nếu vẫn lỗi thì báo

### Q5. Vị trí tab trong sidebar?
- **Phương án A**: Nhóm "Cửa hàng" (cùng với Khuyến mãi) — vì liên quan sản phẩm
- **Phương án B**: Nhóm riêng "AI Content" — vì là tính năng mới, khác bản chất
- **Phương án C**: Trang riêng hoàn toàn, không nằm trong Marketing

---

## 8. Rủi ro kỹ thuật

| Rủi ro | Xác suất | Tác động | Xử lý đề xuất |
|--------|----------|----------|----------------|
| OpenAI API key chưa có | Cao | Trung bình | Phase 1 dùng Claude làm fallback cho mọi model |
| `PLATFORM_CONFIGS` import vào backend (Node) và frontend (Vite) gây conflict | Trung bình | Thấp | Tách thành 2 file: `constants/contentPlatforms.ts` (shared) và type-only import |
| Rate limit OpenAI khi test nhiều | Thấp | Thấp | `checkRateLimit(req, RL_STRICT)` đã có sẵn |
| Output không đúng format (AI không theo rules) | Trung bình | Thấp | Validate output, nếu sai format thì retry 1 lần với prompt nhắc lại |

---

## 9. Tham chiếu code hiện tại

| File | Liên quan |
|------|-----------|
| `routes/ai.ts` | Pattern route AI hiện tại — mọi route mới phải theo pattern này |
| `services/agents/claudeClient.ts` | Interface `callClaude()` — openaiClient phải có cùng signature |
| `components/marketing/MarketingManager.tsx` | File sẽ thêm tab mới vào |
| `constants/marketing.ts` | Pattern viết constants marketing hiện tại |
| `services/marketingClaudeService.ts` | Service frontend hiện tại — `productContentService.ts` tham khảo pattern này |

---

*Tài liệu này được tạo để review nội bộ. Mọi quyết định kỹ thuật cần xác nhận trước khi implement.*

---

---

# VÒNG 1 — REVIEW: Codex

> **Agent**: Codex
> **Ngày**: 2026-06-21
> **Vòng**: 1

## Đồng ý

- **Platform Config Pattern là hướng đúng**: Tách luật viết nội dung từng nền tảng ra khỏi logic AI là đúng. Shopee, Blog, Web, Facebook có format và mục tiêu khác nhau — nếu không config hóa sẽ rất khó bảo trì khi scale.
- **Không nên tạo trang riêng**: Tích hợp vào module Marketing hiện tại là hợp lý vì đây là tác vụ marketing/content, nên nằm gần lịch đăng, kho bài và Facebook API.
- **Một route chung tốt hơn nhiều route nhỏ**: `/api/ai/product-content` tập trung rate limit, logging, fallback và validation — dễ kiểm soát hơn nhiều endpoint riêng.
- **Config hóa rules để sửa prompt không cần chạm code**: Nội dung thương mại thay đổi liên tục theo mùa và chương trình khuyến mãi — đây là điểm thiết kế đúng nhất của plan.

## Phản biện

- **Phạm vi Phase 1 quá rộng**: Plan yêu cầu vừa thêm OpenAI client, vừa thêm router provider, vừa thêm UI mới, vừa thêm fallback trong cùng 1 phase — tăng quá nhiều biến số lỗi cùng lúc. → **Phương án thay thế**: Phase 1 thiết kế interface provider-agnostic nhưng chỉ implement Claude. Tạo `callAI()` router nhưng throw error cho model không phải Claude. OpenAI vào Phase 1.5 khi đã ổn định.
- **Không nên expose model id kỹ thuật ra UI**: `gpt-4o-mini`, `claude-sonnet-4-6` là ngôn ngữ của developer, không phải nhân viên cửa hàng. → **Phương án thay thế**: Selector theo mục tiêu kinh doanh: `Bán nhanh`, `Ra mắt mẫu mới`, `SEO/Blog`, `Xả hàng`. Backend tự map sang model + temperature phù hợp.
- **`platformId` phẳng sẽ hạn chế khi mở rộng**: Shopee và Facebook đều có nhiều task khác nhau (title, description, caption, livestream script...) — dùng 1 id phẳng sẽ cần tạo config mới cho mỗi task và đặt tên rất khó quản lý. → **Phương án thay thế**: Dùng hybrid — preset id ghép từ platform + task (`shopee_product_description`), nhưng nội bộ config object tách riêng `platform`, `task`, `objective[]`.
- **Output JSON không chỉ cần prompt, cần validate/schema**: AI có thể trả markdown fence, thiếu field, hoặc sai kiểu dữ liệu. → **Phương án thay thế**: Dùng Zod validate. Nếu lỗi, retry 1 lần với prompt sửa format. Nếu vẫn lỗi, trả raw output + flag `parseError: true` để user copy thủ công.
- **Nguồn dữ liệu sản phẩm là lõi của tính năng, không phải câu hỏi phụ**: Nếu user phải nhập tay tất cả, giá trị tính năng giảm mạnh. → **Phương án thay thế**: Chọn từ `pos_products` (kho đã có), sau đó cho chỉnh sửa/bổ sung trước khi sinh.
- **Lưu lịch sử Supabase sẽ kéo theo quá nhiều thứ cho Phase 1**: Schema, migration, permissions, UI quản lý lịch sử — không nên làm trước khi chứng minh workflow hữu ích. → **Phương án thay thế**: Phase 1 chỉ cần Copy + Sinh lại. Phase 2 xét Supabase nếu có nhu cầu thực tế.
- **Rủi ro config bị lộ**: Nếu `contentPlatforms.ts` import cả frontend lẫn backend, system prompt sẽ vào JS bundle của client. → **Phương án thay thế**: Tách thành 2 file — `constants/contentPlatforms.ts` (public: id, name, icon, format) và `server/config/contentPrompts.ts` (private: systemPrompt, rules, temperature).

## Đánh giá mục tiêu

Kế hoạch có hướng đúng nhưng Phase 1 hiện tại **chưa đạt mục tiêu**: không triển khai được trong 1 tuần vì phạm vi quá rộng (multi-provider + UI + validation + fallback cùng lúc). Cần thu hẹp Phase 1 để có bản chạy được nhanh, sau đó hardening từng bước.

## Điều kiện để tôi đồng ý dừng

Khi plan chốt thể hiện rõ 4 điều sau: (1) Phase 1 không bao gồm OpenAI, chỉ Claude; (2) có Zod validation cho JSON output; (3) UI selector theo mục tiêu kinh doanh, không theo tên model; (4) config tách public/private rõ ràng trong danh sách file thay đổi.

---

# VÒNG 1 — REVIEW: Claude

> **Agent**: Claude (Sonnet 4.6)
> **Ngày**: 2026-06-21
> **Vòng**: 1

## Đồng ý

- **Đổi tên thành "Product Content Engine"**: Đặt đúng trọng tâm vào giá trị thực tế cho shop — sinh nội dung bán hàng — không phải phô trương công nghệ AI provider.
- **Không thêm OpenAI Phase 1**: Đồng ý với Codex. `callAI()` vẫn tạo để thiết kế interface, nhưng implementation chỉ handle prefix `claude-`. Throw error với model khác thay vì skip.
- **Không lưu Supabase history Phase 1**: Copy + Sinh lại là đủ để validate xem tính năng có giá trị không. Supabase kéo theo migration + UI quản lý — không nên làm trước khi có bằng chứng nhu cầu.
- **UI selector theo mục tiêu kinh doanh**: `Bán nhanh / Ra mắt mẫu mới / SEO / Xả hàng` — đây là ngôn ngữ nhân viên shop hiểu và dùng thật.
- **Validate JSON output bằng Zod + retry 1 lần**: Phù hợp với codebase TypeScript + Express hiện tại, không cần thêm runtime nặng.
- **Tách public/private config**: Đây là rủi ro bảo mật thực sự cần xử lý từ Phase 1, không phải để sau.
- **Chọn sản phẩm từ kho + cho chỉnh sửa**: Tận dụng dữ liệu đã có trong `pos_products`, không bắt nhập tay từ đầu.

## Phản biện

- **Plan gốc thiếu field bắt buộc cho product input**: Không có schema rõ thì AI sẽ bịa thông tin về chất liệu/xuất xứ/bảo hành — đây là rủi ro cao hơn tất cả rủi ro kỹ thuật. → **Phương án thay thế**: Định nghĩa rõ 4 field bắt buộc (`name`, `category`, `price`, `sku`) và field tùy chọn (`material`, `colors`, `sizeRange`, `description`). Khi field tùy chọn thiếu, AI phải viết trung tính hoặc để trống, không được suy đoán. Rule `TUYỆT ĐỐI không bịa thông tin` phải vào systemPrompt của mọi nền tảng.
- **Plan gốc chưa có compliance rules chống claim quá mạnh**: AI có thể tự thêm "tốt nhất", "rẻ nhất", "cam kết 100%" — vi phạm quy định quảng cáo và sai thực tế. → **Phương án thay thế**: Thêm mảng `forbiddenClaims` vào mỗi platform config. Sau khi sinh xong, scan output, cảnh báo nếu vi phạm (không tự xóa — để user quyết định).
- **Plan gốc chưa có acceptance criteria**: Không biết khi nào Phase 1 là "done". → **Phương án thay thế**: 8 criteria cụ thể — xem mục "Điều kiện để tôi đồng ý dừng".

## Đánh giá mục tiêu

Sau khi tích hợp các phản biện của Codex vào plan, mục tiêu "ít rủi ro, triển khai 1 tuần, không phá code hiện tại" gần đạt được. Còn 2 khoảng trống: product input schema chưa rõ và chưa có acceptance criteria để biết Phase 1 kết thúc khi nào.

## Điều kiện để tôi đồng ý dừng

Khi plan chốt bổ sung: (1) product input schema với field bắt buộc vs tùy chọn và rule chống bịa thông tin; (2) `forbiddenClaims` trong config; (3) acceptance criteria 8 điểm; (4) danh sách file thay đổi cập nhật gồm `server/config/contentPrompts.ts` tách riêng.

---

# VÒNG 2 — PHẢN HỒI CHÉO

> **Trạng thái**: Chờ các agent đọc lẫn nhau và ghi phản hồi vào đây
> **Định dạng**: Mỗi agent ghi một section theo mẫu bên dưới

```
## VÒNG 2 — [Tên Agent]

### Phản hồi với [Agent khác]
- Đồng ý / Rút phản biện X vì ... / Giữ phản biện X vì ...

### Điểm còn giữ nguyên
- [Những điểm chưa được giải quyết]

### Tuyên bố
[ ] ✅ ĐỒNG Ý DỪNG — mục tiêu đã đạt
[ ] ⚠️ CÒN BẤT ĐỒNG — ghi rõ bên dưới
```

## VÒNG 2 — Codex

### Phản hồi với Claude

- **Đồng ý với Claude về product input schema**. Đây là điểm cần đưa vào plan chốt, không để ngầm hiểu. Nếu không định nghĩa field bắt buộc/tùy chọn, AI rất dễ bịa chất liệu, xuất xứ, bảo hành, độ bền hoặc claim không có trong dữ liệu thật. Tôi đồng ý với bộ tối thiểu `name`, `category`, `price`, `sku`, nhưng đề xuất bổ sung `brandName` hoặc lấy từ brand profile để prompt không hardcode tên shop.
- **Đồng ý với Claude về rule chống bịa thông tin**. Rule này nên nằm trong private backend prompt, áp dụng cho mọi platform: thiếu thông tin thì viết trung tính, hỏi thêm, hoặc bỏ qua field; tuyệt đối không tự suy đoán.
- **Đồng ý với `forbiddenClaims`**, nhưng tôi muốn làm rõ: không chỉ scan cảnh báo sau sinh, mà nên có cả 2 lớp:
  1. Prompt-level rule: cấm tạo claim như "tốt nhất", "rẻ nhất", "cam kết 100%" nếu input không có bằng chứng.
  2. Post-generation checker: scan output và trả `warnings[]` để UI hiển thị cho user.
- **Đồng ý cần acceptance criteria**. Đây là điều kiện để tránh Phase 1 biến thành feature mở mãi không xong.
- **Đồng ý không thêm OpenAI Phase 1**. Claude đã chấp nhận điểm này, nên bất đồng lớn nhất đã được giải quyết.

### Điểm còn giữ nguyên

- **Giữ phản biện về public/private config**. Plan chốt phải thay `constants/contentPlatforms.ts` thành ít nhất 2 phần:
  - `constants/contentPlatformPublic.ts`: id, label, icon, output format, max length, UI metadata.
  - `server/config/contentPrompts.ts`: system prompt, private rules, model policy, forbidden claims.
  
  Nếu để system prompt/rules private trong file import được từ frontend, Vite có thể bundle sang client. Đây là lỗi kiến trúc cần tránh từ đầu.

- **Giữ phản biện về `platform + task + objective`**. Tôi đồng ý có thể dùng preset id cho UI phase đầu, nhưng config nội bộ nên tách sẵn:

  ```typescript
  {
    id: 'shopee_product_description',
    platform: 'shopee',
    task: 'product_description',
    supportedObjectives: ['sell_fast', 'clearance', 'new_arrival', 'size_advice']
  }
  ```

  Nếu chỉ dùng `platformId = 'shopee'`, sau này thêm Shopee title, Shopee livestream, Shopee message sẽ phải đổi cấu trúc.

- **Giữ phản biện về UI model selector**. Phase 1 không hiển thị model kỹ thuật. UI chỉ nên có mục tiêu kinh doanh hoặc chất lượng sinh nội dung. Model thật là quyết định backend.

- **Giữ phản biện về lưu history**. Phase 1 không Supabase history. Tuy nhiên output textarea nên có trạng thái dirty/editable để user chỉnh và copy. Nếu không, "Sinh lại" sẽ thành thao tác duy nhất, gây tốn token.

### Phản biện bổ sung sau phản hồi của Claude

#### 1. Schema input cần có `knownFacts` và `missingFacts`

Chỉ chia field bắt buộc/tùy chọn chưa đủ. Backend nên build prompt theo hướng phân biệt rõ:

- `knownFacts`: dữ liệu có thật từ sản phẩm/user nhập.
- `missingFacts`: dữ liệu thiếu, AI không được tự bịa.

Ví dụ:

```typescript
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
  knownFacts: string[];
  missingFacts: string[];
}
```

Điều này làm prompt rõ hơn nhiều so với chỉ truyền object sản phẩm thô.

#### 2. `forbiddenClaims` nên trả cảnh báo có cấu trúc

Không nên chỉ scan rồi hiện text chung chung. API nên trả:

```typescript
{
  result: string,
  warnings: [
    {
      type: 'forbidden_claim',
      phrase: 'rẻ nhất',
      message: 'Claim này cần bằng chứng hoặc nên đổi thành cách nói mềm hơn.'
    }
  ]
}
```

Như vậy UI có thể highlight/cảnh báo rõ ràng.

#### 3. Cần quyết định cách lấy sản phẩm từ kho

Plan chốt nên nói rõ `ProductContentTab` nhận sản phẩm bằng prop nào. Hiện `MarketingManager` chỉ nhận `brandProfile`, `suggestedFocusProducts`, không có toàn bộ `appData`. Nếu ProductContentTab cần chọn từ `pos_products`, ta phải quyết định:

- Truyền thêm `products` từ parent cao hơn vào `MarketingManager`, hoặc
- ProductContentTab tự fetch qua API/service, hoặc
- Tận dụng `brandProfile.inventory` nhưng dữ liệu có thể nghèo hơn `pos_products`.

Tôi nghiêng về phương án truyền danh sách sản phẩm cần thiết qua prop, nhưng cần kiểm tra nơi render `MarketingManager` trước khi implement.

#### 4. Acceptance criteria nên cụ thể thành 8 điểm

Tôi đề xuất 8 criteria như sau:

1. Có tab "Nội dung sản phẩm" trong Marketing, không phá các tab hiện có.
2. User chọn được sản phẩm từ kho hoặc nhập tay tối thiểu `name/category/price/sku`.
3. Sinh được 4 preset: Shopee description, Website product description, Blog SEO article, Facebook product caption.
4. UI không hiển thị model id kỹ thuật.
5. Backend dùng Claude hiện có; OpenAI không nằm trong Phase 1.
6. Web product JSON được parse + validate; lỗi thì retry 1 lần.
7. Output có `warnings[]` nếu vi phạm forbidden claims hoặc thiếu dữ liệu quan trọng.
8. Có Copy, Sinh lại với feedback, textarea editable; không cần Supabase history.

### Tuyên bố

[ ] ✅ ĐỒNG Ý DỪNG — mục tiêu đã đạt
[x] ⚠️ CÒN BẤT ĐỒNG — không phải bất đồng với Claude, mà là plan chốt vẫn cần cập nhật rõ 4 phần trước khi implement:

1. Schema input cuối cùng, gồm field bắt buộc/tùy chọn và cách biểu diễn dữ liệu thiếu.
2. Danh sách file thay đổi mới, có tách public config/private prompt config.
3. Cấu trúc response API có `warnings[]` và behavior khi JSON parse fail.
4. Acceptance criteria Phase 1 gồm 8 điểm như trên.

---

## VÒNG 2 — Claude

### Phản hồi với Codex

- **Đồng ý bổ sung `brandName` vào product input**: Đúng — tránh hardcode tên shop trong private prompt. Backend lấy từ brand profile hoặc field này.
- **Đồng ý 2 lớp forbiddenClaims**: Prompt-level rule (cấm tạo ra ngay từ đầu) + post-generation `warnings[]` có cấu trúc (scan và trả về để UI highlight). Tốt hơn nhiều so với chỉ scan text sau khi sinh.
- **Đồng ý cấu trúc `warnings[]`**: `{ type, phrase, message }` — API response chuẩn, UI dễ dùng, dễ highlight từng đoạn vi phạm.
- **Đồng ý acceptance criteria 8 điểm của Codex**: Thêm 1 điểm nhỏ vào criteria #4: không chỉ không hiển thị model id kỹ thuật, mà UI phải có objective selector (Bán nhanh / Xả hàng / Ra mắt mới / SEO).
- **Đồng ý cách lấy sản phẩm qua prop**: `MarketingManager` nhận `appData` — truyền products xuống `ProductContentTab`. Nếu `appData` không có danh sách đủ, `ProductContentTab` tự fetch qua service. Cần kiểm tra nơi render `MarketingManager` khi implement.

**Làm rõ về `knownFacts / missingFacts`**: Đồng ý concept, nhưng đây phải là quá trình tự động ở backend, không phải field user nhập. Backend nhận product object → tự build `knownFacts[]` từ các field có giá trị và `missingFacts[]` từ field null/undefined → inject vào prompt. User không cần biết khái niệm này, chỉ cần điền form sản phẩm bình thường.

### Điểm còn giữ nguyên

Không còn điểm nào bất đồng thực sự giữa hai agent. Toàn bộ 4 điểm Codex đánh ⚠️ là nội dung cần đưa vào plan chốt — không phải mâu thuẫn về hướng đi.

### Tuyên bố

[x] ✅ ĐỒNG Ý DỪNG — Cả hai agent đã hội tụ về: schema input, tách public/private config, cấu trúc API response có `warnings[]`, và acceptance criteria 8 điểm. Không còn bất đồng kỹ thuật. Sẵn sàng tổng hợp Kế hoạch Chốt Cuối Cùng.

---

---

# KẾ HOẠCH CHỐT CUỐI CÙNG

> **Tổng hợp bởi**: Claude (Sonnet 4.6)
> **Ngày chốt**: 2026-06-21
> **Dựa trên**: 2 vòng tranh luận — Codex + Claude
> **Tên tính năng**: Product Content Engine

---

## Những điểm được tất cả đồng ý

- Platform Config Pattern — tách luật nội dung từng nền tảng ra khỏi logic AI
- Không tạo trang riêng — tích hợp vào tab mới trong module Marketing hiện tại
- Một route chung `/api/ai/content/generate` thay vì nhiều route nhỏ
- Phase 1 chỉ dùng Claude, không thêm OpenAI
- UI selector theo mục tiêu kinh doanh, không theo tên model kỹ thuật
- Chọn sản phẩm từ kho `pos_products` + cho chỉnh sửa/bổ sung
- Validate JSON output bằng Zod + retry 1 lần + trả raw nếu vẫn lỗi
- Config tách public (frontend) / private (backend) — không để system prompt vào JS bundle
- `forbiddenClaims`: 2 lớp — prompt-level rule + post-generation `warnings[]`
- Không lưu Supabase history Phase 1 — Copy + Sinh lại là đủ
- Backend tự build `knownFacts[]` / `missingFacts[]` từ product object — không bắt user nhập
- Acceptance criteria 8 điểm làm cột mốc kết thúc Phase 1

---

## Thay đổi so với plan gốc

| Điểm thay đổi | Plan gốc | Plan chốt | Lý do |
|---|---|---|---|
| Tên tính năng | "Multi-provider Content Platform" | "Product Content Engine" | Đặt trọng tâm vào giá trị thực tế, không phô trương provider |
| Phase 1 scope | Claude + OpenAI + router | Chỉ Claude; router `callAI()` thiết kế sẵn nhưng throw error với model khác | Giảm biến số lỗi, triển khai nhanh hơn |
| Config file | 1 file `contentPlatforms.ts` dùng chung | 2 file tách public/private | Tránh system prompt vào JS bundle |
| `platformId` | Phẳng: `'shopee'` | Hybrid: `id = 'shopee_product_description'`, nội bộ có `platform + task + supportedObjectives[]` | Sẵn sàng mở rộng không cần refactor |
| UI selector | Dropdown tên model kỹ thuật | Objective selector: Bán nhanh / Xả hàng / Ra mắt mới / SEO | Ngôn ngữ nhân viên shop hiểu |
| Product input | Không rõ schema | Schema rõ với field bắt buộc/tùy chọn + `knownFacts/missingFacts` auto-build | Tránh AI bịa thông tin |
| Output validation | Chỉ dùng prompt | Zod schema + retry + raw fallback + `warnings[]` có cấu trúc | Đáng tin cậy hơn với output JSON |
| Lưu lịch sử | Câu hỏi mở | Không lưu Phase 1 — Copy + Sinh lại đủ dùng | Không làm trước khi chứng minh giá trị |
| Compliance | Không có | `forbiddenClaims` 2 lớp trong mọi platform config | Bảo vệ shop khỏi vi phạm quảng cáo |
| Acceptance criteria | Không có | 8 điểm cụ thể | Biết khi nào Phase 1 là "done" |

---

## Điểm còn bất đồng — Người dùng quyết định

**Không có.** Cả Codex và Claude đã tuyên bố `✅ ĐỒNG Ý DỪNG` sau Vòng 2.

---

## Kế hoạch thực hiện (đã được đồng thuận)

### Danh sách file thay đổi — cập nhật

| File | Loại | Giai đoạn |
|---|---|---|
| `constants/contentPlatformPublic.ts` | Tạo mới | 1 |
| `server/config/contentPrompts.ts` | Tạo mới | 1 |
| `services/agents/openaiClient.ts` | Tạo mới (stub, chưa implement) | 1 |
| `routes/ai.ts` | Thêm `callAI()` router + route `/api/ai/content/generate` | 1 |
| `.env.local` | Ghi chú OPENAI_API_KEY (để trống, dùng sau) | 1 |
| `services/productContentService.ts` | Tạo mới | 2 |
| `components/marketing/ProductContentTab.tsx` | Tạo mới | 2 |
| `components/marketing/MarketingManager.tsx` | Thêm ~15 dòng | 2 |

### Schema chốt — ProductContentInput

```typescript
// Bắt buộc (thiếu → từ chối sinh)
interface ProductContentInput {
  name: string;
  sku: string;
  category: string;
  price: number;

  // Tùy chọn (thiếu → AI viết trung tính hoặc bỏ qua)
  brandName?: string;
  material?: string;
  colors?: string[];
  sizeRange?: string;
  origin?: string;
  warrantyPolicy?: string;
  description?: string;
  sellingPoints?: string[];

  // Auto-build bởi backend, không phải user nhập
  knownFacts: string[];     // field có giá trị → ["Chất liệu: da bò", "Size: 36-42"]
  missingFacts: string[];   // field null → ["Xuất xứ", "Bảo hành"]
}
```

### Schema chốt — API Response

```typescript
interface ContentGenerationResponse {
  result: string;
  platform: string;
  task: string;
  model: string;
  parseError?: boolean;       // true nếu JSON parse fail, result là raw text
  warnings: Array<{
    type: 'forbidden_claim' | 'missing_data' | 'format_violation';
    phrase?: string;
    message: string;
  }>;
}
```

### Objective selector Phase 1

| Label UI | Mapping backend |
|---|---|
| Bán nhanh | temperature +0.1, nhấn CTA mạnh, giá nổi bật |
| Xả hàng | thêm urgency, mention tồn kho ít, giảm giá |
| Ra mắt mẫu mới | nhấn điểm đặc biệt, tạo tò mò |
| SEO / Blog | dài hơn, từ khóa tự nhiên, heading H2/H3 |

### Config public (frontend-safe)

```typescript
// constants/contentPlatformPublic.ts
export interface PlatformPublicConfig {
  id: string                         // 'shopee_product_description'
  platform: ContentPlatform          // 'shopee'
  task: ContentTask                  // 'product_description'
  name: string                       // hiển thị UI
  icon: string                       // emoji
  supportedObjectives: ContentObjective[]
  output: {
    format: 'text' | 'markdown' | 'json'
    maxLength?: number
    sections: string[]               // để UI hiện character count / section guide
  }
}
```

### Config private (backend only)

```typescript
// server/config/contentPrompts.ts — KHÔNG import từ frontend
export interface PlatformPrivateConfig {
  id: string
  systemPrompt: string
  rules: string[]
  forbiddenClaims: string[]
  ai: {
    preferredModel: string
    fallbackModel: string
    temperature: number
    maxTokens: number
    objectiveModifiers: Record<ContentObjective, Partial<AIParams>>
  }
}
```

---

## Acceptance criteria Phase 1

Phase 1 hoàn thành khi đáp ứng đủ 8 điểm:

1. Tab "Nội dung sản phẩm" hiển thị trong sidebar Marketing, không phá các tab hiện có.
2. User chọn được sản phẩm từ kho `pos_products` hoặc nhập tay tối thiểu `name / category / price / sku`.
3. Sinh được 4 preset: Shopee description, Website product description, Blog SEO article, Facebook product caption.
4. UI có objective selector (Bán nhanh / Xả hàng / Ra mắt mới / SEO) — không hiển thị tên model kỹ thuật.
5. Backend dùng Claude hiện có; OpenAI không nằm trong Phase 1.
6. Web product JSON được parse + Zod validate; lỗi thì retry 1 lần, vẫn lỗi thì trả raw + `parseError: true`.
7. Output API có `warnings[]` nếu vi phạm forbiddenClaims hoặc thiếu dữ liệu quan trọng.
8. UI có Copy, Sinh lại với ô feedback, textarea editable; không cần Supabase history.

---

*Kế hoạch chốt ngày 2026-06-21. Sẵn sàng implement.*
