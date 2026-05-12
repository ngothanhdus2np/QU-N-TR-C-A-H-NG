import fs from 'fs';
import path from 'path';
import axios from 'axios';
import { Router, Request, RequestHandler } from 'express';
import { SupabaseClient } from '@supabase/supabase-js';
import { Session } from 'express-session';

type AutoPostLog = {
  id: string;
  time: string;
  message: string;
  type: 'info' | 'success' | 'error';
};

type AutoPostConfig = {
  enabled: boolean;
  selectedPageId: string;
  selectedPageName: string;
  selectedPageAccessToken: string;
  logs: AutoPostLog[];
};

type FacebookRouterOptions = {
  supabase: SupabaseClient;
  requireAuth: RequestHandler;
  configDir: string;
};

type FacebookSessionRequest = Request & {
  session: Session & {
    fbAccessToken?: string;
  };
};

type HttpClientError = Error & {
  response?: {
    data?: {
      error?: {
        message?: string;
      };
    };
  };
};

const getErrorMessage = (error: unknown): string => {
  if (error instanceof Error) return error.message;
  return 'Unknown error';
};

const getHttpErrorMessage = (error: unknown): string => {
  const httpError = error as HttpClientError;
  return httpError.response?.data?.error?.message || getErrorMessage(error);
};

const defaultAutoPostConfig: AutoPostConfig = {
  enabled: false,
  selectedPageId: '',
  selectedPageName: '',
  selectedPageAccessToken: '',
  logs: [],
};

let globalFbAccessToken = '';
let fbTokenExpiresAt = 0; // unix ms — 0 = unknown
let autoPostConfig: AutoPostConfig = { ...defaultAutoPostConfig };
let fbConfig = {
  appId: '',
  appSecret: '',
};

// Facebook user token có TTL 90 ngày — cảnh báo khi còn < 7 ngày
const FB_TOKEN_TTL_MS = 90 * 24 * 60 * 60 * 1000;
const FB_TOKEN_WARN_DAYS = 7;

