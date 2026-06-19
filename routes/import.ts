import { Router, RequestHandler } from 'express';
import { SupabaseClient } from '@supabase/supabase-js';
import * as XLSX from 'xlsx';
import { createHash } from 'crypto';
import {
  generateId,
  cleanVNNumber,
  parseVNDate,
  buildVariantProductName,
  stripVariantProductNameSuffix,
  formatAutoSku,
} from '../src/lib';
import { EXCEL_MAX_ROWS, assertSafeExcelBuffer } from '../src/lib/excelSafety';

type KiotVietRevenueInput = {
  date?: string;
  revenue?: string | number;
};

type ParsedRevenueRecord = {
  date: string;
  amount: number;
};

type ExistingRevenueRecord = {
  id: string;
  date: string;
};

type ExistingProductRecord = {
  id: string;
  sku: string | null;
};

type ImportedProductRecord = Record<
  string,
  string | number | boolean | string[] | Record<string, string> | null
>;

type SpreadsheetCell = string | number | boolean | Date | null;
type SpreadsheetRow = SpreadsheetCell[];

const readSafeWorkbook = (buf: Buffer, fileName = 'Excel') => {
  assertSafeExcelBuffer(buf, fileName);
  return XLSX.read(buf, {
    type: 'buffer',
    cellDates: true,
    dense: true,
    sheetRows: EXCEL_MAX_ROWS,
  });
};

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

const parseVariantAttrText = (text: string): Record<string, string> => {
  const result: Record<string, string> = {};
  if (!text) return result;
  text.split('|').forEach(part => {
    const idx = part.indexOf(':');
    if (idx > 0) result[part.slice(0, idx).trim()] = part.slice(idx + 1).trim();
  });
  return result;
};

const stableUuidFromKey = (key: string) => {
  const hash = createHash('sha1').update(key).digest('hex').slice(0, 32).split('');
  hash[12] = '5';
  hash[16] = ((parseInt(hash[16], 16) & 0x3) | 0x8).toString(16);
  const id = hash.join('');
  return `${id.slice(0, 8)}-${id.slice(8, 12)}-${id.slice(12, 16)}-${id.slice(16, 20)}-${id.slice(20)}`;
};

const productIdFromSku = (sku: string) => stableUuidFromKey(`pos-product:${sku}`);
const parentIdFromRelatedSku = (sku: string) => stableUuidFromKey(`pos-product-parent:${sku}`);
const parentSkuFromRelatedSku = (sku: string) => `__PARENT__${sku}`;
const customerIdFromKiotVietCode = (code: string) => stableUuidFromKey(`kiotviet-customer:${code}`);
const supplierIdFromKiotVietCode = (code: string) => stableUuidFromKey(`kiotviet-supplier:${code}`);
const APP_SKU_PATTERN = /^SP\d{6}$/;
const MISSING_SCHEMA_COLUMN_RE =
  /Could not find the '([^']+)' column of 'pos_orders' in the schema cache/;
const GENERIC_MISSING_SCHEMA_COLUMN_RE =
  /Could not find the '([^']+)' column of '[^']+' in the schema cache/;
const OPTIONAL_POS_ORDER_COLUMNS = new Set([
  'channel',
  'channel_name',
  'created_by',
  'is_return',
  'price_book_id',
  'price_book_name',
  'status',
]);
const OPTIONAL_SUPPLIER_COLUMNS = new Set([
  'code',
  'phone',
  'email',
  'address',
  'supplier_group',
  'status',
  'notes',
  'company_name',
  'tax_code',
]);
const OPTIONAL_INVENTORY_TRANSACTION_COLUMNS = new Set([
  'note',
  'staff_id',
  'supplier_id',
  'supplier_name',
  'total_amount',
  'status',
  'balanced_date',
  'total_actual_qty',
  'total_diff',
  'increase_count',
  'decrease_count',
]);
const OPTIONAL_SUPPLIER_DEBT_COLUMNS = new Set(['description']);

const getNextSkuNumberFromValues = (skus: Iterable<string | null | undefined>) => {
  const skuNumbers = Array.from(skus)
    .map(sku => String(sku || '').trim())
    .filter(sku => APP_SKU_PATTERN.test(sku))
    .map(sku => Number(sku.slice(2)))
    .filter(num => Number.isFinite(num));

  return skuNumbers.length > 0 ? Math.max(...skuNumbers) + 1 : 1;
};

const removeColumns = <T extends Record<string, unknown>>(records: T[], columns: Set<string>) =>
  records.map(record => {
    const next = { ...record };
    for (const column of columns) delete next[column];
    return next;
  });

const upsertPosOrdersWithSchemaFallback = async (
  supabase: SupabaseClient,
  records: Record<string, unknown>[],
  batchSize: number
) => {
  const unsupportedColumns = new Set<string>();

  for (let i = 0; i < records.length; i += batchSize) {
    const batch = records.slice(i, i + batchSize);

    while (true) {
      const payload = removeColumns(batch, unsupportedColumns);
      const { error } = await supabase
        .from('pos_orders')
        .upsert(payload, { onConflict: 'id' });

      if (!error) break;

      const missingColumn = error.message.match(MISSING_SCHEMA_COLUMN_RE)?.[1];
      if (missingColumn && OPTIONAL_POS_ORDER_COLUMNS.has(missingColumn)) {
        unsupportedColumns.add(missingColumn);
        console.warn(
          `[Import Revenue] pos_orders thiếu cột "${missingColumn}", retry import không dùng cột này.`
        );
        continue;
      }

      throw error;
    }
  }

  return Array.from(unsupportedColumns);
};

const upsertWithSchemaFallback = async (
  supabase: SupabaseClient,
  table: string,
  records: Record<string, unknown>[],
  batchSize: number,
  optionalColumns: Set<string>
) => {
  const unsupportedColumns = new Set<string>();

  for (let i = 0; i < records.length; i += batchSize) {
    const batch = records.slice(i, i + batchSize);

    while (true) {
      const payload = removeColumns(batch, unsupportedColumns);
      const { error } = await supabase.from(table).upsert(payload, { onConflict: 'id' });

      if (!error) break;

      const missingColumn = error.message.match(GENERIC_MISSING_SCHEMA_COLUMN_RE)?.[1];
      if (missingColumn && optionalColumns.has(missingColumn)) {
        unsupportedColumns.add(missingColumn);
        console.warn(
          `[Import] ${table} thiếu cột "${missingColumn}", retry import không dùng cột này.`
        );
        continue;
      }

      throw error;
    }
  }

  return Array.from(unsupportedColumns);
};

const excelDateToIsoDate = (raw: SpreadsheetCell): string | null => {
  if (raw == null) return null;
  if (typeof raw === 'number' && raw > 40000) {
    const d = new Date((raw - 25569) * 86400 * 1000);
    return isNaN(d.getTime()) ? null : d.toISOString().split('T')[0];
  }
  if (raw instanceof Date) {
    return isNaN(raw.getTime()) ? null : raw.toISOString().split('T')[0];
  }
  const s = String(raw).trim();
  const isoMatch = s.match(/^(\d{4}-\d{2}-\d{2})/);
  if (isoMatch) return isoMatch[1];
  const dmyMatch = s.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})$/);
  if (dmyMatch) {
    const [, d, m, y] = dmyMatch;
    return `${y}-${m.padStart(2, '0')}-${d.padStart(2, '0')}`;
  }
  return null;
};

const pad2 = (value: number) => String(value).padStart(2, '0');

const formatLocalDateTimeParts = (
  year: number,
  month: number,
  day: number,
  hour = 0,
  minute = 0,
  second = 0
) =>
  `${year}-${pad2(month)}-${pad2(day)}T${pad2(hour)}:${pad2(minute)}:${pad2(second)}`;

const excelDateToLocalIsoDateTime = (raw: SpreadsheetCell): string | null => {
  if (raw == null) return null;
  if (typeof raw === 'number' && raw > 40000) {
    const d = new Date((raw - 25569) * 86400 * 1000);
    if (isNaN(d.getTime())) return null;
    return formatLocalDateTimeParts(
      d.getUTCFullYear(),
      d.getUTCMonth() + 1,
      d.getUTCDate(),
      d.getUTCHours(),
      d.getUTCMinutes(),
      d.getUTCSeconds()
    );
  }
  if (raw instanceof Date) {
    if (isNaN(raw.getTime())) return null;
    // XLSX tạo Date object theo local timezone — phải dùng local getters, không dùng UTC
    return formatLocalDateTimeParts(
      raw.getFullYear(),
      raw.getMonth() + 1,
      raw.getDate(),
      raw.getHours(),
      raw.getMinutes(),
      raw.getSeconds()
    );
  }
  const s = String(raw).trim();
  const isoMatch = s.match(
    /^(\d{4})-(\d{2})-(\d{2})(?:[T\s](\d{1,2}):(\d{2})(?::(\d{2}))?)?/
  );
  if (isoMatch) {
    const [, y, m, d, hh = '0', mm = '0', ss = '0'] = isoMatch;
    return formatLocalDateTimeParts(Number(y), Number(m), Number(d), Number(hh), Number(mm), Number(ss));
  }
  const dmyMatch = s.match(
    /^(\d{1,2})\/(\d{1,2})\/(\d{4})(?:\s+(\d{1,2}):(\d{2})(?::(\d{2}))?)?$/
  );
  if (dmyMatch) {
    const [, d, m, y, hh = '0', mm = '0', ss = '0'] = dmyMatch;
    return formatLocalDateTimeParts(Number(y), Number(m), Number(d), Number(hh), Number(mm), Number(ss));
  }
  return null;
};

const tierFromNetSpent = (amount: number): 'Standard' | 'Silver' | 'Gold' | 'Diamond' => {
  if (amount >= 10000000) return 'Diamond';
  if (amount >= 5000000) return 'Gold';
  if (amount >= 1000000) return 'Silver';
  return 'Standard';
};

