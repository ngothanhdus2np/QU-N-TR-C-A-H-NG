# IMPROVEMENT CHECKLIST — Danh sách cải thiện CFO Brain 4.0

> **Mục đích**: File này tổng hợp tất cả các điểm cần cải thiện được phát hiện qua đánh giá toàn diện app (2026-05-17).
> **Cách dùng**: Review với các agent khác, tick ✅ khi hoàn thành, ghi note nếu reject.

**Ngày tạo**: 2026-05-17  
**Người đánh giá**: Claude Sonnet 4.5  
**Phạm vi**: Toàn bộ codebase (260 files TypeScript/React)

---

## 🔴 P0 — CRITICAL (Phải sửa ngay)

### 1. Multi-agent AI System không hoạt động

**Vấn đề**:
- Test endpoint `/api/ai/test-connection` trả về: `{"ok":false,"error":"Claude API không phản hồi"}`
- File `.env.local` có `ANTHROPIC_API_KEY=` (trống)
- Code đã implement đầy đủ 6 agents + orchestrator + 9 tools, nhưng không chạy được

**Nguyên nhân**:
```env
# .env.local dòng 18
ANTHROPIC_API_KEY=    # ← TRỐNG!
```

**Cách sửa**:
1. Truy cập https://console.anthropic.com/
2. Tạo API key mới (dạng `sk-ant-api03-...`)
3. Thêm vào `.env.local`:
   ```env
   ANTHROPIC_API_KEY=sk-ant-api03-xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx
   ```
4. Restart server: `npm run dev`
5. Test lại: `curl http://localhost:3000/api/ai/test-connection`

**Impact**: 🔴 HIGH — Tính năng AI (điểm khác biệt chính so với KiotViet) hoàn toàn không hoạt động

**Ước tính thời gian**: 5 phút

**Status**: [ ] Chưa làm

---

### 2. File `.env.local` không nên commit vào Git

**Vấn đề**:
- File `.env.local` chứa secrets (Supabase keys, session secret, internal API key)
- File này đang có trong repo (có thể bị push lên GitHub)
- `.gitignore` có `*.local` nhưng file đã được track trước đó

**Rủi ro**:
- Supabase service role key bị lộ → attacker có thể bypass RLS
- Session secret bị lộ → attacker có thể forge session cookies
- Internal API key bị lộ → attacker có thể gọi mutation endpoints

**Cách sửa**:
```bash
# 1. Xóa file khỏi Git tracking (giữ file local)
git rm --cached .env.local

# 2. Verify .gitignore có dòng này
echo "*.local" >> .gitignore

# 3. Commit
git add .gitignore
git commit -m "security: remove .env.local from git tracking"

# 4. Rotate tất cả secrets trên Supabase dashboard
# 5. Generate session secret mới: openssl rand -hex 32
# 6. Generate internal API key mới: openssl rand -hex 32
```

**Impact**: 🔴 HIGH — Security vulnerability

**Ước tính thời gian**: 15 phút

**Status**: [ ] Chưa làm

---

### 3. Dead files cần xóa

**Vấn đề**:
- `components/KnowledgeManager.tsx.bak8`
- `components/KnowledgeManager.tsx.bak9`
- Các file backup này không được import, gây confusion

**Cách sửa**:
```bash
rm components/KnowledgeManager.tsx.bak8
rm components/KnowledgeManager.tsx.bak9
git add -u
git commit -m "chore: remove backup files"
```

**Impact**: 🟡 LOW — Code cleanliness

**Ước tính thời gian**: 2 phút

**Status**: [ ] Chưa làm

---

## 🟠 P1 — HIGH PRIORITY (Làm trong 1-2 tuần)

### 4. 14 navigation items chưa implement

**Vấn đề**: Các trang này render blank khi click vào

**Danh sách**:

#### Hàng hóa (5 items):
- [ ] `goods-pricing` — Bảng giá
- [ ] `goods-warranty` — Bảo hành
- [ ] `goods-audit` — Kiểm kê (có form nhưng chưa có trang riêng)
- [ ] `goods-internal-use` — Xuất nội bộ
- [ ] `goods-disposal` — Thanh lý

