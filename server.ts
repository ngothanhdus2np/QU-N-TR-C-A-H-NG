const IS_PROD = process.env.NODE_ENV === 'production';

// Validate critical env vars at startup — fail loudly rather than silently degrade
if (IS_PROD && !process.env.SESSION_SECRET) {
  console.error(
    '[STARTUP] FATAL: SESSION_SECRET không được set trong môi trường production. Dừng server.'
  );
  process.exit(1);
}
if (!process.env.SUPABASE_SERVICE_ROLE_KEY) {
  console.error(
    '[STARTUP] WARNING: SUPABASE_SERVICE_ROLE_KEY chưa set — fallback về ANON KEY. Row Level Security sẽ được áp dụng đầy đủ nhưng một số admin operation có thể thất bại.'
  );
}

process.on('unhandledRejection', (reason, promise) => {
  console.error('Unhandled Rejection at:', promise, 'reason:', reason);
});

process.on('uncaughtException', (err, origin) => {
  console.error(`Uncaught Exception: ${err}\n` + `Exception origin: ${origin}`);
});

import express, { NextFunction, Request, RequestHandler, Response } from 'express';
import cookieParser from 'cookie-parser';
import session from 'express-session';
import path from 'path';
import os from 'os';
import { fileURLToPath } from 'url';
import cors from 'cors';
import rateLimit from 'express-rate-limit';
import helmet from 'helmet';
import react from '@vitejs/plugin-react';

import { createClient } from '@supabase/supabase-js';
import pg from 'pg';
import { readFile, mkdir, writeFile, unlink } from 'fs/promises';
import { timingSafeEqual, randomUUID } from 'node:crypto';
import { createAiRouter } from './routes/ai';
import { createAuthRouter } from './routes/auth';
import { createChannelLinksRouter } from './routes/channelLinks';
import { createChannelManagementRouter } from './routes/channelManagement';
import { createDataRouter } from './routes/data';
import { createFacebookRouter } from './routes/facebook';
import { createImportRouter } from './routes/import';
import { createNotificationsRouter, runNotificationScheduler } from './routes/notifications';
import { createStoreRouter } from './routes/store';
import { createAdminStoreRouter } from './routes/adminStore';
import { createShopeeProductsCrudRouter } from './routes/shopeeProductsCrud';
import { createShopeeSyncRouter } from './routes/shopeeSync';
import { createInventoryOutSyncRouter, runInventoryOutSync } from './routes/inventoryOutSync';
import { createPosMobileRouter } from './routes/posMobile';

/**
 * Kiểm tra schema local Supabase qua REST API.
 * Nếu phát hiện cột bị thiếu → in SQL cần chạy vào console để user biết.
 */
