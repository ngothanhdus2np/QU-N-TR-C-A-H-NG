/**
 * Error Tracking Service — CHỈ DÙNG Ở BACKEND (import fs/path). Nếu cần log lỗi
 * React ở frontend, dùng service riêng không đụng fs/path (import file này từ
 * component sẽ vỡ build Vite vì 'fs' không có browser shim).
 *
 * Centralized error tracking and monitoring.
 * Ready for Sentry integration when needed.
 */
import fs from 'fs';
import path from 'path';

interface ErrorContext {
  userId?: string;
  action?: string;
  metadata?: Record<string, unknown>;
}

// Field nhạy cảm cần che khi log — tránh lộ mật khẩu/token nếu route nào nhận các
// trường này trong body (audit 2026-07-10 mục J: errorHandler log cả req.body thô).
const SENSITIVE_KEYS = /password|token|secret|apikey|api_key|access_token|refresh_token|authorization|jwt|service_role/i;

function redact(value: unknown, depth = 0): unknown {
  if (depth > 5 || value == null) return value;
  if (Array.isArray(value)) return value.map(v => redact(v, depth + 1));
  if (typeof value === 'object') {
    const out: Record<string, unknown> = {};
    for (const [k, v] of Object.entries(value as Record<string, unknown>)) {
      out[k] = SENSITIVE_KEYS.test(k) ? '[REDACTED]' : redact(v, depth + 1);
    }
    return out;
  }
  return value;
}

// Ghi log lỗi ra file có rotation (giữ 14 ngày) — console.error mất log khi process
// restart/rotate; đây là lớp lưu trữ tối thiểu trước khi có Sentry/dịch vụ ngoài thật.
const LOG_DIR = path.join(process.cwd(), 'logs');
const LOG_RETENTION_DAYS = 14;
let lastRotationCheck = '';

function rotateOldLogs(): void {
  const today = new Date().toISOString().slice(0, 10);
  if (lastRotationCheck === today) return; // chỉ dọn tối đa 1 lần/ngày
  lastRotationCheck = today;
  try {
    const cutoff = Date.now() - LOG_RETENTION_DAYS * 24 * 60 * 60 * 1000;
    for (const file of fs.readdirSync(LOG_DIR)) {
      if (!file.startsWith('error-') || !file.endsWith('.log')) continue;
      const full = path.join(LOG_DIR, file);
      if (fs.statSync(full).mtimeMs < cutoff) fs.unlinkSync(full);
    }
  } catch {
    // Thư mục chưa tồn tại hoặc lỗi đọc — bỏ qua, không chặn logging.
  }
}

function writeErrorLogFile(entry: Record<string, unknown>): void {
  try {
    fs.mkdirSync(LOG_DIR, { recursive: true });
    rotateOldLogs();
    const file = path.join(LOG_DIR, `error-${new Date().toISOString().slice(0, 10)}.log`);
    fs.appendFileSync(file, JSON.stringify(entry) + '\n');
  } catch {
    // Ghi file lỗi (disk đầy, quyền...) — không chặn luồng chính, console.error vẫn còn.
  }
}

// Audit 29/08/2026: bỏ 4 method chưa từng có caller nào trong toàn repo
// (captureMessage, setUser, clearUser, addBreadcrumb) — cả 4 chỉ chứa nhánh
// `if (this.sentryEnabled)` với sentryEnabled hard-code false, tức no-op thật sự.
// Chỉ giữ init() + captureError() + errorHandler là phần đang thực sự chạy.
// Khi tích hợp Sentry thật thì thêm lại theo nhu cầu lúc đó.
class ErrorTrackingService {
  private sentryEnabled = false; // Set to true when Sentry is configured

  /**
   * Initialize error tracking (Sentry, etc.)
   */
  init(): void {
    if (this.sentryEnabled && process.env.SENTRY_DSN) {
      // TODO: Initialize Sentry when ready
      // import * as Sentry from '@sentry/node';
      // Sentry.init({
      //   dsn: process.env.SENTRY_DSN,
      //   environment: process.env.NODE_ENV,
      //   tracesSampleRate: 1.0,
      // });
      console.log('[ErrorTracking] Sentry initialized');
    } else {
      console.log('[ErrorTracking] Using console logging (Sentry not configured)');
    }
  }

  /**
   * Capture an error
   */
  captureError(error: Error, context?: ErrorContext): void {
    if (this.sentryEnabled) {
      // TODO: Send to Sentry
      // Sentry.captureException(error, { contexts: { custom: context } });
    }

    const entry = {
      message: error.message,
      stack: error.stack,
      context: context ? { ...context, metadata: redact(context.metadata) } : context,
      timestamp: new Date().toISOString(),
    };

    // Always log to console
    console.error('[ERROR]', entry);
    // Backend only (fs không có trên trình duyệt) — ghi thêm ra file có rotation.
    if (typeof window === 'undefined') writeErrorLogFile(entry);
  }

}

// Singleton instance
export const errorTracking = new ErrorTrackingService();

// Initialize on import
errorTracking.init();

/**
 * Express error handler middleware
 */
export const errorHandler = (err: Error, req: any, res: any, next: any) => {
  errorTracking.captureError(err, {
    action: `${req.method} ${req.path}`,
    metadata: {
      body: req.body,
      query: req.query,
      params: req.params,
    },
  });

  // Don't expose error details in production
  const isProduction = process.env.NODE_ENV === 'production';
  res.status(500).json({
    error: isProduction ? 'Internal server error' : err.message,
    ...(isProduction ? {} : { stack: err.stack }),
  });
};
