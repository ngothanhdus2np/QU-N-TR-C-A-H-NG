
import React, { useState, useEffect } from 'react';
import { BrainCircuit, CheckCircle2, XCircle, Loader2, ShieldCheck, ServerCog, Mail, Send, Bell, Save, MessageCircle } from 'lucide-react';
import type { AlertConfig } from '../types';

interface ApiKeySettingsProps {
  isOpen: boolean;
  onClose: () => void;
}

const ApiKeySettings: React.FC<ApiKeySettingsProps> = ({ isOpen, onClose }) => {
  const [claudeStatus, setClaudeStatus] = useState<'idle' | 'testing' | 'success' | 'error'>('idle');
  const [claudeMessage, setClaudeMessage] = useState('');

  const [emailConfigured, setEmailConfigured] = useState<boolean | null>(null);
  const [emailTo, setEmailTo] = useState<string | null>(null);
  const [emailStatus, setEmailStatus] = useState<'idle' | 'sending' | 'success' | 'error'>('idle');
  const [emailMessage, setEmailMessage] = useState('');

  const [zaloConfigured, setZaloConfigured] = useState<boolean | null>(null);
  const [zaloFollowerId, setZaloFollowerId] = useState<string | null>(null);
  const [zaloStatus, setZaloStatus] = useState<'idle' | 'sending' | 'success' | 'error'>('idle');
  const [zaloMessage, setZaloMessage] = useState('');

  const [alertConfig, setAlertConfig] = useState<AlertConfig>({ defaultMinStock: 5, debtOverdueDays: 30, revenueDropPct: 50 });
  const [alertSaveStatus, setAlertSaveStatus] = useState<'idle' | 'saving' | 'saved' | 'error'>('idle');

  useEffect(() => {
    if (!isOpen) return;
    fetch('/api/notifications/status')
      .then(r => r.json())
      .then(d => {
        setEmailConfigured(d.emailConfigured);
        setEmailTo(d.emailTo);
        setZaloConfigured(d.zaloConfigured);
        setZaloFollowerId(d.zaloFollowerId);
      })
      .catch(() => { setEmailConfigured(false); setZaloConfigured(false); });
    fetch('/api/alerts/config')
      .then(r => r.json())
      .then(d => setAlertConfig(d))
      .catch(() => {});
  }, [isOpen]);

  const saveAlertConfig = async () => {
    setAlertSaveStatus('saving');
    try {
      const res = await fetch('/api/alerts/config', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(alertConfig),
      });
      const data = await res.json();
      setAlertSaveStatus(data.ok ? 'saved' : 'error');
      setTimeout(() => setAlertSaveStatus('idle'), 2000);
    } catch {
      setAlertSaveStatus('error');
      setTimeout(() => setAlertSaveStatus('idle'), 2000);
    }
  };

  const testClaude = async () => {
    setClaudeStatus('testing');
    setClaudeMessage('');
    try {
      const res = await fetch('/api/ai/test-connection');
      const data = await res.json();
      if (data.ok) {
        setClaudeStatus('success');
        setClaudeMessage(data.message || 'Kết nối thành công.');
      } else {
        setClaudeStatus('error');
        setClaudeMessage(data.error || 'Claude API không phản hồi.');
      }
    } catch {
      setClaudeStatus('error');
      setClaudeMessage('Không thể kết nối với server. Đảm bảo server đang chạy.');
    }
  };

  const sendTestEmail = async () => {
    setEmailStatus('sending');
    setEmailMessage('');
    try {
      const res = await fetch('/api/notifications/test-email', { method: 'POST' });
      const data = await res.json();
      if (data.ok) {
        setEmailStatus('success');
        setEmailMessage(data.message);
      } else {
        setEmailStatus('error');
        setEmailMessage(data.error);
      }
    } catch {
      setEmailStatus('error');
      setEmailMessage('Không thể gửi email. Kiểm tra lại cấu hình.');
    }
  };

  const sendTestZalo = async () => {
    setZaloStatus('sending');
    setZaloMessage('');
    try {
      const res = await fetch('/api/notifications/test-zalo', { method: 'POST' });
      const data = await res.json();
      if (data.ok) {
        setZaloStatus('success');
        setZaloMessage(data.message);
      } else {
        setZaloStatus('error');
        setZaloMessage(data.error);
      }
    } catch {
      setZaloStatus('error');
      setZaloMessage('Không thể gửi Zalo. Kiểm tra lại cấu hình.');
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm p-4">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md overflow-hidden animate-in fade-in zoom-in duration-200">
        <div className="p-6 border-b border-slate-100 flex items-center justify-between bg-slate-50/50">
          <div className="flex items-center space-x-3">
            <div className="p-2 bg-indigo-100 rounded-lg text-indigo-600">
              <ServerCog className="w-5 h-5" />
            </div>
            <div>
              <h3 className="text-lg font-bold text-slate-800">Cấu hình Hệ thống</h3>
              <p className="text-[11px] text-slate-400">AI · Thông báo</p>
            </div>
          </div>
          <button onClick={onClose} className="text-slate-400 hover:text-slate-600 transition-colors">
            <XCircle className="w-6 h-6" />
          </button>
        </div>

        <div className="p-6 space-y-5 max-h-[70vh] overflow-y-auto">
          {/* Claude AI */}
          <div>
            <div className="flex items-center gap-2 mb-3">
              <BrainCircuit className="w-4 h-4 text-indigo-600" />
              <span className="text-xs font-normal text-slate-700 uppercase tracking-wider">Claude AI</span>
            </div>
            <div className="flex items-start space-x-3 p-3 bg-indigo-50 rounded-xl border border-indigo-100 mb-3">
              <p className="text-[11px] text-indigo-800 leading-relaxed">
                API key cấu hình trong <code className="bg-indigo-100 px-1 rounded font-mono">.env.local</code> — không lưu trên trình duyệt.
              </p>
            </div>
            <div className="bg-slate-50 rounded-xl p-4 border border-slate-100 space-y-3">
              <div className="flex items-center justify-between">
                <span className="text-xs font-normal text-slate-600">Trạng thái kết nối:</span>
                {claudeStatus === 'idle' && <span className="text-xs text-slate-400 italic">Chưa kiểm tra</span>}
                {claudeStatus === 'testing' && <span className="text-xs text-indigo-600 flex items-center animate-pulse"><Loader2 className="w-3 h-3 mr-1 animate-spin" />Đang kiểm tra...</span>}
                {claudeStatus === 'success' && <span className="text-xs text-emerald-600 flex items-center font-normal"><CheckCircle2 className="w-3 h-3 mr-1" />Đã kết nối</span>}
                {claudeStatus === 'error' && <span className="text-xs text-red-600 flex items-center font-normal"><XCircle className="w-3 h-3 mr-1" />Lỗi</span>}
              </div>
              {claudeMessage && (
                <p className={`text-[11px] p-2 rounded border ${claudeStatus === 'success' ? 'text-emerald-700 bg-emerald-50 border-emerald-100' : 'text-red-600 bg-red-50 border-red-100'}`}>
                  {claudeMessage}
                </p>
              )}
              <button onClick={testClaude} disabled={claudeStatus === 'testing'} className="w-full py-2 text-xs font-normal text-indigo-600 bg-white border border-indigo-200 rounded-lg hover:bg-indigo-50 transition-colors disabled:opacity-50">
                Kiểm tra kết nối Claude
              </button>
            </div>
          </div>

          {/* Email Notifications */}
          <div>
            <div className="flex items-center gap-2 mb-3">
              <Mail className="w-4 h-4 text-violet-600" />
              <span className="text-xs font-normal text-slate-700 uppercase tracking-wider">Thông báo Email</span>
            </div>
            <div className="bg-slate-50 rounded-xl p-4 border border-slate-100 space-y-3">
              <div className="flex items-center justify-between">
                <span className="text-xs font-normal text-slate-600">Gửi báo cáo 21:00:</span>
                {emailConfigured === null && <Loader2 className="w-3 h-3 animate-spin text-slate-400" />}
                {emailConfigured === true && (
                  <span className="text-xs text-emerald-600 flex items-center font-normal">
                    <CheckCircle2 className="w-3 h-3 mr-1" />Đã cấu hình
                  </span>
                )}
                {emailConfigured === false && (
                  <span className="text-xs text-slate-400 flex items-center">
                    <XCircle className="w-3 h-3 mr-1" />Chưa cấu hình
                  </span>
                )}
              </div>

              {emailConfigured === true && emailTo && (
                <p className="text-[11px] text-slate-500">
                  Gửi đến: <span className="font-mono font-normal text-slate-700">{emailTo}</span>
                </p>
              )}

              {emailConfigured === false && (
                <div className="text-[11px] text-slate-600 bg-amber-50 border border-amber-100 rounded-lg p-3 space-y-1">
                  <p className="font-normal text-amber-800">Cách bật email thông báo:</p>
                  <p>1. Bật 2FA trên Google Account</p>
                  <p>2. Tạo App Password tại <span className="font-mono">myaccount.google.com/apppasswords</span></p>
                  <p>3. Thêm vào <span className="font-mono">.env.local</span>:</p>
                  <pre className="bg-amber-100 rounded p-2 mt-1 text-[10px] leading-relaxed">{`EMAIL_USER=your@gmail.com\nEMAIL_PASS=xxxx-xxxx-xxxx-xxxx\nEMAIL_TO=owner@gmail.com`}</pre>
                </div>
              )}

              {emailConfigured === true && (
                <>
                  {emailMessage && (
                    <p className={`text-[11px] p-2 rounded border ${emailStatus === 'success' ? 'text-emerald-700 bg-emerald-50 border-emerald-100' : 'text-red-600 bg-red-50 border-red-100'}`}>
                      {emailMessage}
                    </p>
                  )}
                  <button onClick={sendTestEmail} disabled={emailStatus === 'sending'} className="w-full py-2 text-xs font-normal text-violet-600 bg-white border border-violet-200 rounded-lg hover:bg-violet-50 transition-colors disabled:opacity-50 flex items-center justify-center gap-1.5">
                    {emailStatus === 'sending' ? <Loader2 className="w-3 h-3 animate-spin" /> : <Send className="w-3 h-3" />}
                    Gửi email thử nghiệm
                  </button>
                </>
              )}
            </div>
          </div>

          {/* Zalo Notifications */}
          <div>
            <div className="flex items-center gap-2 mb-3">
              <MessageCircle className="w-4 h-4 text-sky-600" />
              <span className="text-xs font-normal text-slate-700 uppercase tracking-wider">Thông báo Zalo OA</span>
            </div>
            <div className="bg-slate-50 rounded-xl p-4 border border-slate-100 space-y-3">
              <div className="flex items-center justify-between">
                <span className="text-xs font-normal text-slate-600">Gửi báo cáo & cảnh báo:</span>
                {zaloConfigured === null && <Loader2 className="w-3 h-3 animate-spin text-slate-400" />}
                {zaloConfigured === true && (
                  <span className="text-xs text-emerald-600 flex items-center font-normal">
                    <CheckCircle2 className="w-3 h-3 mr-1" />Đã cấu hình
                  </span>
                )}
                {zaloConfigured === false && (
                  <span className="text-xs text-slate-400 flex items-center">
                    <XCircle className="w-3 h-3 mr-1" />Chưa cấu hình
                  </span>
                )}
              </div>

              {zaloConfigured === true && zaloFollowerId && (
                <p className="text-[11px] text-slate-500">
                  Gửi đến follower: <span className="font-mono font-normal text-slate-700">{zaloFollowerId}</span>
                </p>
              )}

              {zaloConfigured === false && (
                <div className="text-[11px] text-slate-600 bg-sky-50 border border-sky-100 rounded-lg p-3 space-y-1">
                  <p className="font-normal text-sky-800">Cách bật Zalo OA:</p>
                  <p>1. Đăng ký Zalo Official Account tại <span className="font-mono">oa.zalo.me</span></p>
                  <p>2. Lấy Access Token từ <span className="font-mono">developers.zalo.me</span></p>
                  <p>3. Lấy Follower ID (Zalo user ID của chủ nhà)</p>
                  <p>4. Thêm vào <span className="font-mono">.env.local</span>:</p>
                  <pre className="bg-sky-100 rounded p-2 mt-1 text-[10px] leading-relaxed">{`ZALO_OA_ACCESS_TOKEN=your-oa-access-token\nZALO_FOLLOWER_ID=your-zalo-user-id`}</pre>
                </div>
              )}

              {zaloConfigured === true && (
                <>
                  {zaloMessage && (
                    <p className={`text-[11px] p-2 rounded border ${zaloStatus === 'success' ? 'text-emerald-700 bg-emerald-50 border-emerald-100' : 'text-red-600 bg-red-50 border-red-100'}`}>
                      {zaloMessage}
                    </p>
                  )}
                  <button onClick={sendTestZalo} disabled={zaloStatus === 'sending'} className="w-full py-2 text-xs font-normal text-sky-600 bg-white border border-sky-200 rounded-lg hover:bg-sky-50 transition-colors disabled:opacity-50 flex items-center justify-center gap-1.5">
                    {zaloStatus === 'sending' ? <Loader2 className="w-3 h-3 animate-spin" /> : <Send className="w-3 h-3" />}
                    Gửi Zalo thử nghiệm
                  </button>
                </>
              )}
            </div>
          </div>

          {/* Alert Thresholds */}
          <div>
            <div className="flex items-center gap-2 mb-3">
              <Bell className="w-4 h-4 text-amber-600" />
              <span className="text-xs font-normal text-slate-700 uppercase tracking-wider">Ngưỡng cảnh báo</span>
            </div>
            <div className="bg-slate-50 rounded-xl p-4 border border-slate-100 space-y-4">
              <div className="space-y-1">
                <label className="text-[11px] font-normal text-slate-600 block">Tồn kho tối thiểu mặc định</label>
                <p className="text-[10px] text-slate-400">Áp dụng cho sản phẩm chưa set ngưỡng riêng</p>
                <div className="flex items-center gap-2">
                  <input
                    type="number" min={1} max={100}
                    value={alertConfig.defaultMinStock}
                    onChange={e => setAlertConfig(c => ({ ...c, defaultMinStock: Number(e.target.value) }))}
                    className="w-20 text-sm font-normal text-slate-800 border border-slate-200 rounded-lg px-3 py-1.5 focus:outline-none focus:border-amber-400"
                  />
                  <span className="text-[11px] text-slate-500">sản phẩm</span>
                </div>
              </div>

              <div className="space-y-1">
                <label className="text-[11px] font-normal text-slate-600 block">Công nợ NCC quá hạn sau</label>
                <p className="text-[10px] text-slate-400">Cảnh báo nếu còn nợ và không có hoạt động trong X ngày</p>
                <div className="flex items-center gap-2">
                  <input
                    type="number" min={7} max={365}
                    value={alertConfig.debtOverdueDays}
                    onChange={e => setAlertConfig(c => ({ ...c, debtOverdueDays: Number(e.target.value) }))}
                    className="w-20 text-sm font-normal text-slate-800 border border-slate-200 rounded-lg px-3 py-1.5 focus:outline-none focus:border-amber-400"
                  />
                  <span className="text-[11px] text-slate-500">ngày</span>
                </div>
              </div>

              <div className="space-y-1">
                <label className="text-[11px] font-normal text-slate-600 block">Cảnh báo doanh thu giảm dưới</label>
                <p className="text-[10px] text-slate-400">So với trung bình 6 ngày trước — ví dụ: 50% = doanh thu giảm hơn một nửa</p>
                <div className="flex items-center gap-2">
                  <input
                    type="number" min={10} max={90}
                    value={alertConfig.revenueDropPct}
                    onChange={e => setAlertConfig(c => ({ ...c, revenueDropPct: Number(e.target.value) }))}
                    className="w-20 text-sm font-normal text-slate-800 border border-slate-200 rounded-lg px-3 py-1.5 focus:outline-none focus:border-amber-400"
                  />
                  <span className="text-[11px] text-slate-500">% trung bình</span>
                </div>
              </div>

              <button
                onClick={saveAlertConfig}
                disabled={alertSaveStatus === 'saving'}
                className="w-full py-2 text-xs font-normal text-amber-700 bg-white border border-amber-200 rounded-lg hover:bg-amber-50 transition-colors disabled:opacity-50 flex items-center justify-center gap-1.5"
              >
                {alertSaveStatus === 'saving' ? <Loader2 className="w-3 h-3 animate-spin" /> : <Save className="w-3 h-3" />}
                {alertSaveStatus === 'saved' ? 'Đã lưu!' : alertSaveStatus === 'error' ? 'Lỗi lưu' : 'Lưu cấu hình'}
              </button>
            </div>
          </div>

          <div className="flex items-start space-x-3 p-3 bg-emerald-50 rounded-xl border border-emerald-100">
            <ShieldCheck className="w-5 h-5 text-emerald-600 shrink-0 mt-0.5" />
            <p className="text-[11px] text-emerald-800 leading-relaxed">
              <strong>Bảo mật:</strong> API keys chỉ tồn tại trên server trong <code className="bg-emerald-100 px-1 rounded">.env.local</code>, không bao giờ xuất hiện trong browser.
            </p>
          </div>
        </div>

        <div className="p-6 bg-slate-50 border-t border-slate-100">
          <button onClick={onClose} className="w-full py-3 text-sm font-normal text-white bg-indigo-600 hover:bg-indigo-700 rounded-xl shadow-lg shadow-indigo-200 transition-all active:scale-95">
            Đóng
          </button>
        </div>
      </div>
    </div>
  );
};

export default ApiKeySettings;
