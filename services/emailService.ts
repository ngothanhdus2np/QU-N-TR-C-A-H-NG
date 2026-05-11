import nodemailer from 'nodemailer';

export interface EmailConfig {
  user: string;
  pass: string;
  to: string;
}

function getEmailConfig(): EmailConfig | null {
  const user = process.env.EMAIL_USER;
  const pass = process.env.EMAIL_PASS;
  const to = process.env.EMAIL_TO;
  if (!user || !pass || !to) return null;
  return { user, pass, to };
}

export async function sendEodEmail(date: string, summary: string): Promise<void> {
  const config = getEmailConfig();
  if (!config) return; // Email chưa cấu hình — bỏ qua, không throw

  const transporter = nodemailer.createTransport({
    service: 'gmail',
    auth: { user: config.user, pass: config.pass },
  });

  // Convert markdown bullet points to simple text for email subject preview
  const firstLine = summary.split('\n').find(l => l.trim()) ?? `Báo cáo cuối ngày ${date}`;
  const subject = `[CFO Brain] Báo cáo cuối ngày ${date}`;

  // Inline CSS email body — works in Gmail, Outlook, Apple Mail
  const html = `
<!DOCTYPE html>
<html>
<head><meta charset="utf-8"/></head>
<body style="font-family:Arial,sans-serif;max-width:600px;margin:0 auto;background:#f8fafc;padding:24px;">
  <div style="background:#fff;border-radius:16px;padding:32px;border:1px solid #e2e8f0;">
    <div style="display:flex;align-items:center;margin-bottom:24px;">
      <div style="width:40px;height:40px;background:#4f46e5;border-radius:10px;display:inline-flex;align-items:center;justify-content:center;margin-right:12px;">
        <span style="color:#fff;font-size:18px;font-weight:900;">C</span>
      </div>
      <div>
        <div style="font-size:14px;font-weight:900;color:#1e293b;letter-spacing:-0.5px;">CFO BRAIN</div>
        <div style="font-size:10px;color:#6366f1;font-weight:700;text-transform:uppercase;letter-spacing:1px;">Báo cáo cuối ngày</div>
      </div>
    </div>

    <div style="background:#f1f5f9;border-radius:10px;padding:12px 16px;margin-bottom:20px;">
      <span style="font-size:11px;font-weight:700;color:#64748b;text-transform:uppercase;letter-spacing:1px;">📅 Ngày: ${date}</span>
    </div>

    <div style="font-size:14px;line-height:1.8;color:#334155;white-space:pre-line;">${summary.replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>').replace(/^#+\s*/gm, '').replace(/^[-•]\s*/gm, '• ')}</div>

    <div style="margin-top:28px;padding-top:20px;border-top:1px solid #e2e8f0;font-size:10px;color:#94a3b8;text-align:center;">
      Được tạo tự động bởi CFO Brain 4.0 lúc ${new Date().toLocaleTimeString('vi-VN', { timeZone: 'Asia/Ho_Chi_Minh', hour: '2-digit', minute: '2-digit' })} giờ Việt Nam
    </div>
  </div>
</body>
</html>`;

  await transporter.sendMail({
    from: `"CFO Brain" <${config.user}>`,
    to: config.to,
    subject,
    html,
    text: `Báo cáo cuối ngày ${date}\n\n${summary}`,
  });
}

export function isEmailConfigured(): boolean {
  return !!(process.env.EMAIL_USER && process.env.EMAIL_PASS && process.env.EMAIL_TO);
}
