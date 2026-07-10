import { Router, RequestHandler } from 'express';
import axios from 'axios';

// Host chạy bot shopee-monitor. Bot chỉ chạy trên iMac (chuyển từ MacBook 2026-07-02).
// Prod (chạy cùng máy iMac): mặc định 'localhost' là đúng.
// Dev (MacBook): dùng SSH tunnel -L 3001/3002 sang iMac (launchd agent
// com.phucsang.dev-bot-tunnel) nên 'localhost' trên MacBook cũng trỏ đúng qua tunnel —
// không cần set SHOPEE_BOT_HOST trong .env.local dev.
const BOT_HOST = process.env.SHOPEE_BOT_HOST || 'localhost';

// Slug của shop trong DB → port của bot PM2 tương ứng
const SHOP_PORTS_BY_SLUG: Record<string, number> = {
  'giaydepphucsang': 3002,
  'phuc-sang-store':  3001,
};

function portFromSlug(slug: string | undefined): number {
  return (slug && SHOP_PORTS_BY_SLUG[slug]) ?? 3001;
}

const IS_PROD = process.env.NODE_ENV === 'production';

// Fallback bền vững cho DEV: khi bot localhost (qua tunnel SSH) không tới được — thường vì
// iMac đổi mạng/IP LAN khiến tunnel chết — proxy sang HOSTNAME PUBLIC CỐ ĐỊNH của iMac
// (cloudflare). Hostname public không đổi theo IP LAN nên iMac chuyển mạng KHÔNG cần sửa lại.
// Chỉ dùng ở dev; prod (chạy trên chính iMac) luôn gọi được localhost nên không bao giờ fallback.
const FALLBACK_BASE = process.env.SHOPEE_FALLBACK_BASE || 'https://app.phucsang.com.vn';
const INTERNAL_API_KEY = process.env.INTERNAL_API_KEY;

// Lỗi kết nối tới bot local (tunnel chết / iMac unreachable) → đủ điều kiện fallback.
// Lỗi HTTP thật (4xx/5xx từ bot) KHÔNG fallback — đó là lỗi logic cần lộ ra.
function isBotUnreachable(err: unknown): boolean {
  return (
    axios.isAxiosError(err) &&
    !err.response &&
    ['ECONNREFUSED', 'ETIMEDOUT', 'ECONNRESET', 'EHOSTUNREACH', 'ENETUNREACH', 'ECONNABORTED'].includes(
      err.code ?? ''
    )
  );
}

