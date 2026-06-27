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

function computeUpgradedTier(
  newTotalSpentVnd: number,
  currentTier: string
): 'Standard' | 'Silver' | 'Gold' | 'Diamond' {
  const spent = newTotalSpentVnd / 1_000_000;
  const computed: 'Standard' | 'Silver' | 'Gold' | 'Diamond' =
    spent >= 100 ? 'Diamond' : spent >= 20 ? 'Gold' : spent >= 5 ? 'Silver' : 'Standard';
  const rank: Record<string, number> = { Standard: 0, Silver: 1, Gold: 2, Diamond: 3 };
  return (rank[computed] ?? 0) > (rank[currentTier] ?? 0) ? computed : (currentTier as 'Standard' | 'Silver' | 'Gold' | 'Diamond');
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

    try {
      // Bước 1: Lấy stock hiện tại từ DB
      const productIds = [...new Set(cart.map(i => i.productId))];
      const { data: currentProducts, error: prodErr } = await supabase
        .from('pos_products')
        .select('id, sku, stock, import_price, name')
        .in('id', productIds);
      if (prodErr) throw prodErr;

      type DBProduct = { id: string; sku: string; stock: number; import_price: number; name: string };
      const productMap = new Map(((currentProducts || []) as DBProduct[]).map(p => [p.id, p]));

      // Bước 2: Validate tồn kho
      for (const item of cart) {
        const product = productMap.get(item.productId);
        if (!product) throw new Error(`Không tìm thấy sản phẩm: ${item.name}`);
        if (product.stock < item.quantity) {
          throw new Error(`Không đủ tồn kho: ${item.name} (còn ${product.stock}, cần ${item.quantity})`);
        }
      }

      // Bước 3: Insert đơn hàng
      const orderRow = {
        id: orderId,
        order_code: orderCode,
        date: now,
        customer_id: customerId || null,
        customer_name: customerName || null,
        items: cart.map(item => ({
          productId: item.productId,
          sku: item.sku,
          name: item.name,
          quantity: item.quantity,
          price: item.price,
          discount: item.discount || 0,
          total: item.total,
          importPrice: item.importPrice ?? (productMap.get(item.productId)?.import_price ?? 0),
          lineType: 'sale',
        })),
        total_amount: Number(totalAmount) || 0,
        discount: Number(discount) || 0,
        final_amount: Number(finalAmount) || 0,
        payment_method: paymentMethod || 'Cash',
        staff_id: 'mobile-cashier',
        staff_name: 'Mobile POS',
        created_by: 'mobile-cashier',
        channel: 'direct',
        channel_name: 'Mobile POS',
        status: 'completed',
        points_earned: 0,
        is_return: false,
        notes: notes || null,
        cash_received: cashReceived || null,
        split_payments: splitPayments || null,
      };

      const { error: orderErr } = await supabase.from('pos_orders').insert(orderRow);
      if (orderErr) throw orderErr;

      // Bước 4: Ghi inventory transaction + trừ tồn kho (atomic RPC)
      const inventoryItems = cart.map(item => {
        const product = productMap.get(item.productId);
        const prevStock = product?.stock ?? 0;
        return {
          productId: item.productId,
          sku: item.sku,
          name: item.name,
          quantity: -item.quantity,
          previousStock: prevStock,
          newStock: prevStock - item.quantity,
        };
      });

      const inventoryTx = {
        id: generateId(),
        date: now,
        type: 'Sale',
        staffId: 'mobile-cashier',
        allowNegativeStock: false,
        items: inventoryItems,
        note: `Bán hàng ${orderCode} (Mobile)`,
        referenceId: orderId,
      };

      const { error: rpcErr } = await supabase.rpc('apply_inventory_transaction_with_stock_v2', {
        p_transaction: inventoryTx,
      });

      if (rpcErr) {
        // Fallback thủ công nếu RPC không khả dụng
        await supabase.from('inventory_transactions').insert(inventoryTx);
        for (const item of cart) {
          await supabase.rpc('decrement_product_stock', {
            p_product_id: item.productId,
            p_quantity: item.quantity,
          });
        }
      }

      // Bước 5: Cập nhật revenue_records
      const orderCogs = cart.reduce((sum, item) => {
        const ip = item.importPrice ?? (productMap.get(item.productId)?.import_price ?? 0);
        return sum + ip * item.quantity;
      }, 0);
      const orderNetRevenue = Math.max(0, Number(totalAmount) - Number(discount));
      const orderOtherFees = Math.max(0, Number(finalAmount) - orderNetRevenue);

      const { data: revArr } = await supabase
        .from('revenue_records')
        .select('*')
        .eq('date', dateKey)
        .limit(1);
      type DBRevenue = Record<string, number | string>;
      const existingRev = ((revArr || []) as DBRevenue[])[0];

      if (existingRev) {
        const updatedNet = Number(existingRev.net_revenue || 0) + orderNetRevenue;
        const updatedOther = Number(existingRev.revenue_other || 0) + orderOtherFees;
        const updatedCogs = Number(existingRev.total_cogs || 0) + orderCogs;
        await supabase.from('revenue_records').update({
          total_gross_revenue: Number(existingRev.total_gross_revenue || 0) + Number(totalAmount),
          discount: Number(existingRev.discount || 0) + Number(discount),
          revenue_other: updatedOther,
          net_revenue: updatedNet,
          total_cogs: updatedCogs,
          gross_profit: updatedNet + updatedOther - updatedCogs,
        }).eq('id', existingRev.id);
      } else {
        await supabase.from('revenue_records').insert({
          id: generateId(),
          date: dateKey,
          total_gross_revenue: Number(totalAmount),
          discount: Number(discount),
          revenue_other: orderOtherFees,
          returns_value: 0,
          net_revenue: orderNetRevenue,
          total_cogs: orderCogs,
          gross_profit: orderNetRevenue + orderOtherFees - orderCogs,
        });
      }

      // Bước 6: Cập nhật khách hàng + ghi nợ
      if (customerId) {
        const { data: custArr } = await supabase
          .from('pos_customers')
          .select('id, total_spent, tier, debt_amount')
          .eq('id', customerId)
          .limit(1);
        type DBCustomer = { id: string; total_spent: number; tier: string; debt_amount: number };
        const cust = ((custArr || []) as DBCustomer[])[0];
        if (cust) {
          const debtAdded = isDebtMode ? Number(finalAmount) : 0;
          const newTotalSpent = Number(cust.total_spent || 0) + Number(finalAmount);
          await supabase.from('pos_customers').update({
            total_spent: newTotalSpent,
            tier: computeUpgradedTier(newTotalSpent, cust.tier || 'Standard'),
            last_visit: now,
            debt_amount: Number(cust.debt_amount || 0) + debtAdded,
          }).eq('id', customerId);

          if (debtAdded > 0) {
            await supabase.from('customer_debt_history').insert({
              id: generateId(),
              customer_id: customerId,
              date: now,
              order_id: orderId,
              type: 'debt',
              amount: debtAdded,
              note: `Đơn hàng ${orderCode} (Mobile)`,
            });
          }
        }
      }

      // Bước 7: Audit log (best effort)
      supabase.from('audit_logs').insert({
        id: generateId(),
        table_name: 'pos_orders',
        record_id: orderId,
        action: 'upsert',
        snapshot: { orderCode, finalAmount: Number(finalAmount), paymentMethod, customerId },
      }).then(() => {}, () => {});

      res.json({ ok: true, orderId, orderCode });
    } catch (err: unknown) {
      console.error('[POSMobile] checkout error:', err);
      res.status(500).json({ error: err instanceof Error ? err.message : 'Không thể xử lý thanh toán' });
    }
  });

  return router;
}
