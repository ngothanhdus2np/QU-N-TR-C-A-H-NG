
import React, { useState, useEffect } from 'react';
import { Settings, Key, CheckCircle2, XCircle, Loader2, Eye, EyeOff, ExternalLink, ShieldCheck } from 'lucide-react';
import { GoogleGenAI } from "@google/genai";

interface ApiKeySettingsProps {
  isOpen: boolean;
  onClose: () => void;
}

const ApiKeySettings: React.FC<ApiKeySettingsProps> = ({ isOpen, onClose }) => {
  const [apiKey, setApiKey] = useState('');
  const [showKey, setShowKey] = useState(false);
  const [status, setStatus] = useState<'idle' | 'testing' | 'success' | 'error'>('idle');
  const [errorMessage, setErrorMessage] = useState('');

  useEffect(() => {
    const savedKey = localStorage.getItem('GEMINI_USER_API_KEY');
    if (savedKey) {
      setApiKey(savedKey);
    }
  }, [isOpen]);

  const handleSave = () => {
    if (apiKey.trim()) {
      localStorage.setItem('GEMINI_USER_API_KEY', apiKey.trim());
    } else {
      localStorage.removeItem('GEMINI_USER_API_KEY');
    }
    onClose();
  };

  const testConnection = async () => {
    if (!apiKey.trim()) {
      setStatus('error');
      setErrorMessage('Vui lòng nhập API Key trước khi kiểm tra.');
      return;
    }

    setStatus('testing');
    setErrorMessage('');

    try {
      const genAI = new GoogleGenAI({ apiKey: apiKey.trim() });
      const result = await genAI.models.generateContent({
        model: "gemini-2.0-flash-exp",
        contents: "Hello",
      });
      if (result.text) {
        setStatus('success');
      } else {
        throw new Error("Không nhận được phản hồi từ AI.");
      }
    } catch (error: any) {
      console.error("API Key Test Error:", error);
      setStatus('error');
      setErrorMessage(error.message || 'API Key không hợp lệ hoặc lỗi kết nối.');
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm p-4">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md overflow-hidden animate-in fade-in zoom-in duration-200">
        <div className="p-6 border-b border-slate-100 flex items-center justify-between bg-slate-50/50">
          <div className="flex items-center space-x-3">
            <div className="p-2 bg-indigo-100 rounded-lg text-indigo-600">
              <Settings className="w-5 h-5" />
            </div>
            <h3 className="text-lg font-bold text-slate-800">Cấu hình API Gemini</h3>
          </div>
          <button 
            onClick={onClose}
            className="text-slate-400 hover:text-slate-600 transition-colors"
          >
            <XCircle className="w-6 h-6" />
          </button>
        </div>

        <div className="p-6 space-y-6">
          <div className="space-y-2">
            <label className="text-sm font-semibold text-slate-700 flex items-center space-x-2">
              <Key className="w-4 h-4" />
              <span>Google Gemini API Key</span>
            </label>
            <div className="relative">
              <input
                type={showKey ? "text" : "password"}
                value={apiKey}
                onChange={(e) => {
                  setApiKey(e.target.value);
                  setStatus('idle');
                }}
                placeholder="Dán API Key của bạn vào đây..."
                className="w-full pl-4 pr-12 py-3 bg-slate-50 border border-slate-200 rounded-xl focus:ring-2 focus:ring-indigo-500 focus:border-transparent outline-none transition-all font-mono text-sm"
              />
              <button
                type="button"
                onClick={() => setShowKey(!showKey)}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600"
              >
                {showKey ? <EyeOff className="w-5 h-5" /> : <Eye className="w-5 h-5" />}
              </button>
            </div>
            <p className="text-[11px] text-slate-500 flex items-center space-x-1">
              <ExternalLink className="w-3 h-3" />
              <span>Lấy key tại </span>
              <a 
                href="https://aistudio.google.com/app/apikey" 
                target="_blank" 
                rel="noopener noreferrer"
                className="text-indigo-600 hover:underline font-medium"
              >
                Google AI Studio
              </a>
            </p>
          </div>

          <div className="bg-slate-50 rounded-xl p-4 border border-slate-100 space-y-3">
            <div className="flex items-center justify-between">
              <span className="text-xs font-medium text-slate-600">Trạng thái kết nối:</span>
              {status === 'idle' && <span className="text-xs text-slate-400 italic">Chưa kiểm tra</span>}
              {status === 'testing' && (
                <span className="text-xs text-indigo-600 flex items-center animate-pulse">
                  <Loader2 className="w-3 h-3 mr-1 animate-spin" />
                  Đang kiểm tra...
                </span>
              )}
              {status === 'success' && (
                <span className="text-xs text-emerald-600 flex items-center font-bold">
                  <CheckCircle2 className="w-3 h-3 mr-1" />
                  Đã kết nối
                </span>
              )}
              {status === 'error' && (
                <span className="text-xs text-red-600 flex items-center font-bold">
                  <XCircle className="w-3 h-3 mr-1" />
                  Lỗi kết nối
                </span>
              )}
            </div>
            
            {errorMessage && (
              <p className="text-[10px] text-red-500 bg-red-50 p-2 rounded border border-red-100">
                {errorMessage}
              </p>
            )}

            <button
              onClick={testConnection}
              disabled={status === 'testing'}
              className="w-full py-2 text-xs font-semibold text-indigo-600 bg-white border border-indigo-200 rounded-lg hover:bg-indigo-50 transition-colors disabled:opacity-50"
            >
              Kiểm tra kết nối
            </button>
          </div>

          <div className="flex items-start space-x-3 p-3 bg-emerald-50 rounded-xl border border-emerald-100">
            <ShieldCheck className="w-5 h-5 text-emerald-600 shrink-0 mt-0.5" />
            <p className="text-[11px] text-emerald-800 leading-relaxed">
              <strong>Bảo mật:</strong> Key của bạn được lưu trực tiếp trong trình duyệt (LocalStorage). 
              Chúng tôi không lưu trữ key này trên bất kỳ máy chủ nào.
            </p>
          </div>
        </div>

        <div className="p-6 bg-slate-50 border-t border-slate-100 flex space-x-3">
          <button
            onClick={onClose}
            className="flex-1 py-3 text-sm font-bold text-slate-600 hover:bg-slate-200 rounded-xl transition-colors"
          >
            Hủy bỏ
          </button>
          <button
            onClick={handleSave}
            className="flex-1 py-3 text-sm font-bold text-white bg-indigo-600 hover:bg-indigo-700 rounded-xl shadow-lg shadow-indigo-200 transition-all active:scale-95"
          >
            Lưu cấu hình
          </button>
        </div>
      </div>
    </div>
  );
};

export default ApiKeySettings;
