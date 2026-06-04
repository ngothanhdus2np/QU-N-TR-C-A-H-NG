import React, { useMemo, useState } from 'react';
import type { AppData } from '../../types';
import { AiInsightPanel } from '../shared';
import { hashData, getCachedAiResult, setCachedAiResult } from '../../services/aiCache';

interface Props {
  data: AppData;
}

const fmt = (n: number) => n.toLocaleString('vi-VN', { maximumFractionDigits: 0 });
const fmtBig = (n: number) => {
  if (n >= 1_000_000_000) return (n / 1_000_000_000).toFixed(2) + ' tỷ';
  if (n >= 1_000_000) return (n / 1_000_000).toFixed(0) + ' triệu';
  return fmt(n);
};

const AnalysisGoodsStockPage: React.FC<Props> = ({ data }) => {
  const today = new Date().toLocaleDateString('sv-SE');
  const [aiResult, setAiResult] = useState<string | null>(null);
  const [aiLoading, setAiLoading] = useState(false);
  const [fromCache, setFromCache] = useState(false);

  const stats = useMemo(() => {
    const products = (data.posProducts || []).filter(p => p.status === 'Active');

    const inStock = products.filter(p => p.stock > 0);
    const totalUnits = products.reduce((s, p) => s + p.stock, 0);
    const totalValue = products.reduce((s, p) => s + p.stock * p.importPrice, 0);

    // Tốc độ bán 30 ngày qua — cần cho tính ngày hết hàng
    const thirtyDaysAgo = new Date(Date.now() - 30 * 86400_000).toLocaleDateString('sv-SE');
    const soldQtyMap = new Map<string, number>();
    (data.posOrders || [])
      .filter(o => !o.isReturn && o.status !== 'cancelled' && o.date >= thirtyDaysAgo)
      .forEach(o => {
        (o.items || []).forEach((i: any) => {
          const pid = i.productId || i.id;
          if (pid) soldQtyMap.set(pid, (soldQtyMap.get(pid) || 0) + (i.qty ?? i.quantity ?? 1));
        });
      });

    // Hết hàng hôm nay
    const outToday = products.filter(p => p.stock === 0).length;

    // Hết hàng trong 7/30 ngày dựa trên tốc độ bán thực tế
    const out7 = products.filter(p => {
      if (p.stock <= 0) return false;
      const sold = soldQtyMap.get(p.id) || 0;
      if (sold === 0) return false;
      return (p.stock / (sold / 30)) <= 7;
    }).length;

    const out30 = products.filter(p => {
      if (p.stock <= 0) return false;
      const sold = soldQtyMap.get(p.id) || 0;
      if (sold === 0) return false;
      return (p.stock / (sold / 30)) <= 30;
    }).length;

    // Không bán được: stock > 0, chưa có đơn nào trong 30 ngày qua
    const soldIds = new Set(soldQtyMap.keys());
    const deadStock = products.filter(p => p.stock > 0 && !soldIds.has(p.id));
    const deadStockCount = deadStock.length;
    const deadStockValue = deadStock.reduce((s, p) => s + p.stock * p.importPrice, 0);

    // Tồn kho cao: dùng maxStock nếu có, không thì dùng 2 tháng tốc độ bán làm ngưỡng
    const overStock = products.filter(p => {
      if (p.maxStock != null) return p.stock > p.maxStock;
      const sold = soldQtyMap.get(p.id) || 0;
      if (sold === 0) return false;
      return p.stock > (sold / 30) * 60;
    });
    const overStockCount = overStock.length;
    const overStockValue = overStock.reduce((s, p) => s + p.stock * p.importPrice, 0);

    // Top nhóm theo tồn kho — fallback nhiều cấp nếu categoryPath rỗng
    const groupMap = new Map<string, { qty: number; value: number }>();
    products.forEach(p => {
      const group =
        p.categoryPath?.split(' > ')[0] ||
        (p as any).category ||
        (p as any).categoryName ||
        'Chưa phân loại';
      const prev = groupMap.get(group) ?? { qty: 0, value: 0 };
      groupMap.set(group, {
        qty: prev.qty + p.stock,
        value: prev.value + p.stock * p.importPrice,
      });
    });
    const topGroups = Array.from(groupMap.entries())
      .map(([name, v]) => ({ name, ...v }))
      .sort((a, b) => b.qty - a.qty)
      .slice(0, 8);

    return {
      inStockCount: inStock.length,
      totalUnits,
      totalValue,
      outToday,
      out7,
      out30,
      deadStockCount,
      deadStockValue,
      overStockCount,
      overStockValue,
      topGroups,
    };
  }, [data.posProducts, data.posOrders]);

  const handleAiRun = async () => {
    const contextData = {
      inStockCount: stats.inStockCount,
      totalUnits: stats.totalUnits,
      totalValue: stats.totalValue,
      outToday: stats.outToday,
      out7: stats.out7,
      out30: stats.out30,
      deadStockCount: stats.deadStockCount,
      deadStockValue: stats.deadStockValue,
      overStockCount: stats.overStockCount,
      overStockValue: stats.overStockValue,
      topGroups: stats.topGroups,
    };
    const hash = hashData(contextData);
    const cached = getCachedAiResult('goods-stock', hash);
    if (cached) { setAiResult(cached); setFromCache(true); return; }
    setAiLoading(true); setFromCache(false);
    try {
      const res = await fetch('/api/ai/goods-stock', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(contextData),
      });
      const json = await res.json();
      const result = json.result || json.error || 'Không có kết quả';
      setAiResult(result);
      setCachedAiResult('goods-stock', hash, result);
    } catch {
      setAiResult('Lỗi kết nối đến AI.');
    } finally {
      setAiLoading(false);
    }
  };

  return (
    <div className="flex flex-col h-full overflow-y-auto bg-slate-50">
      {/* Title bar */}
      <div className="flex items-center px-6 py-4 bg-white border-b border-slate-100 shrink-0">
        <h1 className="text-base font-semibold text-slate-800">Tồn kho</h1>
      </div>

      <div className="flex-1 p-6 flex flex-col gap-6">
        {/* 3 summary cards */}
        <div className="grid grid-cols-3 gap-4">
          {[
            { label: 'Số mặt hàng còn tồn', value: fmt(stats.inStockCount) },
            { label: 'Tồn kho', value: fmt(stats.totalUnits) },
            { label: 'Giá trị tồn kho', value: fmtBig(stats.totalValue) },
          ].map(card => (
            <div
              key={card.label}
              className="bg-white rounded-xl border border-slate-100 shadow-sm px-6 py-5"
            >
              <p className="text-xs text-slate-500 mb-1">{card.label}</p>
              <p className="text-3xl font-bold text-slate-800">{card.value}</p>
            </div>
          ))}
        </div>

        {/* Cảnh báo hết hàng */}
        <div className="bg-white rounded-xl border border-slate-100 shadow-sm overflow-hidden">
          <div className="px-5 py-3 border-b border-slate-100">
            <span className="text-sm font-semibold text-slate-700">Cảnh báo hết hàng</span>
          </div>
          <div className="grid grid-cols-3 divide-x divide-slate-100 p-4 gap-4">
            <div className="px-4">
              <div className="flex items-center gap-2 mb-1">
                <span className="w-2.5 h-2.5 rounded-full bg-rose-500 shrink-0" />
                <span className="text-xs text-slate-600">Hết hàng hôm nay</span>
              </div>
              <p className="text-2xl font-bold text-slate-800 mt-1">
                {fmt(stats.outToday)}
                <span className="text-sm font-normal text-slate-500 ml-1">hàng hóa</span>
              </p>
            </div>
            <div className="px-4">
              <div className="flex items-center gap-2 mb-1">
                <span className="w-2.5 h-2.5 rounded-full bg-orange-400 shrink-0" />
                <span className="text-xs text-slate-600">Hết hàng trong 7 ngày tới</span>
              </div>
              <p className="text-2xl font-bold text-slate-800 mt-1">
                {fmt(stats.out7)}
                <span className="text-sm font-normal text-slate-500 ml-1">hàng hóa</span>
              </p>
            </div>
            <div className="px-4">
              <div className="flex items-center gap-2 mb-1">
                <span className="w-2.5 h-2.5 rounded-full bg-slate-400 shrink-0" />
                <span className="text-xs text-slate-600">Hết hàng trong 30 ngày tới</span>
              </div>
              <p className="text-2xl font-bold text-slate-800 mt-1">
                {fmt(stats.out30)}
                <span className="text-sm font-normal text-slate-500 ml-1">hàng hóa</span>
              </p>
            </div>
          </div>
        </div>

        {/* Cảnh báo tồn kho */}
        <div className="bg-white rounded-xl border border-slate-100 shadow-sm overflow-hidden">
          <div className="px-5 py-3 border-b border-slate-100">
            <span className="text-sm font-semibold text-slate-700">Cảnh báo tồn kho</span>
          </div>
          <div className="grid grid-cols-2 divide-x divide-slate-100">
            <div className="p-5">
              <div className="flex items-center gap-2 mb-2">
                <span className="w-2.5 h-2.5 rounded-full bg-rose-500 shrink-0" />
                <span className="text-sm text-slate-600 font-medium">Không bán được</span>
              </div>
              <p className="text-3xl font-bold text-slate-800">
                {fmt(stats.deadStockCount)}
                <span className="text-sm font-normal text-slate-500 ml-1">hàng hóa</span>
              </p>
              <p className="text-xs text-slate-500 mt-1">Dự kiến giá trị hàng lưu kho</p>
              <p className="text-sm font-semibold text-slate-700">{fmtBig(stats.deadStockValue)}</p>
            </div>
            <div className="p-5">
              <div className="flex items-center gap-2 mb-2">
                <span className="w-2.5 h-2.5 rounded-full bg-pink-400 shrink-0" />
                <span className="text-sm text-slate-600 font-medium">
                  Tồn kho cao vượt mức tiêu thụ
                </span>
              </div>
              <p className="text-3xl font-bold text-slate-800">
                {fmt(stats.overStockCount)}
                <span className="text-sm font-normal text-slate-500 ml-1">hàng hóa</span>
              </p>
              <p className="text-xs text-slate-500 mt-1">Dự kiến giá trị hàng lưu kho</p>
              <p className="text-sm font-semibold text-slate-700">{fmtBig(stats.overStockValue)}</p>
            </div>
          </div>
        </div>

        {/* Top nhóm hàng theo tồn kho */}
        <div className="bg-white rounded-xl border border-slate-100 shadow-sm overflow-hidden">
          <div className="px-5 py-3 border-b border-slate-100">
            <span className="text-sm font-semibold text-slate-700">Top nhóm hàng theo tồn kho</span>
          </div>
          <table className="w-full">
            <thead>
              <tr className="border-b border-slate-100 bg-slate-50">
                <th className="text-left px-5 py-2.5 text-xs font-medium text-slate-500">
                  Tên nhóm hàng
                </th>
                <th className="text-right px-5 py-2.5 text-xs font-medium text-slate-500">
                  Tồn kho
                </th>
                <th className="text-right px-5 py-2.5 text-xs font-medium text-slate-500">
                  Giá trị tồn kho
                </th>
              </tr>
            </thead>
            <tbody>
              {stats.topGroups.length === 0 ? (
                <tr>
                  <td colSpan={3} className="text-center py-8 text-slate-400 text-sm">
                    Không có dữ liệu
                  </td>
                </tr>
              ) : (
                stats.topGroups.map((g, i) => (
                  <tr
                    key={i}
                    className="border-b border-slate-50 hover:bg-slate-50 transition-colors"
                  >
                    <td className="px-5 py-3 text-sm text-slate-700 font-medium">{g.name}</td>
                    <td className="px-5 py-3 text-sm text-slate-700 text-right">
                      {fmt(g.qty)}
                    </td>
                    <td className="px-5 py-3 text-sm text-slate-700 text-right">
                      {fmt(g.value)}
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>

        <AiInsightPanel isLoading={aiLoading} result={aiResult} onRun={handleAiRun} fromCache={fromCache} />
      </div>
    </div>
  );
};

export default AnalysisGoodsStockPage;
