import { Router, RequestHandler } from 'express';
import { SupabaseClient } from '@supabase/supabase-js';
import { generateEODReport, getEODReport } from '../services/agents/eodAgent';
import { sendEodEmail, isEmailConfigured } from '../services/emailService';
import {
  sendZaloMessage,
  isZaloConfigured,
  formatEodZaloMessage,
  formatAlertZaloMessage,
} from '../services/zaloService';
import { checkAllAlerts, loadAlertConfig, saveAlertConfig } from '../services/agents/alertAgent';

// [FIX] Lỗi PostgrestError từ supabase.rpc()/query không phải instance Error chuẩn —
// nhánh cũ chỉ bắt `instanceof Error` nên mất hết message thật, rơi về "Unknown error".
const getErrorMessage = (error: unknown): string => {
  if (error instanceof Error) return error.message;
  if (error && typeof error === 'object') {
    const record = error as Record<string, unknown>;
    const parts = [record.message, record.details, record.hint, record.code]
      .filter(Boolean)
      .map(String);
    if (parts.length > 0) return parts.join(' | ');
    try {
      return JSON.stringify(error);
    } catch {
      return String(error);
    }
  }
  return 'Unknown error';
};

export function createNotificationsRouter(
  supabase: SupabaseClient,
  requireAuth: RequestHandler
): Router {
  const router = Router();

  router.get('/api/eod-report', requireAuth, async (req, res) => {
    try {
      const date = (req.query.date as string) || new Date().toISOString().split('T')[0];
      const report = await getEODReport(supabase, date);
      res.json(report ?? null);
    } catch (err: unknown) {
      console.error('[EOD /eod-report]', getErrorMessage(err));
      res.json(null);
    }
  });

  router.post('/api/eod-report', requireAuth, async (req, res) => {
    try {
      const date = (req.body?.date as string) || new Date().toISOString().split('T')[0];
      await generateEODReport(supabase, date);
      const report = await getEODReport(supabase, date);
      res.json(report ?? { error: 'Báo cáo đã tạo nhưng không lấy được' });
    } catch (err: unknown) {
      const message = getErrorMessage(err);
      console.error('[EOD POST]', message);
      res.status(500).json({ error: message || 'Lỗi tạo báo cáo' });
    }
  });

  router.get('/api/notifications/status', requireAuth, (_req, res) => {
    res.json({
      emailConfigured: isEmailConfigured(),
      emailTo: process.env.EMAIL_TO || null,
      zaloConfigured: isZaloConfigured(),
      zaloFollowerId: isZaloConfigured() ? process.env.ZALO_FOLLOWER_ID || null : null,
    });
  });

  router.post('/api/notifications/test-email', requireAuth, async (_req, res) => {
    try {
      if (!isEmailConfigured()) {
        return res
          .status(400)
          .json({
            error: 'Email chưa được cấu hình. Thêm EMAIL_USER, EMAIL_PASS, EMAIL_TO vào .env.local',
          });
      }
      const today = new Date().toISOString().split('T')[0];
      await sendEodEmail(
        today,
        `**Test thành công!** Đây là email thử nghiệm từ CFO Brain 4.0.\n\nNếu bạn nhận được email này, hệ thống thông báo đã hoạt động đúng.\nBáo cáo cuối ngày thực sẽ được gửi tự động lúc 21:00 giờ Việt Nam mỗi ngày.`
      );
      res.json({ ok: true, message: `Đã gửi email test đến ${process.env.EMAIL_TO}` });
    } catch (err: unknown) {
      const message = getErrorMessage(err);
      console.error('[Email Test]', message);
      res.status(500).json({ error: message });
    }
  });

  router.post('/api/notifications/test-zalo', requireAuth, async (_req, res) => {
    try {
      if (!isZaloConfigured()) {
        return res
          .status(400)
          .json({
            error:
              'Zalo chưa được cấu hình. Thêm ZALO_OA_ACCESS_TOKEN và ZALO_FOLLOWER_ID vào .env.local',
          });
      }
      await sendZaloMessage(
        `✅ Test thành công!\n\nĐây là tin nhắn thử nghiệm từ CFO Brain 4.0.\nBáo cáo cuối ngày và cảnh báo thông minh sẽ được gửi tự động qua kênh này.`
      );
      res.json({
        ok: true,
        message: `Đã gửi Zalo test đến follower ${process.env.ZALO_FOLLOWER_ID}`,
      });
    } catch (err: unknown) {
      const message = getErrorMessage(err);
      console.error('[Zalo Test]', message);
      res.status(500).json({ error: message });
    }
  });

  router.get('/api/alerts', requireAuth, async (_req, res) => {
    try {
      const alerts = await checkAllAlerts(supabase);
      res.json(alerts);
    } catch (err: unknown) {
      console.error('[Alerts]', getErrorMessage(err));
      res.json([]);
    }
  });

  router.get('/api/alerts/config', requireAuth, async (_req, res) => {
    try {
      const config = await loadAlertConfig(supabase);
      res.json(config);
    } catch (err: unknown) {
      res.status(500).json({ error: getErrorMessage(err) });
    }
  });

  router.put('/api/alerts/config', requireAuth, async (req, res) => {
    try {
      const { defaultMinStock, debtOverdueDays, revenueDropPct } = req.body;
      if (
        typeof defaultMinStock !== 'number' ||
        typeof debtOverdueDays !== 'number' ||
        typeof revenueDropPct !== 'number'
      ) {
        return res.status(400).json({ error: 'Dữ liệu không hợp lệ' });
      }
      const config = { defaultMinStock, debtOverdueDays, revenueDropPct };
      await saveAlertConfig(supabase, config);
      res.json({ ok: true, config });
    } catch (err: unknown) {
      res.status(500).json({ error: getErrorMessage(err) });
    }
  });

  return router;
}