async function syncLocalSchema(): Promise<void> {
  // Fallback trỏ Supabase DEV/staging (không phải prod) — hàm này chỉ chạy
  // trong nhánh local dev, không nên đụng schema thật của prod.
  const localUrl = process.env.SUPABASE_URL || 'http://192.168.1.6:8010';
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;

  // Danh sách cột quan trọng cần kiểm tra: { table, column, sql }
  const requiredColumns: { table: string; column: string; sql: string }[] = [
    { table: 'pos_orders', column: 'cash_received',  sql: "ALTER TABLE pos_orders ADD COLUMN IF NOT EXISTS cash_received NUMERIC DEFAULT 0;" },
    { table: 'pos_orders', column: 'split_payments', sql: "ALTER TABLE pos_orders ADD COLUMN IF NOT EXISTS split_payments JSONB;" },
    { table: 'pos_orders', column: 'staff_name',     sql: "ALTER TABLE pos_orders ADD COLUMN IF NOT EXISTS staff_name TEXT;" },
    { table: 'pos_orders', column: 'refund_amount',  sql: "ALTER TABLE pos_orders ADD COLUMN IF NOT EXISTS refund_amount NUMERIC DEFAULT 0;" },
    { table: 'pos_orders', column: 'is_return',      sql: "ALTER TABLE pos_orders ADD COLUMN IF NOT EXISTS is_return BOOLEAN DEFAULT false;" },
    { table: 'pos_orders', column: 'points_earned',  sql: "ALTER TABLE pos_orders ADD COLUMN IF NOT EXISTS points_earned NUMERIC DEFAULT 0;" },
    { table: 'pos_orders', column: 'channel',        sql: "ALTER TABLE pos_orders ADD COLUMN IF NOT EXISTS channel TEXT DEFAULT 'direct';" },
    { table: 'pos_orders', column: 'channel_name',   sql: "ALTER TABLE pos_orders ADD COLUMN IF NOT EXISTS channel_name TEXT DEFAULT 'Bán trực tiếp';" },
    { table: 'pos_orders', column: 'price_book_id',  sql: "ALTER TABLE pos_orders ADD COLUMN IF NOT EXISTS price_book_id TEXT;" },
    { table: 'pos_orders', column: 'price_book_name',sql: "ALTER TABLE pos_orders ADD COLUMN IF NOT EXISTS price_book_name TEXT;" },
    { table: 'pos_orders', column: 'status',         sql: "ALTER TABLE pos_orders ADD COLUMN IF NOT EXISTS status TEXT DEFAULT 'completed';" },
    { table: 'pos_orders', column: 'created_by',     sql: "ALTER TABLE pos_orders ADD COLUMN IF NOT EXISTS created_by TEXT;" },
    { table: 'pos_orders', column: 'branch_id',      sql: "ALTER TABLE pos_orders ADD COLUMN IF NOT EXISTS branch_id TEXT NOT NULL DEFAULT 'main';" },
    { table: 'pos_orders', column: 'tenant_id',      sql: "ALTER TABLE pos_orders ADD COLUMN IF NOT EXISTS tenant_id TEXT NOT NULL DEFAULT 'phuc-sang';" },
    { table: 'shopee_product_variants', column: 'shopee_price_override', sql: "ALTER TABLE shopee_product_variants ADD COLUMN IF NOT EXISTS shopee_price_override INTEGER;" },
    { table: 'shopee_inventory_out', column: 'customer_paid',    sql: "ALTER TABLE shopee_inventory_out ADD COLUMN IF NOT EXISTS customer_paid NUMERIC DEFAULT 0;" },
    { table: 'shopee_inventory_out', column: 'tracking_number',  sql: "ALTER TABLE shopee_inventory_out ADD COLUMN IF NOT EXISTS tracking_number TEXT;" },
    { table: 'shopee_inventory_out', column: 'ship_date',        sql: "ALTER TABLE shopee_inventory_out ADD COLUMN IF NOT EXISTS ship_date TEXT;" },
    { table: 'shopee_inventory_out', column: 'product_name',     sql: "ALTER TABLE shopee_inventory_out ADD COLUMN IF NOT EXISTS product_name TEXT;" },
    { table: 'shopee_inventory_out', column: 'piship_fee',       sql: "ALTER TABLE shopee_inventory_out ADD COLUMN IF NOT EXISTS piship_fee NUMERIC DEFAULT 0;" },
    { table: 'shopee_inventory_out', column: 'shopee_ads_fee',   sql: "ALTER TABLE shopee_inventory_out ADD COLUMN IF NOT EXISTS shopee_ads_fee NUMERIC DEFAULT 0;" },
    { table: 'shopee_inventory_out', column: 'vat_tax',          sql: "ALTER TABLE shopee_inventory_out ADD COLUMN IF NOT EXISTS vat_tax NUMERIC DEFAULT 0;" },
    { table: 'shopee_inventory_out', column: 'profit_status',    sql: "ALTER TABLE shopee_inventory_out ADD COLUMN IF NOT EXISTS profit_status TEXT;" },
  ];

  try {
    // Kiểm tra bằng cách query thử với tất cả cột cần thiết
    const colList = [...new Set(requiredColumns.map(c => c.column))].join(',');
    const testUrl = `${localUrl}/rest/v1/pos_orders?select=id,${colList}&limit=0`;
    const resp = await fetch(testUrl, {
      headers: {
        Authorization: `Bearer ${serviceKey}`,
        apikey: serviceKey,
        Accept: 'application/json',
        'Range-Unit': 'items',
        'Range': '0/-1',
        Prefer: 'count=none',
      },
    });

    if (resp.ok) {
      console.log('[Schema Sync] ✅ Local Supabase schema đã đồng bộ');
      return;
    }

    // 400 = thiếu cột — thử từng cột để tìm cái nào thiếu
    const missingSql: string[] = [];
    for (const col of requiredColumns) {
      const r = await fetch(
        `${localUrl}/rest/v1/${col.table}?select=id,${col.column}&limit=0`,
        { headers: { Authorization: `Bearer ${serviceKey}`, apikey: serviceKey } }
      );
      if (!r.ok) missingSql.push(col.sql);
    }

    if (missingSql.length === 0) {
      console.log('[Schema Sync] ✅ Local Supabase schema OK');
    } else {
      console.warn(`\n╔══════════════════════════════════════════════════════╗`);
      console.warn(`║  [Schema Sync] ⚠️  ${missingSql.length} CỘT BỊ THIẾU TRÊN LOCAL SUPABASE  ║`);
      console.warn(`║  Mở ${localUrl} → SQL Editor → paste:   ║`);
      console.warn(`╚══════════════════════════════════════════════════════╝`);
      console.warn('\n-- Copy từ đây --');
      missingSql.forEach(s => console.warn(s));
      console.warn('-- Đến đây --\n');
    }
  } catch {
    // Không kết nối được — bỏ qua, server vẫn chạy bình thường
  }
}

