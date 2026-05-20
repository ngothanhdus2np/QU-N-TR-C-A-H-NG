console.log("--- SERVER PROCESS STARTING ---");

process.on('unhandledRejection', (reason, promise) => {
  console.error('Unhandled Rejection at:', promise, 'reason:', reason);
});

process.on('uncaughtException', (err, origin) => {
  console.error(`Uncaught Exception: ${err}\n` + `Exception origin: ${origin}`);
});

import fs from "fs";

import express from "express";
const app = express();
const PORT = 3000;

let viteReady = false;

// Start listening immediately to satisfy the platform's health check
const server = app.listen(PORT, "0.0.0.0", () => {
  console.log(`🚀 Server is listening on port ${PORT}`);
});

// Early health check and root handler
app.get("/health", (req, res) => res.send("OK"));
app.get("/", (req, res, next) => {
  if (!viteReady && process.env.NODE_ENV !== "production") {
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

server.on('error', (err: any) => {
  console.error("SERVER LISTEN ERROR:", err);
});

import axios from "axios";
import cookieParser from "cookie-parser";
import session from "express-session";
import path from "path";
import { fileURLToPath } from "url";
import cors from "cors";
import { createClient } from '@supabase/supabase-js';
import { cleanVNNumber, parseVNDate, generateId } from "./businessLogic";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const CONFIG_FILE = path.join(__dirname, "fb_config.json");

// Supabase client for scheduler
const supabaseAdminUrl = process.env.SUPABASE_URL;
const supabaseAdminKey = process.env.SUPABASE_ANON_KEY;
if (!supabaseAdminUrl || !supabaseAdminKey) {
  console.error("FATAL: SUPABASE_URL hoặc SUPABASE_ANON_KEY chưa được cấu hình trong .env.local");
  process.exit(1);
}
const supabase = createClient(supabaseAdminUrl, supabaseAdminKey);

// Bộ nhớ đệm toàn cục để xử lý vấn đề mất session trong Iframe
const SESSION_CACHE_FILE = path.join(__dirname, "fb_session_cache.json");
let globalFbAccessToken = "";

if (fs.existsSync(SESSION_CACHE_FILE)) {
  try {
    const cache = JSON.parse(fs.readFileSync(SESSION_CACHE_FILE, "utf-8"));
    globalFbAccessToken = cache.accessToken || "";
  } catch (e) {
    console.error("Lỗi đọc file cache session:", e);
  }
}

// Cấu hình tự động đăng bài
let autoPostConfig = {
  enabled: false,
  selectedPageId: "",
  selectedPageName: "",
  selectedPageAccessToken: "",
  logs: [] as any[]
};

// Load config from file if exists
let fbConfig = {
  appId: "",
  appSecret: ""
};

const AUTO_POST_CONFIG_FILE = path.join(__dirname, "auto_post_config.json");

if (fs.existsSync(CONFIG_FILE)) {
  try {
    fbConfig = JSON.parse(fs.readFileSync(CONFIG_FILE, "utf-8"));
  } catch (e) {
    console.error("Lỗi đọc file cấu hình:", e);
  }
}

if (fs.existsSync(AUTO_POST_CONFIG_FILE)) {
  try {
    autoPostConfig = JSON.parse(fs.readFileSync(AUTO_POST_CONFIG_FILE, "utf-8"));
  } catch (e) {
    console.error("Lỗi đọc file cấu hình tự động:", e);
  }
}

// Hàm lưu log
function addAutoPostLog(message: string, type: 'info' | 'success' | 'error' = 'info') {
  const log = {
    id: Date.now().toString(),
    time: new Date().toLocaleString('vi-VN'),
    message,
    type
  };
  autoPostConfig.logs.unshift(log);
  if (autoPostConfig.logs.length > 50) autoPostConfig.logs.pop();
  
  try {
    fs.writeFileSync(AUTO_POST_CONFIG_FILE, JSON.stringify(autoPostConfig, null, 2));
  } catch (e) {
    console.error("Lỗi lưu log:", e);
  }
}

// Bộ lập lịch tự động đăng bài
async function runAutoPostScheduler() {
  if (!autoPostConfig.enabled || !autoPostConfig.selectedPageId || !autoPostConfig.selectedPageAccessToken) {
    return;
  }

  const now = new Date();
  const todayStr = now.toISOString().split('T')[0];
  const currentTimeStr = `${now.getHours().toString().padStart(2, '0')}:${now.getMinutes().toString().padStart(2, '0')}`;

  console.log(`[Scheduler] Đang kiểm tra bài viết cho ${todayStr} ${currentTimeStr}...`);

  try {
    // Lấy trạng thái app từ Supabase
    const { data, error } = await supabase
      .from('app_state')
      .select('*')
      .eq('user_id', 'phuc-sang-marketing')
      .single();

    if (error || !data) return;

    let schedule = data.schedule || [];
    let updated = false;

    for (let item of schedule) {
      // Kiểm tra nếu bài viết đến giờ đăng và chưa đăng
      const itemTime = item.scheduledTime || "08:00"; // Mặc định 8h sáng nếu không có giờ
      
      if (item.date === todayStr && itemTime <= currentTimeStr && !item.isPosted && item.status !== 'posted') {
        console.log(`[Scheduler] Phát hiện bài viết cần đăng: ${item.topic}`);
        
        try {
          // Đăng lên Facebook
          const fbResponse = await axios.post(`https://graph.facebook.com/v21.0/${autoPostConfig.selectedPageId}/feed`, {
            message: `${item.topic}\n\n${item.caption}`,
            access_token: autoPostConfig.selectedPageAccessToken
          });

          if (fbResponse.data.id) {
            item.isPosted = true;
            item.status = 'posted';
            item.fbPostId = fbResponse.data.id;
            updated = true;
            addAutoPostLog(`Tự động đăng thành công: ${item.topic}`, 'success');
          }
        } catch (fbError: any) {
          const errMsg = fbError.response?.data?.error?.message || fbError.message;
          console.error(`[Scheduler] Lỗi đăng bài: ${errMsg}`);
          item.status = 'error';
          item.errorLog = errMsg;
          updated = true;
          addAutoPostLog(`Lỗi tự động đăng "${item.topic}": ${errMsg}`, 'error');
        }
      }
    }

    if (updated) {
      // Cập nhật lại Supabase
      await supabase.from('app_state').upsert({
        user_id: 'phuc-sang-marketing',
        schedule: schedule,
        updated_at: new Date().toISOString()
      });
    }
  } catch (e) {
    console.error("[Scheduler] Lỗi hệ thống:", e);
  }
}

// Chạy scheduler mỗi phút
async function startServer() {
  try {
    console.log("--- STARTING SERVER INITIALIZATION ---");
    console.log(`NODE_ENV: ${process.env.NODE_ENV}`);
    
    app.set("trust proxy", 1);
    const allowedOrigin = process.env.APP_URL || `http://localhost:${PORT}`;
    app.use(cors({
      origin: allowedOrigin,
      methods: ['GET', 'POST', 'OPTIONS'],
      allowedHeaders: ['Content-Type', 'Authorization', 'X-Api-Key'],
      credentials: true
    }));
    app.use(express.json());
    app.use(cookieParser());

    // Request logging middleware
    app.use((req, res, next) => {
      console.log(`[${new Date().toISOString()}] ${req.method} ${req.url}`);
      next();
    });

    app.use(session({
      secret: process.env.SESSION_SECRET || "change-me-in-production",
      resave: true,
      saveUninitialized: true,
      proxy: true,
      name: "fb_session",
      cookie: { 
        secure: true, 
        sameSite: 'none',
        httpOnly: true,
        maxAge: 24 * 60 * 60 * 1000 // 1 day
      }
    }));

    // Auth middleware: yêu cầu X-Api-Key header cho các route nội bộ
    function requireInternalKey(req: any, res: any, next: any) {
      const apiKey = process.env.INTERNAL_API_KEY;
      if (apiKey && req.headers['x-api-key'] !== apiKey) {
        return res.status(401).json({ error: "Không có quyền truy cập. Thiếu hoặc sai X-Api-Key." });
      }
      next();
    }

    // Auth middleware: yêu cầu Facebook session token
    function requireFbSession(req: any, res: any, next: any) {
      const token = (req.session as any).fbAccessToken || globalFbAccessToken;
      if (!token) {
        return res.status(401).json({ error: "Chưa xác thực Facebook. Vui lòng kết nối lại." });
      }
      next();
    }

    // Health check
    app.get("/health", (req, res) => {
      res.send("OK");
    });

    // API Routes
    app.use("/api", (req, res, next) => {
      console.log(`[API Request] ${req.method} ${req.url}`);
      next();
    });

    app.get("/api/fb/config", (req, res) => {
      res.json({ appId: fbConfig.appId, hasSecret: !!fbConfig.appSecret });
    });

    app.all("/api/sync-kiotviet*all", requireInternalKey, async (req, res) => {
      console.log(">>> NHẬN YÊU CẦU ĐỒNG BỘ KIOTVIET (ALL)");
      const { data } = req.body;
      if (!data || !Array.isArray(data)) {
        return res.status(400).json({ error: "Dữ liệu không hợp lệ" });
      }

      try {
        const parsedData = data.map(item => {
          const date = parseVNDate(item.date);
          const amount = cleanVNNumber(item.revenue);
          return { date, amount };
        }).filter(item => item.date && item.amount > 0);

        if (parsedData.length === 0) {
          return res.status(400).json({ error: "Không có dữ liệu hợp lệ" });
        }

        const dates = parsedData.map(d => d.date);
        const { data: existingRecords } = await supabase
          .from('revenue_records')
          .select('id, date')
          .in('date', dates);

        const existingMap = new Map(existingRecords?.map(r => [r.date, r.id]) || []);

        const recordsToUpsert = parsedData.map(item => {
          const existingId = existingMap.get(item.date!);
          return {
            id: existingId || generateId(),
            date: item.date,
            total_gross_revenue: item.amount,
            net_revenue: item.amount,
            gross_profit: item.amount,
            updated_at: new Date().toISOString()
          };
        });

        const { error } = await supabase
          .from('revenue_records')
          .upsert(recordsToUpsert);

        if (error) throw error;
        res.json({ success: true, count: recordsToUpsert.length });
      } catch (error: any) {
        console.error("KiotViet Sync Error:", error);
        res.status(500).json({ error: error.message });
      }
    });

    app.post("/api/fb/config", (req, res) => {
      const { appId, appSecret } = req.body;
      if (appId) fbConfig.appId = appId;
      if (appSecret) fbConfig.appSecret = appSecret;
      
      try {
        fs.writeFileSync(CONFIG_FILE, JSON.stringify(fbConfig, null, 2));
      } catch (e) {
        console.error("Lỗi lưu file cấu hình:", e);
      }
      
      res.json({ success: true });
    });

    app.get("/api/fb/auth-url", (req, res) => {
      if (!fbConfig.appId) {
        return res.status(400).json({ error: "Chưa cấu hình App ID" });
      }
      const baseUrl = process.env.APP_URL || `${req.protocol}://${req.get('host')}`;
      const redirectUri = `${baseUrl.replace(/\/$/, "")}/auth/facebook/callback`;
      const params = new URLSearchParams({
        client_id: fbConfig.appId,
        redirect_uri: redirectUri,
        scope: "pages_manage_posts,pages_read_engagement,pages_show_list,public_profile,business_management",
        response_type: "code"
      });
      const authUrl = `https://www.facebook.com/v21.0/dialog/oauth?${params.toString()}`;
      res.json({ url: authUrl });
    });

    app.get("/auth/facebook/callback", async (req, res) => {
      const { code } = req.query;
      console.log("--- BẮT ĐẦU XÁC THỰC FACEBOOK ---");
      console.log("App ID đang dùng:", fbConfig.appId ? `${fbConfig.appId.substring(0, 5)}...` : "TRỐNG");
      console.log("Độ dài App Secret:", fbConfig.appSecret ? fbConfig.appSecret.length : 0);
      
      if (!code) return res.status(400).send("Thiếu mã xác thực từ Facebook");
      if (!fbConfig.appId || !fbConfig.appSecret) {
        return res.status(400).send("Thiếu cấu hình App ID hoặc App Secret trên máy chủ");
      }

      const baseUrl = process.env.APP_URL || `${req.protocol}://${req.get('host')}`;
      const redirectUri = `${baseUrl.replace(/\/$/, "")}/auth/facebook/callback`;

      try {
        console.log("Đang đổi code lấy access token...");
        console.log("Redirect URI dùng để đổi token:", redirectUri);
        
        const tokenResponse = await axios.get("https://graph.facebook.com/v21.0/oauth/access_token", {
          params: {
            client_id: fbConfig.appId.trim(),
            client_secret: fbConfig.appSecret.trim(),
            redirect_uri: redirectUri,
            code
          }
        });

        const { access_token } = tokenResponse.data;
        (req.session as any).fbAccessToken = access_token;
        globalFbAccessToken = access_token; // Lưu vào bộ nhớ đệm toàn cục
        
        // Lưu vào file cache để không phải đăng nhập lại khi restart server
        try {
          fs.writeFileSync(SESSION_CACHE_FILE, JSON.stringify({ accessToken: access_token }));
        } catch (e) {
          console.error("Lỗi lưu file cache session:", e);
        }

        req.session.save((err) => {
          if (err) {
            console.error("Lỗi lưu session:", err);
            return res.status(500).send("Lỗi lưu phiên làm việc: " + err.message);
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
                      // Không tự động redirect về / để tránh hiện app trong popup
                    }
                  }
                  
                  // Thử thông báo ngay
                  notifyAndClose();
                  
                  // Fallback: Nếu sau 5s không đóng được thì hiện hướng dẫn
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
      } catch (error: any) {
        const errorMsg = error.response?.data?.error?.message || error.message;
        console.error("Lỗi đổi token chi tiết:", error.response?.data || error.message);
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

    app.get("/api/fb/pages", async (req, res) => {
      // Thử lấy từ session, nếu không có thì lấy từ bộ nhớ đệm toàn cục
      const accessToken = (req.session as any).fbAccessToken || globalFbAccessToken;
      console.log("Yêu cầu lấy Fanpage, Token tồn tại:", !!accessToken, "Nguồn:", (req.session as any).fbAccessToken ? "Session" : "Global Cache");
      
      if (!accessToken) {
        return res.status(401).json({ error: "Chưa kết nối Facebook hoặc phiên làm việc hết hạn. Vui lòng thử kết nối lại." });
      }

      try {
        console.log("Đang gọi Graph API lấy danh sách Fanpage (v21.0)...");
        const response = await axios.get("https://graph.facebook.com/v21.0/me/accounts", {
          params: { 
            access_token: accessToken,
            fields: "name,access_token,id,category,picture,tasks"
          }
        });
        console.log("Dữ liệu thô từ FB:", JSON.stringify(response.data.data));
        console.log("Kết quả từ Facebook:", response.data.data?.length || 0, "Fanpage tìm thấy");
        res.json(response.data.data);
      } catch (error: any) {
        res.status(500).json({ error: error.response?.data?.error?.message || error.message });
      }
    });

    app.post("/api/fb/post", requireFbSession, async (req, res) => {
      const { pageId, pageAccessToken, message } = req.body;
      if (!pageId || !pageAccessToken || !message) {
        return res.status(400).json({ error: "Thiếu thông tin đăng bài" });
      }

      try {
        const response = await axios.post(`https://graph.facebook.com/v21.0/${pageId}/feed`, {
          message,
          access_token: pageAccessToken
        });
        res.json({ success: true, postId: response.data.id });
      } catch (error: any) {
        res.status(500).json({ error: error.response?.data?.error?.message || error.message });
      }
    });

    // API Tự động đăng bài
    app.get("/api/fb/auto-post/config", (req, res) => {
      res.json(autoPostConfig);
    });

    app.post("/api/fb/auto-post/config", (req, res) => {
      const { enabled, selectedPageId, selectedPageName, selectedPageAccessToken } = req.body;
      
      if (enabled !== undefined) autoPostConfig.enabled = enabled;
      if (selectedPageId !== undefined) autoPostConfig.selectedPageId = selectedPageId;
      if (selectedPageName !== undefined) autoPostConfig.selectedPageName = selectedPageName;
      if (selectedPageAccessToken !== undefined) autoPostConfig.selectedPageAccessToken = selectedPageAccessToken;
      
      try {
        fs.writeFileSync(AUTO_POST_CONFIG_FILE, JSON.stringify(autoPostConfig, null, 2));
        addAutoPostLog(`Đã cập nhật cấu hình tự động: ${autoPostConfig.enabled ? "BẬT" : "TẮT"} cho trang ${autoPostConfig.selectedPageName || "chưa chọn"}`);
      } catch (e) {
        console.error("Lỗi lưu cấu hình tự động:", e);
      }
      
      res.json({ success: true, config: autoPostConfig });
    });

    app.get("/api/fb/auto-post/logs", (req, res) => {
      res.json(autoPostConfig.logs);
    });

    // Vite middleware for development
    if (process.env.NODE_ENV !== "production") {
      console.log("Initializing Vite dev server...");
      try {
        const { createServer: createViteServer } = await import("vite");
        const vite = await createViteServer({
          server: { middlewareMode: true },
          appType: "spa",
        });
        app.use(vite.middlewares);
        viteReady = true;
        console.log("Vite dev server initialized successfully.");
      } catch (viteError) {
        console.error("FAILED TO INITIALIZE VITE DEV SERVER:", viteError);
        // Don't crash the whole server, maybe it can still serve API
      }
    } else {
      app.use(express.static(path.join(__dirname, "dist")));
      app.get("*all", (req, res) => {
        res.sendFile(path.join(__dirname, "dist", "index.html"));
      });
    }

    setInterval(runAutoPostScheduler, 60000);
    console.log("--- SERVER INITIALIZATION COMPLETE ---");
  } catch (error) {
    console.error("CRITICAL ERROR DURING SERVER STARTUP:", error);
    process.exit(1);
  }
}

startServer();
