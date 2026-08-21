import { Router, RequestHandler, Request } from 'express';
import { SupabaseClient } from '@supabase/supabase-js';
import { buildCostHistoryBySku, findHistoricalCostBySku } from '../src/lib/costHistoryLookup';

type Actor = { id: string; name: string; role: string };

const KNOWLEDGE_FILES_BUCKET = 'knowledge-files';

const TABLE_MAP: Record<string, string> = {
  employees: 'employees',
  salaryPolicies: 'salary_policies',
  revenue: 'revenue_records',
  expenses: 'expense_records',
  attendance: 'attendance_records',
  overtime: 'overtime_records',
  sales: 'sales_records',
  shortages: 'shortage_records',
  advances: 'advance_records',
  payroll: 'payroll_records',
  staffPerformance: 'staff_performance',
  knowledgeBase: 'knowledge_base',
  productGroups: 'product_groups',
  productGroupRevenue: 'product_group_revenue',
  promotions: 'promotions',
  brandProfile: 'brand_profile',
  shopeeRevenue: 'shopee_revenue_records',
  shopeeProductGroupRevenue: 'shopee_product_group_revenue',
  shopeeSourceData: 'shopee_source_data',
  shopeeInventoryIn: 'shopee_inventory_in',
  shopeeInventoryOut: 'shopee_inventory_out',
  posProducts: 'pos_products',
  posOrders: 'pos_orders',
  posCustomers: 'pos_customers',
  inventoryTransactions: 'inventory_transactions',
  suppliers: 'suppliers',
  supplierDebts: 'supplier_debts',
  customerDebtHistory: 'customer_debt_history',
};

const AUDITED_TABLES = new Set([
  'payroll_records',
  'expense_records',
  'revenue_records',
  'advance_records',
  'shortage_records',
  'salary_policies',
  'inventory_transactions',
  'suppliers',
  'pos_products',
]);

const CONFIG_KEYS = new Set([
  'violation_types',
  'violation_occurrences',
  'custom_penalties',
  'holidays',
  'responsibility_approvals',
  'tet_campaign',
  'expense_categories',
  'shopee_costs',
  'daily_ads_config',
  'daily_break_even_config',
  'pos_payment_settings',
  'pos_inventory_settings',
]);

// [FIX] Lỗi từ supabase.rpc() là PostgrestError (plain object {message,details,hint,code}),
// KHÔNG phải instance Error chuẩn — nhánh cũ chỉ bắt `instanceof Error` nên mọi lỗi RPC
// (kể cả lỗi nghiệp vụ như "không đủ tồn kho") đều rơi về "Unknown error", mất hết message
// thật. Áp dụng cùng pattern đã có sẵn ở routes/import.ts.
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

const writeErrorResponse = (
  res: Parameters<RequestHandler>[1],
  fallback: string,
  error?: unknown
) => res.status(500).json({ error: error ? getErrorMessage(error) || fallback : fallback });

// Trường số KHÔNG được âm theo nghiệp vụ. Cố ý HẸP: đơn trả hàng lưu số âm hợp lệ ở
// pos_orders, và allowSellOutOfStock cho phép stock âm — nên KHÔNG chặn âm chung chung,
// chỉ chặn giá bán/giá vốn sản phẩm (không bao giờ âm hợp lệ).
const NON_NEGATIVE_FIELDS: Record<string, string[]> = {
  pos_products: ['sale_price', 'import_price'],
  shopee_source_data: ['import_price'],
};

// Duyệt sâu payload, phát hiện số vô nghĩa (NaN/±Infinity) ở bất kỳ trường nào — luôn là
// lỗi, không nghiệp vụ hợp lệ nào cần. Trả về mô tả trường vi phạm, hoặc null nếu sạch.
const findNonFinite = (value: unknown, path = ''): string | null => {
  if (typeof value === 'number') {
    return Number.isFinite(value) ? null : `Trường "${path || 'giá trị'}" là số không hợp lệ`;
  }
  if (Array.isArray(value)) {
    for (let i = 0; i < value.length; i++) {
      const r = findNonFinite(value[i], `${path}[${i}]`);
      if (r) return r;
    }
    return null;
  }
  if (value && typeof value === 'object') {
    for (const [k, v] of Object.entries(value as Record<string, unknown>)) {
      const r = findNonFinite(v, path ? `${path}.${k}` : k);
      if (r) return r;
    }
  }
  return null;
};

// Validate payload backend TRƯỚC KHI ghi (không tin frontend): chặn NaN/Infinity toàn
// payload + số âm ở các trường tài chính không được âm. Trả về thông báo lỗi hoặc null.
const validateDataPayload = (tableName: string, payload: Record<string, unknown>): string | null => {
  const nonFinite = findNonFinite(payload);
  if (nonFinite) return nonFinite;
  for (const field of NON_NEGATIVE_FIELDS[tableName] ?? []) {
    const raw = payload[field];
    if (typeof raw === 'number' && raw < 0) return `Trường "${field}" không được âm`;
  }
  return null;
};

// Bảng chấm công/lương bị khoá khi nhân viên ĐÃ "Chốt & Lưu" lương tháng đó (tồn tại dòng
// payroll_records cho employee_id+month). QA 2026-08-16 phát hiện khoá cũ chỉ chặn ở UI
// (input disabled) — gọi thẳng API vẫn ghi/xoá được dữ liệu của nhân viên đã chốt lương,
// không để lại dấu vết audit. Chặn thêm ở đây để không phụ thuộc UI.
const PAYROLL_LOCKED_TABLES = new Set([
  'attendance_records',
  'overtime_records',
  'sales_records',
  'shortage_records',
  'advance_records',
]);

const monthFromDate = (value: unknown): string | null => {
  const str = typeof value === 'string' ? value : '';
  return str.length >= 7 ? str.slice(0, 7) : null;
};

// Trả về thông báo lỗi nếu BẤT KỲ dòng nào thuộc nhân viên đã chốt lương tháng đó, hoặc null
// nếu tất cả hợp lệ. Gộp 1 query cho cả batch (upsert-many) để tránh N+1.
async function findPayrollLockViolation(
  supabase: SupabaseClient,
  tableName: string,
  rows: Record<string, unknown>[]
): Promise<string | null> {
  if (!PAYROLL_LOCKED_TABLES.has(tableName)) return null;

  const pairs = new Map<string, { employeeId: string; month: string }>();
  for (const row of rows) {
    const employeeId = getTextField(row, 'employee_id');
    const month = monthFromDate(row.date);
    if (!employeeId || !month) continue;
    pairs.set(`${employeeId}|${month}`, { employeeId, month });
  }
  if (pairs.size === 0) return null;

  const employeeIds = Array.from(new Set(Array.from(pairs.values()).map(p => p.employeeId)));
  const months = Array.from(new Set(Array.from(pairs.values()).map(p => p.month)));
  const { data, error } = await supabase
    .from('payroll_records')
    .select('employee_id, month')
    .in('employee_id', employeeIds)
    .in('month', months);
  if (error) throw error;

  const lockedKeys = new Set(
    ((data || []) as Array<{ employee_id: string; month: string }>).map(r => `${r.employee_id}|${r.month}`)
  );
  for (const [key, { employeeId, month }] of pairs) {
    if (lockedKeys.has(key)) {
      return `Nhân viên (mã ${employeeId}) đã chốt lương tháng ${month} — không thể sửa chấm công/tăng ca/doanh số/khấu trừ của tháng này.`;
    }
  }
  return null;
}

const getErrorCode = (error: unknown): string | null => {
  if (error && typeof error === 'object' && 'code' in error) {
    const code = (error as { code?: unknown }).code;
    return typeof code === 'string' ? code : null;
  }
  return null;
};

const isInventoryRpcUnavailable = (error: unknown): boolean => {
  const code = getErrorCode(error);
  if (code === 'PGRST202' || code === '42883') return true;
  const message = getErrorMessage(error);
  return message.includes('Could not find the function');
};

const resolveTable = (key: unknown): string | null => {
  if (typeof key !== 'string') return null;
  return TABLE_MAP[key] ?? null;
};

const asRecord = (value: unknown): Record<string, unknown> =>
  value && typeof value === 'object' && !Array.isArray(value) ? (value as Record<string, unknown>) : {};

const getTextField = (record: Record<string, unknown>, field: string): string => {
  const value = record[field];
  return typeof value === 'string' ? value : '';
};

