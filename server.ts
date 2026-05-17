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

import express, { NextFunction, Request, Response } from 'express';
import cookieParser from 'cookie-parser';
import session from 'express-session';
import path from 'path';
import os from 'os';
import { fileURLToPath } from 'url';
import cors from 'cors';
import rateLimit from 'express-rate-limit';
import helmet from 'helmet';

import { createClient } from '@supabase/supabase-js';
import { createAiRouter } from './routes/ai';
import { createDataRouter } from './routes/data';
import { createFacebookRouter } from './routes/facebook';
import { createImportRouter } from './routes/import';
import { createNotificationsRouter, runNotificationScheduler } from './routes/notifications';

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

// Start listening immediately to satisfy the platform's health check.
const server = app.listen(PORT, '0.0.0.0', () => {
  if (!IS_PROD) console.error(`[STARTUP] Server is listening on port ${PORT}`);
});

app.get('/health', (_req, res) => res.send('OK'));
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
      process.env.APP_URL,
      ...(!IS_PROD ? getLocalIPs().map(ip => `http://${ip}:${PORT}`) : []),
    ].filter(Boolean) as string[];

    // Security: Helmet middleware for security headers
    app.use(helmet({
      contentSecurityPolicy: {
        directives: {
          defaultSrc: ["'self'"],
          scriptSrc: ["'self'", "'unsafe-inline'", "'unsafe-eval'"], // React needs unsafe-eval
          styleSrc: ["'self'", "'unsafe-inline'"],
          imgSrc: ["'self'", "data:", "https:", "blob:"],
          connectSrc: ["'self'", "https://api.anthropic.com", "https://*.supabase.co"],
          fontSrc: ["'self'", "data:"],
          objectSrc: ["'none'"],
          mediaSrc: ["'self'"],
          frameSrc: ["'none'"],
        }
      },
      hsts: {
        maxAge: 31536000,
        includeSubDomains: true,
        preload: true
      },
      referrerPolicy: { policy: 'strict-origin-when-cross-origin' }
    }));

    // Security: Rate limiting
    const apiLimiter = rateLimit({
      windowMs: 15 * 60 * 1000, // 15 minutes
      max: 100, // limit each IP to 100 requests per windowMs
      message: 'Too many requests from this IP, please try again later.',
      standardHeaders: true,
      legacyHeaders: false,
    });

    const authLimiter = rateLimit({
      windowMs: 15 * 60 * 1000, // 15 minutes
      max: 5, // Stricter for auth endpoints
      message: 'Too many authentication attempts, please try again later.',
      standardHeaders: true,
      legacyHeaders: false,
    });

    app.use('/api/', apiLimiter);
    app.use('/api/auth/', authLimiter);

    app.use(
      cors({
        origin: (origin, callback) => {
          if (!origin || allowedOrigins.includes(origin)) return callback(null, true);
          callback(new Error('Not allowed by CORS'));
        },
        methods: ['GET', 'POST', 'PUT', 'OPTIONS'],
        allowedHeaders: ['Content-Type', 'Authorization', 'X-Api-Key'],
        credentials: true,
      })
    );
    app.use(express.json({ limit: '30mb' }));
    app.use(cookieParser());

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
        resave: true,
        saveUninitialized: true,
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

    app.get('/health', (_req, res) => {
      res.send('OK');
    });

    if (!IS_PROD) {
      app.use('/api', (req, _res, next) => {
        console.error(`[DEV API Request] ${req.method} ${req.url}`);
        next();
      });
    }

    const requireAuth = (req: Request, res: Response, next: NextFunction) => {
      const apiKey = req.headers['x-api-key'] as string;
      const internalKey = process.env.INTERNAL_API_KEY;
      
      // SECURITY FIX (2026-05-18): Removed loopback address bypass
      // Previous code allowed all requests from 127.0.0.1, which bypasses auth
      // when deployed behind reverse proxy (Nginx/Cloudflare Tunnel).
      // Now ONLY valid API key grants access.
      
      if (!internalKey) {
        console.error('[AUTH] INTERNAL_API_KEY not configured - all requests will be rejected');
        return res.status(500).json({ error: 'Server configuration error' });
      }
      
      if (apiKey && apiKey === internalKey) {
        return next();
      }
      
      return res.status(401).json({ error: 'Unauthorized - Valid API key required' });
    };

    const facebookRoutes = createFacebookRouter({ supabase, requireAuth, configDir: __dirname });
    app.use(facebookRoutes.router);
    app.use(createAiRouter(requireAuth));
    app.use(createDataRouter(supabase, requireAuth));
    app.use(createNotificationsRouter(supabase, requireAuth));
    app.use(createImportRouter(supabase, requireAuth));

    if (!IS_PROD) {
      try {
        const { createServer: createViteServer } = await import('vite');
        const vite = await createViteServer({
          server: { middlewareMode: true, hmr: { server }, allowedHosts: true },
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
  } catch (error) {
    console.error('CRITICAL ERROR DURING SERVER STARTUP:', error);
    process.exit(1);
  }
}

startServer();
