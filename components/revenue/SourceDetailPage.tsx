import React, { useState } from 'react';
import { ExternalLink, ImagePlus, Pencil, StopCircle, Trash2 } from 'lucide-react';
import { ShopeeInventoryInRecord, ShopeeInventoryOutRecord, ShopeeSourceItem } from '../../types';
import { uploadImage } from '../../services/marketingStorageService';

interface Props {
  item: ShopeeSourceItem;
  shopeeInventoryIn: ShopeeInventoryInRecord[];
  shopeeInventoryOut: ShopeeInventoryOutRecord[];
  formatNumber: (num: number) => string;
  defaultShop?: number;
  onShopChange?: (shop: number) => void;
  onBack: () => void;
  onUpdate: (updated: ShopeeSourceItem) => Promise<void>;
  onDelete: () => Promise<void>;
}

type Tab = 'info' | 'stock_card' | 'inventory' | 'channels';

const TABS: { id: Tab; label: string }[] = [
  { id: 'info', label: 'Thông tin & Mô tả' },
  { id: 'stock_card', label: 'Thẻ kho' },
  { id: 'inventory', label: 'Tồn kho' },
  { id: 'channels', label: 'Kênh bán' },
];

const parseSku = (sku: string) => {
  const parts = sku.split('-');
  if (parts.length === 1) return { color: null, size: null };
  if (parts.length === 2) return { color: parts[1], size: null };
  return { color: parts[1], size: parts.slice(2).join('-') };
};

const BUCKET = 'shopee-products';

