
import React, { useState, useMemo } from 'react';
import { X, Printer, ChevronRight, ChevronDown } from 'lucide-react';
import { Employee, POSOrder } from '../../types';
import { calculateStaffSalesForDate } from '../../src/lib/posSalesAttribution';
import { calcOrderRevenue } from '../../src/lib/reportCalculations';

interface EndOfDayReportProps {
  orders: POSOrder[];
  employees?: Employee[];
  storeName?: string;
  onClose: () => void;
  embedded?: boolean; // true = nhúng vào page, không dùng modal overlay
}

const fmt = (n: number) => n.toLocaleString('vi-VN');
const fmtTime = (dateStr: string) => {
  if (!dateStr) return '';
  const d = new Date(dateStr);
  if (isNaN(d.getTime())) return dateStr;
  return d.toLocaleTimeString('vi-VN', { hour: '2-digit', minute: '2-digit' });
};
const fmtCustomer = (name?: string) => name?.trim() || '';
type ReportFocus = 'general' | 'detail';

const EndOfDayReport: React.FC<EndOfDayReportProps> = ({
  orders,
  employees = [],
  storeName = 'CFO Brain Store',
  onClose,
  embedded = false,
}) => {
  const today = new Date().toLocaleDateString('en-CA');
  const [selectedDate, setSelectedDate] = useState(today);
  const [reportFocus, setReportFocus] = useState<ReportFocus>('detail');
  const [paperSize, setPaperSize] = useState<'A4' | 'A5'>('A4');
  const [expandedGroups, setExpandedGroups] = useState<Set<string>>(new Set());

  const filteredOrders = useMemo(() =>
    orders.filter(o => new Date(o.date).toLocaleDateString('en-CA') === selectedDate),
    [orders, selectedDate]
  );

  const {
    salesOrders,
    returnOrders,
    salesSummary,
    returnSummary,
    salesDiscount,
    returnRefundTotal,
    returnTraHang,
    totalAllOrders,
    allQty,
  } = useMemo(() => {
    const salesOrders: POSOrder[] = [];
    const returnOrders: POSOrder[] = [];
    let salesQty = 0, salesRevenue = 0, salesGross = 0, salesActual = 0;
    let returnQty = 0, returnRevenue = 0, returnActual = 0;
    let returnRefundTotal = 0, returnTraHang = 0;
    let totalAllOrders = 0, allQty = 0;

    for (const o of filteredOrders) {
      const qty = o.items.reduce((q, i) => q + i.quantity, 0);
      allQty += qty;
      if (!o.isReturn) totalAllOrders += Math.abs(o.totalAmount);
      if (o.isReturn) {
        returnOrders.push(o);
        returnQty += qty;
        returnRevenue += Math.abs(o.totalAmount);
        returnActual += o.finalAmount;
        returnRefundTotal += o.refundAmount ?? 0;
        returnTraHang += Math.abs(o.totalAmount);
      } else {
        salesOrders.push(o);
        salesQty += qty;
        salesGross += Number(o.totalAmount) || 0;
        salesRevenue += calcOrderRevenue(o); // = totalAmount - discount (chuẩn KiotViet)
        salesActual += o.finalAmount;
      }
    }

    return {
      salesOrders,
      returnOrders,
      salesSummary: { count: salesOrders.length, qty: salesQty, revenue: salesRevenue, actual: salesActual },
      returnSummary: { count: returnOrders.length, qty: returnQty, revenue: returnRevenue, actual: returnActual },
      salesDiscount: salesGross - salesRevenue, // = Σdiscount, dùng để hiển thị
      returnRefundTotal,
      returnTraHang,
      totalAllOrders,
      allQty,
    };
  }, [filteredOrders]);

  const staffSalesSummary = useMemo(
    () => calculateStaffSalesForDate(filteredOrders, selectedDate, employees),
    [employees, filteredOrders, selectedDate]
  );

  // Nhóm tất cả đơn theo PTTT (dùng cho sub-group Chi tiết)
  const ordersByMethod = useMemo(() => {
    const map = new Map<string, POSOrder[]>();
    filteredOrders.forEach(o => {
      const m = o.paymentMethod || 'Cash';
      if (!map.has(m)) map.set(m, []);
      map.get(m)!.push(o);
    });
    const order = ['Cash', 'Bank', 'Card', 'Momo', 'Other'];
    const sorted = new Map<string, POSOrder[]>();
    order.forEach(m => { if (map.has(m)) sorted.set(m, map.get(m)!); });
    map.forEach((v, k) => { if (!sorted.has(k)) sorted.set(k, v); });
    return sorted;
  }, [filteredOrders]);

  const staffNameMap = useMemo(() => {
    const m = new Map<string, string>();
    employees?.forEach(e => m.set(e.id, e.name || ''));
    return m;
  }, [employees]);

  const methodDisplayName = (m: string) =>
    ({ Cash: 'TM', Bank: 'CK', Card: 'Thẻ', Momo: 'Ví', Other: 'Khác' } as Record<string, string>)[m] || m;

  // Pre-compute group summaries theo PTTT — tránh tính lại mỗi lần expand
  const methodSummaries = useMemo(() => {
    const result = new Map<string, {
      qty: number; totienHang: number; traHang: number; doanhThu: number; giamGia: number; thucThu: number;
    }>();
    ordersByMethod.forEach((methodOrders, method) => {
      const sales      = methodOrders.filter(o => !o.isReturn);
      const returns    = methodOrders.filter(o => !!o.isReturn);
      const qty        = methodOrders.reduce((s, o) => s + o.items.reduce((q, i) => q + i.quantity, 0), 0);
      // Tổng tiền hàng = chỉ đơn bán (trả hàng hiển thị riêng ở group "Trả hàng")
      const totienHang = sales.reduce((s, o) => s + Math.abs(o.totalAmount), 0);
      const traHang    = returns.reduce((s, o) => s + Math.abs(o.totalAmount), 0);
      const grossSales = sales.reduce((s, o) => s + (Number(o.totalAmount) || 0), 0);
      const doanhThu   = sales.reduce((s, o) => s + calcOrderRevenue(o), 0); // = totalAmount - discount
      const giamGia    = grossSales - doanhThu; // discount = gross - net
      // thucThu chỉ tính sales để khớp với dòng header "Hóa đơn"; traHang thể hiện ở group riêng
      const thucThu    = doanhThu;
      result.set(method, { qty, totienHang, traHang, doanhThu, giamGia, thucThu });
    });
    return result;
  }, [ordersByMethod]);

  // Pre-compute per-order display data — tránh fmtTime + staffName lookup mỗi render
  const orderDisplayMap = useMemo(() => {
    const m = new Map<string, { time: string; staffName: string; qty: number; disc: number }>();
    filteredOrders.forEach(o => {
      m.set(o.id, {
        time:      fmtTime(o.date),
        staffName: o.staffName || staffNameMap.get(o.staffId) || '',
        qty:       o.items.reduce((s, i) => s + i.quantity, 0),
        disc:      Math.abs(o.discount || 0),
      });
    });
    return m;
  }, [filteredOrders, staffNameMap]);

  // salesRevenue = Σ calcOrderRevenue = totalAmount - discount (đã trừ giảm giá)
  const newDoanhThu = salesSummary.revenue;
  // newDoanhThu đã net của giảm giá → newThucthu = newDoanhThu
  const newThucthu  = newDoanhThu;

  // Thực thu tổng ngày = Thực thu bán - Trả hàng
  const overallThucthu = newThucthu - returnTraHang;
  // grossRevenue giữ để không break print HTML cũ
  const grossRevenue = totalAllOrders - salesDiscount;

  const generalSummary = useMemo(() => {
    const base = {
      cash: 0,
      bank: 0,
      card: 0,
      wallet: 0,
      points: 0,
      voucher: 0,
    };
    const counts = { ...base };
    const payments = salesOrders.reduce((acc, order) => {
      const amount = Number(order.finalAmount) || 0;
      const method = order.paymentMethod;
      if (method === 'Cash') acc.cash += amount;
      else if (method === 'Bank') acc.bank += amount;
      else if (method === 'Momo') acc.wallet += amount;
      else acc.card += amount;
      return acc;
    }, { ...base });

    salesOrders.forEach(order => {
      const method = order.paymentMethod;
      if (method === 'Cash') counts.cash += 1;
      else if (method === 'Bank') counts.bank += 1;
      else if (method === 'Momo') counts.wallet += 1;
      else counts.card += 1;
    });

    const uniqueProducts = new Set<string>();
    const productQty = salesOrders.reduce((sum, order) => {
      order.items.forEach(item => uniqueProducts.add(item.productId || item.sku || item.name));
      return sum + order.items.reduce((itemSum, item) => itemSum + (Number(item.quantity) || 0), 0);
    }, 0);

    const paymentTotal = payments.cash + payments.bank + payments.card + payments.wallet + payments.points + payments.voucher;

    return {
      payments,
      counts,
      paymentTotal,
      salesValue: salesOrders.reduce((sum, order) => sum + (Number(order.totalAmount) || 0), 0),
      invoiceCount: salesOrders.length,
      uniqueProductCount: uniqueProducts.size,
      productQty,
    };
  }, [salesOrders]);

  const toggleGroup = (key: string) => {
    setExpandedGroups(prev => {
      const next = new Set(prev);
      if (next.has(key)) next.delete(key); else next.add(key);
      return next;
    });
  };

  const nowStr = useMemo(() => new Date().toLocaleString('vi-VN', {
    day: '2-digit', month: '2-digit', year: 'numeric',
    hour: '2-digit', minute: '2-digit'
  }), []);
  const dateStr = useMemo(() => new Date(selectedDate + 'T00:00:00').toLocaleDateString('vi-VN'), [selectedDate]);


  const handlePrint = () => {

    const generalTables = `
      <table style="width:100%;border-collapse:collapse;font-size:11px">
        <colgroup>
          <col style="width:18%"/><col style="width:6%"/>
          <col style="width:8%"/><col style="width:8%"/>
          <col style="width:7%"/><col style="width:7%"/>
          <col style="width:7%"/><col style="width:7%"/>
          <col style="width:8%"/><col style="width:10%"/>
          <col style="width:14%"/>
        </colgroup>
        <thead>
          <tr style="background:#93c5d8">
            <th style="text-align:left;padding:5px 8px;border:1px solid #ccc">Chỉ tiêu</th>
            <th style="text-align:right;padding:5px 8px;border:1px solid #ccc">SL</th>
            <th style="text-align:right;padding:5px 8px;border:1px solid #ccc">Tiền mặt</th>
            <th style="text-align:right;padding:5px 8px;border:1px solid #ccc">CK</th>
            <th style="text-align:right;padding:5px 8px;border:1px solid #ccc">Thẻ</th>
            <th style="text-align:right;padding:5px 8px;border:1px solid #ccc">Ví</th>
            <th style="text-align:right;padding:5px 8px;border:1px solid #ccc">Điểm</th>
            <th style="text-align:right;padding:5px 8px;border:1px solid #ccc">Voucher</th>
            <th style="text-align:right;padding:5px 8px;border:1px solid #ccc">Tổng</th>
            <th style="text-align:right;padding:5px 8px;border:1px solid #ccc">Thừa TK</th>
            <th style="text-align:right;padding:5px 8px;border:1px solid #ccc">Thực thu</th>
          </tr>
        </thead>
        <tbody>
          <tr style="background:#f5f0dc">
            <td style="padding:5px 8px;border:1px solid #ccc"></td>
            <td style="text-align:right;padding:5px 8px;border:1px solid #ccc">${filteredOrders.length}</td>
            <td style="text-align:right;padding:5px 8px;border:1px solid #ccc">${fmt(generalSummary.payments.cash)}</td>
            <td style="text-align:right;padding:5px 8px;border:1px solid #ccc">${fmt(generalSummary.payments.bank)}</td>
            <td style="text-align:right;padding:5px 8px;border:1px solid #ccc">${fmt(generalSummary.payments.card)}</td>
            <td style="text-align:right;padding:5px 8px;border:1px solid #ccc">${fmt(generalSummary.payments.wallet)}</td>
            <td style="text-align:right;padding:5px 8px;border:1px solid #ccc">0</td>
            <td style="text-align:right;padding:5px 8px;border:1px solid #ccc">0</td>
            <td style="text-align:right;padding:5px 8px;border:1px solid #ccc">${fmt(totalAllOrders)}</td>
            <td style="text-align:right;padding:5px 8px;border:1px solid #ccc">0</td>
            <td style="text-align:right;padding:5px 8px;border:1px solid #ccc;color:#2563eb;font-weight:600">${fmt(overallThucthu)}</td>
          </tr>
          <tr>
            <td style="padding:5px 8px;border:1px solid #ccc;color:#2563eb;font-weight:600">Hóa đơn</td>
            <td style="text-align:right;padding:5px 8px;border:1px solid #ccc">${salesSummary.count}</td>
            <td style="text-align:right;padding:5px 8px;border:1px solid #ccc">${fmt(generalSummary.payments.cash)}</td>
            <td style="text-align:right;padding:5px 8px;border:1px solid #ccc">${fmt(generalSummary.payments.bank)}</td>
            <td style="text-align:right;padding:5px 8px;border:1px solid #ccc">${fmt(generalSummary.payments.card)}</td>
            <td style="text-align:right;padding:5px 8px;border:1px solid #ccc">${fmt(generalSummary.payments.wallet)}</td>
            <td style="text-align:right;padding:5px 8px;border:1px solid #ccc">0</td>
            <td style="text-align:right;padding:5px 8px;border:1px solid #ccc">0</td>
            <td style="text-align:right;padding:5px 8px;border:1px solid #ccc">${fmt(salesSummary.revenue)}</td>
            <td style="text-align:right;padding:5px 8px;border:1px solid #ccc">0</td>
            <td style="text-align:right;padding:5px 8px;border:1px solid #ccc;font-weight:600">${fmt(newThucthu)}</td>
          </tr>
          ${returnSummary.count > 0 ? `
          <tr>
            <td style="padding:5px 8px;border:1px solid #ccc;color:#e11d48;font-weight:600">Trả hàng</td>
            <td style="text-align:right;padding:5px 8px;border:1px solid #ccc">${returnSummary.count}</td>
            <td style="text-align:right;padding:5px 8px;border:1px solid #ccc">0</td>
            <td style="text-align:right;padding:5px 8px;border:1px solid #ccc">0</td>
            <td style="text-align:right;padding:5px 8px;border:1px solid #ccc">0</td>
            <td style="text-align:right;padding:5px 8px;border:1px solid #ccc">0</td>
            <td style="text-align:right;padding:5px 8px;border:1px solid #ccc">0</td>
            <td style="text-align:right;padding:5px 8px;border:1px solid #ccc">0</td>
            <td style="text-align:right;padding:5px 8px;border:1px solid #ccc;color:#e11d48">${fmt(returnTraHang)}</td>
            <td style="text-align:right;padding:5px 8px;border:1px solid #ccc">0</td>
            <td style="text-align:right;padding:5px 8px;border:1px solid #ccc;color:#e11d48">-${fmt(returnTraHang)}</td>
          </tr>` : ''}
          <tr>
            <td style="padding:5px 8px;border:1px solid #ccc;color:#94a3b8">Dịch vụ</td>
            ${Array(10).fill('<td style="text-align:right;padding:5px 8px;border:1px solid #ccc">0</td>').join('')}
          </tr>
          ${staffSalesSummary.length > 0 ? `
          <tr style="background:#e2e8f0">
            <td colspan="11" style="padding:5px 8px;border:1px solid #ccc;font-weight:600;color:#475569">Doanh số nhân viên</td>
          </tr>
          ${staffSalesSummary.map(row => `
          <tr>
            <td style="padding:5px 8px 5px 20px;border:1px solid #ccc">${row.employeeName}</td>
            <td style="text-align:right;padding:5px 8px;border:1px solid #ccc">${row.orderCount}</td>
            <td style="padding:5px 8px;border:1px solid #ccc"></td>
            <td style="padding:5px 8px;border:1px solid #ccc"></td>
            <td style="padding:5px 8px;border:1px solid #ccc"></td>
            <td style="padding:5px 8px;border:1px solid #ccc"></td>
            <td style="padding:5px 8px;border:1px solid #ccc"></td>
            <td style="padding:5px 8px;border:1px solid #ccc"></td>
            <td style="text-align:right;padding:5px 8px;border:1px solid #ccc;color:#2563eb">${fmt(row.salesAmount)}</td>
            <td style="padding:5px 8px;border:1px solid #ccc"></td>
            <td style="text-align:right;padding:5px 8px;border:1px solid #ccc;color:#2563eb;font-weight:600">${fmt(row.salesAmount)}</td>
          </tr>`).join('')}` : ''}
        </tbody>
      </table>
    `;

    const grpCell = (val: string, color = '', indent = 0) =>
      `<td style="border:1px solid #ccc;padding:5px ${6 + indent}px;font-weight:600${color ? `;color:${color}` : ''}">${val}</td>`;
    const grpR = (val: string, color = '') =>
      `<td style="border:1px solid #ccc;padding:5px 6px;text-align:right;font-weight:600${color ? `;color:${color}` : ''}">${val}</td>`;
    const dtd = (val: string, color = '', indent = 0) =>
      `<td style="border-bottom:1px solid #e2e8f0;padding:4px ${6 + indent}px${color ? `;color:${color}` : ''}">${val}</td>`;
    const dtdR = (val: string, color = '') =>
      `<td style="border-bottom:1px solid #e2e8f0;padding:4px 6px;text-align:right${color ? `;color:${color}` : ''}">${val}</td>`;
    const th14 = (label: string, align = 'right') =>
      `<th style="text-align:${align};padding:5px 6px;border:1px solid #94a3b8;font-size:10px">${label}</th>`;

    const printMethodRows = Array.from(ordersByMethod.entries()).map(([method, methodOrders]) => {
      const mSales    = methodOrders.filter(o => !o.isReturn);
      const mReturns  = methodOrders.filter(o => !!o.isReturn);
      const mQty      = methodOrders.reduce((s, o) => s + o.items.reduce((q, i) => q + i.quantity, 0), 0);
      const mTienHang = mSales.reduce((s, o) => s + (Number(o.totalAmount) || 0), 0);
      const mTraHang  = mReturns.reduce((s, o) => s + Math.abs(Number(o.totalAmount) || 0), 0);
      const mDoanhThu = mSales.reduce((s, o) => s + calcOrderRevenue(o), 0); // = totalAmount - discount
      const mGiamGia  = mTienHang - mDoanhThu; // derived, nhất quán với UI live
      const mThucThu  = mDoanhThu;
      const mName     = methodDisplayName(method);

      const orderRows = methodOrders.map(order => {
        const disc      = Math.abs(order.discount || 0);
        const isRet     = !!order.isReturn;
        const retAmt    = Math.abs(order.totalAmount);
        const staffName = order.staffName || staffNameMap.get(order.staffId) || '';
        const time      = fmtTime(order.date);
        const tienHang  = isRet ? 0 : Math.abs(order.totalAmount);
        const doanhThuOrder = isRet ? 0 : calcOrderRevenue(order); // totalAmount - discount
        return `<tr>
          ${dtd(`<span style="padding-left:36px;font-family:monospace;color:${isRet ? '#e11d48' : '#4f46e5'}">${order.orderCode}</span>`)}
          ${dtd(fmtCustomer(order.customerName))}
          ${dtd(staffName)}
          ${dtd(`<span style="color:#94a3b8">${time}</span>`)}
          ${dtdR(String(order.items.reduce((s, i) => s + i.quantity, 0)))}
          ${dtdR(isRet ? fmt(retAmt) : fmt(tienHang), isRet ? '#e11d48' : '')}
          ${dtdR('0')}
          ${dtdR(isRet ? '0' : fmt(doanhThuOrder))}
          ${dtdR(disc > 0 ? `-${fmt(disc)}` : '', '#e11d48')}
          ${dtdR('0')}${dtdR('0')}
          ${dtdR(isRet ? '' : fmt(order.finalAmount))}
        </tr>`;
      }).join('');

      return `
        <tr style="background:#f0f4f8">
          ${grpCell(mName, '', 20)}${grpCell('')}${grpCell('')}${grpCell('')}
          ${grpR(String(mQty))}${grpR(fmt(mTienHang))}
          ${grpR('0')}${grpR(fmt(mDoanhThu))}
          ${grpR(mGiamGia > 0 ? `-${fmt(mGiamGia)}` : '0', mGiamGia > 0 ? '#e11d48' : '')}
          ${grpR('0')}${grpR('0')}
          ${grpR(fmt(mThucThu))}
        </tr>
        ${orderRows}`;
    }).join('');

    const printReturnRows = returnOrders.map(order => {
      const retAmt    = Math.abs(order.totalAmount);
      const staffName = order.staffName || staffNameMap.get(order.staffId) || '';
      const time      = fmtTime(order.date);
      return `<tr>
        ${dtd(`<span style="padding-left:20px;font-family:monospace;color:#e11d48">${order.orderCode}</span>`)}
        ${dtd(fmtCustomer(order.customerName))}
        ${dtd(staffName)}
        ${dtd(`<span style="color:#94a3b8">${time}</span>`)}
        ${dtdR(String(order.items.reduce((s, i) => s + i.quantity, 0)))}
        ${dtdR(fmt(retAmt), '#e11d48')}
        ${dtdR('0')}${dtdR('0')}
        ${dtdR('0')}${dtdR('0')}${dtdR('0')}
        ${dtdR(`-${fmt(retAmt)}`, '#e11d48')}
      </tr>`;
    }).join('');

    const detailTables = filteredOrders.length === 0
      ? `<table style="width:100%;border-collapse:collapse;font-size:11px"><tbody>
          <tr><td colspan="14" style="text-align:center;padding:20px;color:#94a3b8;font-style:italic">Không có giao dịch trong ngày ${dateStr}</td></tr>
         </tbody></table>`
      : `<table style="width:100%;border-collapse:collapse;font-size:10.5px">
          <colgroup>
            <col style="width:13%"/><col style="width:9%"/>
            <col style="width:8%"/><col style="width:6%"/>
            <col style="width:4%"/><col style="width:11%"/>
            <col style="width:5%"/><col style="width:11%"/>
            <col style="width:8%"/><col style="width:4%"/>
            <col style="width:7%"/><col style="width:9%"/>
          </colgroup>
          <thead>
            <tr style="background:#93c5d8">
              ${th14('Mã chứng từ','left')}${th14('Khách hàng','left')}
              ${th14('Nhân viên','left')}${th14('Thời gian','left')}
              ${th14('SL')}${th14('Tổng tiền hàng')}${th14('Dịch vụ')}
              ${th14('Doanh thu')}${th14('Giảm giá')}${th14('VAT')}${th14('Tiền trả khách')}
              ${th14('Thực thu')}
            </tr>
          </thead>
          <tbody>
            <tr style="background:#f5f0dc">
              ${grpCell(`Hóa đơn: ${filteredOrders.length}`, '#1e293b')}
              ${grpCell('')}${grpCell('')}${grpCell('')}
              ${grpR(String(allQty))}${grpR(fmt(totalAllOrders))}
              ${grpR('0')}${grpR(fmt(newDoanhThu))}
              ${grpR(salesDiscount > 0 ? `-${fmt(salesDiscount)}` : '0', salesDiscount > 0 ? '#e11d48' : '')}
              ${grpR('0')}${grpR('0')}
              ${grpR(fmt(newThucthu), '#2563eb')}
            </tr>
            ${printMethodRows}
            ${returnSummary.count > 0 ? `
            <tr style="background:#f5f0dc">
              ${grpCell(`Trả hàng: ${returnSummary.count}`, '#e11d48')}
              ${grpCell('')}${grpCell('')}${grpCell('')}
              ${grpR(String(returnSummary.qty))}
              ${grpR(fmt(returnTraHang), '#e11d48')}
              ${grpR('0')}${grpR('0')}
              ${grpR('0')}${grpR('0')}${grpR('0')}
              ${grpR(`-${fmt(returnTraHang)}`, '#e11d48')}
            </tr>
            ${printReturnRows}` : ''}
          </tbody>
        </table>
        <div style="margin-top:14px;border:1px solid #e2e8f0;border-radius:4px;padding:10px 14px;background:#f8fafc;display:grid;grid-template-columns:1fr 1fr 1fr;gap:10px">
          <div><div style="font-size:10px;color:#64748b;margin-bottom:2px">Doanh thu bán hàng</div><div style="font-weight:700">${fmt(newThucthu)}đ</div></div>
          <div><div style="font-size:10px;color:#64748b;margin-bottom:2px">Trả hàng</div><div style="font-weight:700;color:#e11d48">${returnTraHang > 0 ? `-${fmt(returnTraHang)}đ` : '0'}</div></div>
          <div><div style="font-size:10px;color:#64748b;margin-bottom:2px">Thực thu cuối ngày</div><div style="font-weight:700;font-size:13px;color:#4338ca">${fmt(overallThucthu)}đ</div></div>
        </div>`;

    const html = `<!DOCTYPE html><html><head><meta charset="utf-8"/>
    <title>Báo cáo cuối ngày - ${storeName}</title>
    <style>
      body { font-family: Inter, ui-sans-serif, system-ui, sans-serif; font-size: 12px; color: #1e293b; margin: 0; letter-spacing: 0; }
      @page { size: ${paperSize}; margin: 15mm 10mm; }
      h1 { font-size: 15px; font-weight: bold; text-align: center; margin: 0 0 4px; }
      .center { text-align: center; }
      .meta { text-align: center; font-size: 11px; color: #475569; line-height: 1.8; margin-bottom: 16px; }
      .created { font-size: 10px; color: #94a3b8; margin-bottom: 12px; }
      table { width: 100%; border-collapse: collapse; font-size: 11px; }
      th { background-color: #93c5d8; border: 1px solid #94a3b8; padding: 6px 8px; font-weight: 700; }
      td { border-bottom: 1px solid #cbd5e1; padding: 8px; text-align: right; }
      td:first-child { text-align: left; }
      .group-row { background-color: #f5f0dc; }
      .group-row td { border: 1px solid #94a3b8; padding: 6px 8px; font-weight: 700; }
      .report-section { margin-top: 18px; }
      h2 { font-size: 13px; margin: 0 0 8px; }
      .blue, .blue-label { color: #2563eb; font-weight: 700; }
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
    ${reportFocus === 'general' ? generalTables : detailTables}
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
  const staffSalesSection = (
    <section>
      <h2 className="mb-2 text-sm font-bold text-slate-800">Doanh số nhân viên</h2>
      <table className="w-full border-collapse text-xs">
        <thead>
          <tr style={{ backgroundColor: '#93c5d8' }}>
            <th className={thStyle}>Nhân viên</th>
            <th className={thRStyle}>Số đơn</th>
            <th className={thRStyle}>SL sản phẩm</th>
            <th className={thRStyle}>Doanh số ghi nhận</th>
          </tr>
        </thead>
        <tbody>
          {staffSalesSummary.length > 0 ? (
            staffSalesSummary.map(row => (
              <tr key={row.employeeId}>
                <td className={`${tdStyle} font-semibold text-slate-700`}>{row.employeeName}</td>
                <td className={tdRStyle}>{row.orderCount}</td>
                <td className={tdRStyle}>{fmt(row.quantity)}</td>
                <td className={`${tdRStyle} font-semibold text-blue-600`}>
                  {fmt(row.salesAmount)}
                </td>
              </tr>
            ))
          ) : (
            <tr>
              <td colSpan={4} className={`${tdStyle} text-center text-slate-400`}>
                Chưa có doanh số nhân viên trong ngày này
              </td>
            </tr>
          )}
        </tbody>
      </table>
    </section>
  );

  const inner = (
    <div className={embedded ? 'flex h-full flex-col overflow-hidden' : 'bg-white rounded-xl shadow-2xl w-full max-w-5xl h-[85vh] flex flex-col overflow-hidden'}>

      {/* Hàng 1: title + controls + nút in + (nút đóng nếu modal) */}
      <div className="bg-white border-b border-slate-200 h-12 flex items-center px-4 gap-3 shrink-0 shadow-sm">
        <span className="font-normal text-slate-800 text-sm mr-1">Báo cáo cuối ngày</span>

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
          onClick={handlePrint}
          className="flex items-center gap-1.5 px-4 py-1.5 bg-indigo-600 text-white rounded-lg text-xs font-normal uppercase tracking-wider hover:bg-indigo-700 active:scale-95 transition-all"
        >
          <Printer className="w-3.5 h-3.5" />
          In báo cáo
        </button>

        {!embedded && (
          <button
            onClick={onClose}
            className="p-2 hover:bg-slate-100 rounded-lg text-slate-500 hover:text-slate-800 transition-colors"
          >
            <X className="w-4 h-4" />
          </button>
        )}
      </div>

      {/* Hàng 2: tab Tổng quát / Chi tiết — căn giữa */}
      <div className="bg-white border-b border-slate-200 h-10 flex items-center justify-center shrink-0">
        <div className="flex items-center gap-1 rounded-lg border border-slate-200 bg-slate-50 p-1">
          {([
            ['general', 'Tổng quát'],
            ['detail', 'Chi tiết'],
          ] as const).map(([value, label]) => (
            <button
              key={value}
              onClick={() => setReportFocus(value)}
              className={`rounded-md px-5 py-1 text-xs transition-colors ${
                reportFocus === value
                  ? 'bg-indigo-600 text-white'
                  : 'text-slate-600 hover:bg-white'
              }`}
            >
              {label}
            </button>
          ))}
        </div>
      </div>

      {/* Preview area */}
      <div className="flex-1 overflow-auto px-6 py-4">
          <div className="text-slate-900">

            {filteredOrders.length === 0 && (
              <div className="text-center py-10 text-slate-400 text-xs">
                Không có dữ liệu cho ngày {dateStr}.<br />
                Hệ thống chỉ lưu dữ liệu 90 ngày gần nhất trên thiết bị. Vui lòng xem báo cáo tại mục <strong>Phân tích</strong> để tra cứu dữ liệu cũ hơn.
              </div>
            )}

            {/* Creation time */}
            <div className="text-2xs text-slate-400 mb-3">Ngày lập: {nowStr}</div>

            {/* Title */}
            <h1 className="text-base font-bold text-center mb-1">Báo cáo cuối ngày về bán hàng</h1>
            <div className="text-center text-xs text-slate-500 space-y-0.5 mb-5">
              <p>Ngày bán: &nbsp;{dateStr}</p>
              <p>Ngày thanh toán: {dateStr}</p>
              <p>Chi nhánh: {storeName}</p>
            </div>

            {reportFocus === 'general' ? (
              <table className="w-full border-collapse text-xs">
                <colgroup>
                  <col style={{ width: '18%' }} />
                  <col style={{ width: '6%' }} />
                  <col style={{ width: '8%' }} />
                  <col style={{ width: '8%' }} />
                  <col style={{ width: '7%' }} />
                  <col style={{ width: '7%' }} />
                  <col style={{ width: '7%' }} />
                  <col style={{ width: '7%' }} />
                  <col style={{ width: '8%' }} />
                  <col style={{ width: '10%' }} />
                  <col style={{ width: '14%' }} />
                </colgroup>
                <thead>
                  <tr style={{ backgroundColor: '#93c5d8' }}>
                    <th className={thStyle}>Chỉ tiêu</th>
                    <th className={thRStyle}>SL</th>
                    <th className={thRStyle}>Tiền mặt</th>
                    <th className={thRStyle}>CK</th>
                    <th className={thRStyle}>Thẻ</th>
                    <th className={thRStyle}>Ví</th>
                    <th className={thRStyle}>Điểm</th>
                    <th className={thRStyle}>Voucher</th>
                    <th className={thRStyle}>Tổng</th>
                    <th className={thRStyle}>Thừa TK</th>
                    <th className={thRStyle}>Thực thu</th>
                  </tr>
                </thead>
                <tbody>
                  {/* Dòng tổng */}
                  <tr style={{ backgroundColor: '#f5f0dc' }}>
                    <td className={grpTdStyle}></td>
                    <td className={grpTdRStyle}>{filteredOrders.length}</td>
                    <td className={grpTdRStyle}>{fmt(generalSummary.payments.cash)}</td>
                    <td className={grpTdRStyle}>{fmt(generalSummary.payments.bank)}</td>
                    <td className={grpTdRStyle}>{fmt(generalSummary.payments.card)}</td>
                    <td className={grpTdRStyle}>{fmt(generalSummary.payments.wallet)}</td>
                    <td className={grpTdRStyle}>0</td>
                    <td className={grpTdRStyle}>0</td>
                    <td className={grpTdRStyle}>{fmt(totalAllOrders)}</td>
                    <td className={grpTdRStyle}>0</td>
                    <td className={`${grpTdRStyle} text-blue-600`}>{fmt(overallThucthu)}</td>
                  </tr>

                  {/* Hóa đơn */}
                  <tr>
                    <td className={`${tdStyle} font-bold text-blue-600`}>Hóa đơn</td>
                    <td className={tdRStyle}>{salesSummary.count}</td>
                    <td className={tdRStyle}>{fmt(generalSummary.payments.cash)}</td>
                    <td className={tdRStyle}>{fmt(generalSummary.payments.bank)}</td>
                    <td className={tdRStyle}>{fmt(generalSummary.payments.card)}</td>
                    <td className={tdRStyle}>{fmt(generalSummary.payments.wallet)}</td>
                    <td className={tdRStyle}>0</td>
                    <td className={tdRStyle}>0</td>
                    <td className={tdRStyle}>{fmt(salesSummary.revenue)}</td>
                    <td className={tdRStyle}>0</td>
                    <td className={`${tdRStyle} font-bold`}>{fmt(newThucthu)}</td>
                  </tr>

                  {/* Trả hàng */}
                  {returnSummary.count > 0 && (
                    <tr>
                      <td className={`${tdStyle} font-bold text-rose-500`}>Trả hàng</td>
                      <td className={tdRStyle}>{returnSummary.count}</td>
                      <td className={tdRStyle}>0</td>
                      <td className={tdRStyle}>0</td>
                      <td className={tdRStyle}>0</td>
                      <td className={tdRStyle}>0</td>
                      <td className={tdRStyle}>0</td>
                      <td className={tdRStyle}>0</td>
                      <td className={`${tdRStyle} text-rose-500`}>{fmt(returnTraHang)}</td>
                      <td className={tdRStyle}>0</td>
                      <td className={tdRStyle}></td>
                    </tr>
                  )}

                  {/* Dịch vụ */}
                  <tr>
                    <td className={`${tdStyle} text-slate-400`}>Dịch vụ</td>
                    <td className={tdRStyle}>0</td>
                    <td className={tdRStyle}>0</td>
                    <td className={tdRStyle}>0</td>
                    <td className={tdRStyle}>0</td>
                    <td className={tdRStyle}>0</td>
                    <td className={tdRStyle}>0</td>
                    <td className={tdRStyle}>0</td>
                    <td className={tdRStyle}>0</td>
                    <td className={tdRStyle}>0</td>
                    <td className={tdRStyle}>0</td>
                  </tr>

                  {/* Section nhân viên */}
                  {staffSalesSummary.length > 0 && (
                    <>
                      <tr style={{ backgroundColor: '#e2e8f0' }}>
                        <td colSpan={11} className="border border-slate-300 px-3 py-1.5 text-xs font-bold text-slate-600">
                          Doanh số nhân viên
                        </td>
                      </tr>
                      {staffSalesSummary.map(row => (
                        <tr key={row.employeeId}>
                          <td className={`${tdStyle} pl-5 text-slate-700`}>{row.employeeName}</td>
                          <td className={tdRStyle}>{row.orderCount}</td>
                          <td className={tdRStyle}></td>
                          <td className={tdRStyle}></td>
                          <td className={tdRStyle}></td>
                          <td className={tdRStyle}></td>
                          <td className={tdRStyle}></td>
                          <td className={tdRStyle}></td>
                          <td className={`${tdRStyle} text-blue-600`}>{fmt(row.salesAmount)}</td>
                          <td className={tdRStyle}></td>
                          <td className={`${tdRStyle} font-bold text-blue-600`}>{fmt(row.salesAmount)}</td>
                        </tr>
                      ))}
                    </>
                  )}
                </tbody>
              </table>
            ) : (
              <>
            {/* Table Chi tiết — 12 cột */}
            <table className="w-full border-collapse text-xs">
              <colgroup>
                <col style={{ width: '13%' }} /><col style={{ width: '9%' }} />
                <col style={{ width: '8%' }} /><col style={{ width: '6%' }} />
                <col style={{ width: '4%' }} /><col style={{ width: '10%' }} />
                <col style={{ width: '5%' }} /><col style={{ width: '10%' }} />
                <col style={{ width: '7%' }} /><col style={{ width: '4%' }} />
                <col style={{ width: '7%' }} /><col style={{ width: '9%' }} />
              </colgroup>
              <thead>
                <tr style={{ backgroundColor: '#93c5d8' }}>
                  <th className={thStyle}>Mã chứng từ</th>
                  <th className={thStyle}>Khách hàng</th>
                  <th className={thStyle}>Nhân viên</th>
                  <th className={thStyle}>Thời gian</th>
                  <th className={thRStyle}>SL</th>
                  <th className={thRStyle}>Tổng tiền hàng</th>
                  <th className={thRStyle}>Dịch vụ</th>
                  <th className={thRStyle}>Doanh thu</th>
                  <th className={thRStyle}>Giảm giá</th>
                  <th className={thRStyle}>VAT</th>
                  <th className={thRStyle}>Tiền trả khách</th>
                  <th className={thRStyle}>Thực thu</th>
                </tr>
              </thead>
              <tbody>
                {/* ── Level 1: Hóa đơn (tất cả) ── */}
                {filteredOrders.length > 0 && (
                  <>
                    <tr style={{ backgroundColor: '#f5f0dc' }} className="cursor-pointer hover:brightness-95"
                        onClick={() => toggleGroup('invoice')}>
                      <td className={grpTdStyle} colSpan={4}>
                        <span className="inline-flex items-center gap-1">
                          {expandedGroups.has('invoice') ? <ChevronDown className="w-3 h-3 shrink-0"/> : <ChevronRight className="w-3 h-3 shrink-0"/>}
                          Hóa đơn: {filteredOrders.length}
                        </span>
                      </td>
                      <td className={grpTdRStyle}>{allQty}</td>
                      <td className={grpTdRStyle}>{fmt(totalAllOrders)}</td>
                      <td className={grpTdRStyle}>0</td>
                      <td className={grpTdRStyle}>{fmt(newDoanhThu)}</td>
                      <td className={`${grpTdRStyle} ${salesDiscount > 0 ? 'text-rose-600' : ''}`}>{salesDiscount > 0 ? `-${fmt(salesDiscount)}` : '0'}</td>
                      <td className={grpTdRStyle}>0</td>
                      <td className={grpTdRStyle}>0</td>
                      <td className={`${grpTdRStyle} text-blue-600`}>{fmt(newThucthu)}</td>
                    </tr>

                    {/* ── Level 2: Sub-group theo PTTT ── */}
                    {expandedGroups.has('invoice') && Array.from(ordersByMethod.entries()).map(([method, methodOrders]) => {
                      const ms  = methodSummaries.get(method)!;
                      const key = `method-${method}`;
                      return (
                        <React.Fragment key={method}>
                          <tr style={{ backgroundColor: '#f0f4f8' }} className="cursor-pointer hover:brightness-95"
                              onClick={() => toggleGroup(key)}>
                            <td className={grpTdStyle} colSpan={4} style={{ paddingLeft: '28px' }}>
                              <span className="inline-flex items-center gap-1">
                                {expandedGroups.has(key) ? <ChevronDown className="w-3 h-3 shrink-0"/> : <ChevronRight className="w-3 h-3 shrink-0"/>}
                                {methodDisplayName(method)}
                              </span>
                            </td>
                            <td className={grpTdRStyle}>{ms.qty}</td>
                            <td className={grpTdRStyle}>{fmt(ms.totienHang)}</td>
                            <td className={grpTdRStyle}>0</td>
                            <td className={grpTdRStyle}>{fmt(ms.doanhThu)}</td>
                            <td className={`${grpTdRStyle} ${ms.giamGia > 0 ? 'text-rose-600' : ''}`}>{ms.giamGia > 0 ? `-${fmt(ms.giamGia)}` : '0'}</td>
                            <td className={grpTdRStyle}>0</td>
                            <td className={grpTdRStyle}>0</td>
                            <td className={grpTdRStyle}>{fmt(ms.thucThu)}</td>
                          </tr>

                          {/* ── Level 3: Từng đơn ── */}
                          {expandedGroups.has(key) && methodOrders.map(order => {
                            const d      = orderDisplayMap.get(order.id)!;
                            const isRet  = !!order.isReturn;
                            const retAmt = Math.abs(order.totalAmount);
                            return (
                              <tr key={order.id} className={isRet ? 'hover:bg-rose-50/40' : 'hover:bg-slate-50'}>
                                <td className={`${tdStyle} pl-12 font-mono ${isRet ? 'text-rose-500' : 'text-indigo-600'}`}>{order.orderCode}</td>
                                <td className={`${tdStyle} text-slate-500 truncate`}>{fmtCustomer(order.customerName)}</td>
                                <td className={`${tdStyle} text-slate-500 truncate`}>{d.staffName}</td>
                                <td className={`${tdStyle} text-slate-400`}>{d.time}</td>
                                <td className={tdRStyle}>{d.qty}</td>
                                <td className={`${tdRStyle} ${isRet ? 'text-rose-500' : ''}`}>{isRet ? fmt(retAmt) : fmt(order.totalAmount)}</td>
                                <td className={tdRStyle}>0</td>
                                <td className={`${tdRStyle} ${isRet ? 'text-rose-500' : ''}`}>{isRet ? '0' : fmt(calcOrderRevenue(order))}</td>
                                <td className={`${tdRStyle} ${d.disc > 0 ? 'text-rose-500' : ''}`}>{d.disc > 0 ? `-${fmt(d.disc)}` : ''}</td>
                                <td className={tdRStyle}>0</td>
                                <td className={tdRStyle}>0</td>
                                <td className={tdRStyle}>{isRet ? '' : fmt(order.finalAmount)}</td>
                              </tr>
                            );
                          })}
                        </React.Fragment>
                      );
                    })}
                  </>
                )}

                {/* ── Trả hàng group (riêng biệt) ── */}
                {returnSummary.count > 0 && (
                  <>
                    <tr style={{ backgroundColor: '#f5f0dc' }} className="cursor-pointer hover:brightness-95"
                        onClick={() => toggleGroup('return')}>
                      <td className={grpTdStyle} colSpan={4}>
                        <span className="inline-flex items-center gap-1">
                          {expandedGroups.has('return') ? <ChevronDown className="w-3 h-3 shrink-0"/> : <ChevronRight className="w-3 h-3 shrink-0"/>}
                          Trả hàng: {returnSummary.count}
                        </span>
                      </td>
                      <td className={grpTdRStyle}>{returnSummary.qty}</td>
                      <td className={`${grpTdRStyle} text-rose-600`}>{fmt(returnTraHang)}</td>
                      <td className={grpTdRStyle}>0</td>
                      <td className={grpTdRStyle}>0</td>
                      <td className={grpTdRStyle}>0</td>
                      <td className={grpTdRStyle}>0</td>
                      <td className={grpTdRStyle}>0</td>
                      <td className={grpTdRStyle}></td>
                    </tr>
                    {expandedGroups.has('return') && returnOrders.map(order => {
                      const d      = orderDisplayMap.get(order.id)!;
                      const retAmt = Math.abs(order.totalAmount);
                      return (
                        <tr key={order.id} className="hover:bg-rose-50/40">
                          <td className={`${tdStyle} pl-8 font-mono text-rose-500`}>{order.orderCode}</td>
                          <td className={`${tdStyle} text-slate-500 truncate`}>{fmtCustomer(order.customerName)}</td>
                          <td className={`${tdStyle} text-slate-500 truncate`}>{d.staffName}</td>
                          <td className={`${tdStyle} text-slate-400`}>{d.time}</td>
                          <td className={tdRStyle}>{d.qty}</td>
                          <td className={`${tdRStyle} text-rose-500`}>{fmt(retAmt)}</td>
                          <td className={tdRStyle}>0</td>
                          <td className={tdRStyle}>0</td>
                          <td className={tdRStyle}>0</td>
                          <td className={tdRStyle}>0</td>
                          <td className={tdRStyle}>0</td>
                          <td className={tdRStyle}></td>
                        </tr>
                      );
                    })}
                  </>
                )}

                {/* Empty state */}
                {filteredOrders.length === 0 && (
                  <tr>
                    <td colSpan={12} className="border border-slate-200 px-3 py-10 text-center text-slate-400 text-xs italic">
                      Không có giao dịch nào trong ngày {dateStr}
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
              </>
            )}
          </div>
      </div>
    </div>
  );

  if (embedded) return inner;
  return (
    <div className="fixed inset-0 bg-slate-950/60 backdrop-blur-sm z-modal flex items-center justify-center p-6">
      {inner}
    </div>
  );
};

export default EndOfDayReport;