async function acquireSchedulerLock(
  supabase: SupabaseClient,
  lockKey: string,
  ttlSeconds = 90
): Promise<boolean> {
  const now = Date.now();
  const lockExpiresAt = now + ttlSeconds * 1000;
  try {
    const { data: existing } = await supabase
      .from('app_state')
      .select('schedule')
      .eq('user_id', lockKey)
      .single();
    if (existing?.schedule?.expiresAt > now) return false;
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

export async function runNotificationScheduler(supabase: SupabaseClient) {
  const now = new Date();
  const vnHour = (now.getUTCHours() + 7) % 24;
  const vnMinute = now.getUTCMinutes();

  if (vnHour === 21 && vnMinute < 2) {
    const today = now.toISOString().split('T')[0];
    const locked = await acquireSchedulerLock(supabase, `scheduler-eod-${today}`, 120);
    if (!locked) return;
    generateEODReport(supabase, today)
      .then(async () => {
        const report = await getEODReport(supabase, today);
        if (!report) return;
        if (isEmailConfigured()) {
          await sendEodEmail(report.date, report.summary);
        }
        if (isZaloConfigured()) {
          await sendZaloMessage(formatEodZaloMessage(report.date, report.summary));
        }
      })
      .catch(e => {
        console.error('[EOD Agent] Lỗi tạo/gửi báo cáo:', e);
      });
  }

  if (vnMinute < 2 && vnHour % 6 === 0) {
    checkAllAlerts(supabase)
      .then(async alerts => {
        const criticalAlerts = alerts.filter(a => a.severity === 'critical');
        if (criticalAlerts.length === 0) return;

        const ALERT_NOTIFY_KEY = 'alert-last-notified';
        let lastNotified = '';
        try {
          const { data: lastNotifyData } = await supabase
            .from('app_state')
            .select('schedule')
            .eq('user_id', ALERT_NOTIFY_KEY)
            .single();
          lastNotified = lastNotifyData?.schedule?.at || '';
        } catch (error) {
          console.error('[Alert] Lỗi khi lấy thời gian thông báo cuối:', error);
        }
        const sixHoursAgo = new Date(Date.now() - 6 * 60 * 60 * 1000).toISOString();
        if (lastNotified > sixHoursAgo) return;

        const alertText = formatAlertZaloMessage(alerts);
        try {
          await supabase.from('app_state').upsert({
            user_id: ALERT_NOTIFY_KEY,
            schedule: { at: new Date().toISOString(), count: criticalAlerts.length },
            updated_at: new Date().toISOString(),
          });
        } catch (error) {
          console.error('[Alert] Lỗi khi cập nhật thời gian thông báo:', error);
        }

        if (isZaloConfigured()) {
          await sendZaloMessage(alertText).catch(e => console.error('[Alert Zalo]', e.message));
        }
        if (isEmailConfigured()) {
          await sendEodEmail(
            new Date().toISOString().split('T')[0],
            `## 🚨 Cảnh báo tự động CFO Brain\n\n${alerts.map(a => `**${a.title}**\n${a.message}`).join('\n\n')}`
          ).catch(e => console.error('[Alert Email]', e.message));
        }
      })
      .catch(e => console.error('[Alert Check]', e.message));
  }
}