function getLocalIPs(): string[] {
  const ips: string[] = [];
  for (const nets of Object.values(os.networkInterfaces())) {
    for (const net of nets ?? []) {
      if (net.family === 'IPv4' && !net.internal) ips.push(net.address);
    }
  }
  return ips;
}

const app = express();
const PORT = Number(process.env.PORT || 3000);
let viteReady = false;

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const supabaseAdminUrl = process.env.SUPABASE_URL!;
const supabaseAdminKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_ANON_KEY!;
const supabase = createClient(supabaseAdminUrl, supabaseAdminKey);

// Bảo vệ các endpoint ảnh sản phẩm (chụp ảnh điện thoại + desktop) bằng token chung POS_MOBILE_TOKEN.
// Các endpoint này đăng ký TRƯỚC requireAuth và phục vụ cả điện thoại chưa đăng nhập → dùng token QR.
const UPLOAD_TOKEN = process.env.POS_MOBILE_TOKEN || '';
const requireUploadToken: RequestHandler = (req, res, next) => {
  if (!UPLOAD_TOKEN) {
    return res.status(503).json({ error: 'Chưa cấu hình POS_MOBILE_TOKEN trên server' });
  }
  const provided =
    (req.headers['x-pos-mobile-token'] as string) ||
    (typeof req.query.t === 'string' ? req.query.t : '') ||
    '';
  const a = Buffer.from(provided);
  const b = Buffer.from(UPLOAD_TOKEN);
  if (provided && a.length === b.length && timingSafeEqual(a, b)) return next();
  return res.status(401).json({ error: 'Unauthorized - thiếu hoặc sai token ảnh sản phẩm' });
};

// Start listening immediately to satisfy the platform's health check.
const server = app.listen(PORT, '0.0.0.0', () => {
  if (!IS_PROD) console.error(`[STARTUP] Server is listening on port ${PORT}`);
});

const healthHandler: RequestHandler = (_req, res) => res.send('OK');

app.get('/health', healthHandler);
app.head('/health', healthHandler);

// ID ngẫu nhiên sinh lại mỗi lần process khởi động — client dev poll để phát hiện
// server đã restart (đổi code) và hiện banner nhắc tải lại trang.
const BOOT_ID = randomUUID();
app.get('/api/server-boot-id', (_req, res) => res.json({ bootId: BOOT_ID }));

app.get('/api/local-ip', (_req, res) => {
  const nets = os.networkInterfaces();
  let localIp = '127.0.0.1';
  for (const iface of Object.values(nets) as any[]) {
    for (const alias of iface) {
      if (alias.family === 'IPv4' && !alias.internal) {
        localIp = alias.address;
        break;
      }
    }
    if (localIp !== '127.0.0.1') break;
  }
  res.json({ ip: localIp });
});

