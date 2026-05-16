import { Router, RequestHandler } from 'express';
import { SupabaseClient } from '@supabase/supabase-js';

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
]);

const getErrorMessage = (error: unknown): string => {
  if (error instanceof Error) return error.message;
  return 'Unknown error';
};

const writeErrorResponse = (res: Parameters<RequestHandler>[1], fallback: string) =>
  res.status(500).json({ error: fallback });

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

async function setProductStock(supabase: SupabaseClient, productId: string, stock: number) {
  const { error } = await supabase
    .from('pos_products')
    .update({ stock: Math.max(0, Math.trunc(stock)) })
    .eq('id', productId);
  if (error) throw error;
}

async function adjustProductStock(supabase: SupabaseClient, productId: string, delta: number) {
  if (delta < 0) {
    const { error } = await supabase.rpc('decrement_product_stock', {
      p_product_id: productId,
      p_quantity: Math.abs(Math.trunc(delta)),
    });
    if (!error) return;
    if (!isInventoryRpcUnavailable(error)) throw error;
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
  await setProductStock(supabase, productId, currentStock + delta);
}

async function applyInventoryTransactionFallback(
  supabase: SupabaseClient,
  payload: Record<string, unknown>
) {
  const { error } = await supabase.from('inventory_transactions').upsert(payload, { onConflict: 'id' });
  if (error) throw error;

  const type = getTextField(payload, 'type');
  for (const item of getItems(payload)) {
    const productId = getTextField(item, 'productId');
    if (!productId) continue;

    if (type === 'Import') {
      await adjustProductStock(supabase, productId, getNumberField(item, 'quantity'));
    } else if (type === 'Sale') {
      await adjustProductStock(supabase, productId, -Math.abs(getNumberField(item, 'quantity')));
    } else if (type === 'Return') {
      await adjustProductStock(supabase, productId, Math.abs(getNumberField(item, 'quantity')));
    } else if (type === 'Check') {
      await setProductStock(supabase, productId, getNumberField(item, 'newStock'));
    }
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

async function auditLog(
  supabase: SupabaseClient,
  tableName: string,
  recordId: string,
  action: string,
  snapshot?: unknown
) {
  if (!AUDITED_TABLES.has(tableName)) return;
  try {
    await supabase.from('audit_logs').insert({
      table_name: tableName,
      record_id: recordId,
      action,
      snapshot: snapshot ?? null,
    });
  } catch {
    // Audit table may not exist in older local databases; do not fail the write.
  }
}

export function createDataRouter(supabase: SupabaseClient, requireAuth: RequestHandler): Router {
  const router = Router();

  router.post('/api/data/upsert', requireAuth, async (req, res) => {
    const tableName = resolveTable(req.body?.key);
    const payload = req.body?.payload;
    const recordId = String(req.body?.recordId || payload?.id || '');
    if (!tableName || !payload || !recordId) {
      return res.status(400).json({ error: 'Dữ liệu ghi không hợp lệ' });
    }

    try {
      const { error } = await supabase.from(tableName).upsert(payload, { onConflict: 'id' });
      if (error) throw error;
      await auditLog(supabase, tableName, recordId, 'upsert', payload);
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

    try {
      const chunkSize = 100;
      for (let i = 0; i < payload.length; i += chunkSize) {
        const chunk = payload.slice(i, i + chunkSize);
        const { error } = await supabase.from(tableName).upsert(chunk, { onConflict: 'id' });
        if (error) throw new Error(`Lỗi ở dòng ${i}: ${error.message}`);
      }
      await auditLog(supabase, tableName, '*', 'upsertMany', { count: payload.length });
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
      const { error } = await supabase.from(tableName).delete().eq('id', id);
      if (error) throw error;
      await auditLog(supabase, tableName, id, 'delete', snapshot);
      res.json({ ok: true });
    } catch (error: unknown) {
      console.error(`[DataRoute] delete failed [${tableName} - ${id}]:`, error);
      writeErrorResponse(res, 'Không thể xóa dữ liệu');
    }
  });

  router.post('/api/data/clear', requireAuth, async (req, res) => {
    const tableName = resolveTable(req.body?.key);
    if (!tableName) return res.status(400).json({ error: 'Bảng xóa không hợp lệ' });

    try {
      const { error } = await supabase
        .from(tableName)
        .delete()
        .neq('id', '00000000-0000-0000-0000-000000000000');
      if (error) throw error;
      await auditLog(supabase, tableName, '*', 'clearTable');
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
      if (['Sale', 'Return'].includes(getTextField(asRecord(payload), 'type'))) {
        await applyInventoryTransactionFallback(supabase, asRecord(payload));
      } else {
        const { error } = await supabase.rpc('apply_inventory_transaction_with_stock', {
          p_transaction: payload,
        });
        if (error) {
          if (!isInventoryRpcUnavailable(error)) throw error;
          await applyInventoryTransactionFallback(supabase, asRecord(payload));
        }
      }
      await auditLog(supabase, 'inventory_transactions', transactionId, 'applyWithStock', payload);
      res.json({ ok: true });
    } catch (error: unknown) {
      console.error(`[DataRoute] inventory apply failed [${transactionId}]:`, error);
      writeErrorResponse(res, 'Không thể áp dụng giao dịch tồn kho');
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
      if (['Sale', 'Return'].includes(getTextField(asRecord(snapshot), 'type'))) {
        await deleteInventoryTransactionFallback(supabase, transactionId);
      } else {
        const { error } = await supabase.rpc('delete_inventory_transaction_with_stock', {
          p_transaction_id: transactionId,
        });
        if (error) {
          if (!isInventoryRpcUnavailable(error)) throw error;
          await deleteInventoryTransactionFallback(supabase, transactionId);
        }
      }
      await auditLog(supabase, 'inventory_transactions', transactionId, 'deleteWithStock', snapshot);
      res.json({ ok: true });
    } catch (error: unknown) {
      console.error(`[DataRoute] inventory delete failed [${transactionId}]:`, error);
      writeErrorResponse(res, 'Không thể xóa giao dịch tồn kho');
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

  return router;
}
