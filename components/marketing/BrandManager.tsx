
import React, { useRef, useState } from 'react';
import { 
  UploadCloud, MessageSquare, Users, Loader2, Sparkles
} from 'lucide-react';
import { BrandProfile } from '../../types';
import { uploadImage } from '../../services/marketingStorageService';

interface BrandManagerProps {
  brandProfile: BrandProfile;
  onUpdate: (profile: BrandProfile) => void;
}

const BrandManager: React.FC<BrandManagerProps> = ({ brandProfile, onUpdate }) => {
  const [loading, setLoading] = useState(false);
  const logoUploadRef = useRef<HTMLInputElement>(null);

  const processAndUploadImage = async (file: File, callback: (url: string) => void) => {
    setLoading(true);
    const reader = new FileReader();
    reader.onload = (e) => {
      const img = new Image();
      img.onload = async () => {
        const canvas = document.createElement('canvas');
        let w = img.width, h = img.height;
        const max = 800; // Reduced from 1200 to 800 for optimization
        if (w > h) { if (w > max) { h *= max/w; w = max; } } else { if (h > max) { w *= max/h; h = max; } }
        canvas.width = w; canvas.height = h;
        canvas.getContext('2d')?.drawImage(img, 0, 0, w, h);
        
        canvas.toBlob(async (blob) => {
          if (blob) {
            // Add timestamp to filename to bypass cache and ensure uniqueness
            const timestamp = Date.now();
            const fileName = `logo_${timestamp}_${file.name}`;
            const publicUrl = await uploadImage('brand-assets', 'images', fileName, blob);
            if (publicUrl) {
              callback(publicUrl);
            } else {
              alert("Lỗi tải ảnh lên Cloud!");
            }
            setLoading(false);
          }
        }, 'image/jpeg', 0.7); // Reduced quality from 0.8 to 0.7 for better compression
      };
      img.src = e.target?.result as string;
    };
    reader.readAsDataURL(file);
  };

  return (
    <div className="p-8 h-full flex flex-col gap-8 overflow-hidden">
      <input type="file" ref={logoUploadRef} className="hidden" accept="image/*" onChange={e => {
        const f = e.target.files?.[0];
        if (f) processAndUploadImage(f, (url) => onUpdate({ ...brandProfile, logo: url }));
      }} />

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8 flex-1 overflow-hidden">
        <div className="flex flex-col gap-6">
          <div className="bg-white p-8 rounded-[2rem] border shadow-sm flex flex-col items-center gap-4">
            <span className="text-[10px] font-black uppercase text-slate-400 tracking-widest">Logo Thương Hiệu</span>
            <div onClick={() => logoUploadRef.current?.click()} className="w-32 h-32 rounded-[2rem] border-4 border-dashed border-slate-100 flex items-center justify-center cursor-pointer hover:border-indigo-400 transition-all overflow-hidden bg-slate-50 relative">
              {loading && (
                <div className="absolute inset-0 bg-white/50 flex items-center justify-center z-10">
                  <Loader2 className="animate-spin text-indigo-600" />
                </div>
              )}
              {brandProfile.logo ? <img src={brandProfile.logo} className="w-full h-full object-cover" /> : <UploadCloud size={32} className="text-slate-200"/>}
            </div>
          </div>
          <div className="bg-white p-8 rounded-[2rem] border shadow-sm flex flex-col gap-4">
             <span className="text-[10px] font-black uppercase text-indigo-600 tracking-widest flex items-center gap-2">Liên hệ & CTA</span>
             <div className="space-y-3">
               <div className="flex flex-col gap-1">
                 <label className="text-[9px] font-black uppercase text-slate-400">Tên cửa hàng</label>
                 <input value={brandProfile.name || ""} onChange={e => onUpdate({...brandProfile, name: e.target.value})} className="bg-slate-50 border rounded-xl p-3 text-xs font-bold outline-none w-full" placeholder="Tên cửa hàng (hiện trên hóa đơn)" />
               </div>
               <div className="flex flex-col gap-1">
                 <label className="text-[9px] font-black uppercase text-slate-400">Số điện thoại</label>
                 <input value={brandProfile.phone || ""} onChange={e => onUpdate({...brandProfile, phone: e.target.value})} className="bg-slate-50 border rounded-xl p-3 text-xs font-bold outline-none w-full" placeholder="Số điện thoại" />
               </div>
               <div className="flex flex-col gap-1">
                 <label className="text-[9px] font-black uppercase text-slate-400">Địa chỉ</label>
                 <input value={brandProfile.address || ""} onChange={e => onUpdate({...brandProfile, address: e.target.value})} className="bg-slate-50 border rounded-xl p-3 text-xs font-bold outline-none w-full" placeholder="Địa chỉ" />
               </div>
               <div className="flex flex-col gap-1">
                 <label className="text-[9px] font-black uppercase text-slate-400">Hashtag</label>
                 <input value={brandProfile.hashtags || ""} onChange={e => onUpdate({...brandProfile, hashtags: e.target.value})} className="bg-slate-50 border rounded-xl p-3 text-xs font-bold outline-none w-full" placeholder="#Hashtag" />
               </div>
             </div>
          </div>
        </div>
        <div className="lg:col-span-2 flex flex-col gap-8 overflow-hidden">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
             <div className="bg-white p-8 rounded-[2rem] border shadow-sm flex flex-col gap-4 h-64">
                <span className="text-[10px] font-black uppercase text-red-600 tracking-widest flex items-center gap-2"><MessageSquare size={14}/> Giọng văn thương hiệu</span>
                <p className="text-[10px] text-slate-400 font-medium leading-relaxed">Mô tả cách Phúc Sang trò chuyện với khách hàng (thân thiện, bình dân, chân thành...)</p>
                <textarea value={brandProfile.voice} onChange={e => onUpdate({...brandProfile, voice: e.target.value})} className="flex-1 bg-slate-50 p-4 rounded-xl text-xs font-medium outline-none resize-none border border-slate-100 focus:border-indigo-300 transition-all" />
             </div>
             <div className="bg-white p-8 rounded-[2rem] border shadow-sm flex flex-col gap-4 h-64">
                <span className="text-[10px] font-black uppercase text-green-600 tracking-widest flex items-center gap-2"><Users size={14}/> Khách hàng mục tiêu</span>
                <p className="text-[10px] text-slate-400 font-medium leading-relaxed">Ai là người thường xuyên mua sắm tại Phúc Sang? (Nội trợ, học sinh, công nhân...)</p>
                <textarea value={brandProfile.targetAudience} onChange={e => onUpdate({...brandProfile, targetAudience: e.target.value})} className="flex-1 bg-slate-50 p-4 rounded-xl text-xs font-medium outline-none resize-none border border-slate-100 focus:border-indigo-300 transition-all" />
             </div>
          </div>
          <div className="bg-white p-8 rounded-[2rem] border shadow-sm flex flex-col gap-4 flex-1">
             <span className="text-[10px] font-black uppercase text-amber-600 tracking-widest flex items-center gap-2"><Sparkles size={14}/> Câu chuyện thương hiệu</span>
             <p className="text-[10px] text-slate-400 font-medium leading-relaxed">Lý do Phúc Sang ra đời và giá trị cốt lõi mà bạn mang lại cho khách hàng.</p>
             <textarea value={brandProfile.story} onChange={e => onUpdate({...brandProfile, story: e.target.value})} className="flex-1 bg-slate-50 p-4 rounded-xl text-xs font-medium outline-none resize-none border border-slate-100 focus:border-indigo-300 transition-all" />
          </div>
        </div>
      </div>
    </div>
  );
};

export default BrandManager;