// Upload ảnh hàng hóa — nhận raw JPEG, lưu base64 data URL thẳng vào DB (bypass Storage + RLS)
app.post('/api/upload-product-image/:productId',
  requireUploadToken,
  express.raw({ type: 'image/*', limit: '5mb' }),
  async (req: Request, res: Response) => {
    const { productId } = req.params;
    if (!productId) return res.status(400).json({ error: 'Thiếu productId' });
    if (!Buffer.isBuffer(req.body) || req.body.length === 0) {
      return res.status(400).json({ error: 'Không nhận được dữ liệu file' });
    }

    const contentType = (req.headers['content-type'] || 'image/jpeg').split(';')[0].trim();
    const ext = contentType === 'image/png' ? 'png' : 'jpg';

    // Lấy SKU và danh sách ảnh hiện tại trong một query
    const { data: product, error: fetchError } = await supabase
      .from('pos_products')
      .select('sku, images')
      .eq('id', productId)
      .single();

    if (fetchError) return res.status(500).json({ error: fetchError.message });

    // Dùng SKU làm thư mục + tên file; fallback về productId nếu không có SKU
    const rawSku = (product?.sku as string | undefined) ?? '';
    const folderName = rawSku
      ? rawSku.replace(/[^a-zA-Z0-9À-ỹ_-]/g, '-').replace(/-+/g, '-')
      : String(productId);
    const currentImages: string[] = Array.isArray(product?.images) ? product.images : [];
    const stt = currentImages.filter(u => u.startsWith(`/product-images/${folderName}/`)).length + 1;
    const filename = rawSku
      ? `${folderName}-${stt}.${ext}`
      : `${Date.now()}-${Math.random().toString(36).slice(2)}.${ext}`;
    const productDir = path.join(os.homedir(), 'cfobrain-assets', 'products', folderName);

    let imageUrl: string;
    try {
      await mkdir(productDir, { recursive: true });
      await writeFile(path.join(productDir, filename), req.body);
      imageUrl = `/product-images/${folderName}/${filename}`;
    } catch {
      // MacBook dev hoặc đĩa lỗi → fallback base64
      imageUrl = `data:${contentType};base64,${req.body.toString('base64')}`;
    }

    const { error: updateError } = await supabase
      .from('pos_products')
      .update({ images: [...currentImages, imageUrl] })
      .eq('id', productId);

    if (updateError) return res.status(500).json({ error: updateError.message });

    res.json({ url: imageUrl });
  }
);

// Lấy thông tin cơ bản sản phẩm để hiện trên trang chụp ảnh điện thoại
app.get('/api/product-info/:productId', requireUploadToken, async (req: Request, res: Response) => {
  const { productId } = req.params;
  if (!productId) return res.status(400).json({ error: 'Thiếu productId' });

  const { data, error } = await supabase
    .from('pos_products')
    .select('name, sku, attributes')
    .eq('id', productId)
    .single();

  if (error) return res.status(500).json({ error: error.message });
  if (!data) return res.status(404).json({ error: 'Không tìm thấy sản phẩm' });

  res.json(data);
});

// Tìm sản phẩm theo mã vạch để hiện trên trang chụp ảnh điện thoại
app.get('/api/product-info/barcode/:barcode', requireUploadToken, async (req: Request, res: Response) => {
  const { barcode } = req.params;
  if (!barcode) return res.status(400).json({ error: 'Thiếu barcode' });

  const COLS = 'id, name, sku, barcode, sale_price, stock, import_price, attributes';

  // Tìm theo cột barcode trước
  let { data } = await supabase
    .from('pos_products')
    .select(COLS)
    .eq('barcode', barcode)
    .limit(1)
    .maybeSingle();

  // Fallback: tìm theo SKU (nhiều sản phẩm lưu barcode = sku)
  if (!data) {
    ({ data } = await supabase
      .from('pos_products')
      .select(COLS)
      .eq('sku', barcode)
      .limit(1)
      .maybeSingle());
  }

  if (!data) return res.status(404).json({ error: 'Không tìm thấy sản phẩm' });

  // Map sale_price → price
  res.json({ ...data, price: (data as Record<string, unknown>).sale_price });
});

