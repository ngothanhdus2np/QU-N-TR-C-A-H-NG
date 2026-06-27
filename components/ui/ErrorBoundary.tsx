import { Component, type ErrorInfo, type ReactNode } from 'react';
import { AlertTriangle, RefreshCw } from 'lucide-react';

interface Props {
  children: ReactNode;
  moduleName?: string;
}

interface State {
  hasError: boolean;
  error: Error | null;
}

// Lỗi tải chunk động (thường xảy ra sau deploy: file chunk đổi hash, bản cũ trong
// cache/Service Worker không còn tồn tại trên server → import() 404).
const isChunkLoadError = (error: Error | null): boolean => {
  if (!error) return false;
  const sig = `${error.name} ${error.message}`;
  return /ChunkLoadError|Failed to fetch dynamically imported module|error loading dynamically imported module|Importing a module script failed/i.test(sig);
};

const CHUNK_RELOAD_KEY = 'cfo_chunk_reload_at';

class ErrorBoundary extends Component<Props, State> {
  state: State = { hasError: false, error: null };

  static getDerivedStateFromError(error: Error): State {
    return { hasError: true, error };
  }

  componentDidCatch(error: Error, info: ErrorInfo) {
    console.error(`[ErrorBoundary] ${this.props.moduleName ?? 'module'} crashed:`, error, info.componentStack);

    // Tự khôi phục khi lỗi do chunk cũ sau deploy: xóa cache rồi tải lại 1 lần.
    // Guard 10s qua sessionStorage để tránh vòng lặp reload vô hạn nếu lỗi thật.
    if (isChunkLoadError(error)) {
      const last = Number(sessionStorage.getItem(CHUNK_RELOAD_KEY) || 0);
      if (Date.now() - last > 10000) {
        sessionStorage.setItem(CHUNK_RELOAD_KEY, String(Date.now()));
        const reload = () => window.location.reload();
        if (typeof caches !== 'undefined') {
          caches.keys()
            .then(keys => Promise.all(keys.map(k => caches.delete(k))))
            .finally(reload);
        } else {
          reload();
        }
      }
    }
  }

  handleReset = () => {
    // Lỗi chunk: reset state không đủ (chunk vẫn thiếu) → tải lại trang để lấy bản mới
    if (isChunkLoadError(this.state.error)) {
      window.location.reload();
      return;
    }
    this.setState({ hasError: false, error: null });
  };

  render() {
    if (this.state.hasError) {
      return (
        <div className="flex items-center justify-center min-h-[400px] p-8">
          <div className="bg-white rounded-3xl border border-rose-100 shadow-lg p-10 max-w-md w-full text-center">
            <div className="w-14 h-14 bg-rose-50 rounded-2xl flex items-center justify-center mx-auto mb-5">
              <AlertTriangle className="w-7 h-7 text-rose-500" />
            </div>
            <h3 className="text-base font-semibold text-slate-900 mb-2">
              {this.props.moduleName ? `${this.props.moduleName} gặp lỗi` : 'Module gặp lỗi'}
            </h3>
            <p className="text-xs text-slate-400 font-normal mb-1">
              Phần này không thể hiển thị. Các module khác vẫn hoạt động bình thường.
            </p>
            {this.state.error && (
              <p className="text-2xs text-rose-400 bg-rose-50 rounded-xl px-3 py-2 mt-3 mb-5 text-left break-all">
                {this.state.error.message}
              </p>
            )}
            <button
              onClick={this.handleReset}
              className="flex items-center gap-2 mx-auto px-5 py-2.5 bg-indigo-600 text-white text-xs font-normal rounded-xl hover:bg-indigo-700 transition-colors"
            >
              <RefreshCw className="w-3.5 h-3.5" /> Thử lại
            </button>
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}

export default ErrorBoundary;