// Gọi bot local trước (nhanh khi tunnel sống); nếu không tới được và đang ở dev có key →
// thử lại qua domain public iMac. Ném lỗi gốc nếu không đủ điều kiện fallback.
async function withBotFallback<T = unknown>(
  localCall: () => Promise<{ data: T }>,
  fallbackCall: () => Promise<{ data: T }>
): Promise<T> {
  try {
    return (await localCall()).data;
  } catch (err: unknown) {
    if (isBotUnreachable(err) && !IS_PROD && INTERNAL_API_KEY) {
      return (await fallbackCall()).data;
    }
    throw err;
  }
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
    const shopId = String(req.params.shopId);
    const port = SHOP_PORTS_BY_ID[shopId];
    if (!port) {
      res.status(400).json({ ok: false, error: 'shopId không hợp lệ (1 hoặc 2)' });
      return;
    }
    const params = { limit: req.query.limit, offset: req.query.offset };
    try {
      const data = await withBotFallback(
        () => axios.get(`http://${BOT_HOST}:${port}/api/orders`, { params, timeout: 10_000 }),
        () => axios.get(`${FALLBACK_BASE}/api/shopee-orders/${shopId}`, {
          params,
          headers: { 'x-api-key': INTERNAL_API_KEY! },
          timeout: 15_000,
        })
      );
      res.json(data);
    } catch (err: unknown) {
      if (isBotUnreachable(err)) {
        res.status(503).json({ ok: false, error: `Bot monitor không chạy (port ${port}) — fallback prod cũng không khả dụng` });
        return;
      }
      res.status(502).json({ ok: false, error: err instanceof Error ? err.message : String(err) });
    }
  });

  // GET /api/shopee-ads-report/:shopId — proxy lịch sử báo cáo hiệu suất quảng
  // cáo (hiển thị/click/chi phí/GMV/ROI/đơn theo ngày) từ bot monitor
  router.get('/api/shopee-ads-report/:shopId', requireAuth, async (req, res) => {
    const shopId = String(req.params.shopId);
    const port = SHOP_PORTS_BY_ID[shopId];
    if (!port) {
      res.status(400).json({ ok: false, error: 'shopId không hợp lệ (1 hoặc 2)' });
      return;
    }
    try {
      const data = await withBotFallback(
        () => axios.get(`http://${BOT_HOST}:${port}/api/ads-report/history`, { timeout: 10_000 }),
        () => axios.get(`${FALLBACK_BASE}/api/shopee-ads-report/${shopId}`, {
          headers: { 'x-api-key': INTERNAL_API_KEY! },
          timeout: 15_000,
        })
      );
      res.json(data);
    } catch (err: unknown) {
      if (isBotUnreachable(err)) {
        res.status(503).json({ ok: false, error: `Bot monitor không chạy (port ${port}) — fallback prod cũng không khả dụng` });
        return;
      }
      res.status(502).json({ ok: false, error: err instanceof Error ? err.message : String(err) });
    }
  });

  // POST /api/shopee-orders/:shopId/refresh — trigger bot quét đơn ngay
  router.post('/api/shopee-orders/:shopId/refresh', requireAuth, async (req, res) => {
    const shopId = String(req.params.shopId);
    const port = SHOP_PORTS_BY_ID[shopId];
    if (!port) {
      res.status(400).json({ ok: false, error: 'shopId không hợp lệ (1 hoặc 2)' });
      return;
    }
    try {
      const data = await withBotFallback(
        () => axios.post(`http://${BOT_HOST}:${port}/api/orders/refresh`, {}, { timeout: 10_000 }),
        () => axios.post(`${FALLBACK_BASE}/api/shopee-orders/${shopId}/refresh`, {}, {
          headers: { 'x-api-key': INTERNAL_API_KEY! },
          timeout: 15_000,
        })
      );
      res.json(data);
    } catch (err: unknown) {
      if (isBotUnreachable(err)) {
        res.status(503).json({ ok: false, error: `Bot monitor không chạy (port ${port}) — fallback prod cũng không khả dụng` });
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

    // Fallback dev: nếu bot local không tới được, lấy trạng thái từ domain public iMac (1 lần,
    // dùng chung cho cả 2 shop). Promise được cache để tránh gọi prod 2 lần khi cả 2 shop cùng lỗi.
    let prodBotsPromise: Promise<Array<Record<string, unknown>> | null> | null = null;
    const getProdBots = (): Promise<Array<Record<string, unknown>> | null> => {
      if (prodBotsPromise) return prodBotsPromise;
      if (IS_PROD || !INTERNAL_API_KEY) { prodBotsPromise = Promise.resolve(null); return prodBotsPromise; }
      prodBotsPromise = axios
        .get(`${FALLBACK_BASE}/api/shopee-bot-status`, { headers: { 'x-api-key': INTERNAL_API_KEY }, timeout: 8_000 })
        .then((r) => (Array.isArray(r.data?.bots) ? (r.data.bots as Array<Record<string, unknown>>) : null))
        .catch(() => null);
      return prodBotsPromise;
    };

    const results = await Promise.all(
      shops.map(async ({ slug, port }) => {
        try {
          const r = await axios.get(`http://${BOT_HOST}:${port}/api/bot-status`, { timeout: 3000 });
          return { slug, ...r.data };
        } catch {
          const prodBots = await getProdBots();
          const match = prodBots?.find((b) => b?.slug === slug);
          if (match) return match;
          return { slug, ok: false, sync: { running: false }, descriptions: { running: false, total: 0, filled: 0, failed: 0, current: null } };
        }
      })
    );

    res.json({ ok: true, bots: results });
  });

  return router;
}