export function createImportRouter(supabase: SupabaseClient, requireAuth: RequestHandler): Router {
  const router = Router();

  router.all('/api/sync-kiotviet*all', requireAuth, async (req, res) => {
    const { data } = req.body;
    if (!data || !Array.isArray(data)) {
      return res.status(400).json({ error: 'Dữ liệu không hợp lệ' });
    }

    try {
      const parsedData = data
        .map((item: KiotVietRevenueInput) => {
          const date = parseVNDate(item.date);
          const amount = cleanVNNumber(item.revenue);
          return { date, amount };
        })
        .filter(
          (item: { date: string | null; amount: number }): item is ParsedRevenueRecord =>
            !!item.date && item.amount > 0
        );

      if (parsedData.length === 0) {
        return res.status(400).json({ error: 'Không có dữ liệu hợp lệ' });
      }

      const dates = parsedData.map(d => d.date);
      const { data: existingRecords } = await supabase
        .from('revenue_records')
        .select('id, date')
        .in('date', dates);

      const existingMap = new Map(
        (existingRecords as ExistingRevenueRecord[] | null)?.map(r => [r.date, r.id]) || []
      );

      const recordsToUpsert = parsedData.map(item => {
        const existingId = existingMap.get(item.date!);
        return {
          id: existingId || generateId(),
          date: item.date,
          total_gross_revenue: item.amount,
          net_revenue: item.amount,
          gross_profit: item.amount,
          updated_at: new Date().toISOString(),
        };
      });

      const { error } = await supabase.from('revenue_records').upsert(recordsToUpsert);
      if (error) throw error;
      res.json({ success: true, count: recordsToUpsert.length });
    } catch (error: unknown) {
      console.error('KiotViet Sync Error:', error);
      res.status(500).json({ error: getErrorMessage(error) });
    }
  });

  router.post('/api/import/kiotviet-products', requireAuth, async (req, res) => {
    try {
      const { fileBase64 } = req.body as { fileBase64?: string };
      if (!fileBase64) return res.status(400).json({ error: 'fileBase64 là bắt buộc' });

      const buf = Buffer.from(fileBase64, 'base64');
      const wb = readSafeWorkbook(buf, 'Excel import');
      const ws = wb.Sheets[wb.SheetNames[0]];
      const rows = XLSX.utils.sheet_to_json<SpreadsheetRow>(ws, { header: 1, defval: null });

      if (rows.length < 2)
        return res.status(400).json({ error: 'File trống hoặc không có dữ liệu.' });

      const headers = rows[0];
      if (String(headers[2] || '').trim() !== 'Mã hàng') {
        return res
          .status(400)
          .json({ error: 'File không đúng định dạng KiotViet. Cột thứ 3 phải là "Mã hàng".' });
      }

      const { data: existing } = await supabase.from('pos_products').select('id, sku').limit(50000);
      const existingProducts = (existing || []) as ExistingProductRecord[];
      const skuToId = new Map<string, string>(
        existingProducts.filter(p => p.sku).map(p => [p.sku!, p.id])
      );
      const existingSkuSet = new Set(
        existingProducts.map(p => String(p.sku || '').trim()).filter(Boolean)
      );
      const assignedSkus = new Set<string>();
      let nextSkuNumber = getNextSkuNumberFromValues(existingSkuSet);
      const sourceSkuToFinalSku = new Map<string, string>();

      // Chỉ xử lý hàng có Mã hàng (cột 2). Hàng cha KiotViet không có mã → bỏ qua,
      // vì parent record sẽ được tạo tự động từ related_sku bên dưới.
      const dataRows = rows
        .slice(1)
        .filter(r => String(r[2] || '').trim() !== '');

      const finalSkusByRow = dataRows.map(r => {
        const sourceSku = String(r[2] || '').trim();
        let sku = sourceSku;
        // Chỉ sinh auto-code khi cột Mã hàng trống hoặc trùng trong file
        if (!sku || assignedSkus.has(sku)) {
          do {
            sku = formatAutoSku(nextSkuNumber);
            nextSkuNumber += 1;
          } while (existingSkuSet.has(sku) || assignedSkus.has(sku));
        }
        assignedSkus.add(sku);
        if (sourceSku && !sourceSkuToFinalSku.has(sourceSku))
          sourceSkuToFinalSku.set(sourceSku, sku);
        return sku;
      });

      const records = dataRows.map((r, rowIndex) => {
        const sku = finalSkusByRow[rowIndex];

        const maxStockRaw = Number(r[11] || 999999);
        const catRaw = String(r[1] || '').trim();
        const catId = catRaw.includes('>>') ? catRaw.split('>>').pop()!.trim() : catRaw || 'Khác';

        const attrStr = r[15] ? String(r[15]).trim() : '';
        const descStr = r[22] ? String(r[22]).trim() : '';
        const description = [attrStr, descStr].filter(Boolean).join(' | ') || null;

        const imgRaw = r[17] ? String(r[17]).trim() : '';
        const images = imgRaw
          ? imgRaw
              .split(',')
              .map((s: string) => s.trim())
              .filter(Boolean)
          : [];

        let createdAt: string | null = null;
        if (r[28]) {
          const d = r[28] instanceof Date ? r[28] : new Date(String(r[28]));
          if (!isNaN(d.getTime())) createdAt = d.toISOString();
        }

        const record: ImportedProductRecord = {
          id: skuToId.get(sku) || productIdFromSku(sku),
          sku,
          name: String(r[3] || '').trim(),
          category_id: catId,
          category_path: catRaw || null,
          brand: r[4] ? String(r[4]).trim() : null,
          sale_price: Number(r[5] || 0),
          import_price: Number(r[6] || 0),
          stock: Number(r[7] || 0),
          expected_out_of_stock: r[9] ? String(r[9]).trim() : null,
          min_stock: Number(r[10] || 0),
          max_stock: maxStockRaw >= 100000 ? 999999 : maxStockRaw,
          unit: r[12] ? String(r[12]).trim() : 'Đôi',
          base_unit_code: r[13] ? String(r[13]).trim() : null,
          conversion_value: Number(r[14] || 1),
          attributes_text: attrStr || null,
          variant_attributes: parseVariantAttrText(attrStr),
          description,
          images,
          note_template: r[23] ? String(r[23]).trim() : null,
          location: r[24] ? String(r[24]).trim() : null,
          components: r[25] ? String(r[25]).trim() : null,
          warranty: r[26] ? String(r[26]).trim() : null,
          periodic_maintenance: r[27] ? String(r[27]).trim() : null,
          allow_points: r[19] !== 0 && r[19] !== false,
          weight: r[18] ? Number(r[18]) : 0,
          status: r[20] === 0 || r[20] === false ? 'Inactive' : 'Active',
          customer_orders: Number(r[8] || 0),
          direct_sale: r[21] !== 0 && r[21] !== false,
          product_type: r[0] ? String(r[0]).trim() : 'Hàng hóa',
          ...(createdAt && { created_at: createdAt }),
        };

        const sourceRelatedSku = r[16] ? String(r[16]).trim() : null;
        const relatedSku = sourceRelatedSku
          ? sourceSkuToFinalSku.get(sourceRelatedSku) || sourceRelatedSku
          : null;
        if (relatedSku) record.related_sku = relatedSku;

        return record;
      });

      // Build parent-child từ related_sku (cột 16 KiotViet).
      // KiotViet dùng 1 SKU thật làm "mã liên quan", nhưng trong CFO Brain parent phải là
      // record logic riêng; toàn bộ SKU thật trong group, kể cả related_sku gốc, đều là child.
      const skuToRecord = new Map<string, ImportedProductRecord>(
        records.map(r => [String(r.sku), r])
      );
      const groupedByRelatedSku = new Map<string, ImportedProductRecord[]>();

      for (const r of records) {
        const relSku = r.related_sku ? String(r.related_sku) : '';
        if (!relSku) continue;
        if (!groupedByRelatedSku.has(relSku)) groupedByRelatedSku.set(relSku, []);
        groupedByRelatedSku.get(relSku)!.push(r);
      }

      const parentRecords: ImportedProductRecord[] = [];
      for (const [relSku, relatedRecords] of groupedByRelatedSku.entries()) {
        const baseRecord = skuToRecord.get(relSku);
        if (!baseRecord) continue;

        const childRecords = [baseRecord, ...relatedRecords.filter(r => r !== baseRecord)];
        const parentId = parentIdFromRelatedSku(relSku);
        const baseVariantName = stripVariantProductNameSuffix(
          String(baseRecord.name || ''),
          baseRecord.variant_attributes as Record<string, string>
        );

        for (const child of childRecords) {
          child.parent_id = parentId;
          child.is_parent = false;
          child.variant_count = 0;
          child.name = buildVariantProductName(
            String(baseVariantName || child.name || ''),
            child.variant_attributes as Record<string, string>
          );
        }

        const totalStock = childRecords.reduce((sum, child) => sum + Number(child.stock || 0), 0);
        const totalCustomerOrders = childRecords.reduce(
          (sum, child) => sum + Number(child.customer_orders || 0),
          0
        );
        const firstImageRecord = childRecords.find(child =>
          Array.isArray(child.images) ? child.images.length > 0 : false
        );

        parentRecords.push({
          ...baseRecord,
          id: parentId,
          sku: parentSkuFromRelatedSku(relSku),
          name: baseVariantName || baseRecord.name,
          parent_id: null,
          is_parent: true,
          variant_count: childRecords.length,
          variant_attributes: {},
          attributes_text: null,
          stock: totalStock,
          customer_orders: totalCustomerOrders,
          direct_sale: false,
          images: firstImageRecord?.images || baseRecord.images || [],
        });
      }

      for (const r of records) {
        if (!r.parent_id) {
          r.is_parent = false;
          r.variant_count = 0;
        }
        // related_sku chỉ dùng để build parent_id, không có cột này trong DB
        delete r.related_sku;
      }
      const recordsToUpsert = [...parentRecords, ...records];

      const BATCH = 300;
      let importedCount = 0;
      let errorCount = 0;
      let firstError: string | null = null;
      for (let i = 0; i < recordsToUpsert.length; i += BATCH) {
        const batch = recordsToUpsert.slice(i, i + BATCH);
        const { error: upsertErr } = await supabase
          .from('pos_products')
          .upsert(batch, { onConflict: 'id' });
        if (upsertErr) {
          console.error(`[Import] Batch ${i / BATCH + 1} lỗi:`, upsertErr.message);
          if (!firstError) firstError = upsertErr.message;
          errorCount += batch.length;
        } else {
          importedCount += batch.length;
        }
      }

      res.json({
        total: records.length,
        logicalParents: parentRecords.length,
        upserted: recordsToUpsert.length,
        imported: importedCount,
        errors: errorCount,
        firstError,
      });
    } catch (err: unknown) {
      const message = getErrorMessage(err);
      console.error('[Import /kiotviet-products]', message);
      res.status(500).json({ error: message || 'Lỗi xử lý file Excel' });
    }
  });

  const categoryCanHaveLocation = (path: string) => path.includes(' >> ');

  const sanitizeCategoryLocation = (path: string, location?: string) => {
    const trimmed = String(location || '').trim();
    return categoryCanHaveLocation(path) && trimmed ? trimmed : null;
  };

  // Rename / reparent a category — updates category_path on all affected products
  router.post('/api/categories/rename', requireAuth, async (req, res) => {
    try {
      const { oldPath, newPath, location } = req.body as {
        oldPath?: string;
        newPath?: string;
        location?: string;
      };
      if (!oldPath || !newPath) {
        return res.status(400).json({ ok: false, error: 'Thiếu oldPath hoặc newPath' });
      }

      // Fetch exact matches + children (paths that start with oldPath + ' >> ')
      const [{ data: exact }, { data: children }, { data: categoryExact }, { data: categoryChildren }] =
        await Promise.all([
        supabase.from('pos_products').select('id, category_path').eq('category_path', oldPath),
        supabase
          .from('pos_products')
          .select('id, category_path')
          .like('category_path', `${oldPath} >> %`),
        supabase.from('categories').select('path, location').eq('path', oldPath),
        supabase.from('categories').select('path, location').like('path', `${oldPath} >> %`),
      ]);

      const all = [...(exact ?? []), ...(children ?? [])];
      const updates = all.map((p: { id: string; category_path: string }) => ({
        id: p.id,
        category_path: p.category_path.startsWith(oldPath)
          ? newPath + p.category_path.slice(oldPath.length)
          : p.category_path,
      }));
      const categoryRows = [...(categoryExact ?? []), ...(categoryChildren ?? [])] as {
        path: string;
        location?: string | null;
      }[];
      const categoryUpserts = categoryRows.map(row => {
        const nextPath = row.path.startsWith(oldPath)
          ? newPath + row.path.slice(oldPath.length)
          : row.path;
        const nextLocation =
          row.path === oldPath
            ? sanitizeCategoryLocation(nextPath, location)
            : sanitizeCategoryLocation(nextPath, row.location || '');
        return { path: nextPath, location: nextLocation };
      });
      if (!categoryUpserts.some(row => row.path === newPath)) {
        categoryUpserts.push({
          path: newPath,
          location: sanitizeCategoryLocation(newPath, location),
        });
      }

      const BATCH = 300;
      let updated = 0;
      let firstError: string | null = null;
      for (let i = 0; i < updates.length; i += BATCH) {
        const { error } = await supabase
          .from('pos_products')
          .upsert(updates.slice(i, i + BATCH), { onConflict: 'id' });
        if (error) {
          if (!firstError) firstError = error.message;
        } else updated += Math.min(BATCH, updates.length - i);
      }

      if (categoryUpserts.length > 0) {
        const { error } = await supabase
          .from('categories')
          .upsert(categoryUpserts, { onConflict: 'path' });
        if (error && !firstError) firstError = error.message;
      }
      if (oldPath !== newPath && categoryRows.length > 0) {
        const oldPaths = categoryRows.map(row => row.path);
        const { error } = await supabase.from('categories').delete().in('path', oldPaths);
        if (error && !firstError) firstError = error.message;
      }

      if (firstError) return res.status(500).json({ ok: false, error: firstError });
      res.json({ ok: true, updated });
    } catch (err: unknown) {
      console.error('[Category rename] Error:', getErrorMessage(err));
      res.status(500).json({ ok: false, error: getErrorMessage(err) });
    }
  });

  router.get('/api/categories', requireAuth, async (_req, res) => {
    try {
      const { data, error } = await supabase.from('categories').select('path, location').order('path');
      if (error) return res.status(500).json({ ok: false, error: error.message });
      res.json({
        ok: true,
        categories: (data ?? []).map((r: { path: string; location?: string | null }) => ({
          path: r.path,
          location: categoryCanHaveLocation(r.path) ? r.location || '' : '',
        })),
      });
    } catch (err: unknown) {
      console.error('[Categories fetch] Error:', getErrorMessage(err));
      res.status(500).json({ ok: false, error: getErrorMessage(err) });
    }
  });

  router.post('/api/categories/create', requireAuth, async (req, res) => {
    try {
      const { path, location } = req.body as { path?: string; location?: string };
      if (!path?.trim()) return res.status(400).json({ ok: false, error: 'Thiếu path' });
      const normalizedPath = path.trim();
      const { error } = await supabase
        .from('categories')
        .upsert(
          { path: normalizedPath, location: sanitizeCategoryLocation(normalizedPath, location) },
          { onConflict: 'path' }
        );
      if (error) return res.status(500).json({ ok: false, error: error.message });
      res.json({ ok: true });
    } catch (err: unknown) {
      console.error('[Category create] Error:', getErrorMessage(err));
      res.status(500).json({ ok: false, error: getErrorMessage(err) });
    }
  });

  // Import doanh thu từ file "Báo cáo bán hàng theo lợi nhuận" của KiotViet
  router.post('/api/import/kiotviet-revenue', requireAuth, async (req, res) => {
    try {
      const { fileBase64 } = req.body as { fileBase64?: string };
      if (!fileBase64) return res.status(400).json({ error: 'fileBase64 là bắt buộc' });

      const buf = Buffer.from(fileBase64, 'base64');
      const wb = readSafeWorkbook(buf, 'Excel import');
      const ws = wb.Sheets[wb.SheetNames[0]];
      const rows = XLSX.utils.sheet_to_json<SpreadsheetRow>(ws, { header: 1, defval: null });

      if (rows.length < 2)
        return res.status(400).json({ error: 'File trống hoặc không có dữ liệu.' });

      const headers = rows[0];
      const col6Header = String(headers[6] || '').trim();

      // Nhận 2 format KiotViet:
      // "Theo thời gian": col6 = "Giá trị trả" — daily summary, mỗi ngày lặp lại cho từng giao dịch
      // "Theo lợi nhuận": col6 = "Mã giao dịch" — transaction-level với đầy đủ thông tin
      const isTheoThoiGian = col6Header === 'Giá trị trả';
      const isTheoLoiNhuan = col6Header === 'Mã giao dịch';
      if (!isTheoThoiGian && !isTheoLoiNhuan) {
        return res.status(400).json({
          error: `File không đúng định dạng. Cột 7 hiện là "${col6Header}". Cần dùng file "Báo cáo bán hàng theo thời gian" hoặc "theo lợi nhuận" từ KiotViet.`,
        });
      }

      const lastDayOfMonth = (yearMonth: string): string => {
        const [y, m] = yearMonth.split('-').map(Number);
        const d = new Date(y, m, 0).getDate();
        return `${yearMonth}-${d.toString().padStart(2, '0')}`;
      };

      // ── Pass 1: aggregate by day → revenue_records ──
      type DayAgg = {
        totalGross: number;   // doanh thu hàng hóa (không tính đơn trả)
        discount: number;
        returnsGross: number; // giá trị trả hàng (dương)
        netRev: number;
        cogs: number;
        profit: number;
      };
      const seenOrders = new Set<string>();
      const dateMap = new Map<string, DayAgg>();

      // ── Pass 2: aggregate by group + month → product_group_revenue ──
      type GroupAgg = { amount: number; qty: number; cogs: number };
      const groupMonthMap = new Map<string, GroupAgg>(); // key: "groupName|YYYY-MM"

      // ── Pass 4: khách hàng duy nhất từ "theo lợi nhuận" ──
      const customerMap = new Map<string, { name: string }>(); // key: customerId (UUID)

      // ── Pass 3: build pos_orders with line items ──
      type ImportedOrderItem = {
        productId: string;
        sku: string;
        name: string;
        quantity: number;
        price: number;
        discount: number;
        total: number;
      };
      type ImportedOrderData = {
        date: string;
        totalAmount: number;
        discount: number;
        finalAmount: number;
        isReturn: boolean;
        items: Map<string, ImportedOrderItem>;
      };
      const orderMap = new Map<string, ImportedOrderData>();

      if (isTheoThoiGian) {
        // ── Format "Báo cáo bán hàng theo thời gian" ──
        // Hỗ trợ cả "theo ngày" (date = "31/05/2024") và "theo tháng" (date = "05-2026" hoặc "05/2026")
        const parseDateOrMonth = (raw: unknown): string => {
          if (!raw) return '';
          const s = String(raw).trim();
          // Thử parse ngày đầy đủ trước
          const d = parseVNDate(s);
          if (d) return d;
          // Thử format "MM-YYYY" hoặc "MM/YYYY" → lấy ngày cuối tháng
          const m = s.match(/^(\d{1,2})[-\/](\d{4})$/);
          if (m) {
            const month = parseInt(m[1]), year = parseInt(m[2]);
            if (month >= 1 && month <= 12 && year > 1900) {
              const lastDay = new Date(year, month, 0).getDate();
              return `${year}-${String(month).padStart(2, '0')}-${String(lastDay).padStart(2, '0')}`;
            }
          }
          return '';
        };

        const seenDates = new Set<string>();
        for (const row of rows.slice(1)) {
          if (!row[0]) continue;
          const date = parseDateOrMonth(row[0]);
          if (!date || seenDates.has(date)) continue;
          seenDates.add(date);
          const gross = Math.abs(Number(row[2] || 0));
          const discount = Number(row[3] || 0); // âm theo KiotViet
          const returns = Math.abs(Number(row[6] || 0));
          const net = Number(row[7] || 0);
          dateMap.set(date, {
            totalGross: gross,
            discount,
            returnsGross: returns,
            netRev: net,
            cogs: 0,
            profit: net,
          });
        }
      } else {
        // ── Format "Báo cáo bán hàng theo lợi nhuận" ──
        // Transaction-level: col6=MãGiaoDịch, col8=datetime, col9=gross, col10=discount,
        //                    col11=finalAmount, col12=COGS, col13=profit
      for (const row of rows.slice(1)) {
        const orderCode = String(row[6] || '').trim();
        if (!orderCode) continue;

        const dateTime = excelDateToLocalIsoDateTime(row[8]);
        if (!dateTime) continue;
        const date = dateTime.slice(0, 10);
        const yearMonth = date.slice(0, 7); // "YYYY-MM"
        const finalAmount = Number(row[11] || 0);
        const isReturnOrder = /^TH/i.test(orderCode) || finalAmount < 0;

        // Day aggregation — dedup by order, tách gross bán vs gross trả
        if (!seenOrders.has(orderCode)) {
          seenOrders.add(orderCode);
          const prev: DayAgg = dateMap.get(date) ?? {
            totalGross: 0,
            discount: 0,
            returnsGross: 0,
            netRev: 0,
            cogs: 0,
            profit: 0,
          };
          const orderGross = Number(row[9] || 0);
          dateMap.set(date, {
            // Chỉ cộng gross vào đơn bán; đơn trả → lưu riêng vào returnsGross
            totalGross: isReturnOrder ? prev.totalGross : prev.totalGross + orderGross,
            discount: prev.discount + Number(row[10] || 0),
            returnsGross: isReturnOrder ? prev.returnsGross + Math.abs(orderGross) : prev.returnsGross,
            netRev: prev.netRev + Number(row[11] || 0),
            cogs: prev.cogs + Number(row[12] || 0),
            profit: prev.profit + Number(row[13] || 0),
          });
        }

        // Customer extraction — col15=Tên KH, col16=Mã KH
        const customerCode = String(row[16] || '').trim();
        const customerName = String(row[15] || '').trim();
        if (customerCode && customerName && !customerMap.has(customerIdFromKiotVietCode(customerCode))) {
          customerMap.set(customerIdFromKiotVietCode(customerCode), { name: customerName });
        }

        // Group aggregation — every line item counts
        const groupName = String(row[17] || '').trim();
        if (groupName) {
          const qty = Number(row[18] || 0);
          const price = Number(row[19] || 0);
          const cost = Number(row[20] || 0);
          const gmKey = `${groupName}|${yearMonth}`;
          const prev: GroupAgg = groupMonthMap.get(gmKey) ?? { amount: 0, qty: 0, cogs: 0 };
          groupMonthMap.set(gmKey, {
            amount: prev.amount + qty * price,
            qty: prev.qty + qty,
            cogs: prev.cogs + qty * cost,
          });
        }

        // Order + item building — one entry per order, one item per sku
        if (!orderMap.has(orderCode)) {
          orderMap.set(orderCode, {
            date: dateTime,
            totalAmount: Number(row[9] || 0),
            discount: Number(row[10] || 0),
            finalAmount,
            isReturn: isReturnOrder,
            items: new Map(),
          });
        }
        const sku = String(row[14] || '').trim();
        const itemName = String(row[15] || '').trim();
        const rawItemQty = Number(row[18] || 0);
        const itemQty = Math.abs(rawItemQty);
        const itemPrice = Number(row[19] || 0);
        if (sku && itemName && itemQty > 0) {
          const ord = orderMap.get(orderCode)!;
          const existingItem = ord.items.get(sku);
          if (existingItem) {
            existingItem.quantity += itemQty;
            existingItem.total += itemQty * itemPrice;
          } else {
            ord.items.set(sku, {
              productId: productIdFromSku(sku),
              sku,
              name: itemName,
              quantity: itemQty,
              price: itemPrice,
              discount: 0,
              total: itemQty * itemPrice,
            });
          }
        }
      }
      } // end else (isTheoLoiNhuan)

      if (dateMap.size === 0)
        return res.status(400).json({
          error: 'Không tìm thấy dữ liệu hợp lệ. Kiểm tra file: cột ngày phải chứa ngày hợp lệ và không rỗng.',
          debug: {
            totalRows: rows.length - 1,
            sample_col0: String(rows[1]?.[0] ?? ''),
            sample_col6: String(rows[1]?.[6] ?? ''),
            sample_col8: String(rows[1]?.[8] ?? ''),
          },
        });

      // ── Upsert revenue_records ──
      const dates = Array.from(dateMap.keys());
      const { data: existingRevRecords } = await supabase
        .from('revenue_records')
        .select('id, date')
        .in('date', dates);
      const existingDateMap = new Map(
        (existingRevRecords as ExistingRevenueRecord[] | null)?.map(r => [r.date, r.id]) ?? []
      );
      const revenueToUpsert = dates.map(date => {
        const d = dateMap.get(date)!;
        const base = {
          id: existingDateMap.get(date) ?? generateId(),
          date,
          total_gross_revenue: Math.round(d.totalGross),
          discount: Math.round(Math.abs(d.discount)),
          net_revenue: Math.round(d.netRev),
          returns_value: Math.round(d.returnsGross),
          revenue_other: 0,
        };
        // "Theo lợi nhuận" cung cấp COGS và lợi nhuận thực → ghi đè 2 cột này
        // "Theo thời gian" không có COGS → không gửi lên, Supabase giữ nguyên giá trị cũ
        if (isTheoLoiNhuan) {
          return { ...base, total_cogs: Math.round(d.cogs), gross_profit: Math.round(d.profit) };
        }
        return base;
      });

      const BATCH = 500;
      let firstError: string | null = null;
      for (let i = 0; i < revenueToUpsert.length; i += BATCH) {
        const { error: e } = await supabase
          .from('revenue_records')
          .upsert(revenueToUpsert.slice(i, i + BATCH), { onConflict: 'id' });
        if (e && !firstError) firstError = e.message;
      }
      if (firstError) throw new Error(firstError);

      // ── Upsert product_groups + product_group_revenue ──
      const uniqueGroupNames = Array.from(
        new Set(Array.from(groupMonthMap.keys()).map(k => k.split('|')[0]))
      );

      // Fetch existing groups to reuse their IDs
      const { data: existingGroups } = await supabase
        .from('product_groups')
        .select('id, name')
        .in('name', uniqueGroupNames);
      const groupNameToId = new Map<string, string>(
        (existingGroups as { id: string; name: string }[] | null)?.map(g => [g.name, g.id]) ?? []
      );

      // Create new groups for names not yet in DB
      const newGroups = uniqueGroupNames
        .filter(name => !groupNameToId.has(name))
        .map(name => {
          const id = stableUuidFromKey(`product-group:${name}`);
          groupNameToId.set(name, id);
          return { id, name };
        });
      if (newGroups.length > 0) {
        await supabase.from('product_groups').upsert(newGroups, { onConflict: 'id' });
      }

      // Build product_group_revenue records (stable ID = deterministic upsert)
      const groupRevToUpsert = Array.from(groupMonthMap.entries()).map(([key, agg]) => {
        const [groupName, yearMonth] = key.split('|');
        const date = lastDayOfMonth(yearMonth);
        const groupId = groupNameToId.get(groupName) ?? '';
        return {
          id: stableUuidFromKey(`pgr:${date}:${groupName}`),
          date,
          group_id: groupId || null,
          group_name: groupName,
          amount: Math.round(agg.amount),
          quantity: Math.round(agg.qty),
          cogs: Math.round(agg.cogs),
          net_revenue: Math.round(agg.amount),
          returns_quantity: 0,
          returns_value: 0,
        };
      });

      for (let i = 0; i < groupRevToUpsert.length; i += BATCH) {
        const { error: e } = await supabase
          .from('product_group_revenue')
          .upsert(groupRevToUpsert.slice(i, i + BATCH), { onConflict: 'id' });
        if (e && !firstError) firstError = e.message;
      }
      if (firstError) throw new Error(firstError);

      // ── Upsert pos_orders (merge strategy: fill gaps, keep existing data) ──
      const allOrderCodes = Array.from(orderMap.keys());
      type ExistingPosOrder = {
        id: string;
        order_code: string;
        customer_name: string | null;
        payment_method: string | null;
        staff_id: string | null;
        items: ImportedOrderItem[] | null;
      };
      const existingPosOrderMap = new Map<string, ExistingPosOrder>();
      for (let i = 0; i < allOrderCodes.length; i += BATCH) {
        const { data: chunk } = await supabase
          .from('pos_orders')
          .select('id, order_code, customer_name, payment_method, staff_id, items')
          .in('order_code', allOrderCodes.slice(i, i + BATCH));
        for (const o of (chunk as ExistingPosOrder[] | null) ?? []) {
          existingPosOrderMap.set(o.order_code, o);
        }
      }

      const ordersToUpsert = allOrderCodes.map(orderCode => {
        const newData = orderMap.get(orderCode)!;
        const existing = existingPosOrderMap.get(orderCode);

        // Merge items: keep existing items first, then add new skus not yet present
        const mergedItems = new Map<string, ImportedOrderItem>();
        for (const item of (existing?.items ?? [])) {
          mergedItems.set(item.sku, item);
        }
        for (const [sku, item] of newData.items) {
          if (!mergedItems.has(sku)) mergedItems.set(sku, item);
        }

        return {
          id: existing?.id ?? stableUuidFromKey(`pos-order:${orderCode}`),
          order_code: orderCode,
          date: newData.date,
          total_amount: newData.totalAmount,
          discount: newData.discount,
          final_amount: newData.finalAmount,
          items: Array.from(mergedItems.values()),
          // COALESCE: chỉ điền field còn null, không ghi đè data đã có
          customer_name: existing?.customer_name ?? null,
          payment_method: existing?.payment_method ?? 'Cash',
          staff_id: existing?.staff_id ?? '',
          status: 'completed',
          channel: 'direct',
          points_earned: 0,
          is_return: newData.isReturn,
        };
      });

      const skippedPosOrderColumns = await upsertPosOrdersWithSchemaFallback(
        supabase,
        ordersToUpsert,
        BATCH
      );

      // ── Tự động tạo khách hàng mới từ file "theo lợi nhuận" ──
      let newCustomersCount = 0;
      if (customerMap.size > 0) {
        const customerIds = Array.from(customerMap.keys());
        const existingCustomerIds = new Set<string>();
        for (let i = 0; i < customerIds.length; i += BATCH) {
          const { data: existing } = await supabase
            .from('pos_customers')
            .select('id')
            .in('id', customerIds.slice(i, i + BATCH));
          (existing as { id: string }[] | null)?.forEach(c => existingCustomerIds.add(c.id));
        }
        const toInsert = customerIds
          .filter(id => !existingCustomerIds.has(id))
          .map(id => ({
            id,
            name: customerMap.get(id)!.name,
            phone: '',
            points: 0,
            total_spent: 0,
            tier: 'Standard',
          }));
        for (let i = 0; i < toInsert.length; i += BATCH) {
          const { error: e } = await supabase
            .from('pos_customers')
            .insert(toInsert.slice(i, i + BATCH));
          if (e && !firstError) firstError = e.message;
        }
        if (firstError) throw new Error(firstError);
        newCustomersCount = toInsert.length;
      }

      res.json({
        success: true,
        days: dateMap.size,
        orders: seenOrders.size,
        ordersUpserted: ordersToUpsert.length,
        groups: uniqueGroupNames.length,
        groupMonths: groupRevToUpsert.length,
        newCustomers: newCustomersCount,
        skippedPosOrderColumns,
      });
    } catch (error: unknown) {
      console.error('[Import /kiotviet-revenue]', getErrorMessage(error));
      res.status(500).json({ error: getErrorMessage(error) });
    }
  });

  router.post('/api/import/kiotviet-customers', requireAuth, async (req, res) => {
    try {
      const { fileBase64 } = req.body as { fileBase64?: string };
      if (!fileBase64) return res.status(400).json({ error: 'fileBase64 là bắt buộc' });

      const buf = Buffer.from(fileBase64, 'base64');
      const wb = readSafeWorkbook(buf, 'Excel import');
      const ws = wb.Sheets[wb.SheetNames[0]];
      const rows = XLSX.utils.sheet_to_json<SpreadsheetRow>(ws, { header: 1, defval: null });

      if (rows.length < 2)
        return res.status(400).json({ error: 'File trống hoặc không có dữ liệu.' });

      const headers = rows[0];
      const col0Header = String(headers[0] || '').trim();
      const col11Header = String(headers[11] || '').trim();

      // ── Format "Báo cáo lợi nhuận theo khách hàng" ──
      // col0=Mã khách hàng, col1=Khách hàng, col2=SĐT, col8=Doanh thu thuần
      if (col0Header === 'Mã khách hàng') {
        const toUpsert = rows.slice(1)
          .filter(row => {
            const code = String(row[0] || '').trim();
            return code && code !== 'Khách lẻ' && /^KH/i.test(code);
          })
          .map(row => {
            const code = String(row[0] || '').trim();
            const name = String(row[1] || '').trim();
            const phone = String(row[2] || '').trim();
            const net = Number(row[8] || 0);
            return {
              id: customerIdFromKiotVietCode(code),
              name: name || code,
              phone,
              points: 0,
              total_spent: Math.round(net),
              tier: tierFromNetSpent(net),
            };
          });

        if (toUpsert.length === 0)
          return res.status(400).json({ error: 'Không có khách hàng hợp lệ trong file.' });

        const batchSize = 500;
        let upserted = 0;
        for (let i = 0; i < toUpsert.length; i += batchSize) {
          const { error } = await supabase
            .from('pos_customers')
            .upsert(toUpsert.slice(i, i + batchSize), { onConflict: 'id' });
          if (error) throw new Error(error.message);
          upserted += toUpsert.slice(i, i + batchSize).length;
        }
        return res.json({ success: true, upserted, message: `Đã import ${upserted} khách hàng. Tải lại trang để thấy dữ liệu.` });
      }

      if (col0Header !== 'Mã KH' || col11Header !== 'Mã giao dịch') {
        return res.status(400).json({
          error: `File không đúng định dạng. Cần file "Báo cáo lợi nhuận theo khách hàng" (cột 1 = "Mã khách hàng") hoặc file giao dịch KiotViet (cột 1 = "Mã KH"). Hiện là "${col0Header}".`,
        });
      }

      type CustomerAgg = {
        id: string;
        code: string;
        name: string;
        phone: string;
        group: string;
        orders: number;
        returns: number;
        gross: number;
        discount: number;
        revenue: number;
        returnValue: number;
        net: number;
        lastVisit: string;
      };

      const customerMap = new Map<string, CustomerAgg>();
      const orderCustomerMap = new Map<string, { customerId: string; customerName: string }>();
      let guestRows = 0;

      for (const row of rows.slice(1)) {
        const code = String(row[0] || '').trim();
        const name = String(row[1] || '').trim();
        if (!code || code === 'Khách lẻ') {
          if (code === 'Khách lẻ') guestRows += 1;
          continue;
        }

        const customerId = customerIdFromKiotVietCode(code);
        const visitDate = excelDateToIsoDate(row[12]) || '';
        if (!customerMap.has(code)) {
          customerMap.set(code, {
            id: customerId,
            code,
            name: name || code,
            phone: String(row[2] || '').trim(),
            group: String(row[3] || '').trim(),
            orders: Number(row[4] || 0),
            gross: Number(row[5] || 0),
            discount: Number(row[6] || 0),
            revenue: Number(row[7] || 0),
            returns: Number(row[8] || 0),
            returnValue: Number(row[9] || 0),
            net: Number(row[10] || 0),
            lastVisit: visitDate,
          });
        } else {
          const current = customerMap.get(code)!;
          if (!current.phone) current.phone = String(row[2] || '').trim();
          if (!current.group) current.group = String(row[3] || '').trim();
          if (visitDate && (!current.lastVisit || visitDate > current.lastVisit)) {
            current.lastVisit = visitDate;
          }
        }

        const orderCode = String(row[11] || '').trim();
        if (orderCode) orderCustomerMap.set(orderCode, { customerId, customerName: name || code });
      }

      const customers = Array.from(customerMap.values());
      if (customers.length === 0)
        return res.status(400).json({
          error: `Không tìm thấy khách hàng hợp lệ. File có ${guestRows} dòng Khách lẻ, các dòng này không import vào CRM.`,
        });

      const BATCH = 500;
      const customersToUpsert = customers.map(c => ({
        id: c.id,
        name: c.name,
        phone: c.phone,
        email: null,
        address: null,
        notes: [
          `Mã KH KiotViet: ${c.code}`,
          c.group ? `Nhóm KiotViet: ${c.group}` : '',
          `SL đơn bán: ${c.orders}`,
          `SL đơn trả: ${c.returns}`,
          `Doanh thu KiotViet: ${Math.round(c.revenue)}`,
          `Giá trị trả KiotViet: ${Math.round(c.returnValue)}`,
        ]
          .filter(Boolean)
          .join('\n'),
        points: 0,
        total_spent: Math.round(c.net),
        last_visit: c.lastVisit || null,
        tier: tierFromNetSpent(c.net),
      }));

      let firstError: string | null = null;
      for (let i = 0; i < customersToUpsert.length; i += BATCH) {
        const { error } = await supabase
          .from('pos_customers')
          .upsert(customersToUpsert.slice(i, i + BATCH), { onConflict: 'id' });
        if (error && !firstError) firstError = error.message;
      }
      if (firstError) throw new Error(firstError);

      const allOrderCodes = Array.from(orderCustomerMap.keys());
      let matchedOrders = 0;
      for (let i = 0; i < allOrderCodes.length; i += BATCH) {
        const chunkCodes = allOrderCodes.slice(i, i + BATCH);
        const { data: existingOrders, error } = await supabase
          .from('pos_orders')
          .select('id, order_code')
          .in('order_code', chunkCodes);
        if (error) throw error;

        const updatesByCustomer = new Map<
          string,
          { customer_id: string; customer_name: string; ids: string[] }
        >();
        for (const order of (existingOrders as { id: string; order_code: string }[] | null) ?? []) {
          const customer = orderCustomerMap.get(order.order_code);
          if (!customer) continue;
          const key = `${customer.customerId}|${customer.customerName}`;
          const group =
            updatesByCustomer.get(key) ?? {
              customer_id: customer.customerId,
              customer_name: customer.customerName,
              ids: [],
            };
          group.ids.push(order.id);
          updatesByCustomer.set(key, group);
        }

        for (const group of updatesByCustomer.values()) {
          matchedOrders += group.ids.length;
          const { error: updateError } = await supabase
            .from('pos_orders')
            .update({ customer_id: group.customer_id, customer_name: group.customer_name })
            .in('id', group.ids);
          if (updateError) throw updateError;
        }
      }

      res.json({
        success: true,
        customers: customers.length,
        guestRows,
        orderLinks: orderCustomerMap.size,
        matchedOrders,
      });
    } catch (error: unknown) {
      console.error('[Import /kiotviet-customers]', getErrorMessage(error));
      res.status(500).json({ error: getErrorMessage(error) });
    }
  });

  // Import "Danh sách chi tiết hoá đơn" từ trang Hoá đơn KiotViet
  // Tự động tạo: khách hàng + đơn hàng pos_orders + revenue_records theo tháng
  router.post('/api/import/kiotviet-invoices', requireAuth, async (req, res) => {
    try {
      const { fileBase64 } = req.body as { fileBase64?: string };
      if (!fileBase64) return res.status(400).json({ error: 'fileBase64 là bắt buộc' });

      const buf = Buffer.from(fileBase64, 'base64');
      const wb = readSafeWorkbook(buf, 'Excel import');
      const ws = wb.Sheets[wb.SheetNames[0]];
      const rows = XLSX.utils.sheet_to_json<SpreadsheetRow>(ws, { header: 1, defval: null });

      if (rows.length < 2) return res.status(400).json({ error: 'File trống.' });

      const h = rows[0];
      if (String(h[1] || '').trim() !== 'Mã hóa đơn' || String(h[12] || '').trim() !== 'Mã khách hàng') {
        return res.status(400).json({
          error: `File không đúng định dạng. Cần file "Danh sách chi tiết hoá đơn" từ KiotViet. Cột 2 hiện là "${h[1]}".`,
        });
      }

      type CustInfo  = { name: string; phone: string; email: string; address: string };
      type OrdItem   = { productId: string; sku: string; name: string; quantity: number; price: number; discount: number; total: number };
      type OrdData   = { date: string; customerId: string | null; customerName: string; staffId: string; staffName: string; channel: string; notes: string; totalAmount: number; discount: number; finalAmount: number; paymentMethod: 'Cash'|'Bank'|'Momo'|'Other'; isReturn: boolean; items: Map<string, OrdItem> };
      type MonthAgg  = { totalGross: number; discount: number; returnsGross: number; netRev: number };

      const customerMap  = new Map<string, CustInfo>();
      const orderMap     = new Map<string, OrdData>();
      const monthMap     = new Map<string, MonthAgg>();
      const seenInvoices = new Set<string>();

      for (const row of rows.slice(1)) {
        const invoiceCode = String(row[1] || '').trim();
        if (!invoiceCode) continue;

        const dateTime = excelDateToLocalIsoDateTime(row[6]);
        if (!dateTime) continue;
        const date      = dateTime.slice(0, 10);
        const yearMonth = date.slice(0, 7);

        const customerCode = String(row[12] || '').trim();
        const customerName = String(row[13] || '').trim();
        const isRealCustomer = customerCode && customerCode !== 'Khách lẻ' && /^KH/i.test(customerCode);

        if (isRealCustomer && !customerMap.has(customerCode)) {
          customerMap.set(customerCode, {
            name: customerName,
            phone:   String(row[15] || '').trim(),
            email:   String(row[14] || '').trim(),
            address: String(row[16] || '').trim(),
          });
        }

        const totalAmount = Math.abs(Number(row[38] || 0));
        const discountAmt = Math.abs(Number(row[39] || 0)); // KiotViet đôi khi export âm
        const finalAmount = Math.abs(Number(row[41] || 0));
        // "Mã trả hàng" (row[11]) trong file hoá đơn bán = mã tham chiếu phiếu trả liên kết,
        // KHÔNG có nghĩa là hoá đơn này là đơn trả. Chỉ nhận đơn trả khi mã HĐ bắt đầu bằng "TH".
        const isReturn    = /^TH/i.test(invoiceCode);

        let paymentMethod: 'Cash'|'Bank'|'Momo'|'Other' = 'Cash';
        if (Number(row[46] || 0) > 0)      paymentMethod = 'Bank';
        else if (Number(row[45] || 0) > 0) paymentMethod = 'Momo';
        else if (Number(row[44] || 0) > 0) paymentMethod = 'Other';

        if (!orderMap.has(invoiceCode)) {
          orderMap.set(invoiceCode, {
            date: dateTime,
            customerId:    isRealCustomer ? customerIdFromKiotVietCode(customerCode) : null,
            customerName,
            staffName:     String(row[21] || '').trim(),
            staffId:       String(row[21] || '').trim() ? stableUuidFromKey(`kiotviet-staff:${String(row[21]).trim()}`) : '',
            channel:       String(row[22] || '').trim(),
            notes:         String(row[37] || '').trim(),
            totalAmount, discount: discountAmt, finalAmount, paymentMethod, isReturn,
            items: new Map(),
          });
        }

        const sku = String(row[52] || '').trim();
        const qty = Number(row[57] || 0);
        if (sku && qty !== 0) {
          const ord = orderMap.get(invoiceCode)!;
          const productId = stableUuidFromKey(`kiotviet-product:${sku}`);
          const existing  = ord.items.get(sku);
          if (existing) { existing.quantity += qty; existing.total += Number(row[62] || 0); }
          else ord.items.set(sku, { productId, sku, name: String(row[53] || '').trim(), quantity: qty, price: Number(row[61] || 0), discount: Number(row[60] || 0), total: Number(row[62] || 0) });
        }

        // Month + day aggregation — count each invoice only once
        if (!seenInvoices.has(invoiceCode)) {
          seenInvoices.add(invoiceCode);
          const prev = monthMap.get(yearMonth) ?? { totalGross: 0, discount: 0, returnsGross: 0, netRev: 0 };
          if (!isReturn) {
            monthMap.set(yearMonth, { ...prev, totalGross: prev.totalGross + totalAmount, discount: prev.discount + discountAmt, netRev: prev.netRev + finalAmount });
          } else {
            monthMap.set(yearMonth, { ...prev, returnsGross: prev.returnsGross + Math.abs(finalAmount), netRev: prev.netRev - Math.abs(finalAmount) });
          }
        }
      }

      const IBATCH = 500;
      let firstError: string | null = null;

      // ── 1. Khách hàng ──
      // Tính customer stats từ orderMap
      const customerStats = new Map<string, { totalSpent: number; lastVisit: string }>();
      for (const ord of orderMap.values()) {
        if (!ord.customerId) continue;
        const prev = customerStats.get(ord.customerId) ?? { totalSpent: 0, lastVisit: '' };
        const spentDelta = ord.isReturn ? -Math.abs(ord.finalAmount) : ord.finalAmount;
        const day = ord.date.slice(0, 10);
        customerStats.set(ord.customerId, {
          totalSpent: Math.max(0, prev.totalSpent + spentDelta),
          lastVisit: day > prev.lastVisit ? day : prev.lastVisit,
        });
      }
      const customersToUpsert = Array.from(customerMap.entries()).map(([code, c]) => {
        const cid   = customerIdFromKiotVietCode(code);
        const stats = customerStats.get(cid);
        return {
          id:          cid,
          name:        c.name || code,
          phone:       c.phone,
          email:       c.email   || null,
          address:     c.address || null,
          points:      0,
          total_spent: stats?.totalSpent ?? 0,
          last_visit:  stats?.lastVisit  || null,
          tier:        'Standard',
        };
      });
      for (let i = 0; i < customersToUpsert.length; i += IBATCH) {
        const { error } = await supabase.from('pos_customers').upsert(customersToUpsert.slice(i, i + IBATCH), { onConflict: 'id' });
        if (error && !firstError) firstError = error.message;
      }
      if (firstError) throw new Error(firstError);

      // ── 2. Đơn hàng pos_orders ──
      const allCodes = Array.from(orderMap.keys());
      type ExOrd = { id: string; order_code: string; customer_name: string | null; payment_method: string | null; staff_id: string | null; staff_name: string | null; items: OrdItem[] | null };
      const existingOrdMap = new Map<string, ExOrd>();
      for (let i = 0; i < allCodes.length; i += IBATCH) {
        const { data: chunk } = await supabase.from('pos_orders').select('id, order_code, customer_name, payment_method, staff_id, staff_name, items').in('order_code', allCodes.slice(i, i + IBATCH));
        for (const o of (chunk as ExOrd[] | null) ?? []) existingOrdMap.set(o.order_code, o);
      }
      const ordersToUpsert = allCodes.map(code => {
        const d  = orderMap.get(code)!;
        const ex = existingOrdMap.get(code);
        return {
          id:             ex?.id ?? stableUuidFromKey(`kiotviet-order:${code}`),
          order_code:     code,
          date:           d.date,
          customer_id:    d.customerId,
          customer_name:  d.customerName || ex?.customer_name || null,
          staff_name:     d.staffName    || ex?.staff_name    || null,
          staff_id:       d.staffId      || ex?.staff_id      || null,
          channel:        d.channel || null,
          notes:          d.notes   || null,
          total_amount:   d.totalAmount,
          discount:       d.discount,
          final_amount:   d.finalAmount,
          payment_method: d.paymentMethod,
          is_return:      d.isReturn,
          // KiotViet: đơn trả → refund_amount = finalAmount (tiền shop hoàn cho khách)
          refund_amount:  d.isReturn ? Math.abs(d.finalAmount) : 0,
          points_earned:  0,
          items:          Array.from(d.items.values()).length > 0 ? Array.from(d.items.values()) : (ex?.items ?? []),
        };
      });
      const skipped = await upsertPosOrdersWithSchemaFallback(supabase, ordersToUpsert, IBATCH);

      // ── 3. Revenue records — tính lại từ pos_orders trong DB ──
      // Dùng DB thay vì dữ liệu file để tránh lỗi khi 2 file giao nhau ngày:
      // sau khi upsert orders, query lại toàn bộ orders trong khoảng ngày bị ảnh hưởng
      // → aggregate → ghi revenue_records luôn đúng bất kể thứ tự import.
      const affectedDates = Array.from(new Set(ordersToUpsert.map(o => o.date.slice(0, 10))));
      if (affectedDates.length > 0) {
        const minDate = affectedDates.reduce((a, b) => (a < b ? a : b));
        const dayAfterMax = (() => {
          const d = new Date(affectedDates.reduce((a, b) => (a > b ? a : b)));
          d.setDate(d.getDate() + 1);
          return d.toISOString().slice(0, 10);
        })();

        type DBOrder = { date: string; total_amount: number; discount: number; final_amount: number; is_return: boolean; refund_amount: number };
        const { data: dbOrders } = await supabase
          .from('pos_orders')
          .select('date, total_amount, discount, final_amount, is_return, refund_amount')
          .gte('date', minDate)
          .lt('date', dayAfterMax);

        type DayRev = { totalGross: number; discount: number; netRev: number; returnsGross: number };
        const revenueByDate = new Map<string, DayRev>(
          affectedDates.map(d => [d, { totalGross: 0, discount: 0, netRev: 0, returnsGross: 0 }])
        );
        for (const ord of (dbOrders ?? []) as DBOrder[]) {
          const day = ord.date.slice(0, 10);
          const prev = revenueByDate.get(day);
          if (!prev) continue;
          if (!ord.is_return) {
            revenueByDate.set(day, {
              totalGross:   prev.totalGross + (ord.total_amount ?? 0),
              discount:     prev.discount   + (ord.discount ?? 0),
              netRev:       prev.netRev     + (ord.final_amount ?? 0),
              returnsGross: prev.returnsGross,
            });
          } else {
            const returnAmt = Math.abs(ord.refund_amount || ord.final_amount || 0);
            revenueByDate.set(day, {
              ...prev,
              returnsGross: prev.returnsGross + returnAmt,
              netRev:       prev.netRev       - returnAmt,
            });
          }
        }

        const { data: existingRevRecords } = await supabase
          .from('revenue_records')
          .select('id, date')
          .in('date', affectedDates);
        const existingDateMap = new Map(
          (existingRevRecords as ExistingRevenueRecord[] | null)?.map(r => [r.date, r.id]) ?? []
        );
        const revenueToUpsert = affectedDates.map(date => {
          const d = revenueByDate.get(date)!;
          return {
            id:                  existingDateMap.get(date) ?? generateId(),
            date,
            total_gross_revenue: Math.round(d.totalGross),
            discount:            Math.round(Math.abs(d.discount)),
            net_revenue:         Math.round(d.netRev),
            returns_value:       Math.round(d.returnsGross),
            revenue_other:       0,
          };
        });
        for (let i = 0; i < revenueToUpsert.length; i += IBATCH) {
          const { error: e } = await supabase
            .from('revenue_records')
            .upsert(revenueToUpsert.slice(i, i + IBATCH), { onConflict: 'id' });
          if (e && !firstError) firstError = e.message;
        }
        if (firstError) throw new Error(firstError);
      }

      res.json({ success: true, customers: customersToUpsert.length, orders: ordersToUpsert.length, revenuedays: affectedDates.length, skipped });
    } catch (error: unknown) {
      console.error('[Import /kiotviet-invoices]', getErrorMessage(error));
      res.status(500).json({ error: getErrorMessage(error) });
    }
  });

  router.post('/api/import/kiotviet-purchase-details', requireAuth, async (req, res) => {
    try {
      const { fileBase64 } = req.body as { fileBase64?: string };
      if (!fileBase64) return res.status(400).json({ error: 'fileBase64 là bắt buộc' });

      const buf = Buffer.from(fileBase64, 'base64');
      const wb = readSafeWorkbook(buf, 'Excel import');
      const ws = wb.Sheets[wb.SheetNames[0]];
      const rows = XLSX.utils.sheet_to_json<SpreadsheetRow>(ws, { header: 1, defval: null });

      if (rows.length < 2)
        return res.status(400).json({ error: 'File trống hoặc không có dữ liệu.' });

      const headers = rows[0];
      // Dùng tên cột thay vì chỉ số cứng — không bị ảnh hưởng khi KiotViet thêm/bớt cột
      const colMap = new Map<string, number>();
      (headers as unknown[]).forEach((h, i) => { if (h) colMap.set(String(h).trim(), i); });
      const c = (name: string) => colMap.get(name) ?? -1;

      if (!colMap.has('Mã nhập hàng') || !colMap.has('Mã hàng') || !colMap.has('Số lượng')) {
        return res.status(400).json({
          error: `File không đúng định dạng. Cần file "Danh sách chi tiết nhập hàng" từ KiotViet. Headers tìm thấy: ${Array.from(colMap.keys()).slice(0, 10).join(', ')}`,
        });
      }

      type PurchaseItem = {
        productId: string;
        sku: string;
        name: string;
        productName: string;
        quantity: number;
        price: number;
        discount: number;
        costMethod: 'fixed' | 'average';
        nextImportPrice: number;
        note?: string;
      };

      type PurchaseAgg = {
        code: string;
        date: string;
        supplierId: string;
        supplierCode: string;
        supplierName: string;
        staffName: string;
        totalAmount: number;
        totalGoods: number;
        discount: number;
        payable: number;
        paid: number;
        totalQuantity: number;
        totalSkus: number;
        note: string;
        items: Map<string, PurchaseItem>;
      };

      type SupplierAgg = {
        id: string;
        code: string;
        name: string;
        phone: string;
        address: string;
      };

      const suppliers = new Map<string, SupplierAgg>();
      const purchases = new Map<string, PurchaseAgg>();
      const skippedByStatus = new Map<string, number>();
      let detailRows = 0;

      for (const row of rows.slice(1)) {
        const purchaseCode = String(row[c('Mã nhập hàng')] || '').trim();
        const supplierCode = String(row[c('Mã nhà cung cấp')] || '').trim();
        const supplierName = String(row[c('Tên nhà cung cấp')] || '').trim();
        const sku = String(row[c('Mã hàng')] || '').trim();
        const productName = String(row[c('Tên hàng')] || '').trim();
        const status = String(row[c('Trạng thái')] || '').trim();
        if (!purchaseCode || !supplierCode || !supplierName || !sku || !productName) continue;

        if (status !== 'Đã nhập hàng') {
          skippedByStatus.set(status || 'Không rõ', (skippedByStatus.get(status || 'Không rõ') || 0) + 1);
          continue;
        }

        const dateTime = excelDateToLocalIsoDateTime(row[c('Thời gian')]);
        if (!dateTime) continue;

        detailRows += 1;
        const supplierId = supplierIdFromKiotVietCode(supplierCode);
        if (!suppliers.has(supplierCode)) {
          suppliers.set(supplierCode, {
            id: supplierId,
            code: supplierCode,
            name: supplierName,
            phone: String(row[c('Điện thoại')] || '').trim(),
            address: String(row[c('Địa chỉ')] || '').trim(),
          });
        }

        const cPayable = c('Cần trả NCC');
        const cGiaNhap = c('Giá nhập');
        if (!purchases.has(purchaseCode)) {
          purchases.set(purchaseCode, {
            code: purchaseCode,
            date: dateTime,
            supplierId,
            supplierCode,
            supplierName,
            staffName: String(row[c('Người nhập')] || row[c('Người tạo')] || '').trim(),
            totalGoods: Number(row[c('Tổng tiền hàng')] || 0),
            discount: Number(row[c('Giảm giá phiếu nhập')] || 0),
            payable: Number(row[cPayable] || 0),
            paid: Number(row[c('Tiền đã trả NCC')] || 0),
            totalAmount: Number(row[cPayable] || row[cGiaNhap] || 0),
            totalQuantity: Number(row[c('Tổng số lượng')] || 0),
            totalSkus: Number(row[c('Tổng số mặt hàng')] || 0),
            note: String(row[c('Ghi chú')] || '').trim(),
            items: new Map(),
          });
        }

        const purchase = purchases.get(purchaseCode)!;
        const quantity = Number(row[c('Số lượng')] || 0);
        const importPrice = Number(row[cGiaNhap] || row[c('Đơn giá')] || 0);
        const lineDiscount = Number(row[c('Giảm giá')] || 0);
        const unit = String(row[c('ĐVT')] || '').trim();
        const brand = String(row[c('Thương hiệu')] || '').trim();
        const cThanhTien = c('Thành tiền');
        const noteParts = [
          unit ? `ĐVT: ${unit}` : '',
          brand ? `Thương hiệu: ${brand}` : '',
          row[c('Ghi chú hàng hóa')] ? `Ghi chú HH: ${String(row[c('Ghi chú hàng hóa')]).trim()}` : '',
          row[cThanhTien] ? `Thành tiền: ${Math.round(Number(row[cThanhTien] || 0))}` : '',
        ].filter(Boolean);

        const existingItem = purchase.items.get(sku);
        if (existingItem) {
          existingItem.quantity += quantity;
          existingItem.discount += lineDiscount;
        } else {
          purchase.items.set(sku, {
            productId: productIdFromSku(sku),
            sku,
            name: productName,
            productName,
            quantity,
            price: importPrice,
            discount: lineDiscount,
            costMethod: 'fixed',
            nextImportPrice: importPrice,
            note: noteParts.join(' | ') || undefined,
          });
        }
      }

      if (purchases.size === 0) {
        return res.status(400).json({
          error: 'Không tìm thấy phiếu nhập hợp lệ. Importer chỉ nhận các dòng có trạng thái "Đã nhập hàng".',
        });
      }

      const BATCH = 500;

      const suppliersToUpsert = Array.from(suppliers.values()).map(s => ({
        id: s.id,
        name: s.name,
        code: s.code,
        phone: s.phone || null,
        email: null,
        address: s.address || null,
        supplier_group: 'KiotViet',
        status: 'active',
        notes: `Mã NCC KiotViet: ${s.code}`,
      }));

      const skippedSupplierColumns = await upsertWithSchemaFallback(
        supabase,
        'suppliers',
        suppliersToUpsert,
        BATCH,
        OPTIONAL_SUPPLIER_COLUMNS
      );

      const transactionsToUpsert = Array.from(purchases.values()).map(p => ({
        id: stableUuidFromKey(`kiotviet-purchase:${p.code}`),
        date: p.date,
        type: 'Import',
        items: Array.from(p.items.values()),
        note: [
          `Import từ KiotViet: ${p.code}`,
          `Mã NCC: ${p.supplierCode}`,
          p.staffName ? `Người nhập: ${p.staffName}` : '',
          `Tổng SL: ${p.totalQuantity}`,
          `Tổng mặt hàng: ${p.totalSkus}`,
          `Tổng tiền hàng: ${Math.round(p.totalGoods)}`,
          `Giảm giá phiếu: ${Math.round(p.discount)}`,
          `Cần trả NCC: ${Math.round(p.payable)}`,
          `Đã trả NCC: ${Math.round(p.paid)}`,
          p.note,
        ]
          .filter(Boolean)
          .join('\n'),
        reference_id: p.code,
        staff_id: p.staffName || null,
        supplier_id: p.supplierId,
        supplier_name: p.supplierName,
        total_amount: Math.round(p.totalAmount),
        status: 'completed',
      }));

      const skippedInventoryTransactionColumns = await upsertWithSchemaFallback(
        supabase,
        'inventory_transactions',
        transactionsToUpsert,
        BATCH,
        OPTIONAL_INVENTORY_TRANSACTION_COLUMNS
      );

      // Cập nhật import_price trên pos_products theo giá nhập mới nhất từ KiotViet
      const latestPriceByProductId = new Map<string, number>();
      for (const p of Array.from(purchases.values()).sort((a, b) => a.date.localeCompare(b.date))) {
        for (const item of p.items.values()) {
          if (item.price > 0) {
            latestPriceByProductId.set(item.productId, item.price);
          }
        }
      }
      if (latestPriceByProductId.size > 0) {
        const priceUpdates = Array.from(latestPriceByProductId.entries());
        for (let i = 0; i < priceUpdates.length; i += BATCH) {
          const batch = priceUpdates.slice(i, i + BATCH);
          await Promise.all(
            batch.map(([productId, importPrice]) =>
              supabase
                .from('pos_products')
                .update({ import_price: importPrice })
                .eq('id', productId)
            )
          );
        }
      }

      const debtRecords = Array.from(purchases.values()).flatMap(p => {
        const records = [
          {
            id: stableUuidFromKey(`kiotviet-supplier-debt:purchase:${p.code}`),
            supplier_id: p.supplierId,
            supplier_name: p.supplierName,
            date: p.date,
            type: 'purchase',
            amount: Math.round(p.payable),
            description: `Nhập hàng KiotViet ${p.code}`,
          },
        ];
        if (p.paid > 0) {
          records.push({
            id: stableUuidFromKey(`kiotviet-supplier-debt:payment:${p.code}`),
            supplier_id: p.supplierId,
            supplier_name: p.supplierName,
            date: p.date,
            type: 'payment',
            amount: Math.round(p.paid),
            description: `Thanh toán KiotViet ${p.code}`,
          });
        }
        return records;
      });

      const skippedSupplierDebtColumns = await upsertWithSchemaFallback(
        supabase,
        'supplier_debts',
        debtRecords,
        BATCH,
        OPTIONAL_SUPPLIER_DEBT_COLUMNS
      );

      // Ghi product_cost_history — mỗi SKU mỗi phiếu = 1 entry, idempotent qua stableUuid
      const costHistoryEntries: { id: string; sku: string; product_id: string | null; import_price: number; effective_date: string; source: string }[] = [];
      for (const p of purchases.values()) {
        const date = p.date.slice(0, 10);
        for (const item of p.items.values()) {
          if (!item.sku || item.price <= 0) continue;
          costHistoryEntries.push({
            id: stableUuidFromKey(`cost-history:${p.code}:${item.sku}`),
            sku: item.sku,
            product_id: item.productId || null,
            import_price: item.price,
            effective_date: date,
            source: 'purchase',
          });
        }
      }
      for (let i = 0; i < costHistoryEntries.length; i += BATCH) {
        await supabase.from('product_cost_history').upsert(costHistoryEntries.slice(i, i + BATCH), { onConflict: 'id' });
      }

      res.json({
        success: true,
        detailRows,
        suppliers: suppliersToUpsert.length,
        purchases: transactionsToUpsert.length,
        debtRecords: debtRecords.length,
        items: transactionsToUpsert.reduce((sum, p) => sum + (Array.isArray(p.items) ? p.items.length : 0), 0),
        costHistoryEntries: costHistoryEntries.length,
        skippedByStatus: Object.fromEntries(skippedByStatus),
        skippedSupplierColumns,
        skippedInventoryTransactionColumns,
        skippedSupplierDebtColumns,
        importPriceUpdated: latestPriceByProductId.size,
      });
    } catch (error: unknown) {
      console.error('[Import /kiotviet-purchase-details]', getErrorMessage(error));
      res.status(500).json({ error: getErrorMessage(error) });
    }
  });

  // Xóa toàn bộ hàng hóa + giao dịch kho (dùng khi chuyển từ app test sang app thật)
  router.delete('/api/admin/reset-products', requireAuth, async (_req, res) => {
    try {
      const del = (table: string) => supabase.from(table).delete().not('id', 'is', null);
      const [r1, r2] = await Promise.all([del('inventory_transactions'), del('pos_products')]);
      const err = r1.error || r2.error;
      if (err) throw err;
      res.json({ success: true });
    } catch (error: unknown) {
      res.status(500).json({ error: getErrorMessage(error) });
    }
  });

  // Xóa toàn bộ doanh thu + đơn hàng POS + nhóm hàng (dùng khi chuyển từ app test sang app thật)
  router.delete('/api/admin/reset-revenue', requireAuth, async (_req, res) => {
    try {
      const del = (table: string) => supabase.from(table).delete().not('id', 'is', null);
      const [r1, r2, r3, r4] = await Promise.all([
        del('pos_orders'),
        del('revenue_records'),
        del('product_group_revenue'),
        del('product_groups'),
      ]);
      const err = r1.error || r2.error || r3.error || r4.error;
      if (err) throw err;
      res.json({ success: true });
    } catch (error: unknown) {
      res.status(500).json({ error: getErrorMessage(error) });
    }
  });

  // ── Import phiếu trả hàng từ KiotViet ──
  // File: "Danh sách chi tiết phiếu trả hàng" xuất từ KiotViet → Đơn hàng → Trả hàng → Xuất file
  // Cột cần có: Mã phiếu trả (col 1), Thời gian (col 6), Tổng tiền hàng (col 38), Khách cần trả (col 41),
  //             Mã hàng (col 52), Số lượng (col 57), Thành tiền (col 62)
  router.post('/api/import/kiotviet-returns', requireAuth, async (req, res) => {
    try {
      const { fileBase64 } = req.body as { fileBase64?: string };
      if (!fileBase64) return res.status(400).json({ error: 'fileBase64 là bắt buộc' });

      const buf = Buffer.from(fileBase64, 'base64');
      const wb = readSafeWorkbook(buf, 'Excel import');
      const ws = wb.Sheets[wb.SheetNames[0]];
      const rows = XLSX.utils.sheet_to_json<SpreadsheetRow>(ws, { header: 1, defval: null });

      if (rows.length < 2) return res.status(400).json({ error: 'File trống.' });

      const h = rows[0];
      // Validate: cột 2 phải là "Mã phiếu trả" hoặc "Mã trả hàng"
      const col1 = String(h[1] || '').trim();
      if (!col1.includes('Mã phiếu trả') && !col1.includes('Mã trả hàng')) {
        return res.status(400).json({
          error: `File không đúng định dạng. Cần file "Danh sách chi tiết phiếu trả hàng". Cột 2 hiện là "${col1}".`,
        });
      }

      // Detect column positions từ header (tránh bị sai khi KiotViet thêm/bớt cột)
      const colMap = new Map<string, number>();
      (h as unknown[]).forEach((cell, i) => { if (cell) colMap.set(String(cell).trim(), i); });
      const col = (name: string, fallback: number) => colMap.get(name) ?? fallback;

      const iCode      = col('Mã phiếu trả', 1) !== 1 ? col('Mã phiếu trả', 1) : col('Mã trả hàng', 1);
      const iTime      = col('Thời gian', 6);
      // File TH dùng "Tổng tiền hàng trả" / "Cần trả khách", file HĐ dùng "Tổng tiền hàng" / "Khách cần trả"
      const iTotal     = colMap.get('Tổng tiền hàng trả') ?? col('Tổng tiền hàng', 13);
      const iFinal     = colMap.get('Cần trả khách') ?? col('Khách cần trả', 18);
      const iSku       = col('Mã hàng', 26);
      const iQty       = col('Số lượng', 31);
      const iLineTotal = colMap.get('Giá bán') ?? col('Thành tiền', 32);
      const iInvoiceRef = col('Mã hóa đơn', 11);

      type ReturnOrd = { date: string; invoiceRef: string; totalAmount: number; finalAmount: number; items: Map<string, { sku: string; name: string; quantity: number; total: number }> };
      const returnMap   = new Map<string, ReturnOrd>();
      const seenReturns = new Set<string>();

      for (const row of rows.slice(1)) {
        const returnCode = String(row[iCode] || '').trim();
        if (!returnCode) continue;

        const dateTime = excelDateToLocalIsoDateTime(row[iTime]);
        if (!dateTime) continue;

        const totalAmount = Math.abs(Number(row[iTotal] || 0));
        const finalAmount = Math.abs(Number(row[iFinal] || 0));
        const invoiceRef  = String(row[iInvoiceRef] || '').trim();

        if (!returnMap.has(returnCode)) {
          returnMap.set(returnCode, { date: dateTime, invoiceRef, totalAmount, finalAmount, items: new Map() });
        }

        const sku = String(row[iSku] || '').trim();
        const qty = Math.abs(Number(row[iQty] || 0));
        if (sku && qty > 0) {
          const ord = returnMap.get(returnCode)!;
          const existing = ord.items.get(sku);
          const lineTotal = Math.abs(Number(row[iLineTotal] || 0));
          if (existing) { existing.quantity += qty; existing.total += lineTotal; }
          else ord.items.set(sku, { sku, name: String(row[(iSku + 1)] || '').trim(), quantity: qty, total: lineTotal });
        }
      }

      const IBATCH = 500;

      // Upsert return orders vào pos_orders với is_return = true
      const allCodes = Array.from(returnMap.keys());
      const existingMap = new Map<string, string>();
      for (let i = 0; i < allCodes.length; i += IBATCH) {
        const { data: chunk } = await supabase.from('pos_orders').select('id, order_code').in('order_code', allCodes.slice(i, i + IBATCH));
        for (const o of (chunk as { id: string; order_code: string }[] | null) ?? []) existingMap.set(o.order_code, o.id);
      }

      const ordersToUpsert = allCodes.map(code => {
        const d = returnMap.get(code)!;
        return {
          id:            existingMap.get(code) ?? stableUuidFromKey(`kiotviet-return:${code}`),
          order_code:    code,
          date:          d.date,
          total_amount:  d.totalAmount,
          discount:      0,
          final_amount:  d.finalAmount,
          refund_amount: d.finalAmount,
          is_return:     true,
          payment_method: 'Cash' as const,
          points_earned: 0,
          notes:         d.invoiceRef ? `Trả hàng HĐ ${d.invoiceRef}` : null,
          items:         Array.from(d.items.values()),
        };
      });

      const skipped = await upsertPosOrdersWithSchemaFallback(supabase, ordersToUpsert, IBATCH);

      res.json({ success: true, returns: ordersToUpsert.length, skipped });
    } catch (error: unknown) {
      console.error('[Import /kiotviet-returns]', getErrorMessage(error));
      res.status(500).json({ error: getErrorMessage(error) });
    }
  });

  // ── Import danh sách chi tiết hóa đơn từ KiotViet (v2 — colMap tự động) ──
  // Route này dùng colMap nhận dạng header tự động, hỗ trợ nhiều format KiotViet hơn route v1
  // Để kích hoạt: gọi /api/import/kiotviet-invoices-v2 thay vì /api/import/kiotviet-invoices
  router.post('/api/import/kiotviet-invoices-v2', requireAuth, async (req, res) => {
    // Inline helper để không phụ thuộc import từ dataMapper (server-side route)
    const inferIsReturnOrder = (code: string, finalAmount: number) =>
      /^TH/i.test(code) || finalAmount < 0;
    try {
      const { fileBase64 } = req.body as { fileBase64?: string };
      if (!fileBase64) return res.status(400).json({ error: 'fileBase64 là bắt buộc' });

      const buf = Buffer.from(fileBase64, 'base64');
      const wb = readSafeWorkbook(buf, 'Excel import');
      const ws = wb.Sheets[wb.SheetNames[0]];
      const rows = XLSX.utils.sheet_to_json<SpreadsheetRow>(ws, { header: 1, defval: null });

      if (rows.length < 2) return res.status(400).json({ error: 'File trống.' });

      const h = rows[0];
      const col1 = String(h[1] || '').trim();
      if (!col1.includes('Mã hóa đơn')) {
        return res.status(400).json({
          error: `File không đúng định dạng. Cần file "Danh sách chi tiết hóa đơn". Cột 2 hiện là "${col1}".`,
        });
      }

      const colMap = new Map<string, number>();
      (h as unknown[]).forEach((cell, i) => { if (cell) colMap.set(String(cell).trim(), i); });
      const col = (name: string, fallback: number) => colMap.get(name) ?? fallback;

      const iCode        = col('Mã hóa đơn', 1);
      const iTime        = col('Thời gian', 6);
      const iCustomerId  = col('Mã khách hàng', 12);
      const iCustomerName = col('Tên khách hàng', 13);
      const iStaff       = col('Người bán', 21);
      const iChannel     = col('Kênh bán', 22);
      const iCreatedBy   = col('Người tạo', 23);
      const iPriceBook   = col('Bảng giá', 20);
      const iTotal       = col('Tổng tiền hàng', 38);
      const iDiscount    = col('Giảm giá hóa đơn', 39);
      const iFinal       = col('Khách cần trả', 41);
      const iStatus      = col('Trạng thái', 50);
      const iSku         = col('Mã hàng', 52);
      const iSkuName     = col('Tên hàng', 53);
      const iQty         = col('Số lượng', 56);
      const iPrice       = col('Giá bán', 60);
      const iLineTotal   = col('Thành tiền', 62);

      type InvData = {
        date: string;
        customerId: string;
        customerName: string;
        staffId: string;
        channel: string;
        createdBy: string;
        priceBookName: string;
        totalAmount: number;
        discount: number;
        finalAmount: number;
        status: string;
        items: Map<string, { sku: string; name: string; quantity: number; price: number; total: number }>;
      };

      const orderMap = new Map<string, InvData>();

      for (const row of rows.slice(1)) {
        const orderCode = String(row[iCode] || '').trim();
        if (!orderCode) continue;

        const dateTime = excelDateToLocalIsoDateTime(row[iTime]);
        if (!dateTime) continue;

        if (!orderMap.has(orderCode)) {
          orderMap.set(orderCode, {
            date: dateTime,
            customerId: String(row[iCustomerId] || '').trim(),
            customerName: String(row[iCustomerName] || '').trim(),
            staffId: String(row[iStaff] || '').trim(),
            channel: String(row[iChannel] || 'direct').trim(),
            createdBy: String(row[iCreatedBy] || '').trim(),
            priceBookName: String(row[iPriceBook] || '').trim(),
            totalAmount: Math.abs(Number(row[iTotal] || 0)),
            discount: Math.abs(Number(row[iDiscount] || 0)),
            finalAmount: Math.abs(Number(row[iFinal] || 0)),
            status: String(row[iStatus] || '').trim(),
            items: new Map(),
          });
        }

        const sku = String(row[iSku] || '').trim();
        const qty = Math.abs(Number(row[iQty] || 0));
        if (sku && qty > 0) {
          const ord = orderMap.get(orderCode)!;
          const existing = ord.items.get(sku);
          const price = Math.abs(Number(row[iPrice] || 0));
          const lineTotal = Math.abs(Number(row[iLineTotal] || 0));
          if (existing) {
            existing.quantity += qty;
            existing.total += lineTotal;
          } else {
            ord.items.set(sku, { sku, name: String(row[iSkuName] || '').trim(), quantity: qty, price, total: lineTotal });
          }
        }
      }

      const IBATCH = 500;
      const allCodes = Array.from(orderMap.keys());

      const existingMap = new Map<string, string>();
      for (let i = 0; i < allCodes.length; i += IBATCH) {
        const { data: chunk } = await supabase
          .from('pos_orders')
          .select('id, order_code')
          .in('order_code', allCodes.slice(i, i + IBATCH));
        for (const o of (chunk as { id: string; order_code: string }[] | null) ?? [])
          existingMap.set(o.order_code, o.id);
      }

      const ordersToUpsert = allCodes.map(code => {
        const d = orderMap.get(code)!;
        const isReturn = inferIsReturnOrder(code, d.finalAmount);
        const status = d.status.includes('Hoàn thành') ? 'completed'
          : d.status.includes('Hủy') ? 'cancelled' : 'completed';
        return {
          id:              existingMap.get(code) ?? stableUuidFromKey(`kiotviet-order:${code}`),
          order_code:      code,
          date:            d.date,
          customer_id:     d.customerId || null,
          customer_name:   d.customerName || null,
          staff_id:        d.staffId || null,
          staff_name:      d.staffId || null,
          channel:         d.channel || 'direct',
          created_by:      d.createdBy || null,
          price_book_name: d.priceBookName || null,
          total_amount:    d.totalAmount,
          discount:        d.discount,
          final_amount:    d.finalAmount,
          refund_amount:   isReturn ? d.finalAmount : 0,
          is_return:       isReturn,
          status,
          items:           Array.from(d.items.values()),
        };
      });

      const skipped = await upsertPosOrdersWithSchemaFallback(supabase, ordersToUpsert, IBATCH);

      res.json({ success: true, invoices: ordersToUpsert.length, skipped });
    } catch (error: unknown) {
      console.error('[Import /kiotviet-invoices]', getErrorMessage(error));
      res.status(500).json({ error: getErrorMessage(error) });
    }
  });

  return router;
}
