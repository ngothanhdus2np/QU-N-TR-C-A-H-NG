import { Router, RequestHandler } from 'express';
import axios from 'axios';

// Index 0 → shop1 port 3001, index 1 → shop2 port 3002
const SHOP_PORTS: Record<number, number> = { 0: 3001, 1: 3002 };

export function createShopeeSyncRouter(requireAuth: RequestHandler) {
  const router = Router();

  // POST /api/shopee-sync — proxy sang shopee-monitor để sync 1 sản phẩm
  // Body: { shopIdx: 0|1, itemId: string, shopeeProductId?: string }
  // Chờ kết quả (tối đa 35s) rồi trả về cho frontend
  router.post('/api/shopee-sync', requireAuth, async (req, res) => {
    const { shopIdx, itemId, shopeeProductId } = req.body ?? {};

    if (!itemId) {
      res.status(400).json({ ok: false, error: 'Thiếu itemId' });
      return;
    }

    const port = SHOP_PORTS[Number(shopIdx) ?? 0] ?? 3001;
    const url  = `http://localhost:${port}/api/product/sync-wait/${itemId}`;

    try {
      const response = await axios.post(url, { shopeeProductId: shopeeProductId ?? null }, {
        timeout: 35_000,
      });
      res.json(response.data);
    } catch (err: unknown) {
      if (axios.isAxiosError(err)) {
        if (err.code === 'ECONNREFUSED') {
          res.status(503).json({
            ok: false,
            error: `Bot shop ${Number(shopIdx ?? 0) + 1} không chạy (port ${port}). Hãy khởi động pm2.`,
          });
          return;
        }
        res.status(502).json({ ok: false, error: err.response?.data?.error ?? err.message });
        return;
      }
      res.status(500).json({ ok: false, error: err instanceof Error ? err.message : String(err) });
    }
  });

  // POST /api/shopee-sync/all — trigger bot quét toàn bộ danh sách SP (không chờ)
  router.post('/api/shopee-sync/all', requireAuth, async (req, res) => {
    const { shopIdx } = req.body ?? {};
    const port = SHOP_PORTS[Number(shopIdx) ?? 0] ?? 3001;

    try {
      const response = await axios.post(`http://localhost:${port}/api/products/fetch`, {}, { timeout: 5_000 });
      res.json(response.data);
    } catch (err: unknown) {
      if (axios.isAxiosError(err) && err.code === 'ECONNREFUSED') {
        res.status(503).json({ ok: false, error: `Bot shop ${Number(shopIdx ?? 0) + 1} không chạy (port ${port})` });
        return;
      }
      res.status(500).json({ ok: false, error: err instanceof Error ? err.message : String(err) });
    }
  });

  return router;
}
