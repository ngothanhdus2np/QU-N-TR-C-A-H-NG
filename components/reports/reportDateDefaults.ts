import type { POSOrder } from '../../types';

export const toDateInputValue = (date: Date) => date.toLocaleDateString('en-CA');

export const getWeekRange = (anchorDate = new Date()) => {
  const day = anchorDate.getDay() || 7;
  const start = new Date(anchorDate);
  start.setDate(anchorDate.getDate() - day + 1);
  const end = new Date(start);
  end.setDate(start.getDate() + 6);
  return { start: toDateInputValue(start), end: toDateInputValue(end) };
};

export const getLatestOrderDate = (orders: POSOrder[]) => {
  let latest = '';
  for (const order of orders) {
    if (!order.date) continue;
    const date = toDateInputValue(new Date(order.date));
    if (date > latest) latest = date;
  }
  return latest;
};

export const hasOrdersInDateRange = (orders: POSOrder[], startDate: string, endDate: string) =>
  orders.some(order => {
    if (!order.date) return false;
    const date = toDateInputValue(new Date(order.date));
    return date >= startDate && date <= endDate;
  });

export const getLatestDatedItemDate = (items: Array<{ date?: string }>) => {
  let latest = '';
  for (const item of items) {
    if (!item.date) continue;
    const date = toDateInputValue(new Date(item.date));
    if (date > latest) latest = date;
  }
  return latest;
};

export const hasDatedItemsInDateRange = (
  items: Array<{ date?: string }>,
  startDate: string,
  endDate: string
) =>
  items.some(item => {
    if (!item.date) return false;
    const date = toDateInputValue(new Date(item.date));
    return date >= startDate && date <= endDate;
  });
