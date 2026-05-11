import axios from 'axios';

const ZALO_API_URL = 'https://openapi.zalo.me/v2.0/oa/message';

function getZaloConfig(): { token: string; userId: string } | null {
  const token = process.env.ZALO_OA_ACCESS_TOKEN;
  const userId = process.env.ZALO_FOLLOWER_ID;
  if (!token || !userId) return null;
  return { token, userId };
}

export function isZaloConfigured(): boolean {
  return !!(process.env.ZALO_OA_ACCESS_TOKEN && process.env.ZALO_FOLLOWER_ID);
}

export async function sendZaloMessage(text: string): Promise<void> {
  const config = getZaloConfig();
  if (!config) return; // Chưa cấu hình — bỏ qua, không throw

  await axios.post(
    ZALO_API_URL,
    {
      recipient: { user_id: config.userId },
      message: { text },
    },
    {
      headers: {
        'access_token': config.token,
        'Content-Type': 'application/json',
      },
    }
  );
}

export function formatEodZaloMessage(date: string, summary: string): string {
  // Strip markdown for plain text Zalo
  const clean = summary
    .replace(/\*\*(.*?)\*\*/g, '$1')
    .replace(/^#{1,3}\s*/gm, '')
    .replace(/^[-•]\s*/gm, '• ')
    .replace(/\n{3,}/g, '\n\n')
    .trim();
  return `📊 BÁO CÁO CUỐI NGÀY ${date}\n\n${clean}\n\n— CFO Brain 4.0`;
}

export function formatAlertZaloMessage(alerts: Array<{ title: string; message: string; severity: string }>): string {
  const critical = alerts.filter(a => a.severity === 'critical');
  const warning = alerts.filter(a => a.severity === 'warning');
  const lines: string[] = ['🚨 CẢNH BÁO TỰ ĐỘNG — CFO Brain 4.0\n'];
  if (critical.length > 0) {
    lines.push('⛔ NGHIÊM TRỌNG:');
    critical.forEach(a => lines.push(`• ${a.title}: ${a.message}`));
  }
  if (warning.length > 0) {
    lines.push('\n⚠️ CẦN CHÚ Ý:');
    warning.forEach(a => lines.push(`• ${a.title}: ${a.message}`));
  }
  return lines.join('\n');
}
