import React, { useState, useMemo } from 'react';
import { X, Edit, Trash2, TrendingDown, TrendingUp, Package, CreditCard } from 'lucide-react';
import { Supplier, SupplierDebtRecord, InventoryTransaction } from '../../types';

interface SupplierDetailViewProps {
  supplier: Supplier;
  supplierDebts: SupplierDebtRecord[];
  purchaseTransactions: InventoryTransaction[];
  onEdit: () => void;
  onDelete: () => void;
  onClose: () => void;
}

type DetailTab = 'info' | 'debt' | 'history';

const SupplierDetailView: React.FC<SupplierDetailViewProps> = ({
  supplier,
  supplierDebts,
  purchaseTransactions,
  onEdit,
  onDelete,
  onClose,
}) => {
  const [activeTab, setActiveTab] = useState<DetailTab>('info');

  // Filter debts for this supplier
  const debts = useMemo(() => {
    return supplierDebts
      .filter(d => d.supplierId === supplier.id)
      .sort((a, b) => b.date.localeCompare(a.date));
  }, [supplierDebts, supplier.id]);

  // Calculate running balance
  const debtsWithBalance = useMemo(() => {
    let balance = 0;
    return [...debts].reverse().map(d => {
      balance += d.type === 'purchase' ? d.amount : -d.amount;
      return { ...d, runningBalance: balance };
    }).reverse();
  }, [debts]);

  // Filter purchase transactions for this supplier
  const purchases = useMemo(() => {
    return purchaseTransactions
      .filter(t => t.type === 'Import' && t.supplierId === supplier.id)
      .sort((a, b) => b.date.localeCompare(a.date));
  }, [purchaseTransactions, supplier.id]);

  const currentDebt = supplier.currentDebt || 0;
  const totalPurchase = supplier.totalPurchase || 0;

  const renderInfoTab = () => (
    <div className="p-6 space-y-6">
      {/* Summary Cards */}
      <div className="grid grid-cols-2 gap-4">
        <div className="bg-gradient-to-br from-rose-50 to-rose-100 rounded-xl p-4 border border-rose-200">
          <div className="flex items-center gap-2 mb-2">
            <TrendingDown className="h-4 w-4 text-rose-600" />
            <span className="text-xs font-black text-rose-700 uppercase tracking-wide">Nợ hiện tại</span>
          </div>
          <div className="text-2xl font-black text-rose-700">
            {currentDebt > 0 ? currentDebt.toLocaleString() + 'đ' : '0đ'}
          </div>
        </div>

        <div className="bg-gradient-to-br from-indigo-50 to-indigo-100 rounded-xl p-4 border border-indigo-200">
          <div className="flex items-center gap-2 mb-2">
            <TrendingUp className="h-4 w-4 text-indigo-600" />
            <span className="text-xs font-black text-indigo-700 uppercase tracking-wide">Tổng mua</span>
          </div>
          <div className="text-2xl font-black text-indigo-700">
            {totalPurchase > 0 ? totalPurchase.toLocaleString() + 'đ' : '0đ'}
          </div>
        </div>
      </div>

      {/* Supplier Info */}
      <div className="bg-white rounded-xl border border-slate-200 overflow-hidden">
        <div className="px-4 py-3 bg-slate-50 border-b border-slate-200">
          <h3 className="text-sm font-black text-slate-700 uppercase tracking-wide">
            Thông tin nhà cung cấp
          </h3>
        </div>
        <div className="p-4 space-y-3">
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="text-xs font-bold text-slate-500 uppercase tracking-wide">Mã NCC</label>
              <p className="text-sm font-bold text-slate-800 mt-1">
                {supplier.code || supplier.id.slice(0, 8)}
              </p>
            </div>
            <div>
              <label className="text-xs font-bold text-slate-500 uppercase tracking-wide">Tên NCC</label>
              <p className="text-sm font-bold text-slate-800 mt-1">{supplier.name}</p>
            </div>
          </div>

          {supplier.group && (
            <div>
              <label className="text-xs font-bold text-slate-500 uppercase tracking-wide">Nhóm</label>
              <p className="text-sm font-bold text-slate-800 mt-1">{supplier.group}</p>
            </div>
          )}

          <div className="grid grid-cols-2 gap-4">
            {supplier.phone && (
              <div>
                <label className="text-xs font-bold text-slate-500 uppercase tracking-wide">Điện thoại</label>
                <p className="text-sm font-bold text-slate-800 mt-1">{supplier.phone}</p>
              </div>
            )}
            {supplier.email && (
              <div>
                <label className="text-xs font-bold text-slate-500 uppercase tracking-wide">Email</label>
                <p className="text-sm font-bold text-slate-800 mt-1">{supplier.email}</p>
              </div>
            )}
          </div>

          {supplier.address && (
            <div>
              <label className="text-xs font-bold text-slate-500 uppercase tracking-wide">Địa chỉ</label>
              <p className="text-sm font-bold text-slate-800 mt-1">{supplier.address}</p>
            </div>
          )}

          <div>
            <label className="text-xs font-bold text-slate-500 uppercase tracking-wide">Trạng thái</label>
            <div className="mt-1">
              <span
                className={`inline-block px-2 py-1 rounded-full text-[10px] font-black uppercase ${
                  supplier.status === 'inactive'
                    ? 'bg-slate-100 text-slate-500'
                    : 'bg-emerald-100 text-emerald-700'
                }`}
              >
                {supplier.status === 'inactive' ? 'Ngừng hoạt động' : 'Đang hoạt động'}
              </span>
            </div>
          </div>

          {supplier.notes && (
            <div>
              <label className="text-xs font-bold text-slate-500 uppercase tracking-wide">Ghi chú</label>
              <p className="text-sm text-slate-600 mt-1 whitespace-pre-wrap">{supplier.notes}</p>
            </div>
          )}
        </div>
      </div>
    </div>
  );

  const renderDebtTab = () => (
    <div className="p-6">
      {debtsWithBalance.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-16">
          <CreditCard className="h-12 w-12 text-slate-300 mb-3" />
          <p className="text-sm font-bold text-slate-400">Chưa có giao dịch công nợ</p>
        </div>
      ) : (
        <div className="bg-white rounded-xl border border-slate-200 overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-slate-50 border-b border-slate-200">
                <tr>
                  <th className="px-4 py-3 text-left text-[10px] font-black uppercase tracking-widest text-slate-500">
                    Ngày
                  </th>
                  <th className="px-4 py-3 text-left text-[10px] font-black uppercase tracking-widest text-slate-500">
                    Loại
                  </th>
                  <th className="px-4 py-3 text-left text-[10px] font-black uppercase tracking-widest text-slate-500">
                    Mô tả
                  </th>
                  <th className="px-4 py-3 text-right text-[10px] font-black uppercase tracking-widest text-slate-500">
                    Số tiền
                  </th>
                  <th className="px-4 py-3 text-right text-[10px] font-black uppercase tracking-widest text-slate-500">
                    Số dư
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {debtsWithBalance.map(debt => (
                  <tr key={debt.id} className="hover:bg-slate-50 transition-colors">
                    <td className="px-4 py-3 text-slate-600">
                      {new Date(debt.date).toLocaleDateString('vi-VN')}
                    </td>
                    <td className="px-4 py-3">
                      <span
                        className={`inline-block px-2 py-0.5 rounded-full text-[10px] font-black uppercase ${
                          debt.type === 'purchase'
                            ? 'bg-rose-100 text-rose-700'
                            : 'bg-emerald-100 text-emerald-700'
                        }`}
                      >
                        {debt.type === 'purchase' ? 'Mua hàng' : 'Thanh toán'}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-slate-700">{debt.description}</td>
                    <td className="px-4 py-3 text-right">
                      <span
                        className={`font-bold ${
                          debt.type === 'purchase' ? 'text-rose-600' : 'text-emerald-600'
                        }`}
                      >
                        {debt.type === 'purchase' ? '+' : '-'}
                        {debt.amount.toLocaleString()}đ
                      </span>
                    </td>
                    <td className="px-4 py-3 text-right font-black text-slate-700">
                      {debt.runningBalance.toLocaleString()}đ
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );

  const renderHistoryTab = () => (
    <div className="p-6">
      {purchases.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-16">
          <Package className="h-12 w-12 text-slate-300 mb-3" />
          <p className="text-sm font-bold text-slate-400">Chưa có phiếu nhập hàng</p>
        </div>
      ) : (
        <div className="bg-white rounded-xl border border-slate-200 overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-slate-50 border-b border-slate-200">
                <tr>
                  <th className="px-4 py-3 text-left text-[10px] font-black uppercase tracking-widest text-slate-500">
                    Mã phiếu
                  </th>
                  <th className="px-4 py-3 text-left text-[10px] font-black uppercase tracking-widest text-slate-500">
                    Ngày nhập
                  </th>
                  <th className="px-4 py-3 text-right text-[10px] font-black uppercase tracking-widest text-slate-500">
                    Số lượng SP
                  </th>
                  <th className="px-4 py-3 text-right text-[10px] font-black uppercase tracking-widest text-slate-500">
                    Tổng tiền
                  </th>
                  <th className="px-4 py-3 text-center text-[10px] font-black uppercase tracking-widest text-slate-500">
                    Trạng thái
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {purchases.map(purchase => (
                  <tr key={purchase.id} className="hover:bg-slate-50 transition-colors">
                    <td className="px-4 py-3">
                      <span className="font-mono font-bold text-indigo-600 text-xs">
                        {purchase.id.slice(0, 12)}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-slate-600">
                      {new Date(purchase.date).toLocaleDateString('vi-VN')}
                    </td>
                    <td className="px-4 py-3 text-right font-bold text-slate-700">
                      {purchase.items.length}
                    </td>
                    <td className="px-4 py-3 text-right font-black text-emerald-600">
                      {(purchase.totalAmount || 0).toLocaleString()}đ
                    </td>
                    <td className="px-4 py-3 text-center">
                      <span
                        className={`inline-block px-2 py-0.5 rounded-full text-[10px] font-black uppercase ${
                          purchase.status === 'cancelled'
                            ? 'bg-slate-100 text-slate-500'
                            : purchase.status === 'draft'
                              ? 'bg-amber-100 text-amber-700'
                              : 'bg-emerald-100 text-emerald-700'
                        }`}
                      >
                        {purchase.status === 'cancelled'
                          ? 'Đã hủy'
                          : purchase.status === 'draft'
                            ? 'Phiếu tạm'
                            : 'Đã nhập'}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );

  return (
    <div className="fixed inset-0 bg-slate-950/60 backdrop-blur-sm flex items-center justify-center z-50 p-4">
      <div className="bg-slate-50 rounded-2xl shadow-2xl w-full max-w-4xl max-h-[90vh] overflow-hidden flex flex-col">
        {/* Header */}
        <div className="px-6 py-4 bg-white border-b border-slate-200 flex items-center justify-between shrink-0">
          <div>
            <h2 className="text-lg font-black text-slate-900">{supplier.name}</h2>
            <p className="text-xs text-slate-400 mt-0.5">
              Mã: {supplier.code || supplier.id.slice(0, 8)}
            </p>
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={onEdit}
              className="flex items-center gap-2 px-3 py-2 bg-indigo-600 text-white rounded-lg text-xs font-bold hover:bg-indigo-700 transition-colors"
            >
              <Edit className="h-3.5 w-3.5" />
              Sửa
            </button>
            <button
              onClick={onDelete}
              className="flex items-center gap-2 px-3 py-2 bg-rose-600 text-white rounded-lg text-xs font-bold hover:bg-rose-700 transition-colors"
            >
              <Trash2 className="h-3.5 w-3.5" />
              Xóa
            </button>
            <button
              onClick={onClose}
              className="p-2 hover:bg-slate-100 rounded-lg transition-colors"
            >
              <X className="h-5 w-5 text-slate-400" />
            </button>
          </div>
        </div>

        {/* Tabs */}
        <div className="px-6 bg-white border-b border-slate-200 flex gap-1 shrink-0">
          <button
            onClick={() => setActiveTab('info')}
            className={`px-4 py-3 text-sm font-bold transition-colors relative ${
              activeTab === 'info'
                ? 'text-indigo-600'
                : 'text-slate-500 hover:text-slate-700'
            }`}
          >
            Thông tin
            {activeTab === 'info' && (
              <div className="absolute bottom-0 left-0 right-0 h-0.5 bg-indigo-600" />
            )}
          </button>
          <button
            onClick={() => setActiveTab('debt')}
            className={`px-4 py-3 text-sm font-bold transition-colors relative ${
              activeTab === 'debt'
                ? 'text-indigo-600'
                : 'text-slate-500 hover:text-slate-700'
            }`}
          >
            Công nợ ({debts.length})
            {activeTab === 'debt' && (
              <div className="absolute bottom-0 left-0 right-0 h-0.5 bg-indigo-600" />
            )}
          </button>
          <button
            onClick={() => setActiveTab('history')}
            className={`px-4 py-3 text-sm font-bold transition-colors relative ${
              activeTab === 'history'
                ? 'text-indigo-600'
                : 'text-slate-500 hover:text-slate-700'
            }`}
          >
            Lịch sử mua hàng ({purchases.length})
            {activeTab === 'history' && (
              <div className="absolute bottom-0 left-0 right-0 h-0.5 bg-indigo-600" />
            )}
          </button>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto">
          {activeTab === 'info' && renderInfoTab()}
          {activeTab === 'debt' && renderDebtTab()}
          {activeTab === 'history' && renderHistoryTab()}
        </div>
      </div>
    </div>
  );
};

export default SupplierDetailView;