#### Mua hàng (2 items):
- [ ] `purchase-invoices` — Hóa đơn đầu vào (QUAN TRỌNG cho kế toán VAT)
- [ ] `purchase-returns` — Trả hàng nhập

#### Đơn hàng (7 items):
- [ ] `order-invoices` — Hóa đơn đầu ra
- [ ] `order-returns` — Trả hàng bán
- [ ] `order-repairs` — Sửa chữa/Bảo hành
- [ ] `delivery-partners` — Đối tác vận chuyển
- [ ] `shipping-orders` — Đơn giao hàng

**Ưu tiên cao nhất**:
1. `purchase-invoices` — Cần cho kế toán thuế VAT
2. `order-invoices` — Cần cho xuất hóa đơn cho khách
3. `goods-audit` — Cần cho kiểm kê định kỳ

**Impact**: 🟠 MEDIUM-HIGH — User experience, tính năng thiếu

**Ước tính thời gian**: 
- Mỗi trang đơn giản: 2-4 giờ
- Mỗi trang phức tạp (invoices): 6-8 giờ
- Tổng: ~40-60 giờ

**Status**: [ ] Chưa làm

**Note**: Có thể làm từng trang theo độ ưu tiên, không cần làm hết cùng lúc

---

### 5. God components vẫn còn

**Vấn đề**: Một số file vẫn quá lớn, khó maintain

#### `SettingsCenter.tsx` — 1,157 dòng
- **Đã tách**: 4/4 tabs (PrintTemplatesTab, PaymentsTab, AppearanceTab, GoodsTab)
- **Đã giảm**: 60.4% (từ 2,922 → 1,157 dòng)
- **Vẫn còn**: 1,157 dòng vẫn lớn
- **Đề xuất**: Tách thêm các sections trong mỗi tab thành sub-components
- **Status**: [ ] Cần tách thêm

#### `types.ts` — 925 dòng
- **Vấn đề**: Tất cả types trong 1 file, khó tìm
- **Đề xuất**: Tách theo domain:
  ```
  types/
    pos.types.ts        — POS, orders, customers
    inventory.types.ts  — Products, stock, suppliers
    payroll.types.ts    — Staff, salary, attendance
    finance.types.ts    — Revenue, expenses, ledgers
    marketing.types.ts  — Promotions, content, strategies
    shared.types.ts     — Common types (DiagnosisRange, etc.)
    index.ts            — Re-export all
  ```
- **Impact**: Code organization, developer experience
- **Ước tính**: 3-4 giờ
- **Status**: [ ] Chưa làm

#### `services/apiService.ts` — 755 dòng
- **Vấn đề**: Tất cả Supabase CRUD trong 1 file
- **Đề xuất**: Tách theo module:
  ```
  services/
    api/
      posApi.ts         — POS orders, customers
      inventoryApi.ts   — Products, stock
      payrollApi.ts     — Staff, salary
      financeApi.ts     — Revenue, expenses
      marketingApi.ts   — Promotions, content
      index.ts          — Re-export all
  ```
- **Impact**: Code organization, easier testing
- **Ước tính**: 4-5 giờ
- **Status**: [ ] Chưa làm

**Impact**: 🟠 MEDIUM — Code maintainability

**Ước tính thời gian tổng**: 8-10 giờ

---

### 6. Performance concerns

#### 6.1. Virtualization cho 12,739+ SKU

**Trạng thái hiện tại**:
- ✅ Đã implement `@tanstack/react-virtual` trong `GoodsVirtualizedTable.tsx`
- ⚠️ Chưa test trên thiết bị thật

**Cần làm**:
- [ ] Test trên iPad/tablet thật với 12,739 SKU
- [ ] Đo FPS khi scroll (target: 60 FPS)
- [ ] Đo memory usage (target: < 500MB)
- [ ] Test search performance (target: < 100ms)

**Tools**:
```javascript
// Thêm vào GoodsInventory.tsx
useEffect(() => {
  const fps = new FPSMeter();
  return () => fps.destroy();
}, []);
```

**Impact**: 🟠 MEDIUM — User experience trên thiết bị thật

**Ước tính thời gian**: 2-3 giờ testing

**Status**: [ ] Chưa test

---

#### 6.2. Polling có thể tốn battery

