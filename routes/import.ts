import { Router, RequestHandler } from 'express';
import { SupabaseClient } from '@supabase/supabase-js';
import * as XLSX from 'xlsx';
import { createHash } from 'crypto';
import { generateId, cleanVNNumber, parseVNDate } from '../businessLogic';

const productIdFromSku = (sku: string) => {
  const hash = createHash('sha1').update(`pos-product:${sku}`).digest('hex').slice(0, 32).split('');
  hash[12] = '5';
  hash[16] = ((parseInt(hash[16], 16) & 0x3) | 0x8).toString(16);
  const id = hash.join('');
  return `${id.slice(0, 8)}-${id.slice(8, 12)}-${id.slice(12, 16)}-${id.slice(16, 20)}-${id.slice(20)}`;
};

export function createImportRouter(supabase: SupabaseClient, requireAuth: RequestHandler): Router {
  const router = Router();

  router.all('/api/sync-kiotviet*all', requireAuth, async (req, res) => {
    console.log('>>> NHẬN YÊU CẦU ĐỒNG BỘ KIOTVIET (ALL)');
    const { data } = req.body;
    if (!data || !Array.isArray(data)) {
      return res.status(400).json({ error: 'Dữ liệu không hợp lệ' });
    }

    try {
      const parsedData = data.map((item: any) => {
        const date = parseVNDate(item.date);
        const amount = cleanVNNumber(item.revenue);
        return { date, amount };
      }).filter((item: any) => item.date && item.amount > 0);

      if (parsedData.length === 0) {
        return res.status(400).json({ error: 'Không có dữ liệu hợp lệ' });
      }

      const dates = parsedData.map((d: any) => d.date);
      const { data: existingRecords } = await supabase
        .from('revenue_records')
        .select('id, date')
        .in('date', dates);

      const existingMap = new Map(existingRecords?.map((r: any) => [r.date, r.id]) || []);

      const recordsToUpsert = parsedData.map((item: any) => {
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
    } catch (error: any) {
      console.error('KiotViet Sync Error:', error);
      res.status(500).json({ error: error.message });
    }
  });

  router.post('/api/import/kiotviet-products', async (req, res) => {
    try {
      const { fileBase64 } = req.body as { fileBase64?: string };
      if (!fileBase64) return res.status(400).json({ error: 'fileBase64 là bắt buộc' });

      const buf = Buffer.from(fileBase64, 'base64');
      const wb = XLSX.read(buf, { type: 'buffer', cellDates: true });
      const ws = wb.Sheets[wb.SheetNames[0]];
      const rows: any[][] = XLSX.utils.sheet_to_json(ws, { header: 1, defval: null });

      if (rows.length < 2) return res.status(400).json({ error: 'File trống hoặc không có dữ liệu.' });

      const headers = rows[0];
      if (String(headers[2] || '').trim() !== 'Mã hàng') {
        return res.status(400).json({ error: 'File không đúng định dạng KiotViet. Cột thứ 3 phải là "Mã hàng".' });
      }

      const { data: existing } = await supabase
        .from('pos_products')
        .select('id, sku')
        .limit(50000);
      const skuToId = new Map<string, string>((existing || []).map((p: any) => [p.sku, p.id]));

      const dataRows = rows.slice(1).filter((r: any[]) => r[2] && String(r[2]).trim() !== '');

      const records = dataRows.map((r: any[]) => {
        const sku = String(r[2] || '').trim();
        const maxStockRaw = Number(r[11] || 999999);
        const catRaw = String(r[1] || '').trim();
        const catId = catRaw.includes('>>') ? catRaw.split('>>').pop()!.trim() : catRaw || 'Khác';

        const attrStr = r[15] ? String(r[15]).trim() : '';
        const descStr = r[22] ? String(r[22]).trim() : '';
        const description = [attrStr, descStr].filter(Boolean).join(' | ') || null;

        const imgRaw = r[17] ? String(r[17]).trim() : '';
        const images = imgRaw ? imgRaw.split(',').map((s: string) => s.trim()).filter(Boolean) : [];

        let createdAt: string | null = null;
        if (r[28]) {
          const d = r[28] instanceof Date ? r[28] : new Date(String(r[28]));
          if (!isNaN(d.getTime())) createdAt = d.toISOString();
        }

        const record: Record<string, any> = {
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

        const relatedSku = r[16] ? String(r[16]).trim() : null;
        if (relatedSku) record.related_sku = relatedSku;

        return record;
      });

      const BATCH = 300;
      let importedCount = 0;
      let errorCount = 0;
      for (let i = 0; i < records.length; i += BATCH) {
        const batch = records.slice(i, i + BATCH);
        const { error: upsertErr } = await supabase.from('pos_products').upsert(batch, { onConflict: 'id' });
        if (upsertErr) {
          console.error(`[Import] Batch ${i / BATCH + 1} lỗi:`, upsertErr.message);
          errorCount += batch.length;
        } else {
          importedCount += batch.length;
        }
      }

      res.json({ total: records.length, imported: importedCount, errors: errorCount });
    } catch (err: any) {
      console.error('[Import /kiotviet-products]', err.message);
      res.status(500).json({ error: err.message || 'Lỗi xử lý file Excel' });
    }
  });

  return router;
}
