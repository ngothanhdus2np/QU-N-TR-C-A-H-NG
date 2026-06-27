import { Router } from 'express';
import type { Request, Response, RequestHandler } from 'express';
import type { SupabaseClient } from '@supabase/supabase-js';
import { timingSafeEqual } from 'node:crypto';

function generateId(): string {
  return crypto.randomUUID();
}

function toLocalDateKey(dateString: string): string {
  const date = new Date(dateString);
  if (!Number.isNaN(date.getTime())) return date.toLocaleDateString('sv-SE');
  return new Date().toLocaleDateString('sv-SE');
}

interface CartItem {
  productId: string;
  sku: string;
  name: string;
  quantity: number;
  price: number;
  discount: number;
  total: number;
  importPrice?: number;
}

interface CheckoutBody {
  cart: CartItem[];
  customerId?: string;
  customerName?: string;
  paymentMethod: 'Cash' | 'Bank' | 'Card' | 'Momo' | 'Other';
  splitPayments?: { cash?: number; bank?: number; card?: number; momo?: number };
  cashReceived?: number;
  isDebtMode?: boolean;
  notes?: string;
  totalAmount: number;
  discount: number;
  finalAmount: number;
}

export function createPosMobileRouter(supabase: SupabaseClient, requireAuth: RequestHandler) {
  const router = Router();

  // Bảo vệ bằng token bí mật (POS_MOBILE_TOKEN): desktop POS đã đăng nhập lấy token
  // qua /api/pos-mobile/token rồi nhúng vào QR. Điện thoại gửi token qua header
  // 'x-pos-mobile-token' hoặc query '?t='. Backend dùng service role nên token này
  // là lớp xác thực duy nhất cho các endpoint mobile.
  const POS_MOBILE_TOKEN = process.env.POS_MOBILE_TOKEN || '';

  const safeEqual = (a: string, b: string): boolean => {
    const ab = Buffer.from(a);
    const bb = Buffer.from(b);
    return ab.length === bb.length && timingSafeEqual(ab, bb);
  };

  const requireMobileToken: RequestHandler = (req, res, next) => {
    if (!POS_MOBILE_TOKEN) {
      return res.status(503).json({ error: 'POS mobile chưa được cấu hình (thiếu POS_MOBILE_TOKEN)' });
    }
    const provided =
      (req.headers['x-pos-mobile-token'] as string) ||
      (typeof req.query.t === 'string' ? req.query.t : '') ||
      '';
    if (provided && safeEqual(provided, POS_MOBILE_TOKEN)) return next();
    return res.status(401).json({ error: 'Unauthorized - thiếu hoặc sai token POS mobile' });
  };

  // Desktop POS (đã đăng nhập) lấy token để dựng mã QR
  router.get('/api/pos-mobile/token', requireAuth, (_req: Request, res: Response) => {
    if (!POS_MOBILE_TOKEN) {
      return res.status(503).json({ error: 'Chưa cấu hình POS_MOBILE_TOKEN trên server' });
    }
    return res.json({ token: POS_MOBILE_TOKEN });
  });

  router.get('/api/pos-mobile/products', requireMobileToken, async (req: Request, res: Response) => {
    const q = String(req.query.q || '').trim();
    try {
      let query = supabase
        .from('pos_products')
        // Không trả import_price (giá vốn) ra client — checkout tự lấy giá vốn từ DB
        .select('id, name, sku, barcode, sale_price, stock, image_url, unit')
        .order('name')
        .limit(50);
      if (q) {
        query = query.or(`name.ilike.%${q}%,sku.ilike.%${q}%`);
      }
      const { data, error } = await query;
      if (error) throw error;
      // Map sale_price → price để frontend dùng thống nhất
      type Row = { sale_price: number; [k: string]: unknown };
      const products = (data || []).map((p: Row) => ({ ...p, price: p.sale_price }));
      res.json({ products });
    } catch (err: unknown) {
      res.status(500).json({ error: err instanceof Error ? err.message : 'Lỗi tải sản phẩm' });
    }
  });

  router.get('/api/pos-mobile/customers', requireMobileToken, async (req: Request, res: Response) => {
    const q = String(req.query.q || '').trim();
    try {
      let query = supabase
        .from('pos_customers')
        .select('id, name, phone, points, total_spent, tier, debt_amount')
        .order('name')
        .limit(20);
      if (q) {
        query = query.or(`name.ilike.%${q}%,phone.ilike.%${q}%`);
      }
      const { data, error } = await query;
      if (error) throw error;
      res.json({ customers: data || [] });
    } catch (err: unknown) {
      res.status(500).json({ error: err instanceof Error ? err.message : 'Lỗi tìm khách hàng' });
    }
  });

  router.post('/api/pos-mobile/checkout', requireMobileToken, async (req: Request, res: Response) => {
    const {
      cart, customerId, customerName, paymentMethod, splitPayments,
      cashReceived, isDebtMode, notes, totalAmount, discount, finalAmount,
    } = req.body as CheckoutBody;

    if (!cart || !Array.isArray(cart) || cart.length === 0) {
      return res.status(400).json({ error: 'Giỏ hàng trống' });
    }

    const now = new Date().toISOString();
    const orderId = generateId();
    const orderCode = `HD-${Date.now().toString(36).slice(-5).toUpperCase()}`;
    const dateKey = toLocalDateKey(now);

    // Toàn bộ checkout chạy trong 1 transaction DB (RPC pos_mobile_checkout):
    // insert đơn + trừ tồn atomic + cộng dồn doanh thu atomic + cập nhật KH/nợ + audit.
    // Lỗi bất kỳ bước nào → rollback toàn bộ, không để dữ liệu lệch.
    const payload = {
      orderId,
      orderCode,
      date: now,
      dateKey,
      cart,
      customerId: customerId || null,
      customerName: customerName || null,
      paymentMethod: paymentMethod || 'Cash',
      splitPayments: splitPayments || null,
      cashReceived: cashReceived ?? null,
      isDebtMode: !!isDebtMode,
      notes: notes || null,
      totalAmount: Number(totalAmount) || 0,
      discount: Number(discount) || 0,
      finalAmount: Number(finalAmount) || 0,
    };

    try {
      const { error } = await supabase.rpc('pos_mobile_checkout', { p_payload: payload });
      if (error) {
        const msg = error.message || '';
        // Lỗi nghiệp vụ → 400 với thông báo thân thiện (đã rollback toàn bộ)
        if (/Insufficient stock/i.test(msg)) {
          return res.status(400).json({ error: 'Không đủ tồn kho cho một sản phẩm trong giỏ. Vui lòng kiểm tra lại số lượng.' });
        }
        const notFound = msg.match(/PRODUCT_NOT_FOUND:(.*)/i);
        if (notFound) {
          return res.status(400).json({ error: `Không tìm thấy sản phẩm: ${notFound[1].trim()}` });
        }
        if (/EMPTY_CART/i.test(msg)) {
          return res.status(400).json({ error: 'Giỏ hàng trống' });
        }
        throw error;
      }
      return res.json({ ok: true, orderId, orderCode });
    } catch (err: unknown) {
      console.error('[POSMobile] checkout error:', err);
      return res.status(500).json({ error: err instanceof Error ? err.message : 'Không thể xử lý thanh toán' });
    }
  });

  return router;
}
