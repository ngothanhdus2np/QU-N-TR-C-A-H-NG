import React from 'react';
import { Search, Scan, PackageOpen, FileText, Trash2 } from 'lucide-react';
import { POSProduct, POSOrderItem } from '../../types';
import POSConsultant from './POSConsultant';

const CartItemRow = React.memo(({ item, idx, onUpdate, onRemove, isReturnItem, onDiscountClick }: {
  item: POSOrderItem;
  idx: number;
  onUpdate: (id: string, delta: number) => void;
  onRemove: (id: string) => void;
  isReturnItem?: boolean;
  onDiscountClick?: (productId: string, price: number, discount: number, rect: DOMRect) => void;
}) => (
  <div className={`flex items-baseline gap-1.5 px-2 py-2 rounded-xl shadow-sm border transition-all font-normal text-lg group
    ${isReturnItem
      ? 'bg-rose-50/40 border-rose-200 hover:shadow-sm'
      : 'bg-white border-slate-200 hover:border-indigo-200 hover:shadow-md'}`}
  >
    <span className="w-12 shrink-0 text-center text-slate-400 italic tabular-nums">{idx}</span>
    <div className="w-14 shrink-0 flex justify-center">
      <button onClick={() => onRemove(item.productId)} className="text-slate-300 hover:text-rose-500 transition-colors p-0.5">
        <Trash2 className="h-3.5 w-3.5" />
      </button>
    </div>
    <span className="w-[160px] shrink-0 text-slate-500 uppercase truncate text-center">{item.sku}</span>
    <span className="flex-1 min-w-0 text-slate-900 uppercase truncate text-center">{item.name}</span>
    <div className="w-[88px] shrink-0 flex items-center justify-center gap-1 group/qty">
      <button
        onClick={() => onUpdate(item.productId, -1)}
        className="opacity-0 group-hover/qty:opacity-100 transition-opacity text-slate-400 hover:text-rose-500 font-black text-base leading-none px-0.5"
      >−</button>
      <span className="border-b border-slate-400 px-2 tabular-nums text-slate-900 min-w-[20px] text-center">{item.quantity}</span>
      <button
        onClick={() => onUpdate(item.productId, +1)}
        className="opacity-0 group-hover/qty:opacity-100 transition-opacity text-slate-400 hover:text-indigo-500 font-black text-base leading-none px-0.5"
      >+</button>
    </div>
    <div
      className={`w-[176px] shrink-0 text-center ${onDiscountClick ? 'cursor-pointer hover:bg-indigo-50 rounded-lg px-1 py-0.5 transition-colors' : ''}`}
      onClick={onDiscountClick ? (e) => {
        const rect = (e.currentTarget as HTMLDivElement).getBoundingClientRect();
        onDiscountClick(item.productId, item.price, item.discount, rect);
      } : undefined}
    >
      <div className="flex flex-col items-center gap-0.5">
        <span className="tabular-nums text-slate-900">{item.price.toLocaleString()}</span>
        {item.discount > 0 && (
          <span className="tabular-nums text-rose-600 text-xs bg-rose-50 border border-rose-200 rounded px-1.5 leading-tight">
            - {item.discount.toLocaleString()}
          </span>
        )}
      </div>
    </div>
    <span className="w-[176px] shrink-0 text-center text-slate-900 tabular-nums">{item.total.toLocaleString()}</span>
  </div>
));

interface POSCartProps {
  mode: 'sales' | 'return';
  cart: POSOrderItem[];
  returnCart: POSOrderItem[];
  orderNote: string;
  showConsultant: boolean;
  setShowConsultant: (v: boolean) => void;
  products: POSProduct[];
  addToCart: (p: POSProduct) => void;
  consultantSearchRef: React.RefObject<HTMLInputElement>;
  onUpdateQuantity: (productId: string, delta: number) => void;
  onRemoveFromCart: (productId: string) => void;
  onUpdateReturnQuantity: (productId: string, delta: number) => void;
  onRemoveFromReturnCart: (productId: string) => void;
  onDiscountClick: (productId: string, price: number, discount: number, rect: DOMRect) => void;
  onOrderNoteChange: (note: string) => void;
}