**Vấn đề**:
- Alerts poll mỗi 10 phút: `setInterval(fetchAlerts, 10 * 60 * 1000)`
- Sync check mỗi lần user thao tác
- Trên mobile PWA, polling liên tục tốn battery

**Đề xuất**:
1. **Ngắn hạn**: Tăng interval lên 15-30 phút
2. **Dài hạn**: Dùng Supabase Realtime thay polling
   ```typescript
   // Thay vì polling
   const channel = supabase
     .channel('alerts')
     .on('postgres_changes', 
       { event: '*', schema: 'public', table: 'alerts' },
       payload => setAlerts(prev => [...prev, payload.new])
     )
     .subscribe();
   ```

**Impact**: 🟡 LOW-MEDIUM — Battery life trên mobile

**Ước tính thời gian**: 
- Tăng interval: 5 phút
- Implement Realtime: 4-6 giờ

**Status**: [ ] Chưa làm

---

#### 6.3. Bundle size chưa optimize

**Vấn đề**:
- Project size: 374MB (bao gồm node_modules)
- Chưa check production bundle size
- Chưa có code splitting

**Cần làm**:
```bash
# 1. Build production
npm run build

# 2. Analyze bundle
npx vite-bundle-visualizer

# 3. Check size
du -sh dist/

# Target: < 2MB gzipped
```

**Đề xuất optimize**:
- Lazy load các trang ít dùng
- Code splitting theo route
- Tree shaking unused icons từ `lucide-react`

**Impact**: 🟡 LOW-MEDIUM — Load time, bandwidth

**Ước tính thời gian**: 3-4 giờ

**Status**: [ ] Chưa làm

---

### 7. Security improvements

#### 7.1. Rate limiting có thể quá thấp

**Hiện tại**:
```typescript
// routes/ai.ts
const RL_STANDARD = 10;  // 10 req/phút
const RL_STRICT = 5;     // 5 req/phút
```

**Vấn đề**:
- POS busy hours: cashier có thể cần > 10 AI queries/phút
- Marketing content generation: 5 req/phút có thể không đủ

**Đề xuất**:
```typescript
const RL_STANDARD = 20;  // Tăng lên 20
const RL_STRICT = 10;    // Tăng lên 10

// Hoặc dùng sliding window thay vì fixed window
```

**Impact**: 🟡 LOW — User experience trong busy hours

**Ước tính thời gian**: 30 phút

**Status**: [ ] Chưa làm

---

#### 7.2. Tool execution nên move về backend

**Vấn đề hiện tại**:
```typescript
// components/ChatInterface.tsx
const callTool = async (name: string, input: any) => {
  // Tools được execute ở frontend
  switch (name) {
    case 'get_metadata':
      return { staff: data.staff, ... };
    // ...
  }
};
```

**Rủi ro**:
- Business logic exposed ở frontend
- Không thể cache tool results
- Khó monitor và debug
- Client có thể manipulate tool inputs

**Đề xuất**:
```typescript
// routes/ai.ts
router.post('/api/ai/execute-tool', requireAuth, async (req, res) => {
  const { toolName, toolInput } = req.body;
  const result = await executeTool(toolName, toolInput, req.supabase);
  res.json({ result });
});

// services/agents/toolExecutor.ts
export async function executeTool(name: string, input: any, supabase: SupabaseClient) {
  switch (name) {
    case 'get_metadata':
      const { data: staff } = await supabase.from('staff').select('*');
      return { staff, ... };
    // ...
  }
}
```

**Lợi ích**:
- ✅ Bảo mật hơn
- ✅ Có thể cache results
- ✅ Dễ monitor (log tool calls)
- ✅ Có thể rate limit per tool

**Impact**: 🟠 MEDIUM — Security, architecture

**Ước tính thời gian**: 6-8 giờ

**Status**: [ ] Chưa làm

---

#### 7.3. Input validation cho AI endpoints

**Vấn đề**:
```typescript
// routes/ai.ts
router.post('/api/ai/chat', async (req, res) => {
  const { messages, domain } = req.body;
  if (!messages) return res.status(400).json({ error: 'messages là bắt buộc' });
  // Không validate structure của messages
});
```