// Xóa ảnh hàng hóa — nhận { images: string[], deleted?: string[] }
// images: mảng URL còn lại (ghi đè DB); deleted: URL bị xóa (để xóa file trên đĩa)
app.delete('/api/upload-product-image/:productId',
  requireUploadToken,
  express.json(),
  async (req: Request, res: Response) => {
    const { productId } = req.params;
    if (!productId) return res.status(400).json({ error: 'Thiếu productId' });
    const { images, deleted } = req.body as { images: string[]; deleted?: string[] };
    if (!Array.isArray(images)) return res.status(400).json({ error: 'images phải là mảng' });

    const { error } = await supabase
      .from('pos_products')
      .update({ images })
      .eq('id', productId);

    if (error) return res.status(500).json({ error: error.message });

    // Xóa file vật lý trên iMac nếu URL là đường dẫn local (không phải base64)
    // SECURITY (SEC-01): chặn path traversal — chỉ xóa file NẰM TRONG thư mục products.
    // path.resolve xử lý cả "../" lẫn đường dẫn tuyệt đối; startsWith chặn mọi thứ thoát ra ngoài.
    if (Array.isArray(deleted)) {
      const productsRoot = path.join(os.homedir(), 'cfobrain-assets', 'products');
      for (const url of deleted) {
        if (typeof url === 'string' && url.startsWith('/product-images/')) {
          const filePath = path.resolve(productsRoot, url.replace('/product-images/', ''));
          if (filePath.startsWith(productsRoot + path.sep)) {
            unlink(filePath).catch(() => {}); // bỏ qua lỗi nếu file không tồn tại
          }
        }
      }
    }

    res.json({ ok: true });
  }
);

app.get('/', (req, res, next) => {
  if (!viteReady && process.env.NODE_ENV !== 'production') {
    return res.send(`
      <html>
        <head>
          <meta http-equiv="refresh" content="2">
          <style>
            body { font-family: sans-serif; display: flex; flex-direction: column; align-items: center; justify-content: center; height: 100vh; margin: 0; background: #f0f2f5; }
            .loader { border: 4px solid #f3f3f3; border-top: 4px solid #3498db; border-radius: 50%; width: 40px; height: 40px; animation: spin 2s linear infinite; }
            @keyframes spin { 0% { transform: rotate(0deg); } 100% { transform: rotate(360deg); } }
            h2 { color: #1c1e21; margin-top: 20px; }
          </style>
        </head>
        <body>
          <div class="loader"></div>
          <h2>Hệ thống đang khởi tạo...</h2>
          <p>Vui lòng đợi trong giây lát, trang sẽ tự động tải lại.</p>
        </body>
      </html>
    `);
  }
  next();
});

server.on('error', (err: Error) => {
  console.error('SERVER LISTEN ERROR:', err);
});

