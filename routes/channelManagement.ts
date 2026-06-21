import { Router, RequestHandler } from 'express';
import { SupabaseClient } from '@supabase/supabase-js';
import axios from 'axios';
import { exec } from 'child_process';
import { promisify } from 'util';
import fs from 'fs';
import path from 'path';
import os from 'os';

const execAsync = promisify(exec);

const SHOPEE_MONITOR_DIR = path.join(os.homedir(), 'shopee-monitor');
const ECOSYSTEM_PATH     = path.join(SHOPEE_MONITOR_DIR, 'ecosystem.config.js');

interface ShopRow {
  id: string;
  name: string;
  slug: string;
  port: number | null;
  shop_url: string | null;
  profile_dir: string | null;
  bot_status: string | null;
  last_sync_at: string | null;
  display_order: number;
}

// Ping bot để lấy trạng thái thực
async function pingBot(port: number): Promise<{ alive: boolean; sessionExpired?: boolean; orders?: number }> {
  try {
    const res = await axios.get(`http://localhost:${port}/api/status`, { timeout: 2000 });
    return { alive: true, sessionExpired: res.data.sessionExpired ?? false, orders: res.data.orders };
  } catch {
    return { alive: false };
  }
}

// Auto-relogin: restart pm2 headless, đợi 20s, kiểm tra lại
async function triggerAutoRelogin(supabase: SupabaseClient, shop: ShopRow) {
  const processName = `shopee-shop${shop.display_order}`;
  try {
    await supabase.from('shopee_shops').update({ bot_status: 'auto_retrying' }).eq('id', shop.id);
    await execAsync(`pm2 restart ${processName}`, { cwd: SHOPEE_MONITOR_DIR }).catch(() => {});
    await new Promise(r => setTimeout(r, 20_000));
    const ping = shop.port ? await pingBot(shop.port) : { alive: false };
    if (ping.alive && !ping.sessionExpired) {
      await supabase.from('shopee_shops').update({ bot_status: 'running' }).eq('id', shop.id);
    } else {
      await supabase.from('shopee_shops').update({ bot_status: 'login_required' }).eq('id', shop.id);
    }
  } catch {
    await supabase.from('shopee_shops').update({ bot_status: 'login_required' }).eq('id', shop.id);
  }
}

// Tạo lại ecosystem.config.js từ danh sách shops trong DB
function generateEcosystem(shops: ShopRow[]): string {
  const SUPABASE_URL = process.env.SUPABASE_URL || 'http://192.168.1.3:8000';
  const SUPABASE_KEY = process.env.SUPABASE_SERVICE_KEY || '';
  const GOOGLE_CREDS = 'gen-lang-client-0513345549-1d9a41618fef.json';

  const apps = shops
    .filter(s => s.port && s.profile_dir)
    .map(s => `        {
            name:           'shopee-shop${s.display_order}',
            script:         'monitor.js',
            cwd:            __dirname,
            env: {
                SHOP_ID:                 '${s.display_order}',
                SHOP_NAME:               '${s.slug}',
                SHOP_PLATFORM:           'Shopee ${s.display_order}',
                API_ENABLED:             'true',
                API_PORT:                '${s.port}',
                GOOGLE_CREDENTIALS_FILE: '${GOOGLE_CREDS}',
                SUPABASE_URL:            '${SUPABASE_URL}',
                SUPABASE_SERVICE_KEY:    '${SUPABASE_KEY}',
            },
            autorestart:    true,
            restart_delay:  5000,
            max_restarts:   20,
            min_uptime:     '10s',
            out_file:       'logs/shop${s.display_order}-out.log',
            error_file:     'logs/shop${s.display_order}-err.log',
            log_date_format:'YYYY-MM-DD HH:mm:ss',
            merge_logs:     true
        }`)
    .join(',\n');

  return `module.exports = {\n    apps: [\n${apps}\n    ]\n};\n`;
}