export function createFacebookRouter({ supabase, requireAuth, configDir }: FacebookRouterOptions) {
  const router = Router();
  const configFile = path.join(configDir, 'fb_config.json');
  const autoPostConfigFile = path.join(configDir, 'auto_post_config.json');

  if (fs.existsSync(configFile)) {
    try {
      fbConfig = JSON.parse(fs.readFileSync(configFile, 'utf-8'));
    } catch (e) {
      console.error('Lỗi đọc file cấu hình:', e);
    }
  }

  if (fs.existsSync(autoPostConfigFile)) {
    try {
      autoPostConfig = {
        ...defaultAutoPostConfig,
        ...JSON.parse(fs.readFileSync(autoPostConfigFile, 'utf-8')),
      };
    } catch (e) {
      console.error('Lỗi đọc file cấu hình tự động:', e);
    }
  }

  async function persistFbToken(token: string) {
    globalFbAccessToken = token;
    fbTokenExpiresAt = Date.now() + FB_TOKEN_TTL_MS;
    try {
      await supabase.from('app_state').upsert({
        user_id: 'phuc-sang-fb-token',
        schedule: { token, expiresAt: fbTokenExpiresAt },
        updated_at: new Date().toISOString(),
      });
    } catch (e) {
      console.error('[FB] Lỗi lưu token vào Supabase:', e);
    }
  }

  async function loadFbToken() {
    try {
      const { data } = await supabase
        .from('app_state')
        .select('schedule')
        .eq('user_id', 'phuc-sang-fb-token')
        .single();
      if (data?.schedule?.token) {
        globalFbAccessToken = data.schedule.token;
        fbTokenExpiresAt = data.schedule.expiresAt || 0;
        const daysLeft = Math.floor((fbTokenExpiresAt - Date.now()) / (24 * 60 * 60 * 1000));
        if (daysLeft <= 0) {
          console.error('[FB] Token đã hết hạn — cần kết nối lại Facebook.');
          globalFbAccessToken = '';
        } else if (daysLeft <= FB_TOKEN_WARN_DAYS) {
          console.error(`[FB] Cảnh báo: token Facebook còn ${daysLeft} ngày — cần gia hạn sớm.`);
        }
      }
    } catch {
      // Không có token đã lưu — bình thường khi lần đầu chạy
    }
  }

  // Scheduler lock: chỉ 1 process chạy tại 1 thời điểm (chống duplicate khi PM2 cluster)
  async function acquireSchedulerLock(lockKey: string, ttlSeconds = 90): Promise<boolean> {
    const now = Date.now();
    const lockExpiresAt = now + ttlSeconds * 1000;
    try {
      const { data: existing } = await supabase
        .from('app_state')
        .select('schedule')
        .eq('user_id', lockKey)
        .single();
      if (existing?.schedule?.expiresAt > now) return false; // lock đang được giữ
      await supabase.from('app_state').upsert({
        user_id: lockKey,
        schedule: { expiresAt: lockExpiresAt, pid: process.pid },
        updated_at: new Date().toISOString(),
      });
      return true;
    } catch {
      return false;
    }
  }

  async function persistAutoPostConfig() {
    try {
      await supabase.from('app_state').upsert({
        user_id: 'phuc-sang-auto-post-config',
        schedule: autoPostConfig,
        updated_at: new Date().toISOString(),
      });
    } catch (e) {
      console.error('Lỗi lưu autoPostConfig vào Supabase:', e);
    }
  }

  function addAutoPostLog(message: string, type: 'info' | 'success' | 'error' = 'info') {
    const log: AutoPostLog = {
      id: Date.now().toString(),
      time: new Date().toLocaleString('vi-VN'),
      message,
      type,
    };
    autoPostConfig.logs.unshift(log);
    if (autoPostConfig.logs.length > 50) autoPostConfig.logs.pop();
    persistAutoPostConfig().catch(() => {});
  }

  async function loadAutoPostConfig() {
    await loadFbToken();
    try {
      const { data: savedConfig } = await supabase
        .from('app_state')
        .select('schedule')
        .eq('user_id', 'phuc-sang-auto-post-config')
        .single();
      if (savedConfig?.schedule) {
        autoPostConfig = { ...autoPostConfig, ...savedConfig.schedule };
      }
    } catch {
      // Không có config đã lưu — dùng default
    }
  }

  async function runAutoPostScheduler() {
    if (
      !autoPostConfig.enabled ||
      !autoPostConfig.selectedPageId ||
      !autoPostConfig.selectedPageAccessToken
    ) {
      return;
    }
    const locked = await acquireSchedulerLock('scheduler-fb-lock', 90);
    if (!locked) return;

    const now = new Date();
    const todayStr = now.toISOString().split('T')[0];
    const currentTimeStr = `${now.getHours().toString().padStart(2, '0')}:${now.getMinutes().toString().padStart(2, '0')}`;

    try {
      const { data, error } = await supabase
        .from('app_state')
        .select('*')
        .eq('user_id', 'phuc-sang-marketing')
        .single();

      if (error || !data) return;

      const schedule = data.schedule || [];
      let updated = false;

      for (const item of schedule) {
        const itemTime = item.scheduledTime || '08:00';

        if (
          item.date === todayStr &&
          itemTime <= currentTimeStr &&
          !item.isPosted &&
          item.status !== 'posted'
        ) {
          try {
            const fbResponse = await axios.post(
              `https://graph.facebook.com/v21.0/${autoPostConfig.selectedPageId}/feed`,
              {
                message: `${item.topic}\n\n${item.caption}`,
                access_token: autoPostConfig.selectedPageAccessToken,
              }
            );

            if (fbResponse.data.id) {
              item.isPosted = true;
              item.status = 'posted';
              item.fbPostId = fbResponse.data.id;
              updated = true;
              addAutoPostLog(`Tự động đăng thành công: ${item.topic}`, 'success');
            }
          } catch (fbError: unknown) {
            const errMsg = getHttpErrorMessage(fbError);
            console.error(`[Scheduler] Lỗi đăng bài: ${errMsg}`);
            item.status = 'error';
            item.errorLog = errMsg;
            updated = true;
            addAutoPostLog(`Lỗi tự động đăng "${item.topic}": ${errMsg}`, 'error');
          }
        }
      }

      if (updated) {
        await supabase.from('app_state').upsert({
          user_id: 'phuc-sang-marketing',
          schedule,
          updated_at: new Date().toISOString(),
        });
      }
    } catch (e) {
      console.error('[Scheduler] Lỗi hệ thống:', e);
    }
  }

  router.get('/api/fb/config', (_req, res) => {
    res.json({ appId: fbConfig.appId, hasSecret: !!fbConfig.appSecret });
  });

  router.post('/api/fb/config', requireAuth, (req, res) => {
    const { appId, appSecret } = req.body;
    if (appId) fbConfig.appId = appId;
    if (appSecret) fbConfig.appSecret = appSecret;

    try {
      fs.writeFileSync(configFile, JSON.stringify(fbConfig, null, 2));
    } catch (e) {
      console.error('Lỗi lưu file cấu hình:', e);
    }

    res.json({ success: true });
  });

  router.get('/api/fb/auth-url', (req, res) => {
    if (!fbConfig.appId) {
      return res.status(400).json({ error: 'Chưa cấu hình App ID' });
    }
    const baseUrl = process.env.APP_URL || `${req.protocol}://${req.get('host')}`;
    const redirectUri = `${baseUrl.replace(/\/$/, '')}/auth/facebook/callback`;
    const params = new URLSearchParams({
      client_id: fbConfig.appId,
      redirect_uri: redirectUri,
      scope:
        'pages_manage_posts,pages_read_engagement,pages_show_list,public_profile,business_management',
      response_type: 'code',
    });
    const authUrl = `https://www.facebook.com/v21.0/dialog/oauth?${params.toString()}`;
    res.json({ url: authUrl });
  });

  router.get('/auth/facebook/callback', async (req, res) => {
    const { code } = req.query;

    if (!code) return res.status(400).send('Thiếu mã xác thực từ Facebook');
    if (!fbConfig.appId || !fbConfig.appSecret) {
      return res.status(400).send('Thiếu cấu hình App ID hoặc App Secret trên máy chủ');
    }

    const baseUrl = process.env.APP_URL || `${req.protocol}://${req.get('host')}`;
    const redirectUri = `${baseUrl.replace(/\/$/, '')}/auth/facebook/callback`;

    try {
      const tokenResponse = await axios.get('https://graph.facebook.com/v21.0/oauth/access_token', {
        params: {
          client_id: fbConfig.appId.trim(),
          client_secret: fbConfig.appSecret.trim(),
          redirect_uri: redirectUri,
          code,
        },
      });

      const { access_token } = tokenResponse.data;
      (req as FacebookSessionRequest).session.fbAccessToken = access_token;
      await persistFbToken(access_token);

      req.session.save(err => {
        if (err) {
          console.error('Lỗi lưu session:', err);
          return res.status(500).send(`Lỗi lưu phiên làm việc: ${err.message}`);
        }
        res.send(`
          <html>
            <head>
              <title>Xác thực thành công</title>
              <style>
                body { font-family: sans-serif; display: flex; flex-direction: column; align-items: center; justify-content: center; height: 100vh; margin: 0; background: #f0f2f5; text-align: center; }
                .card { background: white; padding: 2rem; border-radius: 1rem; shadow: 0 4px 6px rgba(0,0,0,0.1); max-width: 400px; }
                .btn { background: #1877f2; color: white; border: none; padding: 10px 20px; border-radius: 5px; cursor: pointer; font-weight: bold; margin-top: 20px; }
              </style>
            </head>
            <body>
              <div class="card">
                <h2 style="color: #2e7d32;">Kết nối thành công!</h2>
                <p>Tài khoản Facebook của bạn đã được kết nối với hệ thống.</p>
                <p id="status">Đang thông báo cho ứng dụng chính...</p>
                <button class="btn" onclick="window.close()">Đóng cửa sổ này</button>
              </div>
              <script>
                function notifyAndClose() {
                  if (window.opener) {
                    try {
                      window.opener.postMessage({ type: 'OAUTH_AUTH_SUCCESS' }, '*');
                      document.getElementById('status').innerText = 'Đã thông báo thành công. Đang đóng...';
                      setTimeout(() => window.close(), 1000);
                    } catch (e) {
                      console.error("Lỗi postMessage:", e);
                      document.getElementById('status').innerText = 'Có lỗi khi thông báo. Vui lòng đóng cửa sổ này và tải lại trang chính.';
                    }
                  } else {
                    document.getElementById('status').innerText = 'Không tìm thấy cửa sổ chính. Vui lòng đóng cửa sổ này và bấm "Làm mới" trên ứng dụng.';
                  }
                }

                notifyAndClose();

                setTimeout(() => {
                  if (!window.closed) {
                    document.getElementById('status').innerText = 'Vui lòng bấm nút Đóng bên dưới và quay lại ứng dụng.';
                  }
                }, 5000);
              </script>
            </body>
          </html>
        `);
      });
    } catch (error: unknown) {
      const errorMsg = getHttpErrorMessage(error);
      console.error('Lỗi đổi token chi tiết:', errorMsg);
      res.status(500).send(`
        <html>
          <body style="font-family: sans-serif; padding: 20px;">
            <h2 style="color: red;">Lỗi kết nối Facebook</h2>
            <p>Chi tiết: ${errorMsg}</p>
            <p>Vui lòng kiểm tra lại App Secret và App ID trong cấu hình.</p>
            <button onclick="window.close()">Đóng cửa sổ</button>
          </body>
        </html>
      `);
    }
  });

  router.get('/api/fb/pages', async (req, res) => {
    const accessToken = (req as FacebookSessionRequest).session.fbAccessToken || globalFbAccessToken;

    if (!accessToken) {
      return res
        .status(401)
        .json({
          error: 'Chưa kết nối Facebook hoặc phiên làm việc hết hạn. Vui lòng thử kết nối lại.',
        });
    }

    try {
      const response = await axios.get('https://graph.facebook.com/v21.0/me/accounts', {
        params: {
          access_token: accessToken,
          fields: 'name,access_token,id,category,picture,tasks',
        },
      });
      res.json(response.data.data);
    } catch (error: unknown) {
      res.status(500).json({ error: getHttpErrorMessage(error) });
    }
  });

  router.post('/api/fb/post', requireAuth, async (req, res) => {
    const { pageId, pageAccessToken, message } = req.body;
    if (!pageId || !pageAccessToken || !message) {
      return res.status(400).json({ error: 'Thiếu thông tin đăng bài' });
    }

    try {
      const response = await axios.post(`https://graph.facebook.com/v21.0/${pageId}/feed`, {
        message,
        access_token: pageAccessToken,
      });
      res.json({ success: true, postId: response.data.id });
    } catch (error: unknown) {
      res.status(500).json({ error: getHttpErrorMessage(error) });
    }
  });

  router.get('/api/fb/auto-post/config', (_req, res) => {
    res.json(autoPostConfig);
  });

  router.post('/api/fb/auto-post/config', requireAuth, (req, res) => {
    const { enabled, selectedPageId, selectedPageName, selectedPageAccessToken } = req.body;

    if (enabled !== undefined) autoPostConfig.enabled = enabled;
    if (selectedPageId !== undefined) autoPostConfig.selectedPageId = selectedPageId;
    if (selectedPageName !== undefined) autoPostConfig.selectedPageName = selectedPageName;
    if (selectedPageAccessToken !== undefined)
      autoPostConfig.selectedPageAccessToken = selectedPageAccessToken;

    addAutoPostLog(
      `Đã cập nhật cấu hình tự động: ${autoPostConfig.enabled ? 'BẬT' : 'TẮT'} cho trang ${autoPostConfig.selectedPageName || 'chưa chọn'}`
    );

    res.json({ success: true, config: autoPostConfig });
  });

  router.get('/api/fb/auto-post/logs', (_req, res) => {
    res.json(autoPostConfig.logs);
  });

  return {
    router,
    loadAutoPostConfig,
    runAutoPostScheduler,
  };
}