const SourceDetailPage: React.FC<Props> = ({
  item,
  shopeeInventoryIn,
  shopeeInventoryOut,
  formatNumber,
  defaultShop,
  onShopChange,
  onBack,
  onUpdate,
  onDelete,
}) => {
  const [activeTab, setActiveTab] = useState<Tab>('info');
  const [activeShop, setActiveShop] = useState(defaultShop ?? 0);
  const isShopLocked = defaultShop !== undefined;
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState<ShopeeSourceItem>(item);
  const [uploadingImg, setUploadingImg] = useState(false);
  const [deleteConfirm, setDeleteConfirm] = useState(false);

  const { color, size } = parseSku(item.sku);
  const stock = (() => {
    const inQty = shopeeInventoryIn.filter(r => r.sku === item.sku).reduce((s, r) => s + r.quantity, 0);
    const outQty = shopeeInventoryOut.filter(r => r.sku === item.sku && (r.status === 'OK' || r.status === 'SHIPPING')).reduce((s, r) => s + r.quantity, 0);
    return inQty - outQty;
  })();

  const inRecords = shopeeInventoryIn.filter(r => r.sku === item.sku).sort((a, b) => b.date.localeCompare(a.date));
  const outRecords = shopeeInventoryOut.filter(r => r.sku === item.sku).sort((a, b) => b.date.localeCompare(a.date));

  const shops = draft.shops ?? [{ name: '', link: '' }, { name: '', link: '' }];

  const handleImageUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setUploadingImg(true);
    try {
      const url = await uploadImage(item.id, BUCKET, file.name, file);
      if (url) {
        const updated = { ...draft, imageUrl: url };
        setDraft(updated);
        await onUpdate(updated);
      }
    } finally {
      setUploadingImg(false);
      e.target.value = '';
    }
  };

  const handleSave = async () => {
    await onUpdate(draft);
    setEditing(false);
  };

  const setShop = (idx: number, field: 'name' | 'link', value: string) => {
    const updated = [...shops];
    updated[idx] = { ...updated[idx], [field]: value };
    setDraft(d => ({ ...d, shops: updated }));
  };

  return (
    <div className="flex flex-col rounded-lg border border-slate-200 bg-white">
      {/* Header */}
      <div className="flex shrink-0 items-center gap-3 border-b border-slate-200 px-4 py-3">
        <span className="text-sm font-semibold text-slate-800">{item.sku}</span>
        <span className={`ml-auto text-xs font-semibold px-2 py-1 rounded-full ${item.status === 'active' ? 'bg-emerald-50 text-emerald-600' : 'bg-slate-100 text-slate-500'}`}>
          {item.status === 'active' ? 'Đang kinh doanh' : 'Ngừng kinh doanh'}
        </span>
      </div>

      {/* Tabs */}
      <div className="flex shrink-0 gap-1 border-b border-slate-200 px-4">
        {TABS.map(tab => (
          <button
            key={tab.id}
            onClick={() => setActiveTab(tab.id)}
            className={`px-4 py-2.5 text-xs font-semibold transition-colors border-b-2 -mb-px ${
              activeTab === tab.id
                ? 'border-indigo-600 text-indigo-600'
                : 'border-transparent text-slate-500 hover:text-slate-800'
            }`}
          >
            {tab.label}
          </button>
        ))}
      </div>

      {/* Shop selector — chỉ hiện ở tab Thông tin & Mô tả */}
      {activeTab === 'info' && (
        <div className="flex shrink-0 items-center gap-2 border-b border-slate-100 bg-white px-4 py-2 flex-wrap">
          {shops.filter((_, idx) => !isShopLocked || idx === activeShop).map((shop, idx) => (
            <div key={idx} className="relative flex items-center">
              <button
                onClick={() => setActiveShop(idx)}
                className={`pl-3 pr-7 py-1.5 rounded-full text-xs font-semibold transition-colors ${
                  activeShop === idx
                    ? 'bg-indigo-600 text-white'
                    : 'bg-slate-100 text-slate-500 hover:bg-slate-200'
                }`}
              >
                {shop.name?.trim() ? shop.name : `Shop ${idx + 1}`}
              </button>
              {!isShopLocked && (
                <button
                  onClick={() => {
                    const updated = shops.filter((_, i) => i !== idx);
                    setDraft(d => ({ ...d, shops: updated }));
                    if (activeShop >= updated.length) setActiveShop(Math.max(0, updated.length - 1));
                  }}
                  className="absolute right-1.5 flex h-4 w-4 items-center justify-center rounded-full text-2xs hover:bg-black/10 transition-colors"
                  title="Xoá shop"
                >
                  ×
                </button>
              )}
            </div>
          ))}
          {!isShopLocked && (
            <button
              onClick={() => {
                const updated = [...shops, { name: `Shop ${shops.length + 1}`, link: '' }];
                setDraft(d => ({ ...d, shops: updated }));
                setActiveShop(updated.length - 1);
              }}
              className="flex h-7 w-7 items-center justify-center rounded-full border border-dashed border-slate-300 text-slate-400 hover:border-indigo-400 hover:text-indigo-600 transition-colors text-lg leading-none"
              title="Thêm shop"
            >
              +
            </button>
          )}
          {isShopLocked && (
            <span className="text-2xs text-slate-400 italic">Đang lọc theo shop này</span>
          )}
        </div>
      )}

      {/* Content */}
      <div className="bg-slate-50 p-6">
        {activeTab === 'info' && (
          <div className="space-y-4">
            {/* Khung thông tin sản phẩm */}
            <div className="rounded-lg border border-slate-200 bg-white p-6">
              {/* Ảnh + tên */}
              <div className="flex gap-5 mb-6">
                <label className="relative flex h-24 w-24 shrink-0 cursor-pointer items-center justify-center overflow-hidden rounded-lg border-2 border-dashed border-slate-200 bg-slate-50 hover:border-indigo-300 transition-colors">
                  {uploadingImg ? (
                    <span className="text-xs text-slate-400">Đang tải...</span>
                  ) : draft.imageUrl ? (
                    <img src={draft.imageUrl} alt={draft.name} className="h-full w-full object-cover" />
                  ) : (
                    <ImagePlus className="h-8 w-8 text-slate-300" />
                  )}
                  <input type="file" accept="image/*" className="hidden" onChange={handleImageUpload} />
                </label>
                <div className="flex-1 space-y-2">
                  {editing ? (
                    <input
                      type="text"
                      value={draft.name}
                      onChange={e => setDraft(d => ({ ...d, name: e.target.value }))}
                      className="w-full rounded-lg border border-slate-200 px-3 py-2 text-lg font-semibold text-slate-900 outline-none focus:border-indigo-400"
                    />
                  ) : (
                    <h2 className="text-lg font-semibold text-slate-900">{item.name}</h2>
                  )}
                  {editing ? (
                    <input
                      type="text"
                      placeholder="Nhập nhóm hàng..."
                      value={draft.groupId ?? ''}
                      onChange={e => setDraft(d => ({ ...d, groupId: e.target.value }))}
                      className="w-full rounded-lg border border-slate-200 px-3 py-1.5 text-sm text-slate-700 outline-none focus:border-indigo-400"
                    />
                  ) : (
                    <p className="text-sm text-slate-500">
                      Nhóm hàng: <span className={item.groupId ? 'font-semibold text-slate-700' : 'italic text-slate-400'}>
                        {item.groupId || '— (chưa thiết lập)'}
                      </span>
                    </p>
                  )}
                </div>
              </div>

              {/* Grid thông tin + shop */}
              <div className="grid grid-cols-2 gap-4 border-t border-slate-100 pt-5 md:grid-cols-4">
                <div>
                  <p className="text-xs text-slate-500 mb-1">Mã sản phẩm</p>
                  <p className="text-sm font-semibold text-slate-900">{item.sku}</p>
                </div>
                <div>
                  <p className="text-xs text-slate-500 mb-1">Giá nhập</p>
                  {editing ? (
                    <input type="number" value={draft.importPrice}
                      onChange={e => setDraft(d => ({ ...d, importPrice: Number(e.target.value) }))}
                      className="w-full rounded border border-slate-200 px-2 py-1 text-sm outline-none focus:border-indigo-400"
                    />
                  ) : (
                    <p className="text-sm font-semibold text-rose-600">{formatNumber(item.importPrice)}đ</p>
                  )}
                </div>
                <div>
                  <p className="text-xs text-slate-500 mb-1">Tồn kho</p>
                  <p className={`text-sm font-semibold ${stock <= 0 ? 'text-rose-500' : 'text-emerald-600'}`}>{stock}</p>
                </div>
                <div>
                  <p className="text-xs text-slate-500 mb-1">Màu</p>
                  <p className="text-sm text-slate-700">{color ?? '—'}</p>
                </div>
                <div>
                  <p className="text-xs text-slate-500 mb-1">Size</p>
                  <p className="text-sm text-slate-700">{size ?? '—'}</p>
                </div>
                <div>
                  <p className="text-xs text-slate-500 mb-1">Tên shop</p>
                  {editing ? (
                    <input type="text" placeholder="Tên shop..." value={shops[activeShop]?.name ?? ''}
                      onChange={e => setShop(activeShop, 'name', e.target.value)}
                      className="w-full rounded border border-slate-200 px-2 py-1 text-sm outline-none focus:border-indigo-400"
                    />
                  ) : (
                    <p className="text-sm text-slate-700">{shops[activeShop]?.name || <span className="italic text-slate-400">Chưa có</span>}</p>
                  )}
                </div>
                <div className="md:col-span-2">
                  <p className="text-xs text-slate-500 mb-1">Link sản phẩm</p>
                  {editing ? (
                    <input type="text" placeholder="https://..." value={shops[activeShop]?.link ?? ''}
                      onChange={e => setShop(activeShop, 'link', e.target.value)}
                      className="w-full rounded border border-slate-200 px-2 py-1 text-sm outline-none focus:border-indigo-400"
                    />
                  ) : shops[activeShop]?.link ? (
                    <a href={shops[activeShop].link} target="_blank" rel="noreferrer" className="flex items-center gap-1 text-sm text-indigo-600 hover:underline truncate">
                      {shops[activeShop].link} <ExternalLink className="h-3 w-3 shrink-0" />
                    </a>
                  ) : (
                    <span className="text-sm italic text-slate-400">Chưa có link</span>
                  )}
                </div>
              </div>
            </div>

            {/* Khung mô tả */}
            <div className="rounded-lg border border-slate-200 bg-white p-6">
              <p className="text-sm font-semibold text-slate-700 mb-3">Mô tả</p>
              {editing ? (
                <textarea
                  value={draft.description ?? ''}
                  onChange={e => setDraft(d => ({ ...d, description: e.target.value }))}
                  rows={5}
                  placeholder="Nhập mô tả sản phẩm..."
                  className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm text-slate-700 outline-none focus:border-indigo-400 resize-none"
                />
              ) : (
                <p className="text-sm text-slate-500 min-h-[80px]">{item.description || <span className="italic">Chưa có mô tả</span>}</p>
              )}
            </div>
          </div>
        )}

        {activeTab === 'stock_card' && (
          <div className="rounded-lg border border-slate-200 bg-white overflow-hidden">
            <div className="border-b border-slate-100 px-4 py-3">
              <h3 className="text-sm font-semibold text-slate-700">Thẻ kho — {item.sku}</h3>
            </div>
            <div className="overflow-auto">
              <table className="w-full min-w-[700px] text-left text-sm border-collapse">
                <thead className="bg-slate-50 text-xs font-semibold uppercase text-slate-500">
                  <tr className="border-b border-slate-200">
                    <th className="px-4 py-3">Ngày</th>
                    <th className="px-4 py-3">Loại</th>
                    <th className="px-4 py-3">Nền tảng</th>
                    <th className="px-4 py-3 text-right">Số lượng</th>
                    <th className="px-4 py-3 text-right">Giá</th>
                    <th className="px-4 py-3">Ghi chú</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {[
                    ...inRecords.map(r => ({ date: r.date, type: 'Nhập kho', platform: '—', qty: r.quantity, price: r.importPrice, note: r.note ?? '' })),
                    ...outRecords.map(r => ({ date: r.date, type: r.status === 'RETURN' ? 'Hoàn hàng' : 'Xuất kho', platform: r.platform ?? '—', qty: r.status === 'RETURN' ? r.quantity : -r.quantity, price: r.salePrice, note: r.status ?? '' }))
                  ].sort((a, b) => b.date.localeCompare(a.date)).map((r, i) => (
                    <tr key={i} className="hover:bg-slate-50">
                      <td className="px-4 py-3 text-slate-600">{r.date}</td>
                      <td className="px-4 py-3">
                        <span className={`text-xs font-semibold px-2 py-0.5 rounded-full ${r.qty > 0 ? 'bg-emerald-50 text-emerald-600' : 'bg-rose-50 text-rose-600'}`}>
                          {r.type}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-xs text-slate-500">{r.platform}</td>
                      <td className={`px-4 py-3 text-right font-semibold tabular-nums ${r.qty > 0 ? 'text-emerald-600' : 'text-rose-600'}`}>
                        {r.qty > 0 ? '+' : ''}{r.qty}
                      </td>
                      <td className="px-4 py-3 text-right tabular-nums text-slate-700">{formatNumber(r.price)}đ</td>
                      <td className="px-4 py-3 text-slate-500 text-xs">{r.note}</td>
                    </tr>
                  ))}
                  {inRecords.length === 0 && outRecords.length === 0 && (
                    <tr><td colSpan={6} className="px-4 py-12 text-center text-sm text-slate-400">Chưa có lịch sử</td></tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {activeTab === 'inventory' && (() => {
          const totalIn = inRecords.reduce((s, r) => s + r.quantity, 0)
            + outRecords.filter(r => r.status === 'RETURN').reduce((s, r) => s + r.quantity, 0);
          const totalOut = outRecords.filter(r => r.status !== 'RETURN').reduce((s, r) => s + r.quantity, 0);
          return (
            <div className="rounded-lg border border-slate-200 bg-white p-6">
              <h3 className="text-sm font-semibold text-slate-700 mb-4">Tồn kho — {item.sku}</h3>
              <div className="grid grid-cols-3 gap-4">
                <div className="rounded-lg border border-slate-100 bg-slate-50 p-4">
                  <p className="text-xs text-slate-500 mb-1">Tổng nhập</p>
                  <p className="text-xl font-semibold text-emerald-600">{totalIn}</p>
                  <p className="text-2xs text-slate-400 mt-1">Nhập kho + hoàn về đã xác nhận</p>
                </div>
                <div className="rounded-lg border border-slate-100 bg-slate-50 p-4">
                  <p className="text-xs text-slate-500 mb-1">Tổng xuất</p>
                  <p className="text-xl font-semibold text-rose-600">{totalOut}</p>
                  <p className="text-2xs text-slate-400 mt-1">Tất cả các shop</p>
                </div>
                <div className="rounded-lg border border-slate-100 bg-slate-50 p-4">
                  <p className="text-xs text-slate-500 mb-1">Tồn hiện tại</p>
                  <p className={`text-xl font-semibold ${stock <= 0 ? 'text-rose-500' : 'text-slate-900'}`}>{stock}</p>
                </div>
              </div>
            </div>
          );
        })()}

        {activeTab === 'channels' && (() => {
          const shopList = (item.shops ?? []).filter(s => s.name || s.link);
          return (
            <div className="rounded-lg border border-slate-200 bg-white p-6">
              <h3 className="text-sm font-semibold text-slate-700 mb-4">Kênh bán</h3>
              {shopList.length > 0 ? (
                <div className="space-y-3">
                  {shopList.map((shop, idx) => (
                    <div key={idx} className="flex items-center justify-between rounded-lg border border-slate-100 bg-slate-50 px-4 py-3">
                      <div>
                        <p className="text-sm font-semibold text-slate-800">{shop.name || `Shop ${idx + 1}`}</p>
                        {shop.link && <p className="text-xs text-slate-400 mt-0.5">{shop.link}</p>}
                      </div>
                      {shop.link && (
                        <a href={shop.link} target="_blank" rel="noreferrer" className="flex items-center gap-1 text-xs text-indigo-600 hover:underline">
                          Xem <ExternalLink className="h-3 w-3" />
                        </a>
                      )}
                    </div>
                  ))}
                </div>
              ) : (
                <p className="text-sm italic text-slate-400">Chưa có kênh bán nào được thiết lập</p>
              )}
            </div>
          );
        })()}
      </div>

      {/* Hàng nút */}
      <div className="flex shrink-0 items-center justify-between border-t border-slate-200 bg-white px-6 py-3">
        <div className="flex items-center gap-2">
          {deleteConfirm ? (
            <>
              <span className="text-sm text-rose-600 font-semibold">Xác nhận xoá?</span>
              <button onClick={onDelete} className="rounded-lg bg-rose-600 px-3 py-1.5 text-xs font-semibold text-white hover:bg-rose-700">Xoá</button>
              <button onClick={() => setDeleteConfirm(false)} className="rounded-lg border border-slate-200 px-3 py-1.5 text-xs font-semibold text-slate-600 hover:bg-slate-50">Huỷ</button>
            </>
          ) : (
            <button onClick={() => setDeleteConfirm(true)} className="flex items-center gap-1.5 rounded-lg border border-rose-200 px-3 py-1.5 text-xs font-semibold text-rose-600 hover:bg-rose-50">
              <Trash2 className="h-3.5 w-3.5" /> Xoá
            </button>
          )}
          <button
            onClick={async () => {
              const updated = { ...draft, status: item.status === 'active' ? 'inactive' : 'active' };
              setDraft(updated);
              await onUpdate(updated);
            }}
            className="flex items-center gap-1.5 rounded-lg border border-slate-200 px-3 py-1.5 text-xs font-semibold text-slate-600 hover:bg-slate-50"
          >
            <StopCircle className="h-3.5 w-3.5" />
            {item.status === 'active' ? 'Ngừng kinh doanh' : 'Kích hoạt lại'}
          </button>
        </div>
        <div className="flex items-center gap-2">
          {editing ? (
            <>
              <button onClick={() => { setEditing(false); setDraft(item); }} className="rounded-lg border border-slate-200 px-4 py-1.5 text-xs font-semibold text-slate-600 hover:bg-slate-50">Huỷ</button>
              <button onClick={handleSave} className="rounded-lg bg-indigo-600 px-4 py-1.5 text-xs font-semibold text-white hover:bg-indigo-700">Lưu</button>
            </>
          ) : (
            <button onClick={() => setEditing(true)} className="flex items-center gap-1.5 rounded-lg bg-slate-900 px-4 py-1.5 text-xs font-semibold text-white hover:bg-black">
              <Pencil className="h-3.5 w-3.5" /> Chỉnh sửa
            </button>
          )}
        </div>
      </div>
    </div>
  );
};

export default SourceDetailPage;
