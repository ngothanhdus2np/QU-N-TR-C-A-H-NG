import React from 'react';
import {
  Check,
  CloudOff,
  Loader2,
  RefreshCw,
  Sparkles,
  Users,
} from 'lucide-react';

export interface FacebookPage {
  id: string;
  name: string;
  access_token?: string;
}

export interface AutoPostLog {
  id: string;
  type: 'success' | 'error' | string;
  time: string;
  message: string;
}

export interface AutoPostConfig {
  enabled: boolean;
  selectedPageId: string;
  selectedPageName: string;
  selectedPageAccessToken: string;
  logs: AutoPostLog[];
}

interface MarketingFacebookTabProps {
  fbAppConfig: { appId: string; appSecret: string };
  setFbAppConfig: React.Dispatch<React.SetStateAction<{ appId: string; appSecret: string }>>;
  fbPages: FacebookPage[];
  selectedPageId: string;
  setSelectedPageId: React.Dispatch<React.SetStateAction<string>>;
  isFbConnected: boolean;
  setIsFbConnected: React.Dispatch<React.SetStateAction<boolean>>;
  fbLoading: boolean;
  autoPostConfig: AutoPostConfig;
  setAutoPostConfig: React.Dispatch<React.SetStateAction<AutoPostConfig>>;
  fetchFbPages: () => void;
  handleSaveFbConfig: () => void;
  handleConnectFb: () => void;
  handleToggleAutoPost: (enabled: boolean) => void;
}

