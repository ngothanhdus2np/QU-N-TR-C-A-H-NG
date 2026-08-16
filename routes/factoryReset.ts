import { Router, RequestHandler, Request } from 'express';
import { SupabaseClient } from '@supabase/supabase-js';

// [FIX] Lỗi PostgrestError từ supabase.rpc()/query không phải instance Error chuẩn —
// nhánh cũ chỉ bắt `instanceof Error` nên mất hết message thật, rơi về "Unknown error".
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
  return 'Unknown error';
};

// Bảng nằm trong danh sách nhưng không tồn tại ở DB hiện tại (vd migration chưa chạy, hoặc
// cửa hàng khác dùng bản schema rút gọn hơn) — coi như đã "sạch", không chặn cả quá trình.
const isMissingTableError = (message: string | undefined): boolean =>
  !!message && message.includes('Could not find the table');

// Toàn bộ bảng dữ liệu nghiệp vụ dùng khóa chính `id` — xóa sạch khi "trắng hóa" để bàn giao
// app cho 1 cửa hàng khác hoàn toàn. Gồm cả 4 domain ở Migration tab (không phụ thuộc user
// đã tick checkbox ở đó hay chưa) + nhân sự/lương + chi phí + bán online/Shopee + thuế/VAT + khác.
// KHÔNG gồm: categories/system_configs/store_settings/store_product_collections (khóa chính
// khác `id` — store_product_collections dùng khóa kép store_product_id+collection_id, xóa riêng
// bên dưới cùng nhóm với categories/system_configs/store_settings),
// brand_profile (reset về mặc định, không xóa hẳn record), audit_logs (xóa riêng cuối cùng).
//
// Chia theo batch xóa tuần tự (không dùng 1 Promise.all duy nhất cho tất cả) vì nhiều bảng có
// ràng buộc khóa ngoại chéo nhau (vd shopee_product_variants → pos_products) — xóa song song
// toàn bộ có thể trúng lỗi FK constraint tùy thứ tự Postgres xử lý. Thứ tự batch lấy từ
// information_schema.table_constraints trên DB thật (xem PR mô tả), batch sau chỉ chạy khi
// mọi bảng mà nó phụ thuộc đã nằm ở batch trước.
const FACTORY_RESET_BATCHES: string[][] = [
  [
    // Batch 1 — không bị bảng nào khác trong danh sách này tham chiếu tới trước
    'inventory_transactions', 'product_cost_history', 'revenue_records', 'product_group_revenue',
    'supplier_debts', 'customer_debt_history',
    'salary_policies', 'attendance_records', 'overtime_records', 'sales_records',
    'shortage_records', 'advance_records', 'payroll_records', 'staff_performance',
    'expense_records', 'recurring_expenses',
    'store_product_variants', 'store_order_addresses',
    'store_preorder_requests', 'store_contacts', 'newsletter_subscribers', 'store_media_assets',
    'shipments', 'shopee_product_variants',
    'shopee_ads_daily_spend', 'shopee_ads_wallet_transactions',
    'shopee_inventory_in', 'shopee_inventory_out', 'shopee_source_data',
    'shopee_revenue_records', 'shopee_product_group_revenue',
    'price_books', 'price_book_items', 'promotions', 'knowledge_base', 'invoice_attachments',
    'vat_allocation_events', 'sku_vat_group_mapping', 'vat_group_keywords',
  ],
  [
    // Batch 2 — phụ thuộc bảng ở batch 1 (vd pos_products phụ thuộc shopee_product_variants)
    'pos_products', 'pos_orders', 'product_groups', 'suppliers', 'pos_customers', 'employees',
    'store_products', 'store_collections', 'shopee_products', 'vat_allocations',
  ],
  [
    // Batch 3 — phụ thuộc bảng ở batch 2
    'shopee_shops', 'opening_stock_items', 'vat_document_items',
  ],
  [
    // Batch 4 — phụ thuộc bảng ở batch 3
    'tax_filing_periods', 'vat_groups', 'vat_documents',
  ],
];

