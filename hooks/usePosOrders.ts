import { useState, useEffect, useRef } from 'react';
import type { POSOrder } from '../types';
import { apiService, POS_ORDER_BOOTSTRAP_DAYS } from '../services/apiService';

const localDateKey = (date: Date) => date.toLocaleDateString('sv-SE');

const addDays = (date: Date, days: number) => {
  const next = new Date(date);
  next.setDate(next.getDate() + days);
  return next;
};

/**
 * Hook tự động fetch orders từ Supabase khi date range nằm ngoài bootstrap window.
 * - Trong bootstrap: dùng bootstrapOrders trực tiếp (không fetch thêm, nhanh)
 * - Ngoài bootstrap: fetch Supabase theo đúng range đang chọn
 */
export function usePosOrders(
  bootstrapOrders: POSOrder[],
  startDate: string,
  endDate: string
): { orders: POSOrder[]; isLoading: boolean } {
  const [remoteOrders, setRemoteOrders] = useState<POSOrder[] | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const fetchKeyRef = useRef(0);

  useEffect(() => {
    if (!startDate || !endDate) {
      setRemoteOrders(null);
      setIsLoading(false);
      return;
    }

    const todayKey = localDateKey(new Date());
    const guaranteedBootstrapStart = localDateKey(addDays(new Date(), -POS_ORDER_BOOTSTRAP_DAYS));
    const rangeIsInGuaranteedBootstrapWindow =
      startDate >= guaranteedBootstrapStart && endDate <= todayKey;

    // Tìm ngày sớm nhất trong bootstrap để biết coverage thực tế của cache hiện tại.
    // Cache local có thể tích lũy đơn cũ qua nhiều lần dùng app, nhưng chỉ 90 ngày gần nhất
    // được fetch đầy đủ trong bootstrap cloud hiện tại.
    let bootstrapCutoff = '';
    for (const o of bootstrapOrders) {
      if (!o.date) continue;
      const d = o.date.slice(0, 10);
      if (!bootstrapCutoff || d < bootstrapCutoff) bootstrapCutoff = d;
    }

    const rangeOrders = bootstrapOrders.filter(order => {
      if (!order.date) return false;
      const date = order.date.slice(0, 10);
      return date >= startDate && date <= endDate;
    });
    // items = [] là bình thường với đơn kênh bán (Shopee...) — chỉ cần fetch lại nếu field items
    // hoàn toàn thiếu (không phải array), tức cache cũ từ trước khi items được theo dõi.
    const hasOrdersMissingItems = rangeOrders.some(order => !Array.isArray(order.items));

    // Nếu range nằm trong cửa sổ bootstrap được đảm bảo → dùng data sẵn có
    if (
      rangeIsInGuaranteedBootstrapWindow &&
      (!bootstrapCutoff ||
        (startDate >= bootstrapCutoff && !hasOrdersMissingItems))
    ) {
      setRemoteOrders(null);
      setIsLoading(false);
      return;
    }

    // startDate nằm ngoài bootstrap hoặc cache cũ thiếu items → fetch từ Supabase
    const fetchKey = ++fetchKeyRef.current;
    setIsLoading(true);
    setRemoteOrders(null);

    apiService.fetchPosOrdersByDateRange(startDate, endDate).then(({ data, error }) => {
      if (fetchKeyRef.current !== fetchKey) return; // request cũ, bỏ qua
      if (!error) setRemoteOrders(data);
      setIsLoading(false);
    });
  }, [startDate, endDate, bootstrapOrders]);

  // Merge: remoteOrders là nguồn chính, nhưng giữ lại các đơn local-only
  // (vừa tạo, chưa sync lên DB) từ bootstrapOrders để không mất đơn trong UI
  const remoteIds = remoteOrders ? new Set(remoteOrders.map(o => o.id)) : null;
  const orders = remoteOrders
    ? [
        ...remoteOrders,
        // Giữ đơn local-only (vừa tạo, chưa sync) nhưng lọc theo date range
        // để tránh đơn ngoài range lọt vào báo cáo tháng khác
        ...bootstrapOrders.filter(o => {
          if (remoteIds!.has(o.id)) return false;
          const d = o.date?.slice(0, 10);
          return d && d >= startDate && d <= endDate;
        }),
      ]
    : bootstrapOrders;

  return { orders, isLoading };
}