async function startServer() {
  try {
    app.set('trust proxy', 1);
    const allowedOrigins = [
      `http://localhost:${PORT}`,
      `http://127.0.0.1:${PORT}`,
      // Local dev (MacBook, luôn cổng 3000 mặc định) fallback gọi thẳng vào server
      // dev-staging này (cổng riêng 3010) khi Docker Supabase local không chạy —
      // cần whitelist cứng vì PORT ở trên là cổng CỦA SERVER NÀY, không phải 3000.
      'http://localhost:3000',
      'http://127.0.0.1:3000',
      process.env.APP_URL,
      'https://phucsang.com.vn',
      'https://www.phucsang.com.vn',
      'https://cfobrain.phucsang.com.vn',
      'https://app.phucsang.com.vn',
      'https://dev.phucsang.com.vn',
      ...(!IS_PROD ? getLocalIPs().map(ip => `http://${ip}:${PORT}`) : []),
    ].filter(Boolean) as string[];

    // Security: Helmet middleware for security headers
    app.use(helmet({
      contentSecurityPolicy: {
        directives: {
          defaultSrc: ["'self'"],
          scriptSrc: ["'self'", "'unsafe-inline'", "'unsafe-eval'"], // React needs unsafe-eval
          styleSrc: ["'self'", "'unsafe-inline'", "https://fonts.googleapis.com"],
          imgSrc: ["'self'", "data:", "https:", "blob:"],
          connectSrc: ["'self'", "https://api.anthropic.com", "https://*.supabase.co", "http://localhost:3001", "ws://localhost:3001", "http://localhost:3002", "ws://localhost:3002", "http://192.168.1.6:8000", "ws://192.168.1.6:8000", "https://*.trycloudflare.com", "wss://*.trycloudflare.com", "ws://localhost:24678", "https://app.phucsang.com.vn", "wss://app.phucsang.com.vn", "https://supabase.phucsang.com.vn", "wss://supabase.phucsang.com.vn", "https://dev.phucsang.com.vn", "wss://dev.phucsang.com.vn", "https://supabase-dev.phucsang.com.vn", "wss://supabase-dev.phucsang.com.vn", "https://static.cloudflareinsights.com"],
          upgradeInsecureRequests: null,
          fontSrc: ["'self'", "data:", "https://fonts.gstatic.com"],
          objectSrc: ["'self'", "blob:"],
          mediaSrc: ["'self'"],
          frameSrc: ["'self'", "blob:"],
        }
      },
      hsts: {
        maxAge: 31536000,
        includeSubDomains: true,
        preload: true
      },
      referrerPolicy: { policy: 'strict-origin-when-cross-origin' }
    }));

    // Security: Rate limiting (production only — dev mode has no real limit)
    const apiLimiter = rateLimit({
      windowMs: 15 * 60 * 1000,
      // 300 quá thấp: app data-heavy, riêng polling bot-status đã ~90 req/15ph.
      max: IS_PROD ? 1000 : 0,
      message: 'Too many requests from this IP, please try again later.',
      standardHeaders: true,
      legacyHeaders: false,
      // Endpoint polling nhẹ (chỉ đọc status in-memory) — miễn trừ khỏi limiter
      // để không ăn hết quota của các request dữ liệu thật.
      skip: (req) => !IS_PROD || req.originalUrl.startsWith('/api/shopee-bot-status'),
    });

    const authLimiter = rateLimit({
      windowMs: 15 * 60 * 1000,
      max: IS_PROD ? 20 : 0,
      message: 'Too many authentication attempts, please try again later.',
      standardHeaders: true,
      legacyHeaders: false,
      skip: () => !IS_PROD,
    });

    app.use('/api/', apiLimiter);
    app.use('/api/auth/register', authLimiter);
    // [SEC-RATELIMIT-01] Đường login thật đi qua proxy /auth/v1/token (GoTrue) — không nằm
    // dưới /api/ nên apiLimiter không chạm tới, brute-force chỉ bị chặn bởi giới hạn nội bộ
    // GoTrue (nếu có). Áp cùng ngưỡng với authLimiter, mount TRƯỚC proxy để chặn sớm.
    app.use('/auth/v1/token', authLimiter);

    app.use(
      cors({
        origin: (origin, callback) => {
          if (!origin || allowedOrigins.includes(origin)) return callback(null, true);
          // [FIX] callback(null, false) thay vì callback(Error) — tránh stack trace rác trong log
          callback(null, false);
        },
        methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
        // apikey/x-client-info/x-supabase-api-version: header supabase-js tự gắn vào
        // mọi request — thiếu sẽ bị chặn ngay ở bước preflight khi gọi qua proxy /auth/v1,
        // /rest/v1, /storage/v1 (cross-origin, vd local dev fallback qua app.phucsang.com.vn).
        allowedHeaders: ['Content-Type', 'Authorization', 'X-Api-Key', 'apikey', 'x-client-info', 'x-supabase-api-version'],
        credentials: true,
      })
    );
    app.use(express.json({ limit: '30mb' }));
    app.use(cookieParser());

    // Supabase Proxy — forward /auth/v1, /rest/v1, /storage/v1 về Supabase nội bộ
    // Đích lấy từ SUPABASE_URL: prod (iMac) = localhost:8000; dev-staging (iMac) =
    // localhost:8010; local dev (MacBook) = Supabase Docker local nếu đang chạy,
    // KHÔNG mặc định fallback về prod — SUPABASE_URL luôn được set tường minh ở
    // .env.local mỗi môi trường, default dưới đây chỉ dùng khi thiếu hẳn config.
    const SUPABASE_INTERNAL = process.env.SUPABASE_URL || 'http://192.168.1.6:8010';
    app.use(['/auth/v1', '/rest/v1', '/storage/v1'], async (req: Request, res: Response) => {
      const targetUrl = `${SUPABASE_INTERNAL}${req.originalUrl}`;
      const headers: Record<string, string> = {};
      for (const [key, value] of Object.entries(req.headers)) {
        if (key === 'host' || key === 'connection' || key === 'content-length') continue;
        headers[key] = Array.isArray(value) ? value.join(', ') : value;
      }
      try {
        const hasBody = req.body && Object.keys(req.body).length > 0;
        if (hasBody) headers['content-type'] = 'application/json';
        const upstream = await fetch(targetUrl, {
          method: req.method,
          headers,
          body: hasBody ? JSON.stringify(req.body) : undefined,
        });
        upstream.headers.forEach((value, key) => {
          // content-encoding/content-length của upstream không khớp body nữa vì
          // fetch() đã tự giải nén khi đọc arrayBuffer() — giữ header cũ khiến
          // browser cố giải nén lần 2 → ERR_CONTENT_DECODING_FAILED.
          if (key === 'transfer-encoding' || key === 'connection' || key === 'content-encoding' || key === 'content-length') return;
          res.setHeader(key, value);
        });
        res.status(upstream.status);
        const buf = await upstream.arrayBuffer();
        res.end(Buffer.from(buf));
      } catch (err) {
        res.status(502).json({ error: 'Supabase không khả dụng', message: String(err) });
      }
    });

    if (!IS_PROD) {
      app.use((req, _res, next) => {
        console.error(`[DEV Request] ${new Date().toISOString()} ${req.method} ${req.url}`);
        next();
      });
    }

    app.use(
      session({
        secret:
          process.env.SESSION_SECRET ||
          (IS_PROD
            ? (() => {
                throw new Error('SESSION_SECRET required');
              })()
            : 'dev-only-insecure-secret'),
        resave: false,
        saveUninitialized: false, // [FIX] không tạo session cho request chưa login — giảm bloat
        proxy: true,
        name: 'fb_session',
        cookie: {
          secure: true,
          sameSite: 'none',
          httpOnly: true,
          maxAge: 24 * 60 * 60 * 1000,
        },
      })
    );

    app.get('/health', healthHandler);
    app.head('/health', healthHandler);

    if (!IS_PROD) {
      app.use('/api', (req, _res, next) => {
        console.error(`[DEV API Request] ${req.method} ${req.url}`);
        next();
      });
    }

    const requireAuth: RequestHandler = async (req, res, next) => {
      const apiKey = req.headers['x-api-key'] as string;
      const internalKey = process.env.INTERNAL_API_KEY;

      // [Auth Bypass lớp 2] Trước đây có nhánh bypass dựa vào IP nguồn thuộc mạng LAN
      // (req.socket.remoteAddress) + Origin/Referer khớp allowedOrigins — bỏ hẳn vì IP
      // nguồn có thể bị giả mạo qua proxy/tunnel cấu hình sai, và không có gì trong
      // codebase thực sự phụ thuộc vào nó (frontend luôn đính JWT thật qua session
      // Supabase — xem services/apiService.ts). Máy chủ nội bộ cần gọi mà không có JWT
      // (nếu có) phải dùng header x-api-key khớp INTERNAL_API_KEY như dưới đây.
      if (apiKey && internalKey && apiKey === internalKey) {
        return next();
      }

      const authHeader = req.headers.authorization;
      const jwt = authHeader?.startsWith('Bearer ') ? authHeader.slice(7) : null;
      if (jwt) {
        const { data: { user }, error } = await supabase.auth.getUser(jwt);
        if (!error && user) return next();
      }
      
      return res.status(401).json({ error: 'Unauthorized - Supabase session or server API key required' });
    };

    const facebookRoutes = createFacebookRouter({ supabase, requireAuth, configDir: __dirname });
    app.use(facebookRoutes.router);
    app.use(createAuthRouter(supabase, requireAuth));
    app.use(createAiRouter(requireAuth));
    app.use(createChannelLinksRouter(supabase, requireAuth));
    app.use(createChannelManagementRouter(supabase, requireAuth));
    app.use(createDataRouter(supabase, requireAuth));
    app.use(createNotificationsRouter(supabase, requireAuth));
    app.use(createImportRouter(supabase, requireAuth));
    app.use(createStoreRouter(supabase));
    app.use(createAdminStoreRouter(supabase, requireAuth));
    app.use(createShopeeProductsCrudRouter(supabase, requireAuth));
    app.use(createShopeeSyncRouter(requireAuth));
    app.use(createInventoryOutSyncRouter(supabase, requireAuth));
    app.use(createPosMobileRouter(supabase, requireAuth));

    // Auto-detect Supabase URL: dùng IP nội bộ nếu đang ở cùng mạng, fallback sang
    // môi trường DEV/STAGING (dev.phucsang.com.vn) — KHÔNG fallback về prod, để local
    // dev không bao giờ vô tình đọc/ghi dữ liệu thật (xem HISTORY.md mục DEV-ENV-01).
    if (!IS_PROD) {
      try {
        const localUrl = process.env.SUPABASE_URL || 'http://192.168.1.6:8010';
        const remoteUrl = 'https://dev.phucsang.com.vn';
        try {
          const controller = new AbortController();
          const timeout = setTimeout(() => controller.abort(), 1500);
          await fetch(`${localUrl}/health`, { signal: controller.signal });
          clearTimeout(timeout);
          // Dùng localhost:PORT thay vì IP trực tiếp để tránh CORS trong browser
          // (proxy /auth/v1, /rest/v1 đã được setup ở trên để forward về localUrl)
          process.env.VITE_SUPABASE_URL = `http://localhost:${PORT}`;
          console.log('[Config] Mạng nội bộ → dùng proxy localhost:', `http://localhost:${PORT}`);
          // Tự động sync schema lên local Supabase để tránh thiếu cột
          syncLocalSchema().catch(e =>
            console.warn('[Schema Sync] Lỗi sync schema local:', e.message)
          );
        } catch {
          process.env.VITE_SUPABASE_URL = remoteUrl;
          console.log('[Config] Mạng ngoài → dùng', remoteUrl);
        }
      } catch {}
    }

    // Serve help images from persistent folder on iMac (outside git repo)
    // Dev (MacBook): folder không tồn tại → falls through → Vite serve từ public/help/images/
    // Prod (iMac): ~/cfobrain-assets/help/images/ chứa ảnh thực
    app.use('/help/images', express.static(path.join(os.homedir(), 'cfobrain-assets', 'help', 'images')));

    // Serve product images from iMac persistent storage
    // Prod (iMac): ~/cfobrain-assets/products/{productId}/{filename}.jpg
    // Dev (MacBook): folder không tồn tại → fallback về base64 trong upload handler
    app.use('/product-images', express.static(path.join(os.homedir(), 'cfobrain-assets', 'products')));

    if (!IS_PROD) {
      try {
        const { createServer: createViteServer } = await import('vite');
        const vite = await createViteServer({
          configFile: false,
          root: __dirname,
          base: '/',
          plugins: [react()],
          resolve: {
            alias: {
              '@': path.resolve(__dirname, '.'),
              '@/lib': path.resolve(__dirname, './src/lib'),
              '@/components': path.resolve(__dirname, './components'),
              '@/hooks': path.resolve(__dirname, './hooks'),
              '@/services': path.resolve(__dirname, './services'),
              '@/constants': path.resolve(__dirname, './constants'),
              '@/types': path.resolve(__dirname, './types'),
            },
          },
          server: { middlewareMode: true, hmr: false, allowedHosts: true },
          appType: 'spa',
        });
        app.use(vite.middlewares);
        viteReady = true;
      } catch (viteError) {
        console.error('FAILED TO INITIALIZE VITE DEV SERVER:', viteError);
      }
    } else {
      app.use(express.static(path.join(__dirname, 'dist')));
      app.get('*all', (_req, res) => {
        res.sendFile(path.join(__dirname, 'dist', 'index.html'));
      });
    }

    await facebookRoutes.loadAutoPostConfig();

    setInterval(() => {
      facebookRoutes.runAutoPostScheduler().catch(e => {
        console.error('[Scheduler] Unhandled error:', e);
      });

      runNotificationScheduler(supabase).catch(e => {
        console.error('[Notification Scheduler] Unhandled error:', e);
      });
    }, 60000);

    const INVENTORY_SYNC_INTERVAL = 10 * 60 * 1000; // 10 phút
    setInterval(() => {
      runInventoryOutSync(supabase).then(r => {
        if (r.inserted > 0 || r.updated > 0) {
          console.log(`[Auto-sync xuất kho] +${r.inserted} mới, ${r.updated} cập nhật trạng thái`);
        }
        if (r.botErrors.length > 0) {
          console.warn('[Auto-sync xuất kho] Bot lỗi:', r.botErrors.join('; '));
        }
      }).catch(e => console.error('[Auto-sync xuất kho] Lỗi:', e));
    }, INVENTORY_SYNC_INTERVAL);
  } catch (error) {
    console.error('CRITICAL ERROR DURING SERVER STARTUP:', error);
    process.exit(1);
  }
}

startServer();