**Rủi ro**:
- Malformed messages có thể crash server
- Injection attacks qua messages content

**Đề xuất**:
```typescript
import { z } from 'zod';

const ChatRequestSchema = z.object({
  messages: z.array(z.object({
    role: z.enum(['user', 'assistant']),
    content: z.string().max(10000), // Limit length
  })).max(20), // Limit history
  domain: z.enum(['finance', 'hr', 'sales', 'inventory', 'marketing', 'operations']).optional(),
});

router.post('/api/ai/chat', async (req, res) => {
  const parsed = ChatRequestSchema.safeParse(req.body);
  if (!parsed.success) {
    return res.status(400).json({ error: 'Invalid request', details: parsed.error });
  }
  // ...
});
```

**Impact**: 🟡 LOW-MEDIUM — Security, stability

**Ước tính thời gian**: 2-3 giờ

**Status**: [ ] Chưa làm

---

## 🔵 P2 — MEDIUM PRIORITY (Làm trong 1-2 tháng)

### 8. Mobile optimization

**Vấn đề**: App chưa được test kỹ trên mobile devices

**Cần làm**:
- [ ] Test PWA trên iOS Safari
- [ ] Test PWA trên Android Chrome
- [ ] Verify touch targets >= 44x44px (WCAG guideline)
- [ ] Test keyboard behavior trên mobile
- [ ] Test offline mode trên mobile
- [ ] Optimize font sizes cho mobile (hiện tại optimize cho desktop)

**Tools**:
```bash
# Test trên simulator
npx playwright test --project=mobile-safari
npx playwright test --project=mobile-chrome

# Hoặc dùng Chrome DevTools Device Mode
```

**Impact**: 🔵 MEDIUM — Mobile user experience

**Ước tính thời gian**: 8-10 giờ

**Status**: [ ] Chưa làm

---

### 9. Internationalization (i18n)

**Vấn đề**: Tất cả text hardcoded bằng Tiếng Việt

**Khi nào cần**:
- Nếu có expat customers (người nước ngoài)
- Nếu muốn mở rộng ra nước ngoài
- Nếu có nhân viên không biết Tiếng Việt

**Đề xuất**:
```typescript
// i18n/vi.json
{
  "pos.checkout.total": "Tổng cộng",
  "pos.checkout.cash": "Tiền mặt",
  "pos.checkout.change": "Tiền thừa"
}

// i18n/en.json
{
  "pos.checkout.total": "Total",
  "pos.checkout.cash": "Cash",
  "pos.checkout.change": "Change"
}

// Usage
import { useTranslation } from 'react-i18next';
const { t } = useTranslation();
<span>{t('pos.checkout.total')}</span>
```

**Impact**: 🔵 LOW — Chỉ cần nếu có yêu cầu đa ngôn ngữ

**Ước tính thời gian**: 20-30 giờ (translate ~1000 strings)

**Status**: [ ] Không cần thiết hiện tại

---

### 10. Advanced analytics

**Đề xuất tính năng mới**:

#### 10.1. Predictive inventory
- Dự đoán sản phẩm nào sẽ hết hàng trong 7-14 ngày
- Dựa trên: lịch sử bán, seasonality, promotions
- Algorithm: Linear regression hoặc Prophet

#### 10.2. Customer segmentation
- RFM analysis (Recency, Frequency, Monetary)
- Phân khách thành: VIP, Regular, At-risk, Lost
- Đề xuất chiến lược retention cho từng segment

#### 10.3. Product recommendation
- "Khách mua A thường mua thêm B"
- Collaborative filtering
- Hiển thị trong POS khi add to cart

**Impact**: 🔵 LOW — Nice to have, không urgent

**Ước tính thời gian**: 40-60 giờ

**Status**: [ ] Backlog

---

## 🟣 P3 — LOW PRIORITY (Làm khi rảnh / Phase tiếp theo)

### 11. Multi-tenant / Multi-branch

**Hiện tại**: Single tenant (1 cửa hàng)

**Khi nào cần**: Khi mở chi nhánh thứ 2

**Cần làm**:
- [ ] Thêm `branch_id` vào tất cả tables
- [ ] RLS policies filter theo `branch_id`
- [ ] UI chọn chi nhánh
- [ ] Báo cáo tổng hợp đa chi nhánh
- [ ] Chuyển hàng giữa các chi nhánh

