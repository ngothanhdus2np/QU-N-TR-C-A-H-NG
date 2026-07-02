import { Router, RequestHandler } from 'express';
import axios from 'axios';

// Host chạy bot shopee-monitor. Mặc định localhost (bot cùng máy với server);
// trên iMac prod bot chạy ở MacBook khác → set SHOPEE_BOT_HOST=<ip> trong .env.local.
const BOT_HOST = process.env.SHOPEE_BOT_HOST || 'localhost';

// Slug của shop trong DB → port của bot PM2 tương ứng
const SHOP_PORTS_BY_SLUG: Record<string, number> = {
  'giaydepphucsang': 3002,
  'phuc-sang-store':  3001,
};

function portFromSlug(slug: string | undefined): number {
  return (slug && SHOP_PORTS_BY_SLUG[slug]) ?? 3001;
}

export function createShopeeSyncRouter(requireAuth: RequestHandler) {
  const router = Router();

  // POST /api/shopee-sync — proxy sang shopee-monitor để sync 1 sản phẩm
  // Body: { shopSlug: string, itemId: string, shopeeProductId?: string }
  // Chờ kết quả (tối đa 35s) rồi trả về cho frontend
  router.post('/api/shopee-sync', requireAuth, async (req, res) => {
    const { shopSlug, itemId, shopeeProductId } = req.body ?? {};

    if (!itemId) {
      res.status(400).json({ ok: false, error: 'Thiếu itemId' });
      return;
    }

    const port = portFromSlug(shopSlug);
    const url  = `http://${BOT_HOST}:${port}/api/product/sync-wait/${itemId}`;

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
            error: `Bot shop "${shopSlug}" không chạy (port ${port}). Hãy khởi động pm2.`,
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
    const { shopSlug } = req.body ?? {};
    const port = portFromSlug(shopSlug);

    try {
      const response = await axios.post(`http://${BOT_HOST}:${port}/api/products/fetch`, {}, { timeout: 5_000 });
      res.json(response.data);
    } catch (err: unknown) {
      if (axios.isAxiosError(err) && err.code === 'ECONNREFUSED') {
        res.status(503).json({ ok: false, error: `Bot shop "${shopSlug}" không chạy (port ${port})` });
        return;
      }
      res.status(500).json({ ok: false, error: err instanceof Error ? err.message : String(err) });
    }
  });

  // Shop ID (1/2 theo thứ tự trên UI) → port bot monitor
  const SHOP_PORTS_BY_ID: Record<string, number> = { '1': 3001, '2': 3002 };

  // GET /api/shopee-orders/:shopId — proxy danh sách đơn từ bot monitor
  // Query: limit, offset (pass-through). Bot chỉ nghe localhost trên server,
  // frontend từ thiết bị khác phải đi qua proxy này.
  router.get('/api/shopee-orders/:shopId', requireAuth, async (req, res) => {
    const port = SHOP_PORTS_BY_ID[String(req.params.shopId)];
    if (!port) {
      res.status(400).json({ ok: false, error: 'shopId không hợp lệ (1 hoặc 2)' });
      return;
    }
    try {
      const response = await axios.get(`http://${BOT_HOST}:${port}/api/orders`, {
        params: { limit: req.query.limit, offset: req.query.offset },
        timeout: 10_000,
      });
      res.json(response.data);
    } catch (err: unknown) {
      if (axios.isAxiosError(err) && err.code === 'ECONNREFUSED') {
        res.status(503).json({ ok: false, error: `Bot monitor không chạy (port ${port})` });
        return;
      }
      res.status(502).json({ ok: false, error: err instanceof Error ? err.message : String(err) });
    }
  });

  // POST /api/shopee-orders/:shopId/refresh — trigger bot quét đơn ngay
  router.post('/api/shopee-orders/:shopId/refresh', requireAuth, async (req, res) => {
    const port = SHOP_PORTS_BY_ID[String(req.params.shopId)];
    if (!port) {
      res.status(400).json({ ok: false, error: 'shopId không hợp lệ (1 hoặc 2)' });
      return;
    }
    try {
      const response = await axios.post(`http://${BOT_HOST}:${port}/api/orders/refresh`, {}, { timeout: 10_000 });
      res.json(response.data);
    } catch (err: unknown) {
      if (axios.isAxiosError(err) && err.code === 'ECONNREFUSED') {
        res.status(503).json({ ok: false, error: `Bot monitor không chạy (port ${port})` });
        return;
      }
      res.status(502).json({ ok: false, error: err instanceof Error ? err.message : String(err) });
    }
  });

  // GET /api/shopee-bot-status — tổng hợp trạng thái bot từ cả 2 shop
  router.get('/api/shopee-bot-status', requireAuth, async (req, res) => {
    const shops = [
      { slug: 'phuc-sang-store',  port: 3001 },
      { slug: 'giaydepphucsang', port: 3002 },
    ];

    const results = await Promise.all(
      shops.map(async ({ slug, port }) => {
        try {
          const r = await axios.get(`http://${BOT_HOST}:${port}/api/bot-status`, { timeout: 3000 });
          return { slug, ...r.data };
        } catch {
          return { slug, ok: false, sync: { running: false }, descriptions: { running: false, total: 0, filled: 0, failed: 0, current: null } };
        }
      })
    );

    res.json({ ok: true, bots: results });
  });

  return router;
}