const getNumberField = (record: Record<string, unknown>, field: string): number => {
  const value = record[field];
  if (typeof value === 'number' && Number.isFinite(value)) return value;
  if (typeof value === 'string' && value.trim()) {
    const parsed = Number(value);
    return Number.isFinite(parsed) ? parsed : 0;
  }
  return 0;
};

const getItems = (record: Record<string, unknown>): Record<string, unknown>[] => {
  const items = record.items;
  if (!Array.isArray(items)) return [];
  return items.map(asRecord);
};

// Ghi lịch sử giá nhập khi có phiếu nhập hàng
async function writeCostHistory(
  supabase: SupabaseClient,
  items: { sku: string; productId: string; importPrice: number }[],
  effectiveDate: string,
  source = 'purchase'
) {
  const entries = items
    .filter(i => i.sku && i.importPrice > 0)
    .map(i => ({
      id: crypto.randomUUID(),
      sku: i.sku,
      product_id: i.productId || null,
      import_price: i.importPrice,
      effective_date: effectiveDate.slice(0, 10),
      source,
    }));
  if (!entries.length) return;
  await supabase.from('product_cost_history').upsert(entries, { onConflict: 'id' });
}

async function setProductStock(
  supabase: SupabaseClient,
  productId: string,
  stock: number,
  allowNegativeStock = false
) {
  const { error } = await supabase
    .from('pos_products')
    .update({ stock: allowNegativeStock ? Math.trunc(stock) : Math.max(0, Math.trunc(stock)) })
    .eq('id', productId);
  if (error) throw error;
}

async function adjustProductStock(
  supabase: SupabaseClient,
  productId: string,
  delta: number,
  options: { allowNegativeStock?: boolean } = {}
) {
  const quantity = Math.abs(Math.trunc(delta));
  if (quantity === 0) return;

  if (delta < 0) {
    const { data, error } = await supabase.rpc('decrement_product_stock', {
      p_product_id: productId,
      p_quantity: quantity,
    });
    if (!error && Array.isArray(data) && data.length > 0) return;
    if (!error && !options.allowNegativeStock) {
      throw new Error(`Không đủ tồn kho cho sản phẩm ${productId}`);
    }
    if (!error && options.allowNegativeStock) {
      // RPC bảo vệ không cho âm kho; khi cửa hàng bật bán âm, cập nhật có kiểm soát ở fallback.
    } else if (!isInventoryRpcUnavailable(error)) {
      throw error;
    }
  }

  if (delta > 0) {
    const { error } = await supabase.rpc('increment_product_stock', {
      p_product_id: productId,
      p_quantity: Math.abs(Math.trunc(delta)),
    });
    if (!error) return;
    if (!isInventoryRpcUnavailable(error)) throw error;
  }

  const { data, error } = await supabase
    .from('pos_products')
    .select('stock')
    .eq('id', productId)
    .single();
  if (error) throw error;

  const currentStock = getNumberField(asRecord(data), 'stock');
  await setProductStock(
    supabase,
    productId,
    currentStock + delta,
    !!options.allowNegativeStock
  );
}

async function applyInventoryTransactionFallback(
  supabase: SupabaseClient,
  payload: Record<string, unknown>
) {
  const { allow_negative_stock: _allowNegativeStockColumn, ...dbPayload } = payload;
  const transactionId = getTextField(payload, 'id');
  const { error } = await supabase.from('inventory_transactions').upsert(dbPayload, { onConflict: 'id' });
  if (error) throw error;

  const type = getTextField(payload, 'type');
  const txDate = getTextField(payload, 'date') || new Date().toISOString();
  const allowNegativeStock =
    payload.allowNegativeStock === true || payload.allow_negative_stock === true;
  const costItems: { sku: string; productId: string; importPrice: number }[] = [];
  const productIds = Array.from(new Set(
    getItems(payload)
      .map(item => getTextField(item, 'productId'))
      .filter(Boolean)
  ));
  const productSnapshots: Record<string, { stock: number; import_price: number | null }> = {};

  if (productIds.length > 0) {
    const { data: products, error: snapshotError } = await supabase
      .from('pos_products')
      .select('id,stock,import_price')
      .in('id', productIds);
    if (snapshotError) throw snapshotError;
    for (const product of (products || []) as Array<Record<string, unknown>>) {
      const productId = getTextField(product, 'id');
      if (!productId) continue;
      productSnapshots[productId] = {
        stock: getNumberField(product, 'stock'),
        import_price:
          product.import_price == null ? null : getNumberField(product, 'import_price'),
      };
    }
  }

  // Tự tạo sản phẩm mới nếu chưa có trong pos_products (chỉ khi nhập hàng)
  if (type === 'Import') {
    const newProductItems = getItems(payload).filter(item => {
      const pid = getTextField(item, 'productId');
      return pid && !productSnapshots[pid];
    });
    if (newProductItems.length > 0) {
      const seen = new Set<string>();
      const newProducts = newProductItems
        .filter(item => {
          const pid = getTextField(item, 'productId');
          if (seen.has(pid)) return false;
          seen.add(pid);
          return true;
        })
        .map(item => ({
          id: getTextField(item, 'productId'),
          sku: getTextField(item, 'sku'),
          name: getTextField(item, 'name') || getTextField(item, 'productName'),
          import_price: getNumberField(item, 'nextImportPrice') || getNumberField(item, 'price'),
          sale_price: 0,
          stock: getNumberField(item, 'quantity'),
          unit: getTextField(item, 'unit') || 'Cái',
          brand: null,
          category_id: 'Khác',
          status: 'Active',
          is_parent: false,
          product_type: 'Hàng hóa',
          direct_sale: true,
          allow_points: true,
          weight: 0,
          customer_orders: 0,
        }))
        .filter(p => p.id && p.sku);
      if (newProducts.length > 0) {
        const { error: createErr } = await supabase
          .from('pos_products')
          .upsert(newProducts, { onConflict: 'id' });
        if (createErr) {
          console.error('[data] Lỗi tạo sản phẩm mới khi nhập hàng tay:', createErr.message);
        } else {
          console.log(`[data] Đã tạo ${newProducts.length} sản phẩm mới từ phiếu nhập tay`);
          // Cập nhật snapshot để các bước stock bên dưới biết sản phẩm đã tồn tại
          for (const p of newProducts) {
            productSnapshots[p.id] = { stock: 0, import_price: p.import_price };
          }
        }
      }
    }
  }

  try {
    for (const item of getItems(payload)) {
      const productId = getTextField(item, 'productId');
      if (!productId) continue;

      if (type === 'Import') {
        await adjustProductStock(supabase, productId, getNumberField(item, 'quantity'));
        const nextImportPrice = getNumberField(item, 'nextImportPrice');
        if (nextImportPrice > 0) {
          const { error: priceError } = await supabase
            .from('pos_products')
            .update({ import_price: nextImportPrice })
            .eq('id', productId);
          if (priceError) throw priceError;
        }
        const sku = getTextField(item, 'sku');
        const price = getNumberField(item, 'price');
        if (sku && price > 0) costItems.push({ sku, productId, importPrice: price });
      } else if (type === 'PurchaseReturn') {
        await adjustProductStock(supabase, productId, -Math.abs(getNumberField(item, 'quantity')));
      } else if (type === 'Sale') {
        await adjustProductStock(
          supabase,
          productId,
          -Math.abs(getNumberField(item, 'quantity')),
          { allowNegativeStock }
        );
      } else if (type === 'Return') {
        await adjustProductStock(supabase, productId, Math.abs(getNumberField(item, 'quantity')));
      } else if (type === 'Check') {
        await setProductStock(supabase, productId, getNumberField(item, 'newStock'));
      }
    }
  } catch (stockError) {
    for (const [productId, snapshot] of Object.entries(productSnapshots)) {
      const { error: restoreError } = await supabase
        .from('pos_products')
        .update({ stock: snapshot.stock, import_price: snapshot.import_price })
        .eq('id', productId);
      if (restoreError) {
        console.error(`Không thể rollback tồn kho sản phẩm ${productId}:`, restoreError);
      }
    }
    if (transactionId) {
      await supabase.from('inventory_transactions').delete().eq('id', transactionId);
    }
    throw stockError;
  }

  if (costItems.length) {
    await writeCostHistory(supabase, costItems, txDate, 'purchase').catch(() => {});
  }
}

