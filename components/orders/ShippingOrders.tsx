import React, { useState } from 'react';
import { FileText, Plus, Search, Package, Truck, CheckCircle } from 'lucide-react';

export default function ShippingOrders() {
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState<'all' | 'pending' | 'shipping' | 'delivered'>('all');

  // Placeholder data
  const shippingOrders: any[] = [];

  return (
    <div className="p-6 max-w-7xl mx-auto">
      <div className="mb-6">
        <div className="flex items-center justify-between mb-2">
          <div className="flex items-center gap-3">
            <FileText className="w-8 h-8 text-cyan-600" />
            <div>
              <h1 className="text-2xl font-bold text-gray-900">Vận đơn</h1>
              <p className="text-gray-600">Quản lý vận đơn giao hàng</p>
            </div>
          </div>
          <button className="flex items-center gap-2 px-4 py-2 bg-cyan-600 text-white rounded-lg hover:bg-cyan-700 transition-colors">
            <Plus className="w-5 h-5" />
            Tạo vận đơn
          </button>
        </div>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-6">
        <div className="bg-white rounded-lg shadow p-4 border border-gray-200">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-gray-600">Chờ lấy hàng</p>
              <p className="text-2xl font-bold text-yellow-600">0</p>
            </div>
            <Package className="w-8 h-8 text-yellow-500" />
          </div>
        </div>
        <div className="bg-white rounded-lg shadow p-4 border border-gray-200">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-gray-600">Đang giao</p>
              <p className="text-2xl font-bold text-blue-600">0</p>
            </div>
            <Truck className="w-8 h-8 text-blue-500" />
          </div>
        </div>
        <div className="bg-white rounded-lg shadow p-4 border border-gray-200">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-gray-600">Đã giao</p>
              <p className="text-2xl font-bold text-green-600">0</p>
            </div>
            <CheckCircle className="w-8 h-8 text-green-500" />
          </div>
        </div>
        <div className="bg-white rounded-lg shadow p-4 border border-gray-200">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-gray-600">Tổng vận đơn</p>
              <p className="text-2xl font-bold text-gray-900">0</p>
            </div>
            <FileText className="w-8 h-8 text-gray-500" />
          </div>
        </div>
      </div>

      {/* Filters */}
      <div className="bg-white rounded-lg shadow mb-6 p-4 border border-gray-200">
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 w-4 h-4 text-gray-400" />
            <input
              type="text"
              placeholder="Tìm mã vận đơn, khách hàng..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-cyan-500 focus:border-transparent"
            />
          </div>
          <select
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value as any)}
            className="px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-cyan-500 focus:border-transparent"
          >
            <option value="all">Tất cả trạng thái</option>
            <option value="pending">Chờ lấy hàng</option>
            <option value="shipping">Đang giao</option>
            <option value="delivered">Đã giao</option>
          </select>
        </div>
      </div>

      {/* Shipping Orders List */}
      <div className="bg-white rounded-lg shadow border border-gray-200">
        <div className="p-12 text-center text-gray-500">
          <FileText className="w-16 h-16 mx-auto mb-4 text-gray-300" />
          <h3 className="text-lg font-semibold text-gray-700 mb-2">Tính năng đang phát triển</h3>
          <p className="text-sm mb-4">
            Chức năng quản lý vận đơn sẽ được bổ sung trong phiên bản tiếp theo.
          </p>
          <div className="inline-block text-left bg-gray-50 rounded-lg p-4 border border-gray-200">
            <p className="text-sm font-medium text-gray-700 mb-2">Tính năng sẽ bao gồm:</p>
            <ul className="text-sm text-gray-600 space-y-1">
              <li>• Tạo và quản lý vận đơn</li>
              <li>• Theo dõi trạng thái giao hàng real-time</li>
              <li>• Tích hợp với đối tác vận chuyển</li>
              <li>• In phiếu giao hàng</li>
              <li>• Báo cáo hiệu suất giao hàng</li>
              <li>• Thông báo cho khách hàng</li>
            </ul>
          </div>
        </div>
      </div>
    </div>
  );
}
