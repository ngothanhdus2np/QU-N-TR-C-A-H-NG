import React, { useState } from 'react';
import { Bike, Plus, Search, Phone, MapPin, Star } from 'lucide-react';

export default function DeliveryPartners() {
  const [searchTerm, setSearchTerm] = useState('');

  // Placeholder data
  const partners: any[] = [];

  return (
    <div className="p-6 max-w-7xl mx-auto">
      <div className="mb-6">
        <div className="flex items-center justify-between mb-2">
          <div className="flex items-center gap-3">
            <Bike className="w-8 h-8 text-green-600" />
            <div>
              <h1 className="text-2xl font-bold text-gray-900">Đối tác giao hàng</h1>
              <p className="text-gray-600">Quản lý thông tin đối tác vận chuyển</p>
            </div>
          </div>
          <button className="flex items-center gap-2 px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 transition-colors">
            <Plus className="w-5 h-5" />
            Thêm đối tác
          </button>
        </div>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-6">
        <div className="bg-white rounded-lg shadow p-4 border border-gray-200">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-gray-600">Tổng đối tác</p>
              <p className="text-2xl font-bold text-gray-900">0</p>
            </div>
            <Bike className="w-8 h-8 text-green-500" />
          </div>
        </div>
        <div className="bg-white rounded-lg shadow p-4 border border-gray-200">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-gray-600">Đang hoạt động</p>
              <p className="text-2xl font-bold text-green-600">0</p>
            </div>
            <Star className="w-8 h-8 text-yellow-500" />
          </div>
        </div>
        <div className="bg-white rounded-lg shadow p-4 border border-gray-200">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-gray-600">Đơn hàng tháng này</p>
              <p className="text-2xl font-bold text-blue-600">0</p>
            </div>
            <MapPin className="w-8 h-8 text-blue-500" />
          </div>
        </div>
        <div className="bg-white rounded-lg shadow p-4 border border-gray-200">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-gray-600">Chi phí vận chuyển</p>
              <p className="text-2xl font-bold text-red-600">0đ</p>
            </div>
            <Phone className="w-8 h-8 text-red-500" />
          </div>
        </div>
      </div>

      {/* Search */}
      <div className="bg-white rounded-lg shadow mb-6 p-4 border border-gray-200">
        <div className="relative">
          <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 w-4 h-4 text-gray-400" />
          <input
            type="text"
            placeholder="Tìm tên đối tác, số điện thoại..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-green-500 focus:border-transparent"
          />
        </div>
      </div>

      {/* Partner List */}
      <div className="bg-white rounded-lg shadow border border-gray-200">
        <div className="p-12 text-center text-gray-500">
          <Bike className="w-16 h-16 mx-auto mb-4 text-gray-300" />
          <h3 className="text-lg font-semibold text-gray-700 mb-2">Tính năng đang phát triển</h3>
          <p className="text-sm mb-4">
            Chức năng quản lý đối tác giao hàng sẽ được bổ sung trong phiên bản tiếp theo.
          </p>
          <div className="inline-block text-left bg-gray-50 rounded-lg p-4 border border-gray-200">
            <p className="text-sm font-medium text-gray-700 mb-2">Tính năng sẽ bao gồm:</p>
            <ul className="text-sm text-gray-600 space-y-1">
              <li>• Quản lý thông tin đối tác (Grab, Gojek, Ahamove, ...)</li>
              <li>• Theo dõi chi phí vận chuyển</li>
              <li>• Đánh giá hiệu suất giao hàng</li>
              <li>• Tích hợp API đặt đơn tự động</li>
              <li>• Báo cáo chi phí theo đối tác</li>
            </ul>
          </div>
        </div>
      </div>
    </div>
  );
}
