
import React, { useState, useMemo } from 'react';
import { X, Printer, ZoomIn, ZoomOut, ChevronRight, ChevronDown } from 'lucide-react';
import { POSOrder } from '../../types';

interface EndOfDayReportProps {
  orders: POSOrder[];
  storeName?: string;
  onClose: () => void;
}

const fmt = (n: number) => n.toLocaleString('vi-VN');

const EndOfDayReport: React.FC<EndOfDayReportProps> = ({ orders, storeName = 'CFO Brain Store', onClose }) => {
  const today = new Date().toLocaleDateString('en-CA');
  const [selectedDate, setSelectedDate] = useState(today);
  const [paperSize, setPaperSize] = useState<'A4' | 'A5'>('A4');
  const [zoom, setZoom] = useState(90);
  const [expandedGroups, setExpandedGroups] = useState<Set<string>>(new Set());

  const filteredOrders = useMemo(() =>
    orders.filter(o => new Date(o.date).toLocaleDateString('en-CA') === selectedDate),
    [orders, selectedDate]
  );

  const salesOrders = useMemo(() => filteredOrders.filter(o => !o.isReturn), [filteredOrders]);
  const returnOrders = useMemo(() => filteredOrders.filter(o => o.isReturn === true), [filteredOrders]);

  const salesSummary = useMemo(() => ({
    count: salesOrders.length,
    qty: salesOrders.reduce((s, o) => s + o.items.reduce((q, i) => q + i.quantity, 0), 0),
    revenue: salesOrders.reduce((s, o) => s + o.totalAmount, 0),
    actual: salesOrders.reduce((s, o) => s + o.finalAmount, 0),
  }), [salesOrders]);

  const returnSummary = useMemo(() => ({
    count: returnOrders.length,
    qty: returnOrders.reduce((s, o) => s + o.items.reduce((q, i) => q + i.quantity, 0), 0),
    revenue: returnOrders.reduce((s, o) => s + o.totalAmount, 0),
    actual: returnOrders.reduce((s, o) => s + o.finalAmount, 0),
  }), [returnOrders]);

  const netActual = salesSummary.actual - returnSummary.actual;

  const toggleGroup = (key: string) => {
    setExpandedGroups(prev => {
      const next = new Set(prev);
      if (next.has(key)) next.delete(key); else next.add(key);
      return next;
    });
  };

  const nowStr = new Date().toLocaleString('vi-VN', {
    day: '2-digit', month: '2-digit', year: 'numeric',
    hour: '2-digit', minute: '2-digit'
  });
  const dateStr = new Date(selectedDate + 'T00:00:00').toLocaleDateString('vi-VN');
  const paperWidth = paperSize === 'A4' ? 794 : 559;

  const handlePrint = () => {
    const salesRows = salesOrders.map(o => `
      <tr>
        <td style="border:1px solid #ccc;padding:5px 8px;padding-left:28px;font-family:monospace;color:#4f46e5">${o.orderCode}</td>
        <td style="border:1px solid #ccc;padding:5px 8px;color:#64748b">${new Date(o.date).toLocaleTimeString('vi-VN', { hour: '2-digit', minute: '2-digit' })}</td>
        <td style="border:1px solid #ccc;padding:5px 8px;text-align:right">${o.items.reduce((s, i) => s + i.quantity, 0)}</td>
        <td style="border:1px solid #ccc;padding:5px 8px;text-align:right">${fmt(o.totalAmount)}</td>
        <td style="border:1px solid #ccc;padding:5px 8px;text-align:right">0</td>
        <td style="border:1px solid #ccc;padding:5px 8px;text-align:right">0</td>
        <td style="border:1px solid #ccc;padding:5px 8px;text-align:right">0</td>
        <td style="border:1px solid #ccc;padding:5px 8px;text-align:right">0</td>
        <td style="border:1px solid #ccc;padding:5px 8px;text-align:right;font-weight:600">${fmt(o.finalAmount)}</td>
      </tr>`).join('');

    const returnRows = returnOrders.map(o => `
      <tr>
        <td style="border:1px solid #ccc;padding:5px 8px;padding-left:28px;font-family:monospace;color:#e11d48">${o.orderCode}</td>
        <td style="border:1px solid #ccc;padding:5px 8px;color:#64748b">${new Date(o.date).toLocaleTimeString('vi-VN', { hour: '2-digit', minute: '2-digit' })}</td>
        <td style="border:1px solid #ccc;padding:5px 8px;text-align:right">${o.items.reduce((s, i) => s + i.quantity, 0)}</td>
        <td style="border:1px solid #ccc;padding:5px 8px;text-align:right;color:#e11d48">-${fmt(o.totalAmount)}</td>
        <td style="border:1px solid #ccc;padding:5px 8px;text-align:right">0</td>
        <td style="border:1px solid #ccc;padding:5px 8px;text-align:right">0</td>
        <td style="border:1px solid #ccc;padding:5px 8px;text-align:right">0</td>
        <td style="border:1px solid #ccc;padding:5px 8px;text-align:right">0</td>
        <td style="border:1px solid #ccc;padding:5px 8px;text-align:right;font-weight:600;color:#e11d48">-${fmt(o.finalAmount)}</td>
      </tr>`).join('');

    const html = `<!DOCTYPE html><html><head><meta charset="utf-8"/>
    <title>Báo cáo cuối ngày - ${storeName}</title>
    <style>
      body { font-family: Arial, sans-serif; font-size: 12px; color: #1e293b; margin: 0; }
      @page { size: ${paperSize}; margin: 15mm 10mm; }
      h1 { font-size: 15px; font-weight: bold; text-align: center; margin: 0 0 4px; }
      .center { text-align: center; }
      .meta { text-align: center; font-size: 11px; color: #475569; line-height: 1.8; margin-bottom: 16px; }
      .created { font-size: 10px; color: #94a3b8; margin-bottom: 12px; }
      table { width: 100%; border-collapse: collapse; font-size: 11px; }
      th { background-color: #93c5d8; border: 1px solid #94a3b8; padding: 6px 8px; font-weight: 700; }
      .group-row { background-color: #f5f0dc; }
      .group-row td { border: 1px solid #94a3b8; padding: 6px 8px; font-weight: 700; }
      .summary { margin-top: 16px; border: 1px solid #e2e8f0; border-radius: 4px; padding: 12px 16px; background: #f8fafc; }
      .summary-grid { display: grid; grid-template-columns: 1fr 1fr 1fr; gap: 12px; }
      .summary-label { font-size: 10px; color: #64748b; margin-bottom: 2px; }
      .summary-val { font-weight: 700; font-size: 12px; }
      .net { font-size: 14px; color: #4338ca; }
      .rose { color: #e11d48; }
    </style></head><body>
    <div class="created">Ngày lập: ${nowStr}</div>
    <h1>Báo cáo cuối ngày về bán hàng</h1>
    <div class="meta">
      Ngày bán: &nbsp;${dateStr}<br/>
      Ngày thanh toán: ${dateStr}<br/>
      Chi nhánh: ${storeName}
    </div>
    <table>
      <thead>
        <tr>
          <th style="text-align:left">Mã giao dịch</th>
          <th style="text-align:left">Thời gian</th>
          <th style="text-align:right">SL</th>
          <th style="text-align:right">Doanh thu</th>
          <th style="text-align:right">Thu khác</th>
          <th style="text-align:right">VAT</th>
          <th style="text-align:right">Làm tròn</th>
          <th style="text-align:right">Phí trả hàng</th>
          <th style="text-align:right">Thực thu</th>
        </tr>
      </thead>
      <tbody>
        ${salesSummary.count > 0 ? `
        <tr class="group-row">
          <td>▶ Hóa đơn: ${salesSummary.count}</td>
          <td></td>
          <td style="text-align:right">${salesSummary.qty}</td>
          <td style="text-align:right">${fmt(salesSummary.revenue)}</td>
          <td style="text-align:right">0</td><td style="text-align:right">0</td>
          <td style="text-align:right">0</td><td style="text-align:right">0</td>
          <td style="text-align:right">${fmt(salesSummary.actual)}</td>
        </tr>${salesRows}` : ''}
        ${returnSummary.count > 0 ? `
        <tr class="group-row">
          <td>▶ Trả hàng: ${returnSummary.count}</td>
          <td></td>
          <td style="text-align:right">${returnSummary.qty}</td>
          <td style="text-align:right;color:#e11d48">-${fmt(returnSummary.revenue)}</td>
          <td style="text-align:right">0</td><td style="text-align:right">0</td>
          <td style="text-align:right">0</td><td style="text-align:right">0</td>
          <td style="text-align:right;color:#e11d48">-${fmt(returnSummary.actual)}</td>
        </tr>${returnRows}` : ''}
        ${salesSummary.count === 0 && returnSummary.count === 0 ?
          `<tr><td colspan="9" style="text-align:center;padding:20px;color:#94a3b8;font-style:italic">Không có giao dịch trong ngày ${dateStr}</td></tr>` : ''}
      </tbody>
    </table>
    ${(salesSummary.count > 0 || returnSummary.count > 0) ? `
    <div class="summary">
      <div class="summary-grid">
        <div><div class="summary-label">Tổng đơn bán</div><div class="summary-val">${salesSummary.count} đơn</div></div>
        <div><div class="summary-label">Tổng đơn trả</div><div class="summary-val rose">${returnSummary.count} đơn</div></div>
        <div><div class="summary-label">Thực thu cuối ngày</div><div class="summary-val net">${fmt(netActual)}đ</div></div>
      </div>
    </div>` : ''}
    <script>window.onload=()=>{window.print();setTimeout(()=>window.close(),500);}</script>
    </body></html>`;

    const win = window.open('', '_blank', 'width=900,height=700');
    if (!win) return;
    win.document.write(html);
    win.document.close();
  };

  const thStyle = "border border-slate-300 px-3 py-2 font-normal text-left text-xs";
  const thRStyle = "border border-slate-300 px-3 py-2 font-normal text-right text-xs";
  const tdStyle = "border border-slate-200 px-3 py-1.5 text-xs";
  const tdRStyle = "border border-slate-200 px-3 py-1.5 text-xs text-right";
  const grpTdStyle = "border border-slate-300 px-3 py-2 font-normal text-xs";
  const grpTdRStyle = "border border-slate-300 px-3 py-2 font-normal text-xs text-right";

  return (
    <div className="fixed inset-0 bg-slate-950/60 backdrop-blur-sm z-[200] flex items-center justify-center p-6">
      <div className="bg-slate-300 rounded-xl shadow-2xl w-full max-w-4xl h-[80vh] flex flex-col overflow-hidden">

      {/* Filter bar */}
      <div className="bg-white border-b border-slate-200 h-12 flex items-center px-4 gap-3 shrink-0 shadow-sm">
        <span className="font-normal text-slate-800 text-sm mr-3">Báo cáo cuối ngày</span>

        <div className="flex items-center gap-2 border border-slate-200 rounded-lg px-3 py-1.5 bg-slate-50">
          <input
            type="date"
            value={selectedDate}
            onChange={e => setSelectedDate(e.target.value)}
            className="bg-transparent text-slate-700 font-normal outline-none text-xs"
          />
        </div>

        <select
          value={paperSize}
          onChange={e => setPaperSize(e.target.value as 'A4' | 'A5')}
          className="border border-slate-200 rounded-lg px-3 py-1.5 bg-slate-50 text-xs font-normal text-slate-700 outline-none cursor-pointer"
        >
          <option value="A4">Khổ A4</option>
          <option value="A5">Khổ A5</option>
        </select>

        <div className="flex-1" />

        <button
          onClick={onClose}
          className="p-2 hover:bg-slate-100 rounded-lg text-slate-500 hover:text-slate-800 transition-colors"
        >
          <X className="w-4 h-4" />
        </button>
      </div>

      {/* Toolbar */}
      <div className="bg-white border-b border-slate-200 h-10 flex items-center px-4 gap-2 shrink-0">
        <div className="flex items-center gap-1">
          <button
            onClick={() => setZoom(z => Math.max(50, z - 10))}
            className="p-1.5 hover:bg-slate-100 rounded text-slate-500 transition-colors"
          >
            <ZoomOut className="w-3.5 h-3.5" />
          </button>
          <span className="text-xs font-normal text-slate-600 w-10 text-center tabular-nums">{zoom}%</span>
          <button
            onClick={() => setZoom(z => Math.min(150, z + 10))}
            className="p-1.5 hover:bg-slate-100 rounded text-slate-500 transition-colors"
          >
            <ZoomIn className="w-3.5 h-3.5" />
          </button>
        </div>

        <div className="h-5 w-px bg-slate-200 mx-1" />

        <button
          onClick={handlePrint}
          className="flex items-center gap-1.5 px-4 py-1.5 bg-indigo-600 text-white rounded-lg text-xs font-normal uppercase tracking-wider hover:bg-indigo-700 active:scale-95 transition-all"
        >
          <Printer className="w-3.5 h-3.5" />
          In báo cáo
        </button>

      </div>

      {/* Preview area */}
      <div className="flex-1 overflow-auto py-6 px-4 flex justify-center">
        <div
          style={{
            width: `${paperWidth}px`,
            transform: `scale(${zoom / 100})`,
            transformOrigin: 'top center',
            marginBottom: zoom < 100 ? `${(zoom / 100 - 1) * paperWidth * 1.414}px` : '24px'
          }}
          className="bg-white shadow-2xl border border-slate-200"
        >
          <div className="p-10 text-slate-900">

            {/* Creation time */}
            <div className="text-[10px] text-slate-400 mb-3">Ngày lập: {nowStr}</div>

            {/* Title */}
            <h1 className="text-base font-bold text-center mb-1">Báo cáo cuối ngày về bán hàng</h1>
            <div className="text-center text-[11px] text-slate-500 space-y-0.5 mb-5">
              <p>Ngày bán: &nbsp;{dateStr}</p>
              <p>Ngày thanh toán: {dateStr}</p>
              <p>Chi nhánh: {storeName}</p>
            </div>

            {/* Table */}
            <table className="w-full border-collapse">
              <thead>
                <tr style={{ backgroundColor: '#93c5d8' }}>
                  <th className={thStyle}>Mã giao dịch</th>
                  <th className={thStyle}>Thời gian</th>
                  <th className={thRStyle}>SL</th>
                  <th className={thRStyle}>Doanh thu</th>
                  <th className={thRStyle}>Thu khác</th>
                  <th className={thRStyle}>VAT</th>
                  <th className={thRStyle}>Làm tròn</th>
                  <th className={thRStyle}>Phí trả hàng</th>
                  <th className={thRStyle}>Thực thu</th>
                </tr>
              </thead>
              <tbody>

                {/* Sales group */}
                {salesSummary.count > 0 && (
                  <>
                    <tr
                      style={{ backgroundColor: '#f5f0dc' }}
                      className="cursor-pointer hover:brightness-95 transition-all"
                      onClick={() => toggleGroup('sales')}
                    >
                      <td className={grpTdStyle}>
                        <span className="inline-flex items-center gap-1">
                          {expandedGroups.has('sales')
                            ? <ChevronDown className="w-3 h-3 shrink-0" />
                            : <ChevronRight className="w-3 h-3 shrink-0" />}
                          Hóa đơn: {salesSummary.count}
                        </span>
                      </td>
                      <td className={grpTdStyle}></td>
                      <td className={grpTdRStyle}>{salesSummary.qty}</td>
                      <td className={grpTdRStyle}>{fmt(salesSummary.revenue)}</td>
                      <td className={grpTdRStyle}>0</td>
                      <td className={grpTdRStyle}>0</td>
                      <td className={grpTdRStyle}>0</td>
                      <td className={grpTdRStyle}>0</td>
                      <td className={grpTdRStyle}>{fmt(salesSummary.actual)}</td>
                    </tr>
                    {expandedGroups.has('sales') && salesOrders.map(order => (
                      <tr key={order.id} className="hover:bg-slate-50 transition-colors">
                        <td className={`${tdStyle} pl-8 font-mono text-indigo-600`}>{order.orderCode}</td>
                        <td className={`${tdStyle} text-slate-400`}>
                          {new Date(order.date).toLocaleTimeString('vi-VN', { hour: '2-digit', minute: '2-digit' })}
                        </td>
                        <td className={tdRStyle}>{order.items.reduce((s, i) => s + i.quantity, 0)}</td>
                        <td className={tdRStyle}>{fmt(order.totalAmount)}</td>
                        <td className={tdRStyle}>0</td>
                        <td className={tdRStyle}>0</td>
                        <td className={tdRStyle}>0</td>
                        <td className={tdRStyle}>0</td>
                        <td className={`${tdRStyle} font-normal`}>{fmt(order.finalAmount)}</td>
                      </tr>
                    ))}
                  </>
                )}

                {/* Return group */}
                {returnSummary.count > 0 && (
                  <>
                    <tr
                      style={{ backgroundColor: '#f5f0dc' }}
                      className="cursor-pointer hover:brightness-95 transition-all"
                      onClick={() => toggleGroup('return')}
                    >
                      <td className={grpTdStyle}>
                        <span className="inline-flex items-center gap-1">
                          {expandedGroups.has('return')
                            ? <ChevronDown className="w-3 h-3 shrink-0" />
                            : <ChevronRight className="w-3 h-3 shrink-0" />}
                          Trả hàng: {returnSummary.count}
                        </span>
                      </td>
                      <td className={grpTdStyle}></td>
                      <td className={grpTdRStyle}>{returnSummary.qty}</td>
                      <td className={`${grpTdRStyle} text-rose-600`}>-{fmt(returnSummary.revenue)}</td>
                      <td className={grpTdRStyle}>0</td>
                      <td className={grpTdRStyle}>0</td>
                      <td className={grpTdRStyle}>0</td>
                      <td className={grpTdRStyle}>0</td>
                      <td className={`${grpTdRStyle} text-rose-600`}>-{fmt(returnSummary.actual)}</td>
                    </tr>
                    {expandedGroups.has('return') && returnOrders.map(order => (
                      <tr key={order.id} className="hover:bg-rose-50/40 transition-colors">
                        <td className={`${tdStyle} pl-8 font-mono text-rose-500`}>{order.orderCode}</td>
                        <td className={`${tdStyle} text-slate-400`}>
                          {new Date(order.date).toLocaleTimeString('vi-VN', { hour: '2-digit', minute: '2-digit' })}
                        </td>
                        <td className={tdRStyle}>{order.items.reduce((s, i) => s + i.quantity, 0)}</td>
                        <td className={`${tdRStyle} text-rose-500`}>-{fmt(order.totalAmount)}</td>
                        <td className={tdRStyle}>0</td>
                        <td className={tdRStyle}>0</td>
                        <td className={tdRStyle}>0</td>
                        <td className={tdRStyle}>0</td>
                        <td className={`${tdRStyle} font-normal text-rose-500`}>-{fmt(order.finalAmount)}</td>
                      </tr>
                    ))}
                  </>
                )}

                {/* Empty state */}
                {salesSummary.count === 0 && returnSummary.count === 0 && (
                  <tr>
                    <td colSpan={9} className="border border-slate-200 px-3 py-10 text-center text-slate-400 text-xs italic">
                      Không có giao dịch nào trong ngày {dateStr}
                    </td>
                  </tr>
                )}
              </tbody>
            </table>

            {/* Footer summary */}
            {(salesSummary.count > 0 || returnSummary.count > 0) && (
              <div className="mt-5 p-4 bg-slate-50 border border-slate-200 rounded-lg">
                <div className="grid grid-cols-3 gap-4 text-xs">
                  <div>
                    <div className="text-slate-400 font-normal mb-1">Tổng đơn bán</div>
                    <div className="font-normal text-slate-800 text-sm">{salesSummary.count} đơn</div>
                    <div className="text-slate-500 font-normal mt-0.5">{fmt(salesSummary.actual)}đ</div>
                  </div>
                  <div>
                    <div className="text-slate-400 font-normal mb-1">Tổng đơn trả</div>
                    <div className="font-normal text-rose-500 text-sm">{returnSummary.count} đơn</div>
                    <div className="text-rose-400 font-normal mt-0.5">-{fmt(returnSummary.actual)}đ</div>
                  </div>
                  <div className="border-l border-slate-200 pl-4">
                    <div className="text-slate-400 font-normal mb-1">Thực thu cuối ngày</div>
                    <div className="font-normal text-indigo-700 text-lg tabular-nums">{fmt(netActual)}đ</div>
                  </div>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
    </div>
  );
};

export default EndOfDayReport;