async function deleteInventoryTransactionFallback(supabase: SupabaseClient, transactionId: string) {
  const { data, error } = await supabase
    .from('inventory_transactions')
    .select('*')
    .eq('id', transactionId)
    .single();
  if (error) throw error;

  const transaction = asRecord(data);
  if (getTextField(transaction, 'status') !== 'cancelled') {
    const type = getTextField(transaction, 'type');
    for (const item of getItems(transaction)) {
      const productId = getTextField(item, 'productId');
      if (!productId) continue;

      if (type === 'Import') {
        await adjustProductStock(supabase, productId, -getNumberField(item, 'quantity'));
        // Khôi phục giá vốn về trước khi nhập nếu transaction lưu lại giá trị này
        const previousImportPrice = getNumberField(item, 'previousImportPrice');
        if (previousImportPrice > 0) {
          await supabase
            .from('pos_products')
            .update({ import_price: previousImportPrice })
            .eq('id', productId);
        }
      } else if (type === 'PurchaseReturn') {
        await adjustProductStock(supabase, productId, Math.abs(getNumberField(item, 'quantity')));
      } else if (type === 'Sale') {
        await adjustProductStock(supabase, productId, Math.abs(getNumberField(item, 'quantity')));
      } else if (type === 'Return') {
        await adjustProductStock(supabase, productId, -Math.abs(getNumberField(item, 'quantity')));
      } else if (type === 'Check') {
        await setProductStock(supabase, productId, getNumberField(item, 'previousStock'));
      }
    }
  }

  const { error: deleteError } = await supabase
    .from('inventory_transactions')
    .delete()
    .eq('id', transactionId);
  if (deleteError) throw deleteError;
}

// Lấy danh tính người gọi từ JWT — không tin client, giống pattern resolveCaller (routes/auth.ts).
// Không có JWT (dev/LAN local, đã qua requireAuth) → null, auditLog() vẫn ghi nhưng thiếu actor.
async function resolveActor(supabase: SupabaseClient, req: Request): Promise<Actor | null> {
  const authHeader = req.headers.authorization;
  const jwt = authHeader?.startsWith('Bearer ') ? authHeader.slice(7) : null;
  if (!jwt) return null;
  const { data: { user }, error } = await supabase.auth.getUser(jwt);
  if (error || !user) return null;
  return {
    id: user.id,
    name: String(user.user_metadata?.display_name || user.email || 'Không rõ'),
    role: String(user.user_metadata?.role ?? 'cashier').toLowerCase(),
  };
}

async function auditLog(
  supabase: SupabaseClient,
  tableName: string,
  recordId: string,
  action: string,
  snapshot?: unknown,
  actor?: Actor | null
) {
  if (!AUDITED_TABLES.has(tableName)) return;
  try {
    let finalSnapshot: unknown = snapshot ?? null;
    if (actor) {
      finalSnapshot = {
        ...(finalSnapshot && typeof finalSnapshot === 'object' ? (finalSnapshot as Record<string, unknown>) : {}),
        actorId: actor.id,
        actorName: actor.name,
        actorRole: actor.role,
      };
    }
    await supabase.from('audit_logs').insert({
      table_name: tableName,
      record_id: recordId,
      action,
      snapshot: finalSnapshot,
    });
  } catch {
    // Audit table may not exist in older local databases; do not fail the write.
  }
}

// Lấy TOÀN BỘ dòng khớp query, phân trang song song (Promise.all) — nhanh hơn nhiều so với
// await tuần tự từng trang khi bảng lớn (độ trễ ~1 round-trip thay vì cộng dồn N round-trip).
// PostgREST tự cap mỗi request tối đa PGRST_DB_MAX_ROWS dòng BẤT KỂ range yêu cầu rộng bao
// nhiêu (xác nhận thực tế trên DB dev: range(0,4999) chỉ trả về 1000 dòng) — nên KHÔNG hardcode
// kích thước trang. Trang đầu tiết lộ đúng cap thực tế qua độ dài dữ liệu trả về, các trang sau
// dùng đúng con số đó để không bỏ sót dòng nào dù cap đổi (không phụ thuộc cấu hình cụ thể).
async function fetchAllPagedRows<T>(
  buildRangedQuery: (start: number, end: number) => PromiseLike<{ data: T[] | null; error: unknown; count?: number | null }>,
  requestedPageSize: number
): Promise<T[]> {
  const { data: first, error, count } = await buildRangedQuery(0, requestedPageSize - 1);
  if (error) throw error;
  const rows = first || [];
  const actualPageSize = rows.length;
  if (actualPageSize === 0 || (count || 0) <= actualPageSize) return rows;

  const totalPages = Math.ceil((count as number) / actualPageSize);
  const restPages = await Promise.all(
    Array.from({ length: totalPages - 1 }, (_, i) => {
      const start = (i + 1) * actualPageSize;
      return buildRangedQuery(start, start + actualPageSize - 1);
    })
  );
  const all = [...rows];
  for (const page of restPages) {
    if (page.error) throw page.error;
    all.push(...(page.data || []));
  }
  return all;
}

