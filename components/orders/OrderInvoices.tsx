import React, { useState, useMemo } from 'react';
import { FileText, Search, Calendar, DollarSign, User, Download, Eye, Filter } from 'lucide-react';
import { AppData } from '../../types';

interface OrderInvoicesProps {
  orders: AppData['posOrders'];
  customers: AppData['posCustomers'];
  storeName: string;
}

export default function OrderInvoices({ orders, customers, storeName }: OrderInvoicesProps) {
  const [searchTerm, setSearchTerm] = useState('');
  const [dateFilter, setDateFilter] = useState<'all' | 'today' | 'week' | 'month'>('all');
  const [paymentFilter, setPaymentFilter] = useState<string>('all');
  const [selectedInvoice, setSelectedInvoice] = useState<string | null>(null);

  const today = new Date().toISOString().split('T')[0];
  const weekAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString().split('T')[0];
  const monthAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString().split('T')[0];

  const filteredOrders = useMemo(() => {
    return orders.filter(order => {
      // Search filter
      const matchesSearch = 
        order.orderCode.toLowerCase().includes(searchTerm.toLowerCase()) ||
        order.customerName?.toLowerCase().includes(searchTerm.toLowerCase()) ||
        order.notes?.toLowerCase().includes(searchTerm.toLowerCase());

      // Date filter
      let matchesDate = true;
      if (dateFilter === 'today') matchesDate = order.date >= today;
      else if (dateFilter === 'week') matchesDate = order.date >= weekAgo;
      else if (dateFilter === 'month') matchesDate = order.date >= monthAgo;

      // Payment filter
      const matchesPayment = paymentFilter === 'all' || order.paymentMethod === paymentFilter;

      return matchesSearch && matchesDate && matchesPayment;
    }).sort((a, b) => b.date.localeCompare(a.date));
  }, [orders, searchTerm, dateFilter, paymentFilter, today, weekAgo, monthAgo]);

  const stats = useMemo(() => {
    const total = filteredOrders.reduce((sum, o) => sum + (o.finalAmount || 0), 0);
    const count = filteredOrders.length;
    const avgOrder = count > 0 ? total / count : 0;
    
    const byPayment = filteredOrders.reduce((acc, o) => {
      const method = o.paymentMethod || 'Tiền mặt';
      acc[method] = (acc[method] || 0) + (o.finalAmount || 0);
      return acc;
    }, {} as Record<string, number>);

    return { total, count, avgOrder, byPayment };
  }, [filteredOrders]);

  const handlePrintInvoice = (orderId: string) => {
    const order = orders.find(o => o.id === orderId);
    if (!order) return;

    const printWindow = window.open('', '_blank');
    if (!printWindow) return;

    const customer = customers.find(c => c.id === order.customerId);
    const invoiceHtml = `
      <!DOCTYPE html>
      <html>
      <head>
        <meta charset="utf-8">
        <title>Hóa đơn ${order.orderCode}</title>
        <style>
          body { font-family: Arial, sans-serif; padding: 20px; max-width: 800px; margin: 0 auto; }
          .header { text-align: center; margin-bottom: 30px; border-bottom: 2px solid #333; padding-bottom: 20px; }
          .header h1 { margin: 0; font-size: 24px; }
          .header p { margin: 5px 0; color: #666; }
          .info { display: flex; justify-content: space-between; margin-bottom: 20px; }
          .info-block { flex: 1; }
          .info-block h3 { margin: 0 0 10px 0; font-size: 14px; color: #666; }
          .info-block p { margin: 5px 0; }
          table { width: 100%; border-collapse: collapse; margin: 20px 0; }
          th, td { padding: 12px; text-align: left; border-bottom: 1px solid #ddd; }
          th { background: #f5f5f5; font-weight: bold; }
          .text-right { text-align: right; }
          .totals { margin-top: 20px; text-align: right; }
          .totals div { margin: 8px 0; }
          .totals .final { font-size: 18px; font-weight: bold; color: #4f46e5; }
          .footer { margin-top: 40px; text-align: center; color: #666; font-size: 12px; }
          @media print {
            body { padding: 0; }
            button { display: none; }
          }
        </style>
      </head>
      <body>
        <div class="header">
          <h1>${storeName || 'Cửa hàng'}</h1>
          <p>HÓA ĐƠN BÁN HÀNG</p>
          <p>Số: ${order.orderCode}</p>
        </div>
        
        <div class="info">
          <div class="info-block">
            <h3>Thông tin khách hàng</h3>
            <p><strong>Tên:</strong> ${order.customerName || 'Khách lẻ'}</p>
            ${customer?.phone ? `<p><strong>SĐT:</strong> ${customer.phone}</p>` : ''}
            ${customer?.address ? `<p><strong>Địa chỉ:</strong> ${customer.address}</p>` : ''}
          </div>
          <div class="info-block">
            <h3>Thông tin hóa đơn</h3>
            <p><strong>Ngày:</strong> ${new Date(order.date).toLocaleDateString('vi-VN')}</p>
            <p><strong>Nhân viên:</strong> ${order.staffId || 'N/A'}</p>
            <p><strong>Thanh toán:</strong> ${order.paymentMethod || 'Tiền mặt'}</p>
          </div>
        </div>

        <table>
          <thead>
            <tr>
              <th>STT</th>
              <th>Sản phẩm</th>
              <th class="text-right">Số lượng</th>
              <th class="text-right">Đơn giá</th>
              <th class="text-right">Thành tiền</th>
            </tr>
          </thead>
          <tbody>
            ${order.items.map((item, idx) => `
              <tr>
                <td>${idx + 1}</td>
                <td>${item.name}</td>
                <td class="text-right">${item.quantity}</td>
                <td class="text-right">${item.price.toLocaleString('vi-VN')}đ</td>
                <td class="text-right">${(item.quantity * item.price).toLocaleString('vi-VN')}đ</td>
              </tr>
            `).join('')}
          </tbody>
        </table>

        <div class="totals">
          <div>Tổng tiền hàng: <strong>${(order.totalAmount || 0).toLocaleString('vi-VN')}đ</strong></div>
          ${order.discount ? `<div>Giảm giá: <strong>-${order.discount.toLocaleString('vi-VN')}đ</strong></div>` : ''}
          <div class="final">Tổng thanh toán: ${(order.finalAmount || 0).toLocaleString('vi-VN')}đ</div>
          ${order.pointsEarned ? `<div style="color: #10b981;">Điểm tích lũy: +${order.pointsEarned}</div>` : ''}
        </div>

        ${order.notes ? `<div style="margin-top: 20px; padding: 15px; background: #f9fafb; border-radius: 8px;"><strong>Ghi chú:</strong> ${order.notes}</div>` : ''}

        <div class="footer">
          <p>Cảm ơn quý khách đã mua hàng!</p>
          <p>In lúc: ${new Date().toLocaleString('vi-VN')}</p>
        </div>

        <div style="text-align: center; margin-top: 20px;">
          <button onclick="window.print()" style="padding: 10px 20px; background: #4f46e5; color: white; border: none; border-radius: 6px; cursor: pointer; font-size: 14px;">In hóa đơn</button>
        </div>
      </body>
      </html>
    `;

    printWindow.document.write(invoiceHtml);
    printWindow.document.close();
  };

  const handleExportInvoices = () => {
    const csvContent = [
      ['Mã hóa đơn', 'Ngày', 'Khách hàng', 'Tổng tiền', 'Giảm giá', 'Thanh toán', 'Phương thức', 'Nhân viên'].join(','),
      ...filteredOrders.map(o => [
        o.orderCode,
        o.date,
        o.customerName || 'Khách lẻ',
        o.totalAmount || 0,
        o.discount || 0,
        o.finalAmount || 0,
        o.paymentMethod || 'Tiền mặt',
        o.staffId || 'N/A'
      ].join(','))
    ].join('\n');

    const blob = new Blob(['\uFEFF' + csvContent], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement('a');
    link.href = URL.createObjectURL(blob);
    link.download = `hoa-don-${new Date().toISOString().split('T')[0]}.csv`;
    link.click();
  };

  return (
    <div className="p-6 max-w-7xl mx-auto">
      {/* Header */}
      <div className="mb-6">
        <div className="flex items-center gap-3 mb-2">
          <FileText className="w-8 h-8 text-indigo-600" />
          <h1 className="text-2xl font-bold text-gray-900">Hóa đơn bán hàng</h1>
        </div>
        <p className="text-gray-600">Quản lý và tra cứu hóa đơn</p>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-6">
        <div className="bg-white rounded-lg shadow p-4 border border-gray-200">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-gray-600">Tổng hóa đơn</p>
              <p className="text-2xl font-bold text-gray-900">{stats.count}</p>
            </div>
            <FileText className="w-8 h-8 text-blue-500" />
          </div>
        </div>
        <div className="bg-white rounded-lg shadow p-4 border border-gray-200">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-gray-600">Tổng doanh thu</p>
              <p className="text-2xl font-bold text-green-600">{stats.total.toLocaleString('vi-VN')}đ</p>
            </div>
            <DollarSign className="w-8 h-8 text-green-500" />
          </div>
        </div>
        <div className="bg-white rounded-lg shadow p-4 border border-gray-200">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-gray-600">Trung bình/đơn</p>
              <p className="text-2xl font-bold text-indigo-600">{Math.round(stats.avgOrder).toLocaleString('vi-VN')}đ</p>
            </div>
            <User className="w-8 h-8 text-indigo-500" />
          </div>
        </div>
        <div className="bg-white rounded-lg shadow p-4 border border-gray-200">
          <div>
            <p className="text-sm text-gray-600 mb-2">Theo phương thức</p>
            {Object.entries(stats.byPayment).map(([method, amount]) => (
              <div key={method} className="flex justify-between text-xs mb-1">
                <span className="text-gray-600">{method}:</span>
                <span className="font-semibold">{amount.toLocaleString('vi-VN')}đ</span>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Filters */}
      <div className="bg-white rounded-lg shadow mb-6 p-4 border border-gray-200">
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 w-4 h-4 text-gray-400" />
            <input
              type="text"
              placeholder="Tìm mã HĐ, khách hàng..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-transparent"
            />
          </div>
          <select
            value={dateFilter}
            onChange={(e) => setDateFilter(e.target.value as any)}
            className="px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-transparent"
          >
            <option value="all">Tất cả thời gian</option>
            <option value="today">Hôm nay</option>
            <option value="week">7 ngày qua</option>
            <option value="month">30 ngày qua</option>
          </select>
          <select
            value={paymentFilter}
            onChange={(e) => setPaymentFilter(e.target.value)}
            className="px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-transparent"
          >
            <option value="all">Tất cả phương thức</option>
            <option value="Tiền mặt">Tiền mặt</option>
            <option value="Chuyển khoản">Chuyển khoản</option>
            <option value="Thẻ">Thẻ</option>
            <option value="Momo">Momo</option>
          </select>
          <button
            onClick={handleExportInvoices}
            className="flex items-center justify-center gap-2 px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 transition-colors"
          >
            <Download className="w-4 h-4" />
            Xuất Excel
          </button>
        </div>
      </div>

      {/* Invoice List */}
      <div className="bg-white rounded-lg shadow border border-gray-200 overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead className="bg-gray-50 border-b border-gray-200">
              <tr>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Mã HĐ</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Ngày</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Khách hàng</th>
                <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">Tổng tiền</th>
                <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">Giảm giá</th>
                <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">Thanh toán</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">PT Thanh toán</th>
                <th className="px-6 py-3 text-center text-xs font-medium text-gray-500 uppercase tracking-wider">Thao tác</th>
              </tr>
            </thead>
            <tbody className="bg-white divide-y divide-gray-200">
              {filteredOrders.length === 0 ? (
                <tr>
                  <td colSpan={8} className="px-6 py-12 text-center text-gray-500">
                    <FileText className="w-12 h-12 mx-auto mb-3 text-gray-300" />
                    <p>Không tìm thấy hóa đơn nào</p>
                  </td>
                </tr>
              ) : (
                filteredOrders.map((order) => (
                  <tr key={order.id} className="hover:bg-gray-50 transition-colors">
                    <td className="px-6 py-4 whitespace-nowrap">
                      <span className="font-mono text-sm font-semibold text-indigo-600">{order.orderCode}</span>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                      {new Date(order.date).toLocaleDateString('vi-VN')}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                      {order.customerName || 'Khách lẻ'}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-right text-gray-900">
                      {(order.totalAmount || 0).toLocaleString('vi-VN')}đ
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-right text-red-600">
                      {order.discount ? `-${order.discount.toLocaleString('vi-VN')}đ` : '-'}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-right font-semibold text-green-600">
                      {(order.finalAmount || 0).toLocaleString('vi-VN')}đ
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                      <span className="px-2 py-1 bg-gray-100 rounded text-xs">
                        {order.paymentMethod || 'Tiền mặt'}
                      </span>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-center">
                      <button
                        onClick={() => handlePrintInvoice(order.id)}
                        className="inline-flex items-center gap-1 px-3 py-1 bg-indigo-600 text-white text-xs rounded hover:bg-indigo-700 transition-colors"
                      >
                        <Eye className="w-3 h-3" />
                        Xem & In
                      </button>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
