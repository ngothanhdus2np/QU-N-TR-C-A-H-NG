import React from 'react';
import { Search, Plus, Minus, X, ShoppingCart, ChevronRight } from 'lucide-react';
import { POSProduct, POSOrderItem } from '../../types';

interface POSMobileViewProps {
  searchTerm: string;
  setSearchTerm: (v: string) => void;
  searchFilteredProducts: POSProduct[];
  showProductResults: boolean;
  setShowProductResults: (v: boolean) => void;
  cart: POSOrderItem[];
  addToCart: (product: POSProduct) => void;
  updateQuantity: (productId: string, qty: number) => void;
  removeFromCart: (productId: string) => void;
  netPayable: number;
  onOpenCheckout: () => void;
  products: POSProduct[];
  allowSellOutOfStock: boolean;
}

const fmt = (n: number) => n.toLocaleString('vi-VN') + 'đ';

const POSMobileView: React.FC<POSMobileViewProps> = ({
  searchTerm,
  setSearchTerm,
  searchFilteredProducts,
  showProductResults,
  setShowProductResults,
  cart,
  addToCart,
  updateQuantity,
  removeFromCart,
  netPayable,
  onOpenCheckout,
  products,
  allowSellOutOfStock,
}) => {
  const totalItems = cart.reduce((acc, item) => acc + item.quantity, 0);

  return (
    <div className="flex flex-col h-full bg-slate-50">
      {/* Search Bar */}
      <div className="bg-white border-b border-slate-100 px-4 py-3 relative z-20">
        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
          <input
            type="text"
            value={searchTerm}
            onChange={e => {
              setSearchTerm(e.target.value);
              setShowProductResults(true);
            }}
            onFocus={() => {
              if (searchTerm) setShowProductResults(true);
            }}
            placeholder="Tìm sản phẩm theo tên, SKU, barcode..."
            className="w-full pl-9 pr-9 py-3 bg-slate-50 rounded-xl text-sm outline-none border border-slate-200 focus:border-indigo-400"
          />
          {searchTerm && (
            <button
              onClick={() => {
                setSearchTerm('');
                setShowProductResults(false);
              }}
              className="absolute right-3 top-1/2 -translate-y-1/2 p-0.5"
            >
              <X className="w-4 h-4 text-slate-400" />
            </button>
          )}
        </div>

        {/* Search Results Dropdown */}
        {showProductResults && searchTerm && searchFilteredProducts.length > 0 && (
          <div className="absolute left-4 right-4 top-full mt-1 bg-white rounded-2xl shadow-2xl border border-slate-100 max-h-72 overflow-y-auto z-30">
            {searchFilteredProducts.slice(0, 20).map(product => (
              <button
                key={product.id}
                onClick={() => {
                  addToCart(product);
                  setSearchTerm('');
                  setShowProductResults(false);
                }}
                className="w-full flex items-center justify-between px-4 py-3.5 hover:bg-slate-50 active:bg-slate-100 border-b border-slate-50 last:border-0"
              >
                <div className="text-left flex-1 min-w-0 pr-3">
                  <div className="font-semibold text-slate-800 text-sm truncate">
                    {product.name}
                  </div>
                  <div className="text-xs text-slate-400 mt-0.5">
                    {product.sku} · Tồn: {product.stock}
                  </div>
                </div>
                <div className="text-right shrink-0">
                  <div className="font-bold text-indigo-600 text-sm">{fmt(product.salePrice)}</div>
                  <div className="flex items-center justify-end mt-0.5">
                    <Plus className="w-3.5 h-3.5 text-indigo-400" />
                  </div>
                </div>
              </button>
            ))}
          </div>
        )}
      </div>

      {/* Cart Items */}
      <div
        className="flex-1 overflow-y-auto px-4 py-3 space-y-2"
        onClick={() => setShowProductResults(false)}
      >
        {cart.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-full text-slate-300 gap-4 pb-16">
            <ShoppingCart className="w-20 h-20" strokeWidth={1} />
            <p className="text-sm font-medium text-slate-400">Tìm và thêm sản phẩm vào giỏ hàng</p>
          </div>
        ) : (
          cart.map(item => {
            const product = products.find(p => p.id === item.productId);
            const atStockLimit =
              !allowSellOutOfStock && !!product && product.stock <= item.quantity;
            return (
              <div
                key={item.productId}
                className="bg-white rounded-2xl p-4 shadow-sm border border-slate-100"
              >
                <div className="flex items-start justify-between gap-2 mb-3">
                  <div className="flex-1 min-w-0">
                    <p className="font-semibold text-slate-800 text-sm leading-snug">{item.name}</p>
                    <p className="text-xs text-slate-400 mt-0.5">{fmt(item.price)} / cái</p>
                  </div>
                  <button
                    onClick={() => removeFromCart(item.productId)}
                    className="p-1.5 rounded-lg text-slate-300 hover:text-rose-400 hover:bg-rose-50 active:bg-rose-100 shrink-0"
                  >
                    <X className="w-4 h-4" />
                  </button>
                </div>
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <button
                      onClick={() => updateQuantity(item.productId, item.quantity - 1)}
                      className="w-9 h-9 rounded-full bg-slate-100 flex items-center justify-center active:bg-slate-200"
                    >
                      <Minus className="w-4 h-4 text-slate-600" />
                    </button>
                    <span className="font-bold text-slate-800 text-lg w-7 text-center">
                      {item.quantity}
                    </span>
                    <button
                      onClick={() => updateQuantity(item.productId, item.quantity + 1)}
                      disabled={atStockLimit}
                      className="w-9 h-9 rounded-full bg-indigo-100 flex items-center justify-center active:bg-indigo-200 disabled:opacity-40"
                    >
                      <Plus className="w-4 h-4 text-indigo-600" />
                    </button>
                  </div>
                  <p className="font-bold text-slate-800 text-base">{fmt(item.total)}</p>
                </div>
                {atStockLimit && (
                  <p className="text-xs text-amber-500 mt-2">
                    Đã đạt giới hạn tồn kho ({product?.stock})
                  </p>
                )}
              </div>
            );
          })
        )}
      </div>

      {/* Bottom Bar */}
      <div className="bg-white border-t border-slate-100 px-4 pt-3 pb-6">
        <div className="flex items-center justify-between mb-3">
          <span className="text-sm text-slate-500 font-medium">{totalItems} sản phẩm</span>
          <span className="font-semibold text-xl text-slate-800">{fmt(netPayable)}</span>
        </div>
        <button
          onClick={onOpenCheckout}
          disabled={cart.length === 0}
          className="w-full py-4 bg-indigo-600 text-white font-semibold text-base rounded-2xl flex items-center justify-center gap-2 disabled:opacity-40 active:bg-indigo-700 transition-colors"
        >
          Thanh toán
          <ChevronRight className="w-5 h-5" />
        </button>
      </div>
    </div>
  );
};

export default POSMobileView;