const POSCart: React.FC<POSCartProps> = ({
  mode, cart, returnCart, orderNote,
  showConsultant, setShowConsultant, products, addToCart, consultantSearchRef,
  onUpdateQuantity, onRemoveFromCart, onUpdateReturnQuantity, onRemoveFromReturnCart,
  onDiscountClick, onOrderNoteChange,
}) => (
  <div className="flex-1 flex flex-col min-w-0">
    <div className="flex-1 overflow-y-auto flex flex-col no-scrollbar">
      {mode === 'return' ? (
        <div className="flex-1 flex flex-col">
          {/* Search Bar for Return items */}
          <div className="bg-white border-b border-slate-200 p-2 flex items-center gap-3">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
              <input
                type="text"
                placeholder="Tìm hàng trả (F3)"
                className="w-full pl-9 pr-4 py-2 text-sm font-bold bg-slate-50 border border-slate-100 rounded-lg outline-none focus:bg-white focus:border-indigo-400 transition-all"
              />
            </div>
            <Scan className="h-5 w-5 text-indigo-500" />
          </div>

          {/* Return Items List */}
          <div className="h-1/2 overflow-y-auto no-scrollbar border-b border-indigo-100 bg-white italic">
            {returnCart.length === 0 ? (
              <div className="h-full flex items-center justify-center text-slate-300 py-10">
                <p className="text-[10px] font-black uppercase tracking-widest">Danh sách hàng trả trống</p>
              </div>
            ) : (
              <div className="flex flex-col gap-2 p-2">
                {returnCart.map((item, idx) => (
                  <CartItemRow
                    key={item.productId}
                    item={item}
                    idx={returnCart.length - idx}
                    onUpdate={onUpdateReturnQuantity}
                    onRemove={onRemoveFromReturnCart}
                    isReturnItem
                  />
                ))}
              </div>
            )}
          </div>

          {/* Search Bar for Exchange items */}
          <div className="bg-indigo-600 p-2 flex items-center gap-3">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-white/50" />
              <input
                type="text"
                placeholder="Tìm hàng đổi (F7)"
                className="w-full pl-9 pr-4 py-2 text-sm font-bold bg-white/10 text-white placeholder:text-white/40 border border-white/10 rounded-lg outline-none focus:bg-white focus:text-slate-900 transition-all"
              />
            </div>
            <Scan className="h-5 w-5 text-white" />
          </div>

          {/* Exchange Items List */}
          <div className="flex-1 overflow-y-auto no-scrollbar bg-slate-50/30">
            {cart.length === 0 ? (
              <div className="h-full flex items-center justify-center text-slate-300 py-10">
                <p className="text-[10px] font-black uppercase tracking-widest">Danh sách hàng đổi trống</p>
              </div>
            ) : (
              <div className="flex flex-col gap-2 p-2">
                {cart.map((item, idx) => (
                  <CartItemRow
                    key={item.productId}
                    item={item}
                    idx={cart.length - idx}
                    onUpdate={onUpdateQuantity}
                    onRemove={onRemoveFromCart}
                  />
                ))}
              </div>
            )}
          </div>
        </div>
      ) : (
        <div className="flex-1 overflow-y-auto pt-4 flex flex-col no-scrollbar">
          {cart.length === 0 ? (
            <div className="flex-1 flex flex-col items-center justify-center text-slate-300">
              <div className="w-24 h-24 bg-white rounded-[2rem] shadow-xl flex items-center justify-center mb-8 border border-slate-100">
                <PackageOpen className="h-10 w-10 text-slate-200" />
              </div>
              <p className="font-black text-sm uppercase tracking-[0.3em] text-slate-400">Hệ thống chưa có sản phẩm</p>
              <p className="text-[11px] mt-3 font-bold text-slate-400/60 uppercase tracking-widest italic">Quét mã vạch hoặc ấn F3 để bắt đầu bán hàng</p>
            </div>
          ) : (
            <div className="flex flex-col gap-2 p-2 animate-in fade-in duration-300">
              {cart.map((item, idx) => (
                <CartItemRow
                  key={item.productId}
                  item={item}
                  idx={cart.length - idx}
                  onUpdate={onUpdateQuantity}
                  onRemove={onRemoveFromCart}
                  onDiscountClick={onDiscountClick}
                />
              ))}
            </div>
          )}
        </div>
      )}
    </div>

    {/* Order Note */}
    <div className="px-8 pb-8">
      <div className="bg-white border border-slate-200 rounded-[1.5rem] px-5 py-3 flex items-center gap-4 focus-within:border-indigo-400 focus-within:shadow-lg focus-within:shadow-indigo-500/5 transition-all group shadow-sm">
        <FileText className="h-4.5 w-4.5 text-slate-400 group-focus-within:text-indigo-500 transition-colors" />
        <input
          type="text"
          placeholder="Ghi chú đơn hàng cho bộ phận kho hoặc nhân viên giao hàng..."
          className="flex-1 bg-transparent border-none p-0 focus:ring-0 text-sm font-bold text-slate-800 placeholder:text-slate-300 placeholder:font-medium"
          value={orderNote}
          onChange={e => onOrderNoteChange(e.target.value)}
        />
      </div>
    </div>

    {/* Sales Consultant Drawer */}
    <POSConsultant
      showConsultant={showConsultant}
      setShowConsultant={setShowConsultant}
      products={products}
      addToCart={addToCart}
      searchRef={consultantSearchRef}
    />
  </div>
);

export default POSCart;