export function createChannelManagementRouter(
  supabase: SupabaseClient,
  requireAuth: RequestHandler,
) {
  const router = Router();

  // GET /api/channels — danh sách tất cả kênh: Shopee shops + website
  router.get('/api/channels', requireAuth, async (_req, res) => {
    try {
      const [shopsRes, websiteRes] = await Promise.all([
        supabase.from('shopee_shops').select('*').order('display_order', { ascending: true }),
        supabase.from('store_products').select('id, is_published', { count: 'exact', head: false }),
      ]);
      if (shopsRes.error) throw new Error(shopsRes.error.message);

      // Shopee channels
      const shopeeChannels = await Promise.all(
        (shopsRes.data as ShopRow[]).map(async (shop) => {
          if (!shop.port) return { ...shop, type: 'shopee', liveStatus: 'no_port' };
          const ping = await pingBot(shop.port);

          let liveStatus: string;
          if (ping.alive && !ping.sessionExpired) {
            liveStatus = 'running';
            // Xóa trạng thái auto_retrying nếu vừa thành công
            if (shop.bot_status === 'auto_retrying') {
              void supabase.from('shopee_shops').update({ bot_status: 'running' }).eq('id', shop.id);
            }
          } else if (ping.alive && ping.sessionExpired) {
            if (shop.bot_status === 'auto_retrying') {
              liveStatus = 'auto_retrying'; // đang xử lý tự động
            } else if (shop.bot_status === 'login_required') {
              liveStatus = 'login_required'; // cần user nhập OTP
            } else {
              // Phát hiện lần đầu → tự động retry ngầm
              liveStatus = 'auto_retrying';
              void triggerAutoRelogin(supabase, shop);
            }
          } else {
            // Bot không phản hồi
            liveStatus = (shop.bot_status === 'auto_retrying') ? 'auto_retrying' : 'stopped';
          }

          return { ...shop, type: 'shopee', liveStatus, orders: ping.orders };
        })
      );

      // Website channel — luôn tồn tại, lấy số sản phẩm từ store_products
      const storeProducts  = websiteRes.data ?? [];
      const totalProducts  = storeProducts.length;
      const publishedCount = storeProducts.filter((p: { is_published: boolean }) => p.is_published).length;
      const websiteChannel = {
        id: 'website',
        type: 'website',
        name: 'Website PHÚC SANG',
        slug: 'phucsang.com.vn',
        shop_url: 'https://phucsang.com.vn',
        liveStatus: 'running' as const,
        totalProducts,
        publishedProducts: publishedCount,
      };

      res.json({ ok: true, channels: [...shopeeChannels, websiteChannel] });
    } catch (err: unknown) {
      res.status(500).json({ ok: false, error: err instanceof Error ? err.message : String(err) });
    }
  });

  // POST /api/channels — thêm shop mới
  router.post('/api/channels', requireAuth, async (req, res) => {
    try {
      const { name, slug, shop_url } = req.body as { name: string; slug: string; shop_url?: string };
      if (!name || !slug) {
        res.status(400).json({ ok: false, error: 'Thiếu name hoặc slug' });
        return;
      }

      // Tính port và display_order tiếp theo
      const { data: existing } = await supabase
        .from('shopee_shops')
        .select('port, display_order')
        .order('display_order', { ascending: false })
        .limit(1);

      const lastOrder = (existing?.[0]?.display_order ?? 0) as number;
      const lastPort  = (existing?.[0]?.port ?? 3000) as number;
      const newOrder  = lastOrder + 1;
      const newPort   = lastPort + 1;
      const profileDir = `shopee-profile-shop${newOrder}`;

      // Tạo profile directory cho browser
      const fullProfilePath = path.join(SHOPEE_MONITOR_DIR, profileDir);
      if (!fs.existsSync(fullProfilePath)) {
        fs.mkdirSync(fullProfilePath, { recursive: true });
      }

      // Insert vào DB
      const { data: newShop, error } = await supabase
        .from('shopee_shops')
        .insert({
          name,
          slug,
          shop_url: shop_url ?? null,
          port: newPort,
          profile_dir: profileDir,
          display_order: newOrder,
          bot_status: 'stopped',
        })
        .select()
        .single();
      if (error) throw new Error(error.message);

      // Tạo lại ecosystem.config.js
      const { data: allShops } = await supabase
        .from('shopee_shops')
        .select('*')
        .order('display_order', { ascending: true });
      const newEcosystem = generateEcosystem(allShops as ShopRow[]);
      fs.writeFileSync(ECOSYSTEM_PATH, newEcosystem, 'utf-8');

      // Start pm2 process (headed=false, chờ user relogin sau)
      await execAsync(`pm2 start ${ECOSYSTEM_PATH} --only shopee-shop${newOrder}`, {
        cwd: SHOPEE_MONITOR_DIR,
      }).catch(() => {}); // không fail nếu pm2 chưa có

      res.json({ ok: true, shop: newShop });
    } catch (err: unknown) {
      res.status(500).json({ ok: false, error: err instanceof Error ? err.message : String(err) });
    }
  });

  // POST /api/channels/:id/sync — trigger sync toàn bộ sản phẩm
  router.post('/api/channels/:id/sync', requireAuth, async (req, res) => {
    try {
      const { data: shop, error } = await supabase
        .from('shopee_shops')
        .select('port, display_order')
        .eq('id', req.params.id)
        .single();
      if (error || !shop) {
        res.status(404).json({ ok: false, error: 'Không tìm thấy shop' });
        return;
      }

      const response = await axios.post(
        `http://localhost:${shop.port}/api/products/fetch`,
        {},
        { timeout: 5000 }
      );

      await supabase
        .from('shopee_shops')
        .update({ last_sync_at: new Date().toISOString() })
        .eq('id', req.params.id);

      res.json(response.data);
    } catch (err: unknown) {
      if (axios.isAxiosError(err) && err.code === 'ECONNREFUSED') {
        res.status(503).json({ ok: false, error: 'Bot không chạy. Hãy khởi động lại.' });
        return;
      }
      res.status(500).json({ ok: false, error: err instanceof Error ? err.message : String(err) });
    }
  });

  // POST /api/channels/:id/relogin — restart bot để user đăng nhập lại
  // Bot sẽ mở Chrome có giao diện (headed) để user nhập OTP
  router.post('/api/channels/:id/relogin', requireAuth, async (req, res) => {
    try {
      const { data: shop, error } = await supabase
        .from('shopee_shops')
        .select('display_order')
        .eq('id', req.params.id)
        .single();
      if (error || !shop) {
        res.status(404).json({ ok: false, error: 'Không tìm thấy shop' });
        return;
      }

      const processName = `shopee-shop${shop.display_order}`;

      // Dừng process hiện tại
      await execAsync(`pm2 stop ${processName}`, { cwd: SHOPEE_MONITOR_DIR }).catch(() => {});

      // Restart với HEADLESS=false để hiển thị Chrome
      await execAsync(
        `pm2 start ${ECOSYSTEM_PATH} --only ${processName} --env '{"HEADLESS":"false"}'`,
        { cwd: SHOPEE_MONITOR_DIR }
      ).catch(async () => {
        // fallback: set env rồi start
        await execAsync(`HEADLESS=false pm2 start ${ECOSYSTEM_PATH} --only ${processName}`, {
          cwd: SHOPEE_MONITOR_DIR,
        }).catch(() => {});
      });

      await supabase
        .from('shopee_shops')
        .update({ bot_status: 'login_required' })
        .eq('id', req.params.id);

      res.json({ ok: true, message: 'Chrome đã mở. Đăng nhập Shopee trên iMac rồi bấm Hoàn thành.' });
    } catch (err: unknown) {
      res.status(500).json({ ok: false, error: err instanceof Error ? err.message : String(err) });
    }
  });

  // POST /api/channels/:id/relogin-done — sau khi user đăng nhập xong, restart headless
  router.post('/api/channels/:id/relogin-done', requireAuth, async (req, res) => {
    try {
      const { data: shop, error } = await supabase
        .from('shopee_shops')
        .select('display_order')
        .eq('id', req.params.id)
        .single();
      if (error || !shop) {
        res.status(404).json({ ok: false, error: 'Không tìm thấy shop' });
        return;
      }

      const processName = `shopee-shop${shop.display_order}`;
      await execAsync(`pm2 restart ${processName}`, { cwd: SHOPEE_MONITOR_DIR }).catch(() => {});

      await supabase
        .from('shopee_shops')
        .update({ bot_status: 'running' })
        .eq('id', req.params.id);

      res.json({ ok: true });
    } catch (err: unknown) {
      res.status(500).json({ ok: false, error: err instanceof Error ? err.message : String(err) });
    }
  });

  // POST /api/channels/notify-logout — bot gọi khi detect session hết hạn
  // Không cần auth vì gọi từ localhost bot
  // Auto-relogin được kích hoạt qua GET /api/channels khi phát hiện sessionExpired
  router.post('/api/channels/notify-logout', async (req, res) => {
    try {
      const { shopId } = req.body as { shopId?: string };
      if (!shopId) { res.status(400).json({ ok: false }); return; }

      const shopOrder = Number(shopId);

      // Chỉ update nếu chưa đang retry hoặc login_required (tránh ghi đè)
      const { data: existing } = await supabase
        .from('shopee_shops')
        .select('bot_status')
        .eq('display_order', shopOrder)
        .single();

      if (!existing || existing.bot_status === 'auto_retrying' || existing.bot_status === 'login_required') {
        res.json({ ok: true });
        return;
      }

      await supabase
        .from('shopee_shops')
        .update({ bot_status: 'session_expired' })
        .eq('display_order', shopOrder);

      res.json({ ok: true });
    } catch {
      res.json({ ok: true });
    }
  });

  // DELETE /api/channels/:id — xóa shop + stop pm2
  router.delete('/api/channels/:id', requireAuth, async (req, res) => {
    try {
      const { data: shop, error } = await supabase
        .from('shopee_shops')
        .select('display_order')
        .eq('id', req.params.id)
        .single();
      if (error || !shop) {
        res.status(404).json({ ok: false, error: 'Không tìm thấy shop' });
        return;
      }

      await execAsync(`pm2 delete shopee-shop${shop.display_order}`, {
        cwd: SHOPEE_MONITOR_DIR,
      }).catch(() => {});

      await supabase.from('shopee_shops').delete().eq('id', req.params.id);

      // Tạo lại ecosystem.config.js
      const { data: allShops } = await supabase
        .from('shopee_shops')
        .select('*')
        .order('display_order', { ascending: true });
      const newEcosystem = generateEcosystem((allShops ?? []) as ShopRow[]);
      fs.writeFileSync(ECOSYSTEM_PATH, newEcosystem, 'utf-8');

      res.json({ ok: true });
    } catch (err: unknown) {
      res.status(500).json({ ok: false, error: err instanceof Error ? err.message : String(err) });
    }
  });

  return router;
}
