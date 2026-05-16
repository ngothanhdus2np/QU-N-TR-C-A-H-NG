import React, { useState, useMemo } from 'react';
import { Receipt, Search, Download, Eye, Filter, TrendingUp } from 'lucide-react';
import { AppData } from '../../types';

interface PurchaseInvoicesProps {
  transactions: AppData['inventoryTransactions'];
  suppliers: AppData['suppliers'];
  supplierDebts: AppData['supplierDebts'];
}

export default function PurchaseInvoices({ transactions, suppliers, supplierDebts }: PurchaseInvoicesProps) {
  const [searchTerm, setSearchTerm] = useState('');
  const [dateFilter, setDateFilter] = useState<'all' | 'today' | 'week' | 'month'>('all');
  const [supplierFilter, setSupplierFilter] = useState<string>('all');

  const today = new Date().toISOString().split('T')[0];
  const weekAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString().split('T')[0];
  const monthAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString().split('T')[0];

  const purchaseInvoices = useMemo(() => {
    return transactions
      .filter(t => t.type === 'Import')
      .filter(t => {
        const matchesSearch = 
          t.note?.toLowerCase().includes(searchTerm.toLowerCase()) ||
          t.supplierName?.toLowerCase().includes(searchTerm.toLowerCase()) ||
          t.id.toLowerCase().includes(searchTerm.toLowerCase());

        let matchesDate = true;
        if (dateFilter === 'today') matchesDate = t.date >= today;
        else if (dateFilter === 'week') matchesDate = t.date >= weekAgo;
        else if (dateFilter === 'month') matchesDate = t.date >= monthAgo;

        const matchesSupplier = supplierFilter === 'all' || t.supplierId === supplierFilter;

        return matchesSearch && matchesDate && matchesSupplier;
      })
      .sort((a, b) => b.date.localeCompare(a.date));
  }, [transactions, searchTerm, dateFilter, supplierFilter, today, weekAgo, monthAgo]);

  const stats = useMemo(() => {
    const total = purchaseInvoices.reduce((sum, t) => sum + (t.totalAmount || 0), 0);
    const count = purchaseInvoices.length;
    const totalItems = purchaseInvoices.reduce((sum, t) => sum + (t.items?.length || 0), 0);
    
    const bySupplier = purchaseInvoices.reduce((acc, t) => {
      const name = t.supplierName || 'Không rõ';
      acc[name] = (acc[name] || 0) + (t.totalAmount || 0);
      return acc;
    }, {} as Record<string, number>);

    const topSuppliers = Object.entries(bySupplier)
      .sort((a, b) => b[1] - a[1])
      .slice(0, 5);

    return { total, count, totalItems, topSuppliers };
  }, [purchaseInvoices]);

  const handleExport = () => {
    const csvContent = [
      ['Ngày', 'Nhà cung cấp', 'Số lượng SP', 'Tổng tiền', 'Trạng thái', 'Ghi chú'].join(','),
      ...purchaseInvoices.map(t => [
        t.date,
        t.supplierName || 'N/A',
        t.items?.length || 0,
        t.totalAmount || 0,
        t.status || 'completed',
        (t.note || '').replace(/,/g, ';')
      ].join(','))
    ].join('\n');

    const blob = new Blob(['\uFEFF' + csvContent], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement('a');
    link.href = URL.createObjectURL(blob);
    link.download = `hoa-don-nhap-hang-${new Date().toISOString().split('T')[0]}.csv`;
    link.click();
  };

  const handlePrintInvoice = (transaction: AppData['inventoryTransactions'][0]) => {
    const printWindow = window.open('', '_blank');
    if (!printWindow) return;

    const supplier = suppliers.find(s => s.id === transaction.supplierId);
    const invoiceHtml = `
      <!DOCTYPE html>
      <html>
      <head>
        <meta charset="utf-8">
        <title>Hóa đơn nhập hàng ${transaction.id.slice(0, 8)}</title>
        <style>
          body { font-family: Arial, sans-serif; padding: 20px; max-width: 800px; margin: 0 auto; }
          .header { text-align: center; margin-bottom: 30px; border-bottom: 2px solid #333; padding-bottom: 20px; }
          .header h1 { margin: 0; font-size: 24px; }
          .info { display: flex; justify-content: space-between; margin-bottom: 20px; }
          .info-block { flex: 1; }
          .info-block h3 { margin: 0 0 10px 0; font-size: 14px; color: #666; }
          .info-block p { margin: 5px 0; }
          table { width: 100%; border-collapse: collapse; margin: 20px 0; }
          th, td { padding: 12px; text-align: left; border-bottom: 1px solid #ddd; }
          th { background: #f5f5f5; font-weight: bold; }
          .text-right { text-align: right; }
          .totals { margin-top: 20px; text-align: right; }
          .totals .final { font-size: 18px; font-weight: bold; color: #4f46e5; }
          @media print { body { padding: 0; } button { display: none; } }
        </style>
      </head>
      <body>
        <div class="header">
          <h1>HÓA ĐƠN NHẬP HÀNG</h1>
          <p>Mã: ${transaction.id.slice(0, 8).toUpperCase()}</p>
        </div>
        
        <div class="info">
          <div class="info-block">
            <h3>Nhà cung cấp</h3>
            <p><strong>${transaction.supplierName || 'N/A'}</strong></p>
            ${supplier?.phone ? `<p>SĐT: ${supplier.phone}</p>` : ''}
            ${supplier?.address ? `<p>Địa chỉ: ${supplier.address}</p>` : ''}
          </div>
          <div class="info-block">
            <h3>Thông tin phiếu nhập</h3>
            <p><strong>Ngày:</strong> ${new Date(transaction.date).toLocaleDateString('vi-VN')}</p>
            <p><strong>Nhân viên:</strong> ${transaction.staffId || 'N/A'}</p>
            <p><strong>Trạng thái:</strong> ${transaction.status === 'completed' ? 'Hoàn thành' : 'Chưa thanh toán'}</p>
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
            ${(transaction.items || []).map((item, idx) => `
              <tr>
                <td>${idx + 1}</td>
                <td>${item.productName || item.productId}</td>
                <td class="text-right">${item.quantity}</td>
                <td class="text-right">${(item.price || 0).toLocaleString('vi-VN')}đ</td>
                <td class="text-right">${((item.quantity || 0) * (item.price || 0)).toLocaleString('vi-VN')}đ</td>
              </tr>
            `).join('')}
          </tbody>
        </table>

        <div class="totals">
          <div class="final">Tổng cộng: ${(transaction.totalAmount || 0).toLocaleString('vi-VN')}đ</div>
        </div>

        ${transaction.note ? `<div style="margin-top: 20px; padding: 15px; background: #f9fafb; border-radius: 8px;"><strong>Ghi chú:</strong> ${transaction.note}</div>` : ''}

        <div style="text-align: center; margin-top: 40px;">
          <button onclick="window.print()" style="padding: 10px 20px; background: #4f46e5; color: white; border: none; border-radius: 6px; cursor: pointer;">In hóa đơn</button>
        </div>
      </body>
      </html>
    `;

    printWindow.document.write(invoiceHtml);
    printWindow.document.close();
  };

  return (
    <div className="p-6 max-w-7xl mx-auto">
      <div className="mb-6">
        <div className="flex items-center gap-3 mb-2">
          <Receipt className="w-8 h-8 text-blue-600" />
          <h1 className="text-2xl font-bold text-gray-900">Hóa đơn đầu vào</h1>
        </div>
        <p className="text-gray-600">Quản lý hóa đơn nhập hàng từ nhà cung cấp</p>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-6">
        <div className="bg-white rounded-lg shadow p-4 border border-gray-200">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-gray-600">Tổng hóa đơn</p>
              <p className="text-2xl font-bold text-gray-900">{stats.count}</p>
            </div>
            <Receipt className="w-8 h-8 text-blue-500" />
          </div>
        </div>
        <div className="bg-white rounded-lg shadow p-4 border border-gray-200">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-gray-600">Tổng chi phí</p>
              <p className="text-2xl font-bold text-red-600">{stats.total.toLocaleString('vi-VN')}đ</p>
            </div>
            <TrendingUp className="w-8 h-8 text-red-500" />
          </div>
        </div>
        <div className="bg-white rounded-lg shadow p-4 border border-gray-200">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-gray-600">Tổng sản phẩm</p>
              <p className="text-2xl font-bold text-indigo-600">{stats.totalItems}</p>
            </div>
            <Filter className="w-8 h-8 text-indigo-500" />
          </div>
        </div>
        <div className="bg-white rounded-lg shadow p-4 border border-gray-200">
          <div>
            <p className="text-sm text-gray-600 mb-2">Top NCC</p>
            {stats.topSuppliers.slice(0, 3).map(([name, amount]) => (
              <div key={name} className="flex justify-between text-xs mb-1">
                <span className="text-gray-600 truncate max-w-[120px]">{name}:</span>
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
              placeholder="Tìm NCC, ghi chú..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
            />
          </div>
          <select
            value={dateFilter}
            onChange={(e) => setDateFilter(e.target.value as any)}
            className="px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
          >
            <option value="all">Tất cả thời gian</option>
            <option value="today">Hôm nay</option>
            <option value="week">7 ngày qua</option>
            <option value="month">30 ngày qua</option>
          </select>
          <select
            value={supplierFilter}
            onChange={(e) => setSupplierFilter(e.target.value)}
            className="px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
          >
            <option value="all">Tất cả NCC</option>
            {suppliers.map(s => (
              <option key={s.id} value={s.id}>{s.name}</option>
            ))}
          </select>
          <button
            onClick={handleExport}
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
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Ngày</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Nhà cung cấp</th>
                <th className="px-6 py-3 text-center text-xs font-medium text-gray-500 uppercase">Số SP</th>
                <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase">Tổng tiền</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Trạng thái</th>
                <th className="px-6 py-3 text-center text-xs font-medium text-gray-500 uppercase">Thao tác</th>
              </tr>
            </thead>
            <tbody className="bg-white divide-y divide-gray-200">
              {purchaseInvoices.length === 0 ? (
                <tr>
                  <td colSpan={6} className="px-6 py-12 text-center text-gray-500">
                    <Receipt className="w-12 h-12 mx-auto mb-3 text-gray-300" />
                    <p>Không tìm thấy hóa đơn nào</p>
                  </td>
                </tr>
              ) : (
                purchaseInvoices.map((invoice) => (
                  <tr key={invoice.id} className="hover:bg-gray-50 transition-colors">
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                      {new Date(invoice.date).toLocaleDateString('vi-VN')}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <div>
                        <p className="text-sm font-medium text-gray-900">{invoice.supplierName || 'N/A'}</p>
                        {invoice.note && (
                          <p className="text-xs text-gray-500 truncate max-w-xs">{invoice.note}</p>
                        )}
                      </div>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-center text-sm text-gray-900">
                      {invoice.items?.length || 0}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-right font-semibold text-red-600">
                      {(invoice.totalAmount || 0).toLocaleString('vi-VN')}đ
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <span className={`px-2 py-1 text-xs rounded ${
                        invoice.status === 'completed' 
                          ? 'bg-green-100 text-green-800' 
                          : 'bg-yellow-100 text-yellow-800'
                      }`}>
                        {invoice.status === 'completed' ? 'Hoàn thành' : 'Chưa thanh toán'}
                      </span>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-center">
                      <button
                        onClick={() => handlePrintInvoice(invoice)}
                        className="inline-flex items-center gap-1 px-3 py-1 bg-blue-600 text-white text-xs rounded hover:bg-blue-700 transition-colors"
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
