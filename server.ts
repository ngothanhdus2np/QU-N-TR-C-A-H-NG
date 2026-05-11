console.log('--- SERVER PROCESS STARTING ---');

process.on('unhandledRejection', (reason, promise) => {
  console.error('Unhandled Rejection at:', promise, 'reason:', reason);
});

process.on('uncaughtException', (err, origin) => {
  console.error(`Uncaught Exception: ${err}\n` + `Exception origin: ${origin}`);
});

import express from 'express';
import cookieParser from 'cookie-parser';
import session from 'express-session';
import path from 'path';
import { fileURLToPath } from 'url';
import cors from 'cors';
import { createClient } from '@supabase/supabase-js';
import { createAiRouter } from './routes/ai';
import { createFacebookRouter } from './routes/facebook';
import { createImportRouter } from './routes/import';
import { createNotificationsRouter, runNotificationScheduler } from './routes/notifications';

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
  console.log(`🚀 Server is listening on port ${PORT}`);
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

server.on('error', (err: any) => {
  console.error('SERVER LISTEN ERROR:', err);
});

async function startServer() {
  try {
    console.log('--- STARTING SERVER INITIALIZATION ---');
    console.log(`NODE_ENV: ${process.env.NODE_ENV}`);

    app.set('trust proxy', 1);
    const allowedOrigins = [
      `http://localhost:${PORT}`,
      `http://127.0.0.1:${PORT}`,
      process.env.APP_URL,
    ].filter(Boolean) as string[];

    app.use(cors({
      origin: (origin, callback) => {
        if (!origin || allowedOrigins.includes(origin)) return callback(null, true);
        callback(new Error('Not allowed by CORS'));
      },
      methods: ['GET', 'POST', 'PUT', 'OPTIONS'],
      allowedHeaders: ['Content-Type', 'Authorization', 'X-Api-Key'],
      credentials: true,
    }));
    app.use(express.json({ limit: '15mb' }));
    app.use(cookieParser());

    app.use((req, _res, next) => {
      console.log(`[${new Date().toISOString()}] ${req.method} ${req.url}`);
      next();
    });

    app.use(session({
      secret: process.env.SESSION_SECRET || 'fb-app-secret-key',
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
    }));

    app.get('/health', (_req, res) => {
      res.send('OK');
    });

    app.use('/api', (req, _res, next) => {
      console.log(`[API Request] ${req.method} ${req.url}`);
      next();
    });

    const requireAuth = (req: any, res: any, next: any) => {
      const apiKey = req.headers['x-api-key'] as string;
      const internalKey = process.env.INTERNAL_API_KEY;
      const isLocalRequest = req.hostname === 'localhost' || req.hostname === '127.0.0.1';
      const hasValidKey = internalKey && apiKey === internalKey;

      if (isLocalRequest || hasValidKey) return next();
      return res.status(401).json({ error: 'Unauthorized' });
    };

    const facebookRoutes = createFacebookRouter({ supabase, requireAuth, configDir: __dirname });
    app.use(facebookRoutes.router);
    app.use(createAiRouter());
    app.use(createNotificationsRouter(supabase));
    app.use(createImportRouter(supabase, requireAuth));

    if (process.env.NODE_ENV !== 'production') {
      console.log('Initializing Vite dev server...');
      try {
        const { createServer: createViteServer } = await import('vite');
        const vite = await createViteServer({
          server: { middlewareMode: true },
          appType: 'spa',
        });
        app.use(vite.middlewares);
        viteReady = true;
        console.log('Vite dev server initialized successfully.');
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

    console.log('--- SERVER INITIALIZATION COMPLETE ---');
  } catch (error) {
    console.error('CRITICAL ERROR DURING SERVER STARTUP:', error);
    process.exit(1);
  }
}

startServer();