// [FIX BẢO MẬT 2026-08-16] requireAuth chỉ xác nhận "đã đăng nhập", không phân biệt vai trò —
// mọi nhân viên (kể cả thu ngân) đều gọi được endpoint xoá sạch dữ liệu này qua API trực tiếp,
// bỏ qua hoàn toàn ô xác nhận gõ tên cửa hàng ở frontend (chỉ là UI, không chặn được ai gọi
// thẳng fetch/curl). Thêm kiểm tra vai trò owner ở server, cùng pattern đã dùng cho
// /api/data/audit-logs — không tin frontend cho một thao tác không thể hoàn tác.
async function requireOwner(supabase: SupabaseClient, req: Request): Promise<string | null> {
  const authHeader = req.headers.authorization;
  const jwt = authHeader?.startsWith('Bearer ') ? authHeader.slice(7) : null;
  if (!jwt) return null; // Dev/LAN local không kèm JWT → coi như owner, khớp pattern audit-logs
  const { data: { user }, error } = await supabase.auth.getUser(jwt);
  if (error || !user) return 'Phiên đăng nhập không hợp lệ';
  const role = String(user.user_metadata?.role ?? 'cashier').toLowerCase();
  if (role !== 'owner') return 'Chỉ chủ cửa hàng mới được thực hiện thao tác trắng hóa hệ thống.';
  return null;
}

export function createFactoryResetRouter(supabase: SupabaseClient, requireAuth: RequestHandler): Router {
  const router = Router();

  // Xóa TOÀN BỘ dữ liệu nghiệp vụ + cấu hình + tài khoản đăng nhập — đưa app về trạng thái
  // trắng tinh để bàn giao cho 1 cửa hàng khác. KHÔNG hoàn tác được, không backup tự động —
  // frontend bắt buộc gõ đúng tên cửa hàng để xác nhận trước khi gọi endpoint này, VÀ server
  // chỉ cho phép chủ cửa hàng (owner) thực hiện.
  router.delete('/api/admin/factory-reset', requireAuth, async (req, res) => {
    const ownerError = await requireOwner(supabase, req);
    if (ownerError) return res.status(403).json({ error: ownerError });

    try {
      // store_product_collections dùng khóa kép (store_product_id+collection_id), và bị
      // store_collections/store_products (batch 2) phụ thuộc — phải xóa trước khi batch 1 khác
      // chạy xong, nên không lồng được vào FACTORY_RESET_BATCHES (chỉ nhận filter theo `id`).
      const spcResult = await supabase.from('store_product_collections').delete().not('store_product_id', 'is', null);

      const idTableResults = [spcResult];
      for (const batch of FACTORY_RESET_BATCHES) {
        const batchResults = await Promise.all(
          batch.map(table => supabase.from(table).delete().not('id', 'is', null))
        );
        idTableResults.push(...batchResults);
      }
      const keyTableResults = await Promise.all([
        supabase.from('categories').delete().not('path', 'is', null),
        supabase.from('system_configs').delete().not('key', 'is', null),
        supabase.from('store_settings').delete().not('key', 'is', null),
      ]);

      const { error: brandErr } = await supabase.from('brand_profile').upsert({
        id: '00000000-0000-0000-0000-000000000000',
        name: null,
        story: '',
        voice: '',
        target_audience: '',
        competitive_advantage: '',
        logo: null,
        inventory: [],
        phone: null,
        address: null,
        hashtags: null,
      });

      const { error: auditErr } = await supabase.from('audit_logs').delete().not('id', 'is', null);

      const { data: userList, error: listErr } = await supabase.auth.admin.listUsers({ perPage: 1000 });
      let authErr: string | null = listErr?.message ?? null;
      let accountsDeleted = 0;
      if (!listErr) {
        for (const u of userList.users) {
          const { error } = await supabase.auth.admin.deleteUser(u.id);
          if (error && !authErr) authErr = error.message;
          else if (!error) accountsDeleted += 1;
        }
      }

      const firstErr =
        idTableResults.find(r => r.error && !isMissingTableError(r.error.message))?.error?.message ??
        keyTableResults.find(r => r.error && !isMissingTableError(r.error.message))?.error?.message ??
        (brandErr && !isMissingTableError(brandErr.message) ? brandErr.message : null) ??
        (auditErr && !isMissingTableError(auditErr.message) ? auditErr.message : null) ??
        (authErr && !isMissingTableError(authErr) ? authErr : null) ??
        null;
      if (firstErr) throw new Error(firstErr);

      res.json({
        success: true,
        tablesCleared: idTableResults.length + 3,
        accountsDeleted,
      });
    } catch (error: unknown) {
      res.status(500).json({ error: getErrorMessage(error) });
    }
  });

  return router;
}