export function createDataRouter(supabase: SupabaseClient, requireAuth: RequestHandler): Router {
  const router = Router();

  // customer_debt_history bật RLS "TO authenticated" → role anon (app dùng để đọc /rest/v1) bị
  // chặn, không bao giờ thấy bản ghi điều chỉnh/thu nợ dù đã ghi. Đọc qua server bằng service-role
  // (giống cách bảng này được GHI qua /api/data/upsert) để bỏ qua RLS, không phơi dữ liệu cho anon.
  router.get('/api/data/customer-debt-history', requireAuth, async (_req, res) => {
    try {
      const { data, error } = await supabase
        .from('customer_debt_history')
        .select('*')
        .order('date', { ascending: false })
        .limit(5000);
      if (error) throw error;
      res.json({ data: data || [] });
    } catch (error: unknown) {
      console.error('[DataRoute] customer-debt-history read failed:', error);
      writeErrorResponse(res, 'Không thể đọc lịch sử công nợ');
    }
  });

  // Tổng hợp per-customer (sold/returned/debt/last-transaction/spent-in-range) ở server —
  // trước đây trang Danh sách khách hàng (CustomerListPage.tsx) tự kéo TOÀN BỘ pos_orders về
  // client rồi tính bằng JS mỗi lần mở trang, khiến trang này chậm hơn hẳn trang Hàng hoá dù
  // ít bản ghi hơn (hàng hoá dùng data đã bootstrap sẵn + phân trang, không fetch thêm).
  // Công thức PHẢI khớp với calcOrderRevenue (src/lib/reportCalculations.ts) và debtStats cũ ở
  // CustomerListPage.tsx — nếu sửa 1 bên phải soát lại bên kia (xem FORMULAS.md).
  router.get('/api/data/customer-stats', requireAuth, async (req, res) => {
    try {
      const dateFrom = typeof req.query.date_from === 'string' ? req.query.date_from : null;
      const dateTo = typeof req.query.date_to === 'string' ? req.query.date_to : null;
      const hasRange = !!(dateFrom || dateTo);
      const fromTime = dateFrom ? new Date(`${dateFrom}T00:00:00`).getTime() : null;
      const toTime = dateTo ? new Date(`${dateTo}T23:59:59`).getTime() : null;

      type Agg = {
        sold: number;
        returned: number;
        orderDebt: number;
        lastTransactionDate: string;
        spentInRange: number;
      };
      const agg = new Map<string, Agg>();
      const orderIds = new Set<string>();
      const getAgg = (id: string): Agg => {
        let a = agg.get(id);
        if (!a) {
          a = { sold: 0, returned: 0, orderDebt: 0, lastTransactionDate: '', spentInRange: 0 };
          agg.set(id, a);
        }
        return a;
      };

      // Phân trang song song (fetchAllPagedRows, xem định nghĩa đầu file) thay vì tuần tự —
      // bảng pos_orders shop này có thể lên tới hàng chục nghìn dòng, phân trang tuần tự (await
      // từng trang) cộng dồn độ trễ mạng đáng kể. requestedPageSize chỉ là gợi ý ban đầu —
      // fetchAllPagedRows tự đo kích thước trang THỰC TẾ PostgREST trả về (có thể bị cap thấp
      // hơn, vd PGRST_DB_MAX_ROWS) nên không bao giờ bỏ sót dòng dù server cap bao nhiêu.
      const REQUEST_PAGE_SIZE = 5000;

      const processOrder = (o: any) => {
        const cid = String(o.customer_id);
        orderIds.add(String(o.id));
        const a = getAgg(cid);
        const totalAmount = Math.abs(Number(o.total_amount) || 0);
        const finalAmount = Number(o.final_amount) || 0;
        const cashReceived = Number(o.cash_received) || 0;
        const isReturn = o.is_return === true;

        if (isReturn) {
          a.returned += totalAmount;
          a.orderDebt += -(finalAmount - cashReceived);
        } else {
          const discount = o.discount != null
            ? Math.abs(Number(o.discount))
            : Math.max(0, totalAmount - finalAmount);
          a.sold += totalAmount - discount;
          a.orderDebt += finalAmount - cashReceived;
          if (hasRange) {
            const t = new Date(o.date).getTime();
            if (Number.isFinite(t) && (fromTime == null || t >= fromTime) && (toTime == null || t <= toTime)) {
              a.spentInRange += totalAmount - discount;
            }
          }
        }
        const date = String(o.date || '');
        if (date && date > a.lastTransactionDate) a.lastTransactionDate = date;
      };

      const orderRows = await fetchAllPagedRows(
        (start, end) => supabase
          .from('pos_orders')
          .select('id, customer_id, date, total_amount, discount, final_amount, cash_received, is_return, status', { count: 'exact' })
          .not('customer_id', 'is', null)
          .or('status.is.null,status.neq.cancelled')
          .range(start, end),
        REQUEST_PAGE_SIZE
      );
      orderRows.forEach(processOrder);

      // Bước 2: merge customer_debt_history — bỏ bản ghi 'debt' đã gắn 1 order còn tồn tại
      // (tránh đếm trùng khoản nợ đó, vì đã tính qua finalAmount - cashReceived ở trên).
      const processDebtRow = (r: any) => {
        if (!r.customer_id) return;
        if (r.type === 'debt' && r.order_id && orderIds.has(String(r.order_id))) return;
        const delta = r.type === 'repay' ? -Number(r.amount || 0) : Number(r.amount || 0);
        const a = getAgg(String(r.customer_id));
        a.orderDebt += delta;
      };

      const debtRows = await fetchAllPagedRows(
        (start, end) => supabase
          .from('customer_debt_history')
          .select('customer_id, order_id, type, amount', { count: 'exact' })
          .range(start, end),
        REQUEST_PAGE_SIZE
      );
      debtRows.forEach(processDebtRow);

      const result = Array.from(agg.entries()).map(([customerId, a]) => ({
        customerId,
        sold: a.sold,
        returned: a.returned,
        debt: Math.max(0, a.orderDebt),
        lastTransactionDate: a.lastTransactionDate || null,
        spentInRange: hasRange ? a.spentInRange : 0,
      }));

      res.json({ data: result });
    } catch (error: unknown) {
      console.error('[DataRoute] customer-stats read failed:', error);
      writeErrorResponse(res, 'Không thể tổng hợp số liệu khách hàng');
    }
  });

  // Nhật ký hoạt động — chỉ chủ cửa hàng (owner) được xem, vì dữ liệu nhạy cảm về thao tác
  // của toàn bộ nhân viên. Dev/LAN không kèm JWT → coi như owner (khớp resolveCaller/auth.ts).
  router.get('/api/data/audit-logs', requireAuth, async (req, res) => {
    const authHeader = req.headers.authorization;
    const jwt = authHeader?.startsWith('Bearer ') ? authHeader.slice(7) : null;
    if (jwt) {
      const { data: { user }, error: userError } = await supabase.auth.getUser(jwt);
      if (userError || !user) return res.status(401).json({ error: 'Phiên đăng nhập không hợp lệ' });
      const role = String(user.user_metadata?.role ?? 'cashier').toLowerCase();
      if (role !== 'owner') {
        return res.status(403).json({ error: 'Chỉ chủ cửa hàng mới được xem nhật ký hoạt động' });
      }
    }

    // Trả 1 lượt tối đa 1000 dòng gần nhất (giống customer-debt-history .limit(5000)) — trang
    // hiển thị tự lọc/phân trang phía client, không cần cơ chế phân trang server riêng.
    try {
      const { data, error } = await supabase
        .from('audit_logs')
        .select('*')
        .order('created_at', { ascending: false })
        .limit(1000);
      if (error) throw error;
      res.json({ data: data || [] });
    } catch (error: unknown) {
      console.error('[DataRoute] audit-logs read failed:', error);
      writeErrorResponse(res, 'Không thể đọc nhật ký hoạt động');
    }
  });

  router.post('/api/data/upsert', requireAuth, async (req, res) => {
    const tableName = resolveTable(req.body?.key);
    const payload = req.body?.payload;
    const recordId = String(req.body?.recordId || payload?.id || '');
    if (!tableName || !payload || !recordId) {
      return res.status(400).json({ error: 'Dữ liệu ghi không hợp lệ' });
    }
    const validationError = validateDataPayload(tableName, payload as Record<string, unknown>);
    if (validationError) {
      return res.status(400).json({ error: validationError });
    }

    try {
      const lockError = await findPayrollLockViolation(supabase, tableName, [payload as Record<string, unknown>]);
      if (lockError) return res.status(409).json({ error: lockError });

      const { error } = await supabase.from(tableName).upsert(payload, { onConflict: 'id' });
      if (error) throw error;
      await auditLog(supabase, tableName, recordId, 'upsert', payload, await resolveActor(supabase, req));

      // Ghi lịch sử giá nhập khi upsert phiếu nhập hàng (bao gồm nhập hàng nhanh OP-011
      // vốn không đi qua apply_inventory_transaction_with_stock nên thiếu writeCostHistory)
      if (tableName === 'inventory_transactions' && payload.type === 'Import') {
        const costItems = ((payload.items as any[]) || [])
          .map((item: any) => ({
            sku: String(item.sku || ''),
            productId: String(item.productId || ''),
            importPrice: Number(item.nextImportPrice || item.price || 0),
          }))
          .filter(i => i.sku && i.importPrice > 0);
        if (costItems.length) {
          const txDate = String(payload.date || '').slice(0, 10);
          await writeCostHistory(supabase, costItems, txDate, 'purchase').catch(() => {});
        }
      }

      res.json({ ok: true });
    } catch (error: unknown) {
      console.error(`[DataRoute] upsert failed [${tableName} - ${recordId}]:`, error);
      writeErrorResponse(res, 'Không thể ghi dữ liệu');
    }
  });

  router.post('/api/data/upsert-many', requireAuth, async (req, res) => {
    const tableName = resolveTable(req.body?.key);
    const payload = req.body?.payload;
    if (!tableName || !Array.isArray(payload)) {
      return res.status(400).json({ error: 'Dữ liệu ghi hàng loạt không hợp lệ' });
    }
    for (let i = 0; i < payload.length; i++) {
      const validationError = validateDataPayload(tableName, payload[i] as Record<string, unknown>);
      if (validationError) {
        return res.status(400).json({ error: `Dòng ${i}: ${validationError}` });
      }
    }

    try {
      const lockError = await findPayrollLockViolation(supabase, tableName, payload as Record<string, unknown>[]);
      if (lockError) return res.status(409).json({ error: lockError });

      const chunkSize = 100;
      for (let i = 0; i < payload.length; i += chunkSize) {
        const chunk = payload.slice(i, i + chunkSize);
        const { error } = await supabase.from(tableName).upsert(chunk, { onConflict: 'id' });
        if (error) throw new Error(`Lỗi ở dòng ${i}: ${error.message}`);
      }
      await auditLog(supabase, tableName, '*', 'upsertMany', { count: payload.length }, await resolveActor(supabase, req));
      res.json({ ok: true });
    } catch (error: unknown) {
      console.error(`[DataRoute] upsert-many failed [${tableName}]:`, error);
      writeErrorResponse(res, 'Không thể ghi dữ liệu hàng loạt');
    }
  });

  router.post('/api/data/delete', requireAuth, async (req, res) => {
    const tableName = resolveTable(req.body?.key);
    const id = String(req.body?.id || '');
    if (!tableName || !id) return res.status(400).json({ error: 'Dữ liệu xóa không hợp lệ' });

    try {
      const { data: snapshot } = await supabase.from(tableName).select('*').eq('id', id).single();
      if (snapshot) {
        const lockError = await findPayrollLockViolation(supabase, tableName, [snapshot as Record<string, unknown>]);
        if (lockError) return res.status(409).json({ error: lockError });
      }
      const { error } = await supabase.from(tableName).delete().eq('id', id);
      if (error) throw error;
      await auditLog(supabase, tableName, id, 'delete', snapshot, await resolveActor(supabase, req));
      res.json({ ok: true });
    } catch (error: unknown) {
      console.error(`[DataRoute] delete failed [${tableName} - ${id}]:`, error);
      writeErrorResponse(res, 'Không thể xóa dữ liệu');
    }
  });

  router.post('/api/data/clear', requireAuth, async (req, res) => {
    const authHeader = req.headers.authorization;
    const jwt = authHeader?.startsWith('Bearer ') ? authHeader.slice(7) : null;
    if (!jwt) {
      return res.status(403).json({ error: 'Chỉ quản trị viên mới có quyền xóa toàn bộ dữ liệu' });
    }
    const { data: { user }, error: userError } = await supabase.auth.getUser(jwt);
    if (userError || !user || user.user_metadata?.role !== 'admin') {
      return res.status(403).json({ error: 'Chỉ quản trị viên mới có quyền xóa toàn bộ dữ liệu' });
    }

    const tableName = resolveTable(req.body?.key);
    if (!tableName) return res.status(400).json({ error: 'Bảng xóa không hợp lệ' });

    try {
      const { error } = await supabase
        .from(tableName)
        .delete()
        .neq('id', '00000000-0000-0000-0000-000000000000');
      if (error) throw error;
      await auditLog(supabase, tableName, '*', 'clearTable', undefined, {
        id: user.id,
        name: String(user.user_metadata?.display_name || user.email || 'Không rõ'),
        role: String(user.user_metadata?.role ?? 'cashier').toLowerCase(),
      });
      res.json({ ok: true });
    } catch (error: unknown) {
      console.error(`[DataRoute] clear failed [${tableName}]:`, error);
      writeErrorResponse(res, 'Không thể xóa bảng dữ liệu');
    }
  });

  router.post('/api/data/config', requireAuth, async (req, res) => {
    const key = String(req.body?.key || '');
    if (!CONFIG_KEYS.has(key)) return res.status(400).json({ error: 'Config key không hợp lệ' });

    try {
      const { error } = await supabase.from('system_configs').upsert({
        key,
        value: req.body?.value,
      });
      if (error) throw error;
      res.json({ ok: true });
    } catch (error: unknown) {
      console.error(`[DataRoute] config upsert failed [${key}]:`, error);
      writeErrorResponse(res, 'Không thể lưu cấu hình');
    }
  });

  router.post('/api/data/inventory/apply', requireAuth, async (req, res) => {
    const payload = req.body?.payload;
    const transactionId = String(req.body?.transactionId || payload?.id || '');
    if (!payload || !transactionId) {
      return res.status(400).json({ error: 'Giao dịch tồn kho không hợp lệ' });
    }

    try {
      const { error } = await supabase.rpc('apply_inventory_transaction_with_stock_v2', {
        p_transaction: payload,
      });
      if (error) {
        if (!isInventoryRpcUnavailable(error)) throw error;
        if (['Import', 'PurchaseReturn', 'Sale', 'Return'].includes(getTextField(asRecord(payload), 'type'))) {
          await applyInventoryTransactionFallback(supabase, asRecord(payload));
        } else {
          const legacy = await supabase.rpc('apply_inventory_transaction_with_stock', {
            p_transaction: payload,
          });
          if (legacy.error) {
            if (!isInventoryRpcUnavailable(legacy.error)) throw legacy.error;
            await applyInventoryTransactionFallback(supabase, asRecord(payload));
          }
        }
      }
      await auditLog(supabase, 'inventory_transactions', transactionId, 'applyWithStock', payload, await resolveActor(supabase, req));
      res.json({ ok: true });
    } catch (error: unknown) {
      console.error(`[DataRoute] inventory apply failed [${transactionId}]:`, error);
      writeErrorResponse(res, 'Không thể áp dụng giao dịch tồn kho', error);
    }
  });

  router.post('/api/data/inventory/delete', requireAuth, async (req, res) => {
    const transactionId = String(req.body?.transactionId || '');
    if (!transactionId) return res.status(400).json({ error: 'ID giao dịch tồn kho không hợp lệ' });

    try {
      const { data: snapshot } = await supabase
        .from('inventory_transactions')
        .select('*')
        .eq('id', transactionId)
        .single();
      const { error } = await supabase.rpc('delete_inventory_transaction_with_stock_v2', {
        p_transaction_id: transactionId,
      });
      if (error) {
        if (!isInventoryRpcUnavailable(error)) throw error;
        if (['Import', 'PurchaseReturn', 'Sale', 'Return'].includes(getTextField(asRecord(snapshot), 'type'))) {
          await deleteInventoryTransactionFallback(supabase, transactionId);
        } else {
          const legacy = await supabase.rpc('delete_inventory_transaction_with_stock', {
            p_transaction_id: transactionId,
          });
          if (legacy.error) {
            if (!isInventoryRpcUnavailable(legacy.error)) throw legacy.error;
            await deleteInventoryTransactionFallback(supabase, transactionId);
          }
        }
      }
      await auditLog(supabase, 'inventory_transactions', transactionId, 'deleteWithStock', snapshot, await resolveActor(supabase, req));
      res.json({ ok: true });
    } catch (error: unknown) {
      console.error(`[DataRoute] inventory delete failed [${transactionId}]:`, error);
      writeErrorResponse(res, 'Không thể xóa giao dịch tồn kho', error);
    }
  });

  // [TXN-RPC-01] Xóa (soft-delete) 1 đơn bán trong 1 transaction DB — thay chuỗi nhiều lời
  // gọi mạng cũ, đóng cửa sổ lệch khi rớt mạng giữa chừng.
  router.post('/api/data/pos-orders/delete-tx', requireAuth, async (req, res) => {
    const orderId = String(req.body?.orderId || '');
    if (!orderId) return res.status(400).json({ error: 'ID đơn hàng không hợp lệ' });

    try {
      const actor = await resolveActor(supabase, req);
      const { error } = await supabase.rpc('delete_pos_order_tx', {
        p_order_id: orderId,
        p_actor_id: actor?.id ?? null,
        p_actor_name: actor?.name ?? null,
      });
      if (error) throw error;
      res.json({ ok: true });
    } catch (error: unknown) {
      console.error(`[DataRoute] delete pos order tx failed [${orderId}]:`, error);
      writeErrorResponse(res, 'Không thể xóa đơn hàng', error);
    }
  });

  // [TXN-RPC-01] Hủy phiếu trả hàng (TH receipt) trong 1 transaction DB — thay chuỗi nhiều lời
  // gọi mạng cũ, đóng cửa sổ lệch khi rớt mạng giữa chừng.
  router.post('/api/data/pos-orders/cancel-return-tx', requireAuth, async (req, res) => {
    const returnOrderId = String(req.body?.returnOrderId || '');
    if (!returnOrderId) return res.status(400).json({ error: 'ID phiếu trả hàng không hợp lệ' });

    try {
      const actor = await resolveActor(supabase, req);
      const { error } = await supabase.rpc('cancel_pos_return_tx', {
        p_return_order_id: returnOrderId,
        p_actor_id: actor?.id ?? null,
        p_actor_name: actor?.name ?? null,
      });
      if (error) throw error;
      res.json({ ok: true });
    } catch (error: unknown) {
      console.error(`[DataRoute] cancel pos return tx failed [${returnOrderId}]:`, error);
      writeErrorResponse(res, 'Không thể hủy phiếu trả hàng', error);
    }
  });

  // [TXN-RPC-01] Sửa 1 đơn bán (hoàn/áp tồn kho + xóa/ghi nợ + ghi đè đơn + đảo doanh thu)
  // trong 1 transaction DB — thay chuỗi nhiều lời gọi mạng cũ.
  router.post('/api/data/pos-orders/edit-tx', requireAuth, async (req, res) => {
    const orderId = String(req.body?.orderId || '');
    const updatedOrder = req.body?.updatedOrder;
    const debtRecord = req.body?.debtRecord ?? null;
    const allowSellOutOfStock = Boolean(req.body?.allowSellOutOfStock);
    if (!orderId) return res.status(400).json({ error: 'ID đơn hàng không hợp lệ' });
    if (!updatedOrder || typeof updatedOrder !== 'object') {
      return res.status(400).json({ error: 'Dữ liệu đơn hàng cập nhật không hợp lệ' });
    }

    try {
      const actor = await resolveActor(supabase, req);
      const { error } = await supabase.rpc('edit_pos_order_tx', {
        p_order_id: orderId,
        p_updated_order: updatedOrder,
        p_debt_record: debtRecord,
        p_allow_sell_out_of_stock: allowSellOutOfStock,
        p_actor_id: actor?.id ?? null,
        p_actor_name: actor?.name ?? null,
      });
      if (error) throw error;
      res.json({ ok: true });
    } catch (error: unknown) {
      console.error(`[DataRoute] edit pos order tx failed [${orderId}]:`, error);
      writeErrorResponse(res, 'Không thể sửa đơn hàng', error);
    }
  });

  // [TXN-RPC-01] Tạo 1 đơn bán mới (insert order + ghi inventory tx & trừ tồn kho + ghi
  // nợ + cộng dồn doanh thu) trong 1 transaction DB — thay chuỗi nhiều lời gọi mạng cũ +
  // rollback thủ công từng bước.
  router.post('/api/data/pos-orders/place-tx', requireAuth, async (req, res) => {
    const order = req.body?.order;
    const debtRecord = req.body?.debtRecord ?? null;
    const allowSellOutOfStock = Boolean(req.body?.allowSellOutOfStock);
    if (!order || typeof order !== 'object' || !order.id) {
      return res.status(400).json({ error: 'Dữ liệu đơn hàng không hợp lệ' });
    }

    try {
      const actor = await resolveActor(supabase, req);
      const { error } = await supabase.rpc('place_pos_order_tx', {
        p_order: order,
        p_debt_record: debtRecord,
        p_allow_sell_out_of_stock: allowSellOutOfStock,
        p_actor_id: actor?.id ?? null,
        p_actor_name: actor?.name ?? null,
      });
      if (error) throw error;
      res.json({ ok: true });
    } catch (error: unknown) {
      console.error(`[DataRoute] place pos order tx failed [${order.id}]:`, error);
      writeErrorResponse(res, 'Không thể tạo đơn hàng', error);
    }
  });

  // [DATA-02] Cộng dồn doanh thu theo DELTA atomic (chống race 2 máy bán cùng ngày)
  router.post('/api/data/revenue/apply-delta', requireAuth, async (req, res) => {
    const id = req.body?.id ? String(req.body.id) : null;
    const dateKey = String(req.body?.dateKey || '');
    const delta = req.body?.delta;
    if (!dateKey || !delta || typeof delta !== 'object') {
      return res.status(400).json({ error: 'Delta doanh thu không hợp lệ' });
    }
    try {
      const { error } = await supabase.rpc('apply_revenue_delta', {
        p_id: id,
        p_date_key: dateKey,
        p_delta: delta,
      });
      if (error) throw error;
      res.json({ ok: true });
    } catch (error: unknown) {
      console.error(`[DataRoute] revenue apply-delta failed [${dateKey}]:`, error);
      writeErrorResponse(res, 'Không thể cộng dồn doanh thu', error);
    }
  });

  router.post('/api/data/knowledge/upload', requireAuth, async (req, res) => {
    const path = String(req.body?.path || '');
    const fileBase64 = String(req.body?.fileBase64 || '');
    const mimeType = String(req.body?.mimeType || 'application/octet-stream');
    if (!path || !fileBase64) return res.status(400).json({ error: 'File upload không hợp lệ' });

    try {
      const buffer = Buffer.from(fileBase64, 'base64');
      const { error } = await supabase.storage.from(KNOWLEDGE_FILES_BUCKET).upload(path, buffer, {
        cacheControl: '31536000',
        contentType: mimeType,
        upsert: false,
      });
      if (error) throw error;
      res.json({
        ok: true,
        sourceFilePath: path,
        sourceFileUrl: `/api/data/knowledge/file?path=${encodeURIComponent(path)}`,
      });
    } catch (error: unknown) {
      console.error(`[DataRoute] knowledge upload failed [${path}]:`, error);
      writeErrorResponse(res, 'Không thể tải file lên');
    }
  });

  router.get('/api/data/knowledge/file', requireAuth, async (req, res) => {
    const path = String(req.query?.path || '');
    if (!path) return res.status(400).json({ error: 'Đường dẫn file không hợp lệ' });

    try {
      const { data, error } = await supabase.storage.from(KNOWLEDGE_FILES_BUCKET).download(path);
      if (error) throw error;
      const arrayBuffer = await data.arrayBuffer();
      res.setHeader('Content-Type', data.type || 'application/octet-stream');
      res.setHeader('Cache-Control', 'private, max-age=300');
      res.send(Buffer.from(arrayBuffer));
    } catch (error: unknown) {
      console.error(`[DataRoute] knowledge file download failed [${path}]:`, error);
      res.status(404).json({ error: 'Không tìm thấy file' });
    }
  });

  // Backfill lịch sử giá nhập từ toàn bộ inventory_transactions có sẵn
  router.post('/api/analytics/backfill-cost-history', requireAuth, async (req, res) => {
    try {
      let allTx: any[] = [], offset = 0;
      while (true) {
        const { data, error } = await supabase
          .from('inventory_transactions')
          .select('date, type, items')
          .eq('type', 'Import')
          .order('date', { ascending: true })
          .range(offset, offset + 999);
        if (error) throw new Error(error.message);
        if (!data?.length) break;
        allTx = allTx.concat(data);
        if (data.length < 1000) break;
        offset += 1000;
      }

      let written = 0;
      const BATCH = 200;
      const entries: any[] = [];
      for (const tx of allTx) {
        const date = (tx.date as string)?.slice(0, 10);
        if (!date) continue;
        for (const item of ((tx.items as any[]) || [])) {
          const sku = String(item.sku || '').trim();
          const price = Number(item.price || 0);
          if (!sku || price <= 0) continue;
          entries.push({
            id: crypto.randomUUID(),
            sku,
            product_id: item.productId || null,
            import_price: price,
            effective_date: date,
            source: 'purchase',
          });
        }
      }

      for (let i = 0; i < entries.length; i += BATCH) {
        const { error } = await supabase
          .from('product_cost_history')
          .upsert(entries.slice(i, i + BATCH), { onConflict: 'id' });
        if (error) throw new Error(error.message);
        written += Math.min(BATCH, entries.length - i);
      }

      res.json({ written, transactions: allTx.length });
    } catch (error: unknown) {
      console.error('[DataRoute] backfill-cost-history failed:', error);
      res.status(500).json({ error: error instanceof Error ? error.message : 'Lỗi' });
    }
  });

  // Tính lại COGS + gross_profit cho tất cả tháng từ pos_orders × giá lịch sử
  router.post('/api/analytics/recalculate-cogs', requireAuth, async (req, res) => {
    try {
      // Load product_cost_history (giá nhập theo thời gian) — nguồn chính xác nhất
      const { data: costHistory } = await supabase
        .from('product_cost_history')
        .select('sku, import_price, effective_date')
        .order('effective_date', { ascending: true });

      // Build Map<sku, [{date, price}]> để lookup giá gần nhất trước ngày bán
      const historyBySku = buildCostHistoryBySku(costHistory as any[]);
      const getHistoricalPrice = (sku: string, orderDate: string): number =>
        findHistoricalCostBySku(historyBySku, sku, orderDate);

      // Fallback: giá hiện tại từ pos_products (cho sản phẩm chưa có history)
      const { data: products } = await supabase.from('pos_products').select('id, sku, import_price');
      const priceById  = new Map((products || []).map((p: any) => [p.id,  Number(p.import_price || 0)]));
      const priceBySku = new Map((products || []).map((p: any) => [p.sku, Number(p.import_price || 0)]));

      // Paginate toàn bộ pos_orders, gộp COGS theo tháng (YYYY-MM)
      const cogsByMonth = new Map<string, number>();
      let offset = 0;
      while (true) {
        const { data: orders, error } = await supabase
          .from('pos_orders')
          .select('date, is_return, items')
          // Soft-delete: loại đơn đã hủy (status NULL ở dòng cũ vẫn phải giữ)
          .or('status.is.null,status.neq.cancelled')
          .order('date', { ascending: false })
          .range(offset, offset + 999);
        if (error) throw new Error(error.message);
        if (!orders?.length) break;

        for (const o of orders) {
          const month = (o.date as string)?.slice(0, 7);
          const orderDate = (o.date as string)?.slice(0, 10);
          if (!month || !orderDate) continue;
          if (!cogsByMonth.has(month)) cogsByMonth.set(month, 0);
          const isReturn = o.is_return === true;
          for (const item of ((o.items as any[]) || [])) {
            const qty = Math.abs(Number(item.quantity || 0));
            const sku = String(item.sku || '').trim();
            // Ưu tiên: importPrice lưu trong item → lịch sử giá → giá hiện tại
            // [FIX m3-INV] Check cả camelCase (importPrice) và snake_case (import_price)
            const ip = Number(item.importPrice || item.import_price || 0)
              || getHistoricalPrice(sku, orderDate)
              || priceById.get(item.productId)
              || priceBySku.get(sku)
              || 0;
            cogsByMonth.set(month, cogsByMonth.get(month)! + (isReturn ? -qty * ip : qty * ip));
          }
        }
        if (orders.length < 1000) break;
        offset += 1000;
      }

      // Load tất cả revenue_records kèm total_cogs hiện tại
      const { data: revRecords } = await supabase
        .from('revenue_records')
        .select('id, date, net_revenue, total_cogs');
      if (!revRecords?.length) return res.json({ updated: 0 });

      // Gộp revenue_records theo tháng
      type RevMonth = { ids: string[]; netRevenue: number; existingCogs: number };
      const revByMonth = new Map<string, RevMonth>();
      // [FIX] Build lookup map để lấy date khi upsert — tránh NOT NULL violation
      const revRecordById = new Map((revRecords as any[]).map((r: any) => [r.id as string, r]));
      for (const r of revRecords as any[]) {
        const month = (r.date as string)?.slice(0, 7);
        if (!month) continue;
        if (!revByMonth.has(month)) revByMonth.set(month, { ids: [], netRevenue: 0, existingCogs: 0 });
        const m = revByMonth.get(month)!;
        m.ids.push(r.id);
        m.netRevenue += Number(r.net_revenue || 0);
        m.existingCogs += Number(r.total_cogs || 0);
      }

      // Cập nhật từng record:
      // - total_cogs: chỉ ghi nếu chưa có (= 0) → không ghi đè data KiotViet đã import
      // - gross_profit: luôn tính lại = net_revenue - total_cogs
      let updated = 0;
      const BATCH = 100;
      const toUpdate: any[] = [];
      for (const [month, rev] of revByMonth) {
        const posCogs = Math.round(cogsByMonth.get(month) || 0);
        // Dùng COGS hiện có nếu đã được set (từ KiotViet), fallback sang pos_orders nếu = 0
        const finalCogs = rev.existingCogs !== 0 ? rev.existingCogs : posCogs;

        if (rev.ids.length === 1) {
          const existing = revRecordById.get(rev.ids[0]);
          // [FIX] Đưa date vào payload — upsert không bị lỗi NOT NULL nếu record bị xóa bên ngoài
          const payload: any = {
            id: rev.ids[0],
            date: existing?.date,
            gross_profit: Math.round(rev.netRevenue) - finalCogs,
          };
          if (rev.existingCogs === 0) payload.total_cogs = posCogs;
          toUpdate.push(payload);
        } else {
          // Nhiều records/tháng (daily) → mỗi record tự tính gross_profit từ total_cogs riêng
          for (const r of (revRecords as any[]).filter((x: any) => x.date?.slice(0, 7) === month)) {
            const rExisting = Number(r.total_cogs || 0);
            const ratio = rev.netRevenue ? Number(r.net_revenue || 0) / rev.netRevenue : 1 / rev.ids.length;
            const rCogs = rExisting !== 0 ? rExisting : Math.round(posCogs * ratio);
            // [FIX] Đưa date vào payload
            const payload: any = {
              id: r.id,
              date: r.date,
              gross_profit: Math.round(Number(r.net_revenue || 0)) - rCogs,
            };
            if (rExisting === 0) payload.total_cogs = rCogs;
            toUpdate.push(payload);
          }
        }
      }

      for (let i = 0; i < toUpdate.length; i += BATCH) {
        const { error } = await supabase
          .from('revenue_records')
          .upsert(toUpdate.slice(i, i + BATCH), { onConflict: 'id' });
        if (error) throw new Error(error.message);
        updated += toUpdate.slice(i, i + BATCH).length;
      }

      res.json({ updated, months: cogsByMonth.size });
    } catch (error: unknown) {
      console.error('[DataRoute] recalculate-cogs failed:', error);
      res.status(500).json({ error: error instanceof Error ? error.message : 'Lỗi không xác định' });
    }
  });

  // Tổng hợp ma trận tài chính từ pos_orders (nguồn gốc thực tế)
  router.post('/api/analytics/financial-matrix', requireAuth, async (req, res) => {
    try {
      const { startDate, endDate } = req.body as { startDate?: string; endDate?: string };
      const startMD = startDate ? startDate.slice(5, 10) : '01-01';
      const endMD   = endDate   ? endDate.slice(5, 10)   : '12-31';
      const includeAll = startMD <= '01-01' && endMD >= '12-31';

      // Tra import_price theo productId và sku (fallback hiện tại)
      const { data: products } = await supabase.from('pos_products').select('id, sku, import_price');
      const priceById  = new Map((products || []).map((p: any) => [p.id,  Number(p.import_price || 0)]));
      const priceBySku = new Map((products || []).map((p: any) => [p.sku, Number(p.import_price || 0)]));

      // [FIX M10] Load lịch sử giá nhập — dùng giá tại thời điểm bán thay vì giá hiện tại
      const { data: matrixCostHistory } = await supabase
        .from('product_cost_history')
        .select('sku, import_price, effective_date')
        .order('effective_date', { ascending: true });
      const matrixHistoryBySku = buildCostHistoryBySku(matrixCostHistory as any[]);
      const getHistoricalCost = (sku: string, orderDate: string): number =>
        findHistoricalCostBySku(matrixHistoryBySku, sku, orderDate);

      type YearAgg = { gross: number; discount: number; returns: number; net: number; cogs: number };
      const byYear = new Map<string, YearAgg>();

      // Paginate qua toàn bộ pos_orders (tất cả năm)
      let offset = 0;
      while (true) {
        const { data: orders, error } = await supabase
          .from('pos_orders')
          .select('date, total_amount, discount, final_amount, is_return, items')
          // Soft-delete: loại đơn đã hủy (status NULL ở dòng cũ vẫn phải giữ)
          .or('status.is.null,status.neq.cancelled')
          .order('date', { ascending: false })
          .range(offset, offset + 999);
        if (error) throw new Error(error.message);
        if (!orders?.length) break;

        for (const o of orders) {
          const year = (o.date as string)?.slice(0, 4);
          if (!year) continue;
          const md = (o.date as string).slice(5, 10);
          if (!includeAll && (md < startMD || md > endMD)) continue;

          if (!byYear.has(year)) byYear.set(year, { gross: 0, discount: 0, returns: 0, net: 0, cogs: 0 });
          const agg = byYear.get(year)!;
          const isReturn = o.is_return === true;

          if (!isReturn) {
            agg.gross    += Number(o.total_amount || 0);
            agg.discount += Math.abs(Number(o.discount || 0));
          } else {
            agg.returns += Math.abs(Number(o.total_amount || 0));
          }
          // netRevenue = totalAmount - discount (chuẩn KiotViet), đơn trả trừ totalAmount
          if (!isReturn) agg.net += Number(o.total_amount || 0) - Math.abs(Number(o.discount || 0));
          else           agg.net -= Math.abs(Number(o.total_amount || 0));

          for (const item of ((o.items as any[]) || [])) {
            const qty = Math.abs(Number(item.quantity || 0));
            const orderDate = (o.date as string)?.slice(0, 10) || '';
            const sku = String(item.sku || '').trim();
            // [FIX M10] Ưu tiên: importPrice lưu trong item → lịch sử → hiện tại
            // [FIX m3-INV] Check cả camelCase và snake_case
            const ip = Number(item.importPrice || item.import_price || 0)
              || getHistoricalCost(sku, orderDate)
              || priceById.get(item.productId)
              || priceBySku.get(sku)
              || 0;
            if (!isReturn) agg.cogs += qty * ip;
            else           agg.cogs -= qty * ip;
          }
        }

        if (orders.length < 1000) break;
        offset += 1000;
      }

      const data: Record<string, Record<string, number>> = {};
      byYear.forEach((agg, year) => {
        const net  = Math.round(agg.net);
        const cogs = Math.round(agg.cogs);
        data[year] = {
          totalGrossRevenue: Math.round(agg.gross),
          discount:          Math.round(agg.discount),
          returnsValue:      Math.round(agg.returns),
          revenueOther:      0,
          netRevenue:        net,
          totalCogs:         cogs,
          grossProfit:       net - cogs,
        };
      });

      const years = Array.from(byYear.keys()).sort((a, b) => b.localeCompare(a));
      res.json({ data, years });
    } catch (error: unknown) {
      console.error('[DataRoute] financial-matrix failed:', error);
      res.status(500).json({ error: error instanceof Error ? error.message : 'Lỗi không xác định' });
    }
  });

  // Tính lại revenue_records cho 1 tháng từ pos_orders (fix khi data bị sai)
  // [LOGIC-02 — sửa 2026-07-02] Dựng lại doanh thu từ đơn hàng THEO TỪNG NGÀY.
  // BUG cũ: gộp tổng CẢ THÁNG vào 1 dòng ngày cuối tháng (mô hình cũ 1 dòng/tháng) →
  // chạy trên tháng đã có dòng theo ngày sẽ CỘNG TRÙNG gấp đôi. Nay group by date,
  // upsert từng ngày onConflict(date) — khớp mô hình hiện tại (1 dòng/ngày) và công
  // thức calcOrderRevenue (src/lib/reportCalculations.ts): sale = total - discount
  // (discount fallback max(0,total-final)); return = -|total|. revenue_other = phụ phí
  // (final - net) của đơn bán. KHÔNG đụng total_cogs/gross_profit (recalculate-cogs lo riêng).
  router.post('/api/analytics/recalculate-revenue-from-orders', requireAuth, async (req, res) => {
    try {
      const { month } = req.body as { month?: string }; // "YYYY-MM", mặc định tháng hiện tại
      const targetMonth = month || new Date().toLocaleDateString('sv-SE').slice(0, 7);
      const [y, m] = targetMonth.split('-').map(Number);
      const lastDayNum = new Date(y, m, 0).getDate();
      const lastDay = `${targetMonth}-${lastDayNum.toString().padStart(2, '0')}`;

      // Cộng dồn theo NGÀY (khóa = 'YYYY-MM-DD' lấy từ 10 ký tự đầu của date)
      type DayAgg = { gross: number; discount: number; returns: number; other: number };
      const byDay = new Map<string, DayAgg>();
      const bump = (day: string): DayAgg => {
        let agg = byDay.get(day);
        if (!agg) { agg = { gross: 0, discount: 0, returns: 0, other: 0 }; byDay.set(day, agg); }
        return agg;
      };

      let offset = 0;
      while (true) {
        const { data: orders, error } = await supabase
          .from('pos_orders')
          .select('total_amount, discount, final_amount, is_return, date')
          .gte('date', `${targetMonth}-01`)
          .lte('date', `${lastDay}T23:59:59`)
          // Soft-delete: loại đơn đã hủy (status NULL ở dòng cũ vẫn phải giữ)
          .or('status.is.null,status.neq.cancelled')
          .range(offset, offset + 999);
        if (error) throw new Error(error.message);
        if (!orders?.length) break;

        for (const o of orders) {
          const day = String(o.date || '').slice(0, 10);
          if (!day) continue;
          const agg = bump(day);
          const total = Math.abs(Number(o.total_amount || 0));
          if (o.is_return) {
            agg.returns += total;
          } else {
            const final = Number(o.final_amount || 0);
            const discount = o.discount != null
              ? Math.abs(Number(o.discount))
              : Math.max(0, total - final);
            const net = total - discount;
            agg.gross    += total;
            agg.discount += discount;
            // Phụ phí (ship/dịch vụ) = phần khách trả thêm ngoài doanh thu thuần
            agg.other    += Math.max(0, final - net);
          }
        }

        if (orders.length < 1000) break;
        offset += 1000;
      }

      // Lấy id hiện có theo ngày để upsert giữ nguyên id (tránh đổi id gây nhân đôi realtime)
      const days = [...byDay.keys()];
      const idByDate = new Map<string, string>();
      if (days.length > 0) {
        const { data: existing } = await supabase
          .from('revenue_records')
          .select('id, date')
          .in('date', days);
        for (const r of (existing || []) as Array<{ id: string; date: string }>) {
          idByDate.set(String(r.date).slice(0, 10), r.id);
        }
      }

      const rows = days.map(day => {
        const a = byDay.get(day)!;
        const gross = Math.round(a.gross);
        const disc  = Math.round(a.discount);
        const ret   = Math.round(a.returns);
        const other = Math.round(a.other);
        const net   = gross - disc - ret;
        return {
          id: idByDate.get(day) ?? crypto.randomUUID(),
          date: day,
          total_gross_revenue: gross,
          discount: disc,
          net_revenue: net,
          returns_value: ret,
          revenue_other: other,
        };
      });

      if (rows.length > 0) {
        const { error } = await supabase
          .from('revenue_records')
          .upsert(rows, { onConflict: 'date' });
        if (error) throw new Error(error.message);
      }

      const monthNet = rows.reduce((s, r) => s + r.net_revenue, 0);
      res.json({
        success: true,
        month: targetMonth,
        daysRebuilt: rows.length,
        month_net_revenue: monthNet,
      });
    } catch (error) {
      const msg = error instanceof Error ? error.message : String(error);
      res.status(500).json({ error: msg });
    }
  });

  // Đồng bộ khách hàng từ pos_orders: tạo mới nếu chưa có, update số liệu nếu đã có
  router.post('/api/customers/sync-from-orders', requireAuth, async (req, res) => {
    try {
      type CustomerAgg = { name: string; totalSpent: number; lastVisit: string; points: number };
      const aggByCustomer = new Map<string, CustomerAgg>();

      // Bước 1: Aggregate từ pos_orders (lấy thêm customer_name)
      let offset = 0;
      while (true) {
        const { data: orders, error } = await supabase
          .from('pos_orders')
          .select('customer_id, customer_name, total_amount, discount, final_amount, date, is_return, points_earned')
          .not('customer_id', 'is', null)
          .range(offset, offset + 999);
        if (error) throw new Error(error.message);
        if (!orders?.length) break;

        for (const o of orders) {
          const cid = String(o.customer_id);
          const isReturn = o.is_return === true;
          const prev = aggByCustomer.get(cid) ?? { name: '', totalSpent: 0, lastVisit: '', points: 0 };
          aggByCustomer.set(cid, {
            name: prev.name || String(o.customer_name || ''),
            // totalSpent = Σ(totalAmount - discount) bán - Σ totalAmount trả (chuẩn KiotViet)
            totalSpent: prev.totalSpent + (
              isReturn
                ? -Math.abs(Number(o.total_amount || 0))
                : Number(o.total_amount || 0) - Math.abs(Number(o.discount || 0))
            ),
            lastVisit: String(o.date || '') > prev.lastVisit ? String(o.date) : prev.lastVisit,
            points: prev.points + Number(o.points_earned || 0),
          });
        }

        if (orders.length < 1000) break;
        offset += 1000;
      }

      // Bước 2: Lấy danh sách ID đã tồn tại trong pos_customers
      const existingIds = new Set<string>();
      let cidOffset = 0;
      while (true) {
        const { data: existing, error } = await supabase
          .from('pos_customers')
          .select('id')
          .range(cidOffset, cidOffset + 999);
        if (error) throw new Error(error.message);
        if (!existing?.length) break;
        (existing as any[]).forEach(c => existingIds.add(String(c.id)));
        if (existing.length < 1000) break;
        cidOffset += 1000;
      }

      // Bước 3: Tạo mới khách chưa có
      const toInsert = Array.from(aggByCustomer.entries())
        .filter(([id, agg]) => !existingIds.has(id) && agg.name)
        .map(([id, agg]) => ({
          id,
          name: agg.name,
          phone: '',
          points: Math.round(agg.points),
          total_spent: Math.round(agg.totalSpent),
          last_visit: agg.lastVisit || null,
          tier: 'Standard',
        }));

      let createdCount = 0;
      const BATCH = 500;
      for (let i = 0; i < toInsert.length; i += BATCH) {
        const { error } = await supabase
          .from('pos_customers')
          .insert(toInsert.slice(i, i + BATCH));
        if (error) throw new Error(error.message);
        createdCount += toInsert.slice(i, i + BATCH).length;
      }

      // Bước 4: Update số liệu khách đã có
      let updatedCount = 0;
      for (const [id, agg] of aggByCustomer.entries()) {
        if (!existingIds.has(id)) continue;
        const { error } = await supabase
          .from('pos_customers')
          .update({
            total_spent: Math.round(agg.totalSpent),
            last_visit: agg.lastVisit || null,
            points: Math.round(agg.points),
          })
          .eq('id', id);
        if (error) throw new Error(error.message);
        updatedCount++;
      }

      res.json({ success: true, createdCount, updatedCount });
    } catch (error) {
      const msg = error instanceof Error ? error.message : String(error);
      res.status(500).json({ error: msg });
    }
  });

  return router;
}
