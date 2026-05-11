import { Router } from 'express';
import { SupabaseClient } from '@supabase/supabase-js';
import { generateEODReport, getEODReport } from '../services/agents/eodAgent';
import { sendEodEmail, isEmailConfigured } from '../services/emailService';
import { sendZaloMessage, isZaloConfigured, formatEodZaloMessage, formatAlertZaloMessage } from '../services/zaloService';
import { checkAllAlerts, loadAlertConfig, saveAlertConfig } from '../services/agents/alertAgent';

export function createNotificationsRouter(supabase: SupabaseClient): Router {
  const router = Router();

  router.get('/api/eod-report', async (req, res) => {
    try {
      const date = (req.query.date as string) || new Date().toISOString().split('T')[0];
      const report = await getEODReport(supabase, date);
      res.json(report ?? null);
    } catch (err: any) {
      console.error('[EOD /eod-report]', err.message);
      res.json(null);
    }
  });

  router.post('/api/eod-report', async (req, res) => {
    try {
      const date = (req.body?.date as string) || new Date().toISOString().split('T')[0];
      await generateEODReport(supabase, date);
      const report = await getEODReport(supabase, date);
      res.json(report ?? { error: 'Báo cáo đã tạo nhưng không lấy được' });
    } catch (err: any) {
      console.error('[EOD POST]', err.message);
      res.status(500).json({ error: err.message || 'Lỗi tạo báo cáo' });
    }
  });

  router.get('/api/notifications/status', (_req, res) => {
    res.json({
      emailConfigured: isEmailConfigured(),
      emailTo: process.env.EMAIL_TO || null,
      zaloConfigured: isZaloConfigured(),
      zaloFollowerId: isZaloConfigured() ? process.env.ZALO_FOLLOWER_ID || null : null,
    });
  });

  router.post('/api/notifications/test-email', async (_req, res) => {
    try {
      if (!isEmailConfigured()) {
        return res.status(400).json({ error: 'Email chưa được cấu hình. Thêm EMAIL_USER, EMAIL_PASS, EMAIL_TO vào .env.local' });
      }
      const today = new Date().toISOString().split('T')[0];
      await sendEodEmail(today, `**Test thành công!** Đây là email thử nghiệm từ CFO Brain 4.0.\n\nNếu bạn nhận được email này, hệ thống thông báo đã hoạt động đúng.\nBáo cáo cuối ngày thực sẽ được gửi tự động lúc 21:00 giờ Việt Nam mỗi ngày.`);
      res.json({ ok: true, message: `Đã gửi email test đến ${process.env.EMAIL_TO}` });
    } catch (err: any) {
      console.error('[Email Test]', err.message);
      res.status(500).json({ error: err.message });
    }
  });

  router.post('/api/notifications/test-zalo', async (_req, res) => {
    try {
      if (!isZaloConfigured()) {
        return res.status(400).json({ error: 'Zalo chưa được cấu hình. Thêm ZALO_OA_ACCESS_TOKEN và ZALO_FOLLOWER_ID vào .env.local' });
      }
      await sendZaloMessage(`✅ Test thành công!\n\nĐây là tin nhắn thử nghiệm từ CFO Brain 4.0.\nBáo cáo cuối ngày và cảnh báo thông minh sẽ được gửi tự động qua kênh này.`);
      res.json({ ok: true, message: `Đã gửi Zalo test đến follower ${process.env.ZALO_FOLLOWER_ID}` });
    } catch (err: any) {
      console.error('[Zalo Test]', err.message);
      res.status(500).json({ error: err.message });
    }
  });

  router.get('/api/alerts', async (_req, res) => {
    try {
      const alerts = await checkAllAlerts(supabase);
      res.json(alerts);
    } catch (err: any) {
      console.error('[Alerts]', err.message);
      res.json([]);
    }
  });

  router.get('/api/alerts/config', async (_req, res) => {
    try {
      const config = await loadAlertConfig(supabase);
      res.json(config);
    } catch (err: any) {
      res.status(500).json({ error: err.message });
    }
  });

  router.put('/api/alerts/config', async (req, res) => {
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
    } catch (err: any) {
      res.status(500).json({ error: err.message });
    }
  });

  return router;
}

export async function runNotificationScheduler(supabase: SupabaseClient) {
  const now = new Date();
  const vnHour = (now.getUTCHours() + 7) % 24;
  const vnMinute = now.getUTCMinutes();

  if (vnHour === 21 && vnMinute < 2) {
    const today = now.toISOString().split('T')[0];
    generateEODReport(supabase, today)
      .then(async () => {
        const report = await getEODReport(supabase, today);
        if (!report) return;
        if (isEmailConfigured()) {
          await sendEodEmail(report.date, report.summary);
          console.log(`[EOD Email] Đã gửi báo cáo ${today} qua email.`);
        }
        if (isZaloConfigured()) {
          await sendZaloMessage(formatEodZaloMessage(report.date, report.summary));
          console.log(`[EOD Zalo] Đã gửi báo cáo ${today} qua Zalo.`);
        }
      })
      .catch(e => {
        console.error('[EOD Agent] Lỗi tạo/gửi báo cáo:', e);
      });
  }

  if (vnMinute < 2 && vnHour % 6 === 0) {
    checkAllAlerts(supabase).then(async (alerts) => {
      const criticalAlerts = alerts.filter(a => a.severity === 'critical');
      if (criticalAlerts.length === 0) return;

      const ALERT_NOTIFY_KEY = 'alert-last-notified';
      let lastNotified = '';
      try {
        const { data: lastNotifyData } = await supabase
          .from('app_state').select('schedule').eq('user_id', ALERT_NOTIFY_KEY).single();
        lastNotified = lastNotifyData?.schedule?.at || '';
      } catch {}
      const sixHoursAgo = new Date(Date.now() - 6 * 60 * 60 * 1000).toISOString();
      if (lastNotified > sixHoursAgo) return;

      const alertText = formatAlertZaloMessage(alerts);
      try {
        await supabase.from('app_state').upsert({
          user_id: ALERT_NOTIFY_KEY,
          schedule: { at: new Date().toISOString(), count: criticalAlerts.length },
          updated_at: new Date().toISOString(),
        });
      } catch {}

      if (isZaloConfigured()) {
        await sendZaloMessage(alertText).catch(e => console.error('[Alert Zalo]', e.message));
        console.log(`[Alert Zalo] Đã gửi ${criticalAlerts.length} cảnh báo nghiêm trọng.`);
      }
      if (isEmailConfigured()) {
        await sendEodEmail(
          new Date().toISOString().split('T')[0],
          `## 🚨 Cảnh báo tự động CFO Brain\n\n${alerts.map(a => `**${a.title}**\n${a.message}`).join('\n\n')}`
        ).catch(e => console.error('[Alert Email]', e.message));
        console.log(`[Alert Email] Đã gửi ${criticalAlerts.length} cảnh báo nghiêm trọng.`);
      }
    }).catch(e => console.error('[Alert Check]', e.message));
  }
}
