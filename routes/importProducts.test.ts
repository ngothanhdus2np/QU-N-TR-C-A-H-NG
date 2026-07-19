import { describe, expect, it, beforeAll, afterAll } from 'vitest';
import express from 'express';
import * as XLSX from 'xlsx';
import type { AddressInfo } from 'node:net';
import type { Server } from 'node:http';
import { SupabaseClient } from '@supabase/supabase-js';
import { createImportRouter } from './import';

// Test TẦNG HTTP thật cho nhánh IMPORT-02 của /api/import/kiotviet-products (audit 2026-07-19
// mục P2-2: logic "sản phẩm cũ giữ tồn kho, sản phẩm mới nhận tồn kho từ file" trước đây 0 test).
// app.listen(0) + global fetch của Node, mock SupabaseClient (select danh sách cũ + capture upsert).

type UpsertCall = { table: string; payload: Record<string, unknown>[]; options: unknown };

function makeSupabaseMock(existing: { id: string; sku: string }[]) {
  const upsertCalls: UpsertCall[] = [];
  const client = {
    from: (table: string) => ({
      // Route đọc: from('pos_products').select('id, sku').limit(50000)
      select: (_cols: string) => ({
        limit: (_n: number) => Promise.resolve({ data: existing, error: null }),
      }),
      upsert: (payload: Record<string, unknown>[], options: unknown) => {
        upsertCalls.push({ table, payload, options });
        return Promise.resolve({ error: null });
      },
    }),
  } as unknown as SupabaseClient;
  return { client, upsertCalls };
}

const requireAuthStub: express.RequestHandler = (req, res, next) => {
  if (req.headers['x-test-auth'] === 'yes') return next();
  res.status(401).json({ error: 'Unauthorized' });
};

// Dựng file Excel định dạng KiotViet (cột index 2 = 'Mã hàng') dưới dạng base64.
// Vị trí cột parser đọc: 0 Loại hàng · 1 Nhóm hàng · 2 Mã hàng · 3 Tên · 4 Thương hiệu ·
// 5 Giá bán · 6 Giá vốn · 7 Tồn kho.
function buildKiotVietBase64(rows: (string | number)[][]) {
  const header = ['Loại hàng', 'Nhóm hàng', 'Mã hàng', 'Tên sản phẩm', 'Thương hiệu', 'Giá bán', 'Giá vốn', 'Tồn kho'];
  const ws = XLSX.utils.aoa_to_sheet([header, ...rows]);
  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, 'Sheet1');
  return XLSX.write(wb, { type: 'base64', bookType: 'xlsx' }) as string;
}

function startApp(client: SupabaseClient): Promise<{ server: Server; baseUrl: string }> {
  const app = express();
  app.use(express.json({ limit: '20mb' }));
  app.use(createImportRouter(client, requireAuthStub));
  return new Promise(resolve => {
    const server = app.listen(0, '127.0.0.1', () => {
      const { port } = server.address() as AddressInfo;
      resolve({ server, baseUrl: `http://127.0.0.1:${port}` });
    });
  });
}

async function postImport(baseUrl: string, fileBase64: string, headers: Record<string, string> = {}) {
  const res = await fetch(`${baseUrl}/api/import/kiotviet-products`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'x-test-auth': 'yes', ...headers },
    body: JSON.stringify({ fileBase64 }),
  });
  return { status: res.status, json: (await res.json()) as Record<string, any> };
}

// Gom mọi payload upsert, tìm record theo SKU
const findBySku = (calls: UpsertCall[], sku: string) =>
  calls.flatMap(c => c.payload).find(r => r.sku === sku);

describe('/api/import/kiotviet-products — [IMPORT-02] tầng HTTP', () => {
  let mock: ReturnType<typeof makeSupabaseMock>;
  let server: Server;
  let baseUrl: string;

  beforeAll(async () => {
    // DQND01 đã tồn tại trong DB (tồn kho do app quản lý); DQND99 chưa có
    mock = makeSupabaseMock([{ id: 'id-existing-DQND01', sku: 'DQND01' }]);
    ({ server, baseUrl } = await startApp(mock.client));
  });

  afterAll(() => new Promise<void>(r => server.close(() => r())));

  it('chặn 401 khi không qua requireAuth', async () => {
    const b64 = buildKiotVietBase64([['Hàng hóa', 'Dép', 'DQND01', 'Dép', 'B', 1000, 500, 9]]);
    const res = await fetch(`${baseUrl}/api/import/kiotviet-products`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' }, // KHÔNG có x-test-auth
      body: JSON.stringify({ fileBase64: b64 }),
    });
    expect(res.status).toBe(401);
  });

  it('sản phẩm CŨ giữ tồn kho (payload không có cột stock); sản phẩm MỚI nhận tồn kho từ file', async () => {
    mock.upsertCalls.length = 0;
    const b64 = buildKiotVietBase64([
      ['Hàng hóa', 'Dép', 'DQND01', 'Dép quai ngang (đổi tên)', 'BrandX', 120000, 60000, 99], // cũ: stock 99 phải BỊ BỎ QUA
      ['Hàng hóa', 'Dép', 'DQND99', 'Dép mới', 'BrandY', 90000, 40000, 5], // mới: stock 5 phải được ghi
    ]);

    const { status, json } = await postImport(baseUrl, b64);
    expect(status).toBe(200);
    expect(json.created).toBe(1);
    expect(json.updated).toBe(1);
    expect(json.errors).toBe(0);
    expect(json.imported).toBe(2);

    // Sản phẩm cũ (DQND01): giữ id cũ, KHÔNG có cột stock trong payload → PostgREST giữ tồn kho DB
    const existingRec = findBySku(mock.upsertCalls, 'DQND01');
    expect(existingRec).toBeDefined();
    expect(existingRec!.id).toBe('id-existing-DQND01');
    expect(existingRec).not.toHaveProperty('stock');
    expect(existingRec!.name).toBe('Dép quai ngang (đổi tên)'); // các field khác VẪN cập nhật
    expect(existingRec!.sale_price).toBe(120000);

    // Sản phẩm mới (DQND99): CÓ cột stock từ file
    const newRec = findBySku(mock.upsertCalls, 'DQND99');
    expect(newRec).toBeDefined();
    expect(newRec!.stock).toBe(5);
    expect(newRec!.sale_price).toBe(90000);
  });

  it('sản phẩm cũ KHÔNG bị ghi đè created_at (chỉ set khi tạo mới)', async () => {
    mock.upsertCalls.length = 0;
    const b64 = buildKiotVietBase64([
      ['Hàng hóa', 'Dép', 'DQND01', 'Dép', 'B', 1000, 500, 9],
    ]);
    await postImport(baseUrl, b64);
    const existingRec = findBySku(mock.upsertCalls, 'DQND01');
    expect(existingRec).not.toHaveProperty('created_at');
  });

  it('file không đúng định dạng KiotViet (cột 3 khác "Mã hàng") → 400', async () => {
    const ws = XLSX.utils.aoa_to_sheet([
      ['A', 'B', 'C', 'D'],
      ['x', 'y', 'z', 'w'],
    ]);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, 'Sheet1');
    const b64 = XLSX.write(wb, { type: 'base64', bookType: 'xlsx' }) as string;
    const { status } = await postImport(baseUrl, b64);
    expect(status).toBe(400);
  });
});
