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

const getErrorMessage = (error: unknown): string => {
  if (error instanceof Error) return error.message;
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
const APP_SKU_PATTERN = /^SP\d{6}$/;

const getNextSkuNumberFromValues = (skus: Iterable<string | null | undefined>) => {
  const skuNumbers = Array.from(skus)
    .map(sku => String(sku || '').trim())
    .filter(sku => APP_SKU_PATTERN.test(sku))
    .map(sku => Number(sku.slice(2)))
    .filter(num => Number.isFinite(num));

  return skuNumbers.length > 0 ? Math.max(...skuNumbers) + 1 : 1;
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
      const wb = XLSX.read(buf, { type: 'buffer', cellDates: true });
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

      const dataRows = rows
        .slice(1)
        .filter(r => String(r[2] || '').trim() !== '' || String(r[3] || '').trim() !== '');

      const finalSkusByRow = dataRows.map(r => {
        const sourceSku = String(r[2] || '').trim();
        let sku = sourceSku;
        if (!APP_SKU_PATTERN.test(sku) || assignedSkus.has(sku)) {
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

  // Rename / reparent a category — updates category_path on all affected products
  router.post('/api/categories/rename', requireAuth, async (req, res) => {
    const { oldPath, newPath } = req.body as { oldPath?: string; newPath?: string };
    if (!oldPath || !newPath) {
      return res.status(400).json({ ok: false, error: 'Thiếu oldPath hoặc newPath' });
    }
    if (oldPath === newPath) return res.json({ ok: true, updated: 0 });

    // Fetch exact matches + children (paths that start with oldPath + ' >> ')
    const [{ data: exact }, { data: children }] = await Promise.all([
      supabase.from('pos_products').select('id, category_path').eq('category_path', oldPath),
      supabase
        .from('pos_products')
        .select('id, category_path')
        .like('category_path', `${oldPath} >> %`),
    ]);

    const all = [...(exact ?? []), ...(children ?? [])];
    if (all.length === 0) return res.json({ ok: true, updated: 0 });

    const updates = all.map((p: { id: string; category_path: string }) => ({
      id: p.id,
      category_path: p.category_path.startsWith(oldPath)
        ? newPath + p.category_path.slice(oldPath.length)
        : p.category_path,
    }));

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

    if (firstError) return res.status(500).json({ ok: false, error: firstError });
    res.json({ ok: true, updated });
  });

  router.get('/api/categories', requireAuth, async (_req, res) => {
    const { data, error } = await supabase.from('categories').select('path').order('path');
    if (error) return res.status(500).json({ ok: false, error: error.message });
    res.json({ ok: true, categories: (data ?? []).map((r: { path: string }) => r.path) });
  });

  router.post('/api/categories/create', requireAuth, async (req, res) => {
    const { path } = req.body as { path?: string };
    if (!path?.trim()) return res.status(400).json({ ok: false, error: 'Thiếu path' });
    const { error } = await supabase
      .from('categories')
      .upsert({ path: path.trim() }, { onConflict: 'path' });
    if (error) return res.status(500).json({ ok: false, error: error.message });
    res.json({ ok: true });
  });

  // Import doanh thu từ file "Báo cáo bán hàng theo lợi nhuận" của KiotViet
  router.post('/api/import/kiotviet-revenue', requireAuth, async (req, res) => {
    try {
      const { fileBase64 } = req.body as { fileBase64?: string };
      if (!fileBase64) return res.status(400).json({ error: 'fileBase64 là bắt buộc' });

      const buf = Buffer.from(fileBase64, 'base64');
      const wb = XLSX.read(buf, { type: 'buffer' });
      const ws = wb.Sheets[wb.SheetNames[0]];
      const rows = XLSX.utils.sheet_to_json<SpreadsheetRow>(ws, { header: 1, defval: null });

      if (rows.length < 2)
        return res.status(400).json({ error: 'File trống hoặc không có dữ liệu.' });

      const headers = rows[0];
      if (String(headers[6] || '').trim() !== 'Mã giao dịch') {
        return res.status(400).json({
          error:
            'File không đúng định dạng. Cần file "Báo cáo bán hàng theo lợi nhuận" từ KiotViet (cột 7 phải là "Mã giao dịch").',
        });
      }

      const excelToDate = (serial: number): string => {
        const ms = (serial - 25569) * 86400 * 1000;
        return new Date(ms).toISOString().split('T')[0];
      };

      const lastDayOfMonth = (yearMonth: string): string => {
        const [y, m] = yearMonth.split('-').map(Number);
        const d = new Date(y, m, 0).getDate();
        return `${yearMonth}-${d.toString().padStart(2, '0')}`;
      };

      // ── Pass 1: aggregate by day (dedup by order) → revenue_records ──
      type DayAgg = {
        totalGross: number;
        discount: number;
        netRev: number;
        cogs: number;
        profit: number;
      };
      const seenOrders = new Set<string>();
      const dateMap = new Map<string, DayAgg>();

      // ── Pass 2: aggregate by group + month → product_group_revenue ──
      type GroupAgg = { amount: number; qty: number; cogs: number };
      const groupMonthMap = new Map<string, GroupAgg>(); // key: "groupName|YYYY-MM"

      for (const row of rows.slice(1)) {
        const orderCode = String(row[6] || '').trim();
        if (!orderCode) continue;

        const serialDate = Number(row[8]);
        if (!serialDate) continue;
        const date = excelToDate(serialDate);
        const yearMonth = date.slice(0, 7); // "YYYY-MM"

        // Day aggregation — dedup by order
        if (!seenOrders.has(orderCode)) {
          seenOrders.add(orderCode);
          const prev: DayAgg = dateMap.get(date) ?? {
            totalGross: 0,
            discount: 0,
            netRev: 0,
            cogs: 0,
            profit: 0,
          };
          dateMap.set(date, {
            totalGross: prev.totalGross + Number(row[9] || 0),
            discount: prev.discount + Number(row[10] || 0),
            netRev: prev.netRev + Number(row[11] || 0),
            cogs: prev.cogs + Number(row[12] || 0),
            profit: prev.profit + Number(row[13] || 0),
          });
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
      }

      if (dateMap.size === 0)
        return res.status(400).json({ error: 'Không tìm thấy dữ liệu hợp lệ.' });

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
        return {
          id: existingDateMap.get(date) ?? generateId(),
          date,
          total_gross_revenue: Math.round(d.totalGross),
          discount: Math.round(d.discount),
          net_revenue: Math.round(d.netRev),
          total_cogs: Math.round(d.cogs),
          gross_profit: Math.round(d.profit),
          revenue_other: 0,
          returns_value: 0,
        };
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

      res.json({
        success: true,
        days: dateMap.size,
        orders: seenOrders.size,
        groups: uniqueGroupNames.length,
        groupMonths: groupRevToUpsert.length,
      });
    } catch (error: unknown) {
      console.error('[Import /kiotviet-revenue]', getErrorMessage(error));
      res.status(500).json({ error: getErrorMessage(error) });
    }
  });

  // Xóa toàn bộ hàng hóa (dùng khi chuyển từ app test sang app thật)
  router.delete('/api/admin/reset-products', requireAuth, async (_req, res) => {
    try {
      const { error } = await supabase.from('pos_products').delete().not('id', 'is', null);
      if (error) throw error;
      res.json({ success: true });
    } catch (error: unknown) {
      res.status(500).json({ error: getErrorMessage(error) });
    }
  });

  // Xóa toàn bộ doanh thu (dùng khi chuyển từ app test sang app thật)
  router.delete('/api/admin/reset-revenue', requireAuth, async (_req, res) => {
    try {
      const { error } = await supabase.from('revenue_records').delete().not('id', 'is', null);
      if (error) throw error;
      res.json({ success: true });
    } catch (error: unknown) {
      res.status(500).json({ error: getErrorMessage(error) });
    }
  });

  return router;
}
