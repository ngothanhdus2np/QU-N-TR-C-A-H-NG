import { useEffect, useCallback } from 'react';
import { supabase } from '../services/supabase';
import { AppDataSurgicalUpdate, POSOrder, POSProduct, RevenueRecord } from '../types';
import { buildVariantProductName } from '../src/lib/businessLogic.inventory';

// IDs vừa được local device ghi — dùng để bỏ qua echo từ Realtime
const _recentLocalWrites = new Set<string>();
export function markLocalWrite(id: string) {
  _recentLocalWrites.add(id);
  setTimeout(() => _recentLocalWrites.delete(id), 3000);
}

const n = (v: any) => Number(v) || 0;

function mapOrderRow(o: any): POSOrder {
  const code = o.order_code || o.orderCode || '';
  const finalAmt = Number(o.final_amount || o.finalAmount || 0);
  const isReturn = o.is_return ?? o.isReturn ?? (code.startsWith('RT') || finalAmt < 0);
  return {
    id: o.id,
    orderCode: code,
    date: o.date,
    customerId: o.customer_id || o.customerId,
    customerName: o.customer_name || o.customerName,
    items: o.items || [],
    totalAmount: Number(o.total_amount || o.totalAmount || 0),
    discount: n(o.discount),
    finalAmount: finalAmt,
    paymentMethod: o.payment_method || o.paymentMethod || 'Cash',
    staffId: o.staff_id || o.staffId || '',
    createdBy: o.created_by || o.createdBy || o.staff_id || o.staffId,
    channel: o.channel || 'direct',
    channelName: o.channel_name || o.channelName || 'Bán trực tiếp',
    priceBookId: o.price_book_id || o.priceBookId,
    priceBookName: o.price_book_name || o.priceBookName,
    status: o.status || 'completed',
    notes: o.notes,
    pointsEarned: n(o.points_earned || o.pointsEarned),
    isReturn,
    refundAmount: n(o.refund_amount || o.refundAmount),
    cashReceived: (o.cash_received != null || o.cashReceived != null)
      ? n(o.cash_received ?? o.cashReceived)
      : undefined,
    splitPayments: o.split_payments || o.splitPayments,
    staffName: o.staff_name || o.staffName,
  };
}

function mapProductRow(p: any): POSProduct {
  const variantAttributes = p.variant_attributes || p.variantAttributes || {};
  const isParent = p.is_parent ?? p.isParent ?? false;
  const name = !isParent && (p.parent_id || p.parentId)
    ? buildVariantProductName(p.name || '', variantAttributes)
    : (p.name || '');
  return {
    id: p.id,
    sku: isParent ? '' : (p.sku || ''),
    name,
    categoryId: p.category_id || p.categoryId,
    categoryPath: p.category_path || p.categoryPath,
    importPrice: n(p.import_price || p.importPrice),
    salePrice: n(p.sale_price || p.salePrice),
    stock: n(p.stock),
    expectedOutOfStock: p.expected_out_of_stock || p.expectedOutOfStock,
    minStock: n(p.min_stock || p.minStock),
    maxStock: n(p.max_stock || p.maxStock) || 999999,
    unit: p.unit,
    baseUnitCode: p.base_unit_code || p.baseUnitCode,
    conversionValue: n(p.conversion_value || p.conversionValue) || 1,
    brand: p.brand,
    barcode: p.barcode,
    attributesText: p.attributes_text || p.attributesText,
    description: p.description,
    noteTemplate: p.note_template || p.noteTemplate,
    components: p.components,
    warranty: p.warranty,
    periodicMaintenance: p.periodic_maintenance || p.periodicMaintenance,
    allowPoints: p.allow_points ?? p.allowPoints ?? true,
    weight: n(p.weight),
    weightUnit: p.weight_unit || p.weightUnit,
    location: p.location,
    relatedSku: p.related_sku || p.relatedSku || null,
    discountPercent: n(p.discount_percent || p.discountPercent),
    customerOrders: n(p.customer_orders || p.customerOrders),
    directSale: p.direct_sale !== false,
    productType: p.product_type || p.productType || 'Hàng hóa',
    images: p.images || [],
    status: p.status,
    units: p.units || [],
    attributes: p.attributes || [],
    variantAttributes,
    parentId: p.parent_id || p.parentId || null,
    isParent,
    variantCount: n(p.variant_count || p.variantCount),
  };
}

function mapRevenueRow(r: any): RevenueRecord {
  return {
    id: r.id,
    date: r.date,
    totalGrossRevenue: n(r.total_gross_revenue || r.totalGrossRevenue),
    discount: n(r.discount),
    revenueOther: n(r.revenue_other || r.revenueOther),
    returnsValue: n(r.returns_value || r.returnsValue),
    netRevenue: n(r.net_revenue || r.netRevenue),
    totalCogs: n(r.total_cogs || r.totalCogs),
    grossProfit: n(r.gross_profit || r.grossProfit),
  };
}

export function useRealtimeSync(
  mergeRemoteUpdate: (updates: AppDataSurgicalUpdate[]) => void
) {
  const stableMerge = useCallback(mergeRemoteUpdate, []);

  useEffect(() => {
    // Bỏ qua nếu Supabase URL là ws:// nhưng trang đang trên HTTPS (mixed content)
    const supabaseUrl = import.meta.env.VITE_SUPABASE_URL as string ?? '';
    if (supabaseUrl.startsWith('http:') && window.location.protocol === 'https:') {
      console.warn('[Realtime] Bỏ qua kết nối — mixed content (ws:// trên HTTPS)');
      return;
    }

    const channel = supabase
      .channel('cfo-realtime-sync')
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'pos_orders' },
        (payload) => {
          const isDelete = payload.eventType === 'DELETE';
          const row = isDelete ? payload.old : payload.new;
          const id = (row as any)?.id;
          if (!id || _recentLocalWrites.has(id)) return;
          const update: AppDataSurgicalUpdate = isDelete
            ? { key: 'posOrders', item: { id }, isDelete: true }
            : { key: 'posOrders', item: mapOrderRow(row) };
          stableMerge([update]);
        }
      )
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'pos_products' },
        (payload) => {
          const isDelete = payload.eventType === 'DELETE';
          const row = isDelete ? payload.old : payload.new;
          const id = (row as any)?.id;
          if (!id || _recentLocalWrites.has(id)) return;
          const update: AppDataSurgicalUpdate = isDelete
            ? { key: 'posProducts', item: { id }, isDelete: true }
            : { key: 'posProducts', item: mapProductRow(row) };
          stableMerge([update]);
        }
      )
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'revenue_records' },
        (payload) => {
          const isDelete = payload.eventType === 'DELETE';
          const row = isDelete ? payload.old : payload.new;
          const id = (row as any)?.id;
          if (!id || _recentLocalWrites.has(id)) return;
          const update: AppDataSurgicalUpdate = isDelete
            ? { key: 'revenue', item: { id }, isDelete: true }
            : { key: 'revenue', item: mapRevenueRow(row) };
          stableMerge([update]);
        }
      )
      .subscribe((status) => {
        if (status === 'SUBSCRIBED') {
          console.log('[Realtime] Connected — syncing pos_orders, pos_products, revenue_records');
        }
      });

    return () => {
      supabase.removeChannel(channel);
    };
  }, [stableMerge]);
}