**Impact**: 🟣 LOW — Chỉ cần khi scale

**Ước tính thời gian**: 60-80 giờ

**Status**: [ ] Chưa cần

---

### 12. Third-party integrations

#### 12.1. TikTok Shop / Lazada
- Sync orders tự động
- Sync inventory 2-way
- Tương tự như Shopee integration hiện tại

#### 12.2. GHN / GHTK shipping
- Tạo vận đơn tự động
- Track shipping status
- Print shipping labels

#### 12.3. Momo / ZaloPay payment
- QR code payment trong POS
- Auto-reconciliation

**Impact**: 🟣 LOW — Nice to have

**Ước tính thời gian**: 40-60 giờ mỗi integration

**Status**: [ ] Backlog

---

### 13. Real-time sync

**Hiện tại**: Polling + manual sync

**Đề xuất**: Supabase Realtime

**Lợi ích**:
- Nhiều cashier thấy orders realtime
- Inventory updates realtime
- Không tốn battery (WebSocket)

**Cách implement**:
```typescript
// hooks/useRealtimeSync.ts
const channel = supabase
  .channel('pos_orders')
  .on('postgres_changes', 
    { event: 'INSERT', schema: 'public', table: 'pos_orders' },
    payload => {
      // Update local state
      setOrders(prev => [...prev, payload.new]);
    }
  )
  .subscribe();
```

**Impact**: 🟣 LOW — Nice to have, hiện tại polling đủ dùng

**Ước tính thời gian**: 8-10 giờ

**Status**: [ ] Backlog

---

## 📊 TỔNG KẾT

### Thống kê theo mức độ ưu tiên:

| Priority | Items | Ước tính thời gian | Impact |
|----------|-------|-------------------|--------|
| 🔴 P0 (Critical) | 3 items | ~30 phút | HIGH |
| 🟠 P1 (High) | 7 items | ~80-100 giờ | MEDIUM-HIGH |
| 🔵 P2 (Medium) | 3 items | ~70-100 giờ | MEDIUM |
| 🟣 P3 (Low) | 3 items | ~150-200 giờ | LOW |

### Đề xuất roadmap:

#### Sprint 1 (Tuần 1):
- ✅ Fix P0 items (30 phút)
- ✅ Implement 3 trang ưu tiên cao: purchase-invoices, order-invoices, goods-audit (20-24 giờ)

#### Sprint 2-3 (Tuần 2-3):
- ✅ Implement 11 trang còn lại (40-50 giờ)
- ✅ Tách types.ts và apiService.ts (8-10 giờ)

#### Sprint 4 (Tuần 4):
- ✅ Performance testing và optimization (10-15 giờ)
- ✅ Security improvements (10-15 giờ)

#### Phase 2 (Tháng 2):
- Mobile optimization
- Advanced analytics (nếu cần)

#### Phase 3 (Tháng 3+):
- Multi-branch (nếu cần)
- Third-party integrations (nếu cần)

---

## 📝 CÁCH SỬ DỤNG FILE NÀY

### Cho Product Owner / Manager:
1. Review từng item, quyết định có làm không
2. Điều chỉnh priority nếu cần
3. Assign cho agent phù hợp

### Cho Developer / Agent:
1. Pick item theo priority
2. Đọc kỹ phần "Cách sửa"
3. Implement và test
4. Tick ✅ vào checkbox
5. Commit với message reference item number

### Cho QA / Reviewer:
1. Verify từng item đã được fix đúng
2. Test regression
3. Sign off

---

## 🔄 CẬP NHẬT

**Lần cập nhật gần nhất**: 2026-05-17  
**Người cập nhật**: Claude Sonnet 4.5  
**Số items hoàn thành**: 0/16  
**Progress**: 0%

---

## 📌 GHI CHÚ

- File này là **living document** — cập nhật liên tục khi phát hiện issue mới
- Mỗi item nên có **acceptance criteria** rõ ràng
- Ước tính thời gian là **ballpark** — có thể sai lệch ±30%
- Priority có thể thay đổi theo business needs

---

**END OF CHECKLIST**
