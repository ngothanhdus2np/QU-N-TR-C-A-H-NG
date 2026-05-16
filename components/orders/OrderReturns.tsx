import React, { useState, useMemo } from 'react';
import { RotateCcw, Search, Plus, X, Check, AlertCircle } from 'lucide-react';
import { AppData } from '../../types';

interface OrderReturnsProps {
  orders: AppData['posOrders'];
  products: AppData['posProducts'];
  customers: AppData['posCustomers'];
  onUpdateSurgical: (updates: any[]) => Promise<void>;
}

interface ReturnItem {
  productId: string;
  productName: string;
  quantity: number;
  originalPrice: number;
  refundAmount: number;
  reason: string;
}

export default function OrderReturns({ orders, products, customers, onUpdateSurgical }: OrderReturnsProps) {
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedOrder, setSelectedOrder] = useState<AppData['posOrders'][0] | null>(null);
  const [returnItems, setReturnItems] = useState<ReturnItem[]>([]);
  const [returnReason, setReturnReason] = useState('');
  const [isProcessing, setIsProcessing] = useState(false);

  const recentOrders = useMemo(() => {
    const thirtyDaysAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString().split('T')[0];
    return orders
      .filter(o => o.date >= thirtyDaysAgo)
      .filter(o => 
        o.orderCode.toLowerCase().includes(searchTerm.toLowerCase()) ||
        o.customerName?.toLowerCase().includes(searchTerm.toLowerCase())
      )
      .sort((a, b) => b.date.localeCompare(a.date))
      .slice(0, 50);
  }, [orders, searchTerm]);

  const handleSelectOrder = (order: AppData['posOrders'][0]) => {
    setSelectedOrder(order);
    setReturnItems(order.items.map(item => ({
      productId: item.productId,
      productName: item.name,
      quantity: 0,
      originalPrice: item.price,
      refundAmount: 0,
      reason: ''
    })));
  };

  const handleUpdateReturnItem = (index: number, field: keyof ReturnItem, value: any) => {
    const updated = [...returnItems];
    updated[index] = { ...updated[index], [field]: value };
    
    if (field === 'quantity') {
      const maxQty = selectedOrder?.items[index]?.quantity || 0;
      const qty = Math.min(Math.max(0, Number(value) || 0), maxQty);
      updated[index].quantity = qty;
      updated[index].refundAmount = qty * updated[index].originalPrice;
    }
    
    setReturnItems(updated);
  };

  const totalRefund = useMemo(() => {
    return returnItems.reduce((sum, item) => sum + item.refundAmount, 0);
  }, [returnItems]);

  const handleProcessReturn = async () => {
    if (!selectedOrder) return;
    
    const itemsToReturn = returnItems.filter(item => item.quantity > 0);
    if (itemsToReturn.length === 0) {
      alert('Vui lòng chọn ít nhất 1 sản phẩm để trả hàng');
      return;
    }

    if (!returnReason.trim()) {
      alert('Vui lòng nhập lý do trả hàng');
      return;
    }

    setIsProcessing(true);

    try {
      const updates: any[] = [];

      // Update product stock (increase back)
      for (const returnItem of itemsToReturn) {
        const product = products.find(p => p.id === returnItem.productId);
        if (product) {
          updates.push({
            key: 'posProducts',
            item: {
              ...product,
              stock: (product.stock || 0) + returnItem.quantity
            },
            isDelete: false
          });
        }
      }

      // Create inventory transaction for return
      const returnTransaction = {
        id: crypto.randomUUID(),
        date: new Date().toISOString().split('T')[0],
        type: 'return' as const,
        items: itemsToReturn.map(item => ({
          productId: item.productId,
          productName: item.productName,
          quantity: item.quantity,
          price: item.originalPrice
        })),
        note: `Trả hàng từ đơn ${selectedOrder.orderCode}. Lý do: ${returnReason}`,
        referenceId: selectedOrder.id,
        staffId: selectedOrder.staffId,
        totalAmount: totalRefund,
        status: 'completed'
      };

      updates.push({
        key: 'inventoryTransactions',
        item: returnTransaction,
        isDelete: false
      });

      // Update customer points if applicable
      if (selectedOrder.customerId && selectedOrder.pointsEarned) {
        const customer = customers.find(c => c.id === selectedOrder.customerId);
        if (customer) {
          const pointsToDeduct = Math.floor(totalRefund / (selectedOrder.finalAmount || 1) * (selectedOrder.pointsEarned || 0));
          updates.push({
            key: 'posCustomers',
            item: {
              ...customer,
              points: Math.max(0, (customer.points || 0) - pointsToDeduct),
              totalSpent: Math.max(0, (customer.totalSpent || 0) - totalRefund)
            },
            isDelete: false
          });
        }
      }

      await onUpdateSurgical(updates);

      alert(`Đã xử lý trả hàng thành công!\nSố tiền hoàn: ${totalRefund.toLocaleString('vi-VN')}đ`);
      
      // Reset form
      setSelectedOrder(null);
      setReturnItems([]);
      setReturnReason('');
    } catch (error) {
      console.error('Error processing return:', error);
      alert('Có lỗi xảy ra khi xử lý trả hàng. Vui lòng thử lại.');
    } finally {
      setIsProcessing(false);
    }
  };

  return (
    <div className="p-6 max-w-7xl mx-auto">
      <div className="mb-6">
        <div className="flex items-center gap-3 mb-2">
          <RotateCcw className="w-8 h-8 text-orange-600" />
          <h1 className="text-2xl font-bold text-gray-900">Trả hàng</h1>
        </div>
        <p className="text-gray-600">Xử lý yêu cầu trả hàng từ khách hàng</p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Order Selection */}
        <div className="bg-white rounded-lg shadow border border-gray-200 p-6">
          <h2 className="text-lg font-semibold mb-4">Chọn đơn hàng</h2>
          
          <div className="relative mb-4">
            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 w-4 h-4 text-gray-400" />
            <input
              type="text"
              placeholder="Tìm mã đơn hàng hoặc khách hàng..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-orange-500 focus:border-transparent"
            />
          </div>

          <div className="space-y-2 max-h-[600px] overflow-y-auto">
            {recentOrders.map(order => (
              <div
                key={order.id}
                onClick={() => handleSelectOrder(order)}
                className={`p-4 border rounded-lg cursor-pointer transition-all ${
                  selectedOrder?.id === order.id
                    ? 'border-orange-500 bg-orange-50'
                    : 'border-gray-200 hover:border-orange-300 hover:bg-gray-50'
                }`}
              >
                <div className="flex justify-between items-start mb-2">
                  <div>
                    <p className="font-mono font-semibold text-sm text-indigo-600">{order.orderCode}</p>
                    <p className="text-sm text-gray-600">{order.customerName || 'Khách lẻ'}</p>
                  </div>
                  <div className="text-right">
                    <p className="text-sm font-semibold text-gray-900">{(order.finalAmount || 0).toLocaleString('vi-VN')}đ</p>
                    <p className="text-xs text-gray-500">{new Date(order.date).toLocaleDateString('vi-VN')}</p>
                  </div>
                </div>
                <div className="text-xs text-gray-500">
                  {order.items.length} sản phẩm • {order.paymentMethod || 'Tiền mặt'}
                </div>
              </div>
            ))}
            {recentOrders.length === 0 && (
              <div className="text-center py-12 text-gray-500">
                <AlertCircle className="w-12 h-12 mx-auto mb-3 text-gray-300" />
                <p>Không tìm thấy đơn hàng nào</p>
              </div>
            )}
          </div>
        </div>

        {/* Return Processing */}
        <div className="bg-white rounded-lg shadow border border-gray-200 p-6">
          <h2 className="text-lg font-semibold mb-4">Xử lý trả hàng</h2>

          {!selectedOrder ? (
            <div className="text-center py-12 text-gray-500">
              <RotateCcw className="w-12 h-12 mx-auto mb-3 text-gray-300" />
              <p>Vui lòng chọn đơn hàng để xử lý trả hàng</p>
            </div>
          ) : (
            <div className="space-y-4">
              <div className="bg-gray-50 rounded-lg p-4">
                <p className="text-sm text-gray-600 mb-1">Đơn hàng</p>
                <p className="font-mono font-semibold text-indigo-600">{selectedOrder.orderCode}</p>
                <p className="text-sm text-gray-600 mt-2">Khách hàng: {selectedOrder.customerName || 'Khách lẻ'}</p>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Chọn sản phẩm trả hàng
                </label>
                <div className="space-y-3 max-h-[300px] overflow-y-auto">
                  {returnItems.map((item, idx) => (
                    <div key={idx} className="border border-gray-200 rounded-lg p-3">
                      <div className="flex justify-between items-start mb-2">
                        <div className="flex-1">
                          <p className="font-medium text-sm">{item.productName}</p>
                          <p className="text-xs text-gray-500">
                            Giá: {item.originalPrice.toLocaleString('vi-VN')}đ • 
                            Đã mua: {selectedOrder.items[idx]?.quantity || 0}
                          </p>
                        </div>
                      </div>
                      <div className="grid grid-cols-2 gap-2">
                        <div>
                          <label className="block text-xs text-gray-600 mb-1">Số lượng trả</label>
                          <input
                            type="number"
                            min="0"
                            max={selectedOrder.items[idx]?.quantity || 0}
                            value={item.quantity}
                            onChange={(e) => handleUpdateReturnItem(idx, 'quantity', e.target.value)}
                            className="w-full px-2 py-1 text-sm border border-gray-300 rounded focus:ring-2 focus:ring-orange-500 focus:border-transparent"
                          />
                        </div>
                        <div>
                          <label className="block text-xs text-gray-600 mb-1">Hoàn tiền</label>
                          <input
                            type="text"
                            value={item.refundAmount.toLocaleString('vi-VN') + 'đ'}
                            disabled
                            className="w-full px-2 py-1 text-sm border border-gray-300 rounded bg-gray-50 text-gray-700"
                          />
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Lý do trả hàng <span className="text-red-500">*</span>
                </label>
                <textarea
                  value={returnReason}
                  onChange={(e) => setReturnReason(e.target.value)}
                  placeholder="Nhập lý do trả hàng (lỗi sản phẩm, không vừa ý, ...)"
                  rows={3}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-orange-500 focus:border-transparent"
                />
              </div>

              <div className="bg-orange-50 rounded-lg p-4 border border-orange-200">
                <div className="flex justify-between items-center mb-2">
                  <span className="text-sm font-medium text-gray-700">Tổng hoàn tiền:</span>
                  <span className="text-2xl font-bold text-orange-600">
                    {totalRefund.toLocaleString('vi-VN')}đ
                  </span>
                </div>
                <p className="text-xs text-gray-600">
                  Số lượng sản phẩm: {returnItems.reduce((sum, item) => sum + item.quantity, 0)}
                </p>
              </div>

              <div className="flex gap-3">
                <button
                  onClick={() => {
                    setSelectedOrder(null);
                    setReturnItems([]);
                    setReturnReason('');
                  }}
                  className="flex-1 px-4 py-2 border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50 transition-colors"
                >
                  <X className="w-4 h-4 inline mr-2" />
                  Hủy
                </button>
                <button
                  onClick={handleProcessReturn}
                  disabled={isProcessing || totalRefund === 0 || !returnReason.trim()}
                  className="flex-1 px-4 py-2 bg-orange-600 text-white rounded-lg hover:bg-orange-700 transition-colors disabled:bg-gray-300 disabled:cursor-not-allowed"
                >
                  {isProcessing ? (
                    'Đang xử lý...'
                  ) : (
                    <>
                      <Check className="w-4 h-4 inline mr-2" />
                      Xác nhận trả hàng
                    </>
                  )}
                </button>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
