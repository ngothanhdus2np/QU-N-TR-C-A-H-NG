import React, { useState, useMemo } from 'react';
import { PackageOpen, Plus, Search, Calendar, User, Save, X } from 'lucide-react';
import { AppData } from '../../types';

interface GoodsInternalUseProps {
  products: AppData['posProducts'];
  data: AppData;
  onUpdateSurgical: (updates: any[]) => Promise<void>;
}

interface InternalUseItem {
  productId: string;
  productName: string;
  quantity: number;
  currentStock: number;
}

export default function GoodsInternalUse({ products, data, onUpdateSurgical }: GoodsInternalUseProps) {
  const [isCreating, setIsCreating] = useState(false);
  const [selectedDate, setSelectedDate] = useState(new Date().toISOString().split('T')[0]);
  const [staffId, setStaffId] = useState('');
  const [purpose, setPurpose] = useState('');
  const [items, setItems] = useState<InternalUseItem[]>([]);
  const [searchTerm, setSearchTerm] = useState('');
  const [isSaving, setIsSaving] = useState(false);

  const internalUseTransactions = useMemo(() => {
    return (data.inventoryTransactions || [])
      .filter(t => t.type === 'internal_use')
      .sort((a, b) => b.date.localeCompare(a.date));
  }, [data.inventoryTransactions]);

  const availableProducts = useMemo(() => {
    return products
      .filter(p => !p.isParent && (p.stock || 0) > 0)
      .filter(p => 
        p.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
        p.sku?.toLowerCase().includes(searchTerm.toLowerCase())
      );
  }, [products, searchTerm]);

  const handleAddItem = (product: AppData['posProducts'][0]) => {
    if (items.find(i => i.productId === product.id)) {
      alert('Sản phẩm đã được thêm vào danh sách');
      return;
    }

    setItems([...items, {
      productId: product.id,
      productName: product.name,
      quantity: 1,
      currentStock: product.stock || 0
    }]);
    setSearchTerm('');
  };

  const handleUpdateQuantity = (productId: string, quantity: number) => {
    setItems(items.map(item => 
      item.productId === productId 
        ? { ...item, quantity: Math.min(Math.max(1, quantity), item.currentStock) }
        : item
    ));
  };

  const handleRemoveItem = (productId: string) => {
    setItems(items.filter(item => item.productId !== productId));
  };

  const handleSave = async () => {
    if (items.length === 0) {
      alert('Vui lòng thêm ít nhất 1 sản phẩm');
      return;
    }

    if (!purpose.trim()) {
      alert('Vui lòng nhập mục đích sử dụng');
      return;
    }

    setIsSaving(true);

    try {
      const updates: any[] = [];

      // Update product stock
      for (const item of items) {
        const product = products.find(p => p.id === item.productId);
        if (product) {
          updates.push({
            key: 'posProducts',
            item: {
              ...product,
              stock: (product.stock || 0) - item.quantity
            },
            isDelete: false
          });
        }
      }

      // Create internal use transaction
      const transaction = {
        id: crypto.randomUUID(),
        date: selectedDate,
        type: 'internal_use' as const,
        items: items.map(item => ({
          productId: item.productId,
          productName: item.productName,
          quantity: item.quantity,
          price: 0
        })),
        note: purpose,
        staffId: staffId || 'N/A',
        totalAmount: 0,
        status: 'completed'
      };

      updates.push({
        key: 'inventoryTransactions',
        item: transaction,
        isDelete: false
      });

      await onUpdateSurgical(updates);

      alert('Đã tạo phiếu xuất dùng nội bộ thành công!');
      
      // Reset form
      setIsCreating(false);
      setItems([]);
      setPurpose('');
      setStaffId('');
      setSelectedDate(new Date().toISOString().split('T')[0]);
    } catch (error) {
      console.error('Error creating internal use:', error);
      alert('Có lỗi xảy ra. Vui lòng thử lại.');
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <div className="p-6 max-w-7xl mx-auto">
      <div className="mb-6">
        <div className="flex items-center justify-between mb-2">
          <div className="flex items-center gap-3">
            <PackageOpen className="w-8 h-8 text-purple-600" />
            <div>
              <h1 className="text-2xl font-bold text-gray-900">Xuất dùng nội bộ</h1>
              <p className="text-gray-600">Quản lý hàng hóa sử dụng nội bộ</p>
            </div>
          </div>
          {!isCreating && (
            <button
              onClick={() => setIsCreating(true)}
              className="flex items-center gap-2 px-4 py-2 bg-purple-600 text-white rounded-lg hover:bg-purple-700 transition-colors"
            >
              <Plus className="w-5 h-5" />
              Tạo phiếu xuất
            </button>
          )}
        </div>
      </div>

      {isCreating ? (
        <div className="bg-white rounded-lg shadow border border-gray-200 p-6">
          <h2 className="text-lg font-semibold mb-4">Tạo phiếu xuất dùng nội bộ</h2>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Ngày xuất <span className="text-red-500">*</span>
              </label>
              <input
                type="date"
                value={selectedDate}
                onChange={(e) => setSelectedDate(e.target.value)}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-transparent"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Người nhận
              </label>
              <input
                type="text"
                value={staffId}
                onChange={(e) => setStaffId(e.target.value)}
                placeholder="Tên nhân viên"
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-transparent"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Mục đích <span className="text-red-500">*</span>
              </label>
              <input
                type="text"
                value={purpose}
                onChange={(e) => setPurpose(e.target.value)}
                placeholder="VD: Dùng cho văn phòng"
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-transparent"
              />
            </div>
          </div>

          <div className="mb-6">
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Tìm sản phẩm
            </label>
            <div className="relative">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 w-4 h-4 text-gray-400" />
              <input
                type="text"
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                placeholder="Tìm theo tên hoặc SKU..."
                className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-transparent"
              />
            </div>
            {searchTerm && availableProducts.length > 0 && (
              <div className="mt-2 border border-gray-200 rounded-lg max-h-60 overflow-y-auto">
                {availableProducts.map(product => (
                  <div
                    key={product.id}
                    onClick={() => handleAddItem(product)}
                    className="p-3 hover:bg-gray-50 cursor-pointer border-b border-gray-100 last:border-b-0"
                  >
                    <div className="flex justify-between items-center">
                      <div>
                        <p className="font-medium text-sm">{product.name}</p>
                        <p className="text-xs text-gray-500">SKU: {product.sku} • Tồn: {product.stock}</p>
                      </div>
                      <Plus className="w-4 h-4 text-purple-600" />
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>

          <div className="mb-6">
            <h3 className="text-sm font-medium text-gray-700 mb-3">Danh sách sản phẩm xuất</h3>
            {items.length === 0 ? (
              <div className="text-center py-8 text-gray-500 border-2 border-dashed border-gray-300 rounded-lg">
                <PackageOpen className="w-12 h-12 mx-auto mb-2 text-gray-300" />
                <p>Chưa có sản phẩm nào</p>
              </div>
            ) : (
              <div className="space-y-2">
                {items.map(item => (
                  <div key={item.productId} className="flex items-center gap-4 p-3 border border-gray-200 rounded-lg">
                    <div className="flex-1">
                      <p className="font-medium text-sm">{item.productName}</p>
                      <p className="text-xs text-gray-500">Tồn kho: {item.currentStock}</p>
                    </div>
                    <div className="w-32">
                      <input
                        type="number"
                        min="1"
                        max={item.currentStock}
                        value={item.quantity}
                        onChange={(e) => handleUpdateQuantity(item.productId, Number(e.target.value))}
                        className="w-full px-2 py-1 text-sm border border-gray-300 rounded focus:ring-2 focus:ring-purple-500 focus:border-transparent"
                      />
                    </div>
                    <button
                      onClick={() => handleRemoveItem(item.productId)}
                      className="p-2 text-red-600 hover:bg-red-50 rounded transition-colors"
                    >
                      <X className="w-4 h-4" />
                    </button>
                  </div>
                ))}
              </div>
            )}
          </div>

          <div className="flex gap-3">
            <button
              onClick={() => {
                setIsCreating(false);
                setItems([]);
                setPurpose('');
                setStaffId('');
              }}
              className="flex-1 px-4 py-2 border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50 transition-colors"
            >
              Hủy
            </button>
            <button
              onClick={handleSave}
              disabled={isSaving || items.length === 0 || !purpose.trim()}
              className="flex-1 px-4 py-2 bg-purple-600 text-white rounded-lg hover:bg-purple-700 transition-colors disabled:bg-gray-300 disabled:cursor-not-allowed"
            >
              {isSaving ? 'Đang lưu...' : (
                <>
                  <Save className="w-4 h-4 inline mr-2" />
                  Lưu phiếu xuất
                </>
              )}
            </button>
          </div>
        </div>
      ) : (
        <div className="bg-white rounded-lg shadow border border-gray-200">
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead className="bg-gray-50 border-b border-gray-200">
                <tr>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Ngày</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Người nhận</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Mục đích</th>
                  <th className="px-6 py-3 text-center text-xs font-medium text-gray-500 uppercase">Số SP</th>
                  <th className="px-6 py-3 text-center text-xs font-medium text-gray-500 uppercase">Tổng SL</th>
                </tr>
              </thead>
              <tbody className="bg-white divide-y divide-gray-200">
                {internalUseTransactions.length === 0 ? (
                  <tr>
                    <td colSpan={5} className="px-6 py-12 text-center text-gray-500">
                      <PackageOpen className="w-12 h-12 mx-auto mb-3 text-gray-300" />
                      <p>Chưa có phiếu xuất nào</p>
                    </td>
                  </tr>
                ) : (
                  internalUseTransactions.map(transaction => (
                    <tr key={transaction.id} className="hover:bg-gray-50">
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                        {new Date(transaction.date).toLocaleDateString('vi-VN')}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                        {transaction.staffId || 'N/A'}
                      </td>
                      <td className="px-6 py-4 text-sm text-gray-900">
                        {transaction.note || '-'}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-center text-sm text-gray-900">
                        {transaction.items?.length || 0}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-center text-sm font-semibold text-purple-600">
                        {transaction.items?.reduce((sum, item) => sum + (item.quantity || 0), 0) || 0}
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
}
