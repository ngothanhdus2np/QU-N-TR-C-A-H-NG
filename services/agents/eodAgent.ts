import type { SupabaseClient } from '@supabase/supabase-js';
import { callClaude } from './claudeClient';

export interface EODReport {
  date: string;
  summary: string;
  generatedAt: string;
}

const EOD_STATE_KEY = 'eod-report';

type EODOrderItem = {
  sku?: string;
  name?: string;
  quantity?: number;
  total?: number;
};

type EODOrder = {
  is_return?: boolean;
  final_amount?: number;
  payment_method?: string;
  items?: EODOrderItem[];
};

export async function generateEODReport(supabase: SupabaseClient, date: string): Promise<void> {
  // Lấy posOrders của ngày hôm nay
  const { data: orders, error } = await supabase
    .from('pos_orders')
    .select('order_code, date, customer_name, items, final_amount, payment_method, is_return')
    .gte('date', `${date}T00:00:00`)
    .lte('date', `${date}T23:59:59`)
    // Soft-delete: loại đơn đã hủy (status NULL ở dòng cũ vẫn phải giữ)
    .or('status.is.null,status.neq.cancelled')
    .order('date', { ascending: true });

  if (error) throw new Error(`Lỗi truy vấn POS orders: ${error.message}`);

  const typedOrders = (orders || []) as EODOrder[];
  const sales = typedOrders.filter(o => !o.is_return);
  const returns = typedOrders.filter(o => o.is_return);
  const totalRevenue = sales.reduce((s, o) => s + (o.final_amount || 0), 0);
  const totalReturns = returns.reduce((s, o) => s + (o.final_amount || 0), 0);

  // Tổng hợp top sản phẩm
  const productMap = new Map<string, { name: string; qty: number; revenue: number }>();
  for (const order of sales) {
    for (const item of (order.items || [])) {
      const cur = productMap.get(item.sku || item.name) || { name: item.name, qty: 0, revenue: 0 };
      cur.qty += item.quantity || 1;
      cur.revenue += item.total || 0;
      productMap.set(item.sku || item.name, cur);
    }
  }
  const topProducts = Array.from(productMap.values())
    .sort((a, b) => b.qty - a.qty)
    .slice(0, 5);

  const contextData = `BÁO CÁO CUỐI NGÀY ${date}:
- Tổng hóa đơn bán: ${sales.length}
- Tổng doanh thu: ${totalRevenue.toLocaleString('vi-VN')}đ
- Tổng hóa đơn trả: ${returns.length} (${totalReturns.toLocaleString('vi-VN')}đ)
- Doanh thu thuần: ${(totalRevenue - totalReturns).toLocaleString('vi-VN')}đ
- Tiền mặt: ${sales.filter(o => o.payment_method === 'Cash').length} hóa đơn
- Chuyển khoản: ${sales.filter(o => o.payment_method === 'Bank').length} hóa đơn
- Top sản phẩm: ${topProducts.map(p => `${p.name} (${p.qty} cái, ${p.revenue.toLocaleString('vi-VN')}đ)`).join('; ')}

Tóm tắt ngắn gọn kết quả ngày hôm nay cho chủ cửa hàng, nhận xét sắc bén, đề xuất 1 việc cần làm ngày mai. Giọng văn thân thiện, chuyên nghiệp, dùng Markdown.`;

  const summary = await callClaude({
    model: 'claude-haiku-4-5',
    system: 'Bạn là trợ lý tài chính thân thiện của cửa hàng. Tóm tắt kết quả kinh doanh cuối ngày ngắn gọn, trực quan, bằng Tiếng Việt.',
    userMessage: contextData,
    temperature: 0.3,
    maxTokens: 512,
  });

  const report: EODReport = {
    date,
    summary,
    generatedAt: new Date().toISOString(),
  };

  await supabase.from('app_state').upsert({
    user_id: `${EOD_STATE_KEY}-${date}`,
    schedule: report,
    updated_at: new Date().toISOString(),
  });

}

export async function getEODReport(supabase: SupabaseClient, date: string): Promise<EODReport | null> {
  const { data, error } = await supabase
    .from('app_state')
    .select('schedule')
    .eq('user_id', `${EOD_STATE_KEY}-${date}`)
    .single();

  if (error || !data?.schedule) return null;
  return data.schedule as EODReport;
}