const MarketingFacebookTab: React.FC<MarketingFacebookTabProps> = ({
  fbAppConfig,
  setFbAppConfig,
  fbPages,
  selectedPageId,
  setSelectedPageId,
  isFbConnected,
  setIsFbConnected,
  fbLoading,
  autoPostConfig,
  setAutoPostConfig,
  fetchFbPages,
  handleSaveFbConfig,
  handleConnectFb,
  handleToggleAutoPost,
}) => (
  <div className="p-8 flex flex-col gap-8">
    <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
      <div className="bg-white p-8 rounded-[2.5rem] border border-slate-200 shadow-sm space-y-6">
        <div className="flex items-center gap-3 mb-2">
          <div className="p-2 bg-indigo-50 text-indigo-600 rounded-lg">
            <Sparkles size={20} />
          </div>
          <h3 className="text-sm font-black uppercase text-slate-800">Cấu hình & Kết nối</h3>
        </div>

        <div className="space-y-4">
          <div className="space-y-1.5">
            <label className="text-[10px] font-normal text-slate-400 uppercase ml-1">App ID</label>
            <input
              type="text"
              value={fbAppConfig.appId}
              onChange={(e) => setFbAppConfig((prev) => ({ ...prev, appId: e.target.value }))}
              className="w-full bg-slate-50 border border-slate-100 rounded-xl px-4 py-3 text-xs font-normal outline-none focus:border-indigo-500"
              placeholder="Nhập App ID..."
            />
          </div>
          <div className="space-y-1.5">
            <label className="text-[10px] font-normal text-slate-400 uppercase ml-1">App Secret</label>
            <input
              type="password"
              value={fbAppConfig.appSecret}
              onChange={(e) => setFbAppConfig((prev) => ({ ...prev, appSecret: e.target.value }))}
              className="w-full bg-slate-50 border border-slate-100 rounded-xl px-4 py-3 text-xs font-normal outline-none focus:border-indigo-500"
              placeholder="Nhập App Secret..."
            />
          </div>
          <div className="flex gap-2">
            <button
              onClick={handleSaveFbConfig}
              disabled={fbLoading}
              className="flex-1 py-4 bg-slate-900 text-white rounded-xl font-normal text-[10px] uppercase hover:bg-slate-800 transition-all disabled:opacity-50"
            >
              {fbLoading ? 'Đang lưu...' : 'Lưu cấu hình'}
            </button>

            {!isFbConnected ? (
              <button
                onClick={handleConnectFb}
                disabled={fbLoading || !fbAppConfig.appId}
                className="flex-1 py-4 bg-indigo-600 text-white rounded-xl font-normal text-[10px] uppercase shadow-lg hover:bg-indigo-700 transition-all disabled:opacity-50 flex items-center justify-center gap-2"
              >
                {fbLoading ? <Loader2 size={14} className="animate-spin" /> : null}
                Kết nối ngay
              </button>
            ) : (
              <div className="flex-1 flex gap-2">
                <button
                  onClick={fetchFbPages}
                  disabled={fbLoading}
                  className="flex-1 py-4 bg-indigo-50 text-indigo-600 border border-indigo-100 rounded-xl font-normal text-[10px] uppercase hover:bg-indigo-100 transition-all flex items-center justify-center gap-2"
                >
                  <RefreshCw size={14} className={fbLoading ? 'animate-spin' : ''} />
                  Làm mới
                </button>
                <button
                  onClick={() => setIsFbConnected(false)}
                  className="flex-1 py-4 bg-rose-50 text-rose-600 border border-rose-100 rounded-xl font-normal text-[10px] uppercase hover:bg-rose-100 transition-all"
                >
                  Ngắt kết nối
                </button>
              </div>
            )}
          </div>
        </div>

        {isFbConnected && (
          <div className="p-4 bg-green-50 border border-green-100 rounded-2xl flex items-center justify-between gap-3">
            <div className="flex items-center gap-3">
              <div className="w-2 h-2 bg-green-500 rounded-full animate-pulse"></div>
              <span className="text-[10px] font-normal text-green-700 uppercase">Tài khoản đã sẵn sàng</span>
            </div>
            <button onClick={fetchFbPages} className="text-[9px] font-normal text-indigo-600 uppercase underline">
              Cập nhật lại
            </button>
          </div>
        )}
      </div>

      <div className="bg-white p-8 rounded-[2.5rem] border border-slate-200 shadow-sm space-y-6">
        <div className="flex items-center justify-between mb-2">
          <div className="flex items-center gap-3">
            <div className={`p-2 rounded-lg ${isFbConnected ? 'bg-indigo-50 text-indigo-600' : 'bg-slate-50 text-slate-400'}`}>
              <Users size={20} />
            </div>
            <h3 className="text-sm font-black uppercase text-slate-800">Danh sách Fanpage</h3>
          </div>
          {isFbConnected && (
            <button
              onClick={fetchFbPages}
              disabled={fbLoading}
              className="p-2 hover:bg-slate-50 rounded-full text-slate-400 hover:text-indigo-600 transition-all"
              title="Tải lại danh sách"
            >
              <RefreshCw size={16} className={fbLoading ? 'animate-spin' : ''} />
            </button>
          )}
        </div>

        {!isFbConnected ? (
          <div className="flex flex-col items-center justify-center py-12 gap-4 text-center">
            <div className="w-16 h-16 bg-slate-50 rounded-full flex items-center justify-center text-slate-200">
              <CloudOff size={32} />
            </div>
            <p className="text-[10px] text-slate-400 font-normal uppercase max-w-[200px] leading-relaxed">
              Vui lòng kết nối Facebook ở cột bên trái để xem danh sách Fanpage.
            </p>
          </div>
        ) : (
          <div className="space-y-4">
            <label className="text-[10px] font-normal text-slate-400 uppercase ml-1">Chọn Fanpage để đăng bài</label>
            <div className="grid grid-cols-1 gap-2 max-h-[300px] overflow-y-auto pr-2 custom-scrollbar">
              {fbPages.length > 0 ? (
                fbPages.map((page) => (
                  <button
                    key={page.id}
                    onClick={() => {
                      setSelectedPageId(page.id);
                      if (autoPostConfig.enabled) {
                        handleToggleAutoPost(true);
                      }
                    }}
                    className={`flex items-center gap-3 p-3 rounded-xl border transition-all text-left ${
                      selectedPageId === page.id ? 'border-indigo-600 bg-indigo-50 ring-1 ring-indigo-600' : 'border-slate-100 hover:border-slate-200 bg-slate-50'
                    }`}
                  >
                    <div className="w-10 h-10 bg-white rounded-full border border-slate-200 flex items-center justify-center overflow-hidden">
                      <img src={`https://graph.facebook.com/${page.id}/picture`} alt="" className="w-full h-full object-cover" />
                    </div>
                    <div className="flex flex-col">
                      <span className="text-[11px] font-normal text-slate-800 uppercase">{page.name}</span>
                      <span className="text-[9px] text-slate-400 font-normal uppercase tracking-tighter">ID: {page.id}</span>
                    </div>
                    {selectedPageId === page.id && <Check className="ml-auto text-indigo-600" size={16} />}
                  </button>
                ))
              ) : (
                <div className="flex flex-col items-center gap-3 py-10 text-center">
                  <p className="text-[10px] font-normal text-slate-400 uppercase">Không tìm thấy Fanpage nào</p>
                  <p className="text-[9px] text-slate-400 leading-relaxed max-w-[200px]">
                    Lưu ý: Bạn cần "Tích chọn" các Fanpage trong cửa sổ Facebook khi kết nối. Hãy thử "Ngắt kết nối" và kết nối lại.
                  </p>
                </div>
              )}
            </div>

            {isFbConnected && selectedPageId && (
              <div className="pt-4 border-t border-slate-100 space-y-4">
                <div className="flex items-center justify-between p-4 bg-indigo-50 rounded-2xl border border-indigo-100">
                  <div className="flex flex-col">
                    <span className="text-[10px] font-normal text-indigo-900 uppercase">Tự động đăng bài</span>
                    <span className="text-[9px] text-indigo-600 font-normal uppercase">Theo lịch đã lên</span>
                  </div>
                  <button
                    onClick={() => handleToggleAutoPost(!autoPostConfig.enabled)}
                    className={`w-12 h-6 rounded-full transition-all relative ${autoPostConfig.enabled ? 'bg-indigo-600' : 'bg-slate-300'}`}
                  >
                    <div className={`absolute top-1 w-4 h-4 bg-white rounded-full transition-all ${autoPostConfig.enabled ? 'left-7' : 'left-1'}`}></div>
                  </button>
                </div>

                <div className="space-y-2">
                  <div className="flex items-center justify-between px-1">
                    <span className="text-[9px] font-normal text-slate-400 uppercase">Nhật ký hoạt động</span>
                    <button
                      onClick={() => fetch('/api/fb/auto-post/logs').then((r) => r.json()).then((l: AutoPostLog[]) => setAutoPostConfig((prev) => ({ ...prev, logs: l })))}
                      className="text-[9px] font-normal text-indigo-600 uppercase"
                    >
                      Làm mới
                    </button>
                  </div>
                  <div className="bg-slate-50 rounded-xl p-3 border border-slate-100 max-h-[120px] overflow-y-auto custom-scrollbar space-y-2">
                    {autoPostConfig.logs.length > 0 ? (
                      autoPostConfig.logs.slice(0, 5).map((log) => (
                        <div key={log.id} className="flex flex-col gap-0.5 border-b border-slate-200 pb-1 last:border-0">
                          <div className="flex items-center justify-between">
                            <span className={`text-[8px] font-normal uppercase ${log.type === 'success' ? 'text-green-600' : log.type === 'error' ? 'text-rose-600' : 'text-slate-500'}`}>
                              {log.type}
                            </span>
                            <span className="text-[7px] text-slate-400 font-normal">{log.time}</span>
                          </div>
                          <p className="text-[9px] text-slate-700 font-normal leading-tight">{log.message}</p>
                        </div>
                      ))
                    ) : (
                      <p className="text-center py-4 text-[8px] font-normal text-slate-400 uppercase italic">Chưa có hoạt động nào</p>
                    )}
                  </div>
                </div>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  </div>
);

export default MarketingFacebookTab;
