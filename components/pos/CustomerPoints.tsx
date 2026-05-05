
import React, { useState } from 'react';
import { Users, Search, Plus, Star, Phone, X } from 'lucide-react';
import { POSCustomer } from '../../types';

interface CustomerPointsProps {
  customers: POSCustomer[];
  onUpdateCustomers: (customers: POSCustomer[]) => void;
  onUpdateSurgical?: (updates: { key: any, item: any, isDelete?: boolean }[]) => Promise<void>;
}

const generateId = () => {
  try {
    return crypto.randomUUID();
  } catch (e) {
    return Math.random().toString(36).substring(2) + Date.now().toString(36);
  }
};

const CustomerPoints: React.FC<CustomerPointsProps> = ({ customers, onUpdateCustomers, onUpdateSurgical }) => {
  const [searchTerm, setSearchTerm] = useState('');
  const [showAddModal, setShowAddModal] = useState(false);
  const [formData, setFormData] = useState<Partial<POSCustomer>>({
    name: '',
    phone: '',
    email: '',
    address: '',
    points: 0,
    totalSpent: 0,
    tier: 'Standard'
  });

  const filteredCustomers = customers.filter(c => 
    (c.name?.toLowerCase() || '').includes(searchTerm.toLowerCase()) || 
    (c.phone || '').includes(searchTerm)
  );

  const handleAddCustomer = () => {
    if (!formData.name || !formData.phone) {
      alert('Vui lòng nhập tên và số điện thoại!');
      return;
    }

    const newCustomer: POSCustomer = {
      ...formData,
      id: generateId(),
      points: formData.points || 0,
      totalSpent: formData.totalSpent || 0,
      tier: formData.tier || 'Standard'
    } as POSCustomer;

    if (onUpdateSurgical) {
      onUpdateSurgical([{ key: 'posCustomers', item: newCustomer }]);
    } else {
      onUpdateCustomers([...customers, newCustomer]);
    }
    setShowAddModal(false);
    setFormData({ name: '', phone: '', email: '', address: '', points: 0, totalSpent: 0, tier: 'Standard' });
  };

  const getTierColor = (tier: string) => {
    switch(tier) {
      case 'Diamond': return 'bg-indigo-100 text-indigo-700';
      case 'Gold': return 'bg-amber-100 text-amber-700';
      case 'Silver': return 'bg-slate-200 text-slate-700';
      default: return 'bg-slate-100 text-slate-600';
    }
  };

  return (
    <div className="space-y-8 animate-in fade-in slide-in-from-bottom-4 duration-500">
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center bg-white p-6 rounded-[2rem] shadow-xl border border-slate-200 gap-6">
        <div className="flex gap-4 w-full md:w-auto">
          <div className="relative flex-1">
            <Search className="absolute left-4 top-1/2 -translate-y-1/2 h-5 w-5 text-slate-400" />
            <input 
              type="text" 
              placeholder="Tìm tên, số điện thoại khách hàng... (F4)" 
              className="w-full md:w-80 pl-12 pr-6 py-4 bg-slate-50 border border-slate-200 rounded-2xl text-sm font-bold outline-none focus:bg-white focus:border-indigo-400 transition-all shadow-inner placeholder:text-slate-400"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
            />
          </div>
        </div>
        <button 
          onClick={() => setShowAddModal(true)}
          className="px-8 py-4 bg-slate-950 text-white rounded-[1.5rem] font-black text-xs uppercase tracking-[0.2em] shadow-2xl shadow-slate-950/20 hover:bg-indigo-600 transition-all flex items-center justify-center gap-3 active:scale-95 flex-1 md:flex-none"
        >
          <Plus className="h-5 w-5" />
          Đăng ký hội viên mới
        </button>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
        {filteredCustomers.length === 0 ? (
          <div className="col-span-full py-32 text-center text-slate-300 italic bg-white rounded-[3rem] border border-dashed border-slate-200 flex flex-col items-center shadow-inner">
            <div className="w-20 h-20 bg-slate-50 rounded-[2rem] flex items-center justify-center mb-6 border border-slate-100">
              <Users className="h-10 w-10 opacity-20" />
            </div>
            <p className="font-black uppercase text-xs tracking-[0.3em]">Không tìm thấy thông tin hội viên</p>
          </div>
        ) : (
          filteredCustomers.map(c => (
            <div key={c.id} className="bg-white p-8 rounded-[2.5rem] shadow-xl border border-slate-200 flex flex-col relative overflow-hidden group hover:shadow-2xl transition-all border-b-4 border-b-transparent hover:border-b-indigo-500">
              <div className={`absolute top-0 right-0 px-6 py-2 rounded-bl-[1.5rem] text-[10px] font-black uppercase tracking-[0.2em] shadow-sm ${getTierColor(c.tier)}`}>
                {c.tier}
              </div>
              
              <div className="flex items-start gap-6 mb-8">
                <div className="w-16 h-16 rounded-[1.25rem] bg-slate-50 border border-slate-100 flex items-center justify-center text-slate-300 group-hover:bg-indigo-50 group-hover:text-indigo-500 group-hover:border-indigo-100 transition-all font-black text-2xl shadow-inner uppercase">
                  {c.name.charAt(0)}
                </div>
                <div>
                  <h3 className="font-black text-slate-950 uppercase tracking-tighter text-lg leading-tight group-hover:text-indigo-600 transition-colors">{c.name}</h3>
                  <div className="flex items-center gap-2 text-slate-400 text-xs font-bold mt-2 uppercase tracking-widest">
                    <Phone className="h-3 w-3 text-emerald-500" />
                    {c.phone}
                  </div>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-6 mt-auto pt-6 border-t border-slate-50 bg-slate-50/50 -mx-8 -mb-8 p-8">
                <div className="space-y-1">
                  <div className="text-[9px] font-black text-slate-400 uppercase tracking-[0.2em]">Điểm tích lũy</div>
                  <div className="flex items-center gap-2">
                    <Star className="h-4 w-4 text-amber-500 fill-amber-500" />
                    <span className="font-black text-slate-950 text-base tabular-nums">{c.points.toLocaleString()}</span>
                  </div>
                </div>
                <div className="text-right space-y-1">
                  <div className="text-[9px] font-black text-slate-400 uppercase tracking-[0.2em]">Tổng chi tiêu</div>
                  <div className="font-black text-indigo-600 text-base tabular-nums">{c.totalSpent.toLocaleString()}<span className="text-[10px] ml-0.5">đ</span></div>
                </div>
              </div>
            </div>
          ))
        )}
      </div>

      {/* Modal Thêm Khách Hàng */}
      {showAddModal && (
        <div className="fixed inset-0 bg-slate-950/80 backdrop-blur-md z-[100] flex items-center justify-center p-6">
          <div className="bg-white rounded-[3rem] shadow-[0_32px_64px_-16px_rgba(0,0,0,0.4)] w-full max-w-xl overflow-hidden animate-in fade-in zoom-in-95 duration-500 border border-slate-200">
            <div className="bg-slate-50 p-10 border-b border-slate-200 flex justify-between items-center">
              <div>
                <h3 className="font-black text-2xl text-slate-950 uppercase tracking-tighter">Hồ sơ hội viên</h3>
                <p className="text-[10px] font-black text-slate-400 uppercase tracking-[0.3em] mt-2 italic">Hệ thống chăm sóc khách hàng CFO Brain</p>
              </div>
              <button onClick={() => setShowAddModal(false)} className="h-12 w-12 flex items-center justify-center hover:bg-white rounded-2xl text-slate-400 hover:text-rose-500 transition-all shadow-sm border border-transparent hover:border-slate-100"><X className="h-6 w-6" /></button>
            </div>
            <div className="p-10 space-y-8">
              <div className="space-y-6">
                <div className="grid grid-cols-2 gap-6">
                  <div className="col-span-2 space-y-2">
                    <label className="text-[10px] font-black text-slate-500 uppercase ml-2 tracking-widest">Họ và tên khách hàng *</label>
                    <input 
                      placeholder="NGUYỄN VĂN A"
                      className="w-full p-4 bg-slate-50 border border-slate-200 rounded-2xl font-black text-slate-900 focus:bg-white focus:border-indigo-400 outline-none transition-all uppercase tracking-tight" 
                      value={formData.name} 
                      onChange={(e) => setFormData({...formData, name: e.target.value})}
                    />
                  </div>
                  <div className="space-y-2">
                    <label className="text-[10px] font-black text-slate-500 uppercase ml-2 tracking-widest">Số điện thoại *</label>
                    <input 
                      placeholder="03xxxxxxxx"
                      className="w-full p-4 bg-slate-50 border border-slate-200 rounded-2xl font-black text-slate-900 focus:bg-white focus:border-indigo-400 outline-none transition-all tabular-nums" 
                      value={formData.phone} 
                      onChange={(e) => setFormData({...formData, phone: e.target.value})}
                    />
                  </div>
                  <div className="space-y-2">
                    <label className="text-[10px] font-black text-slate-500 uppercase ml-2 tracking-widest">Email liên hệ</label>
                    <input 
                      placeholder="khachhang@example.com"
                      className="w-full p-4 bg-slate-50 border border-slate-200 rounded-2xl font-bold text-slate-600 focus:bg-white focus:border-indigo-400 outline-none transition-all" 
                      value={formData.email} 
                      onChange={(e) => setFormData({...formData, email: e.target.value})}
                    />
                  </div>
                  <div className="col-span-2 space-y-2">
                    <label className="text-[10px] font-black text-slate-500 uppercase ml-2 tracking-widest">Địa chỉ giao hàng</label>
                    <textarea 
                      placeholder="Nhập địa chỉ chi tiết của khách hàng..."
                      className="w-full p-4 bg-slate-50 border border-slate-200 rounded-2xl font-bold text-slate-600 focus:bg-white focus:border-indigo-400 outline-none transition-all min-h-[100px] no-scrollbar" 
                      value={formData.address} 
                      onChange={(e) => setFormData({...formData, address: e.target.value})}
                    />
                  </div>
                </div>
              </div>
              <div className="flex gap-4 pt-4 border-t border-slate-100 mt-2">
                <button 
                  onClick={() => setShowAddModal(false)}
                  className="px-8 py-5 text-slate-400 font-black text-[11px] uppercase tracking-[0.2em] hover:text-slate-600 transition-colors"
                >
                  Bỏ qua
                </button>
                <button 
                  onClick={handleAddCustomer}
                  className="flex-1 py-5 bg-slate-950 text-white rounded-[1.5rem] font-black text-[11px] uppercase tracking-[0.2em] shadow-2xl shadow-slate-900/30 hover:bg-indigo-600 transition-all active:scale-95"
                >
                  Xác nhận đăng ký
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default CustomerPoints;
