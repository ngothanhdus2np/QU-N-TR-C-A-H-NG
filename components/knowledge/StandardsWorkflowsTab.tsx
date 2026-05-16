import React, { useRef } from 'react';
import { KnowledgeBaseArticle } from '../../types';
import {
  Plus,
  Search,
  ChevronRight,
  X,
  Edit,
  Trash2,
  UploadCloud,
  Loader2,
  Upload,
  Sparkles,
  Library,
  Workflow,
  FileSearch,
  FileDown,
} from 'lucide-react';
import DOMPurify from 'dompurify';
import { marked } from 'marked';

interface Props {
  mode: 'standards' | 'workflows';
  list: KnowledgeBaseArticle[];
  searchTerm: string;
  setSearchTerm: (term: string) => void;
  selectedCategory: string;
  setSelectedCategory: (category: string) => void;
  categories: string[];
  isEditing: boolean;
  setIsEditing: (editing: boolean) => void;
  currentArticle: Partial<KnowledgeBaseArticle> | null;
  setCurrentArticle: (article: Partial<KnowledgeBaseArticle> | null) => void;
  viewArticle: KnowledgeBaseArticle | null;
  setViewArticle: (article: KnowledgeBaseArticle | null) => void;
  isParsing: boolean;
  fileInputRef: React.RefObject<HTMLInputElement>;
  handleDocumentUpload: (e: React.ChangeEvent<HTMLInputElement>) => void;
  aiDocSuggestion: Partial<KnowledgeBaseArticle> | null;
  setAiDocSuggestion: (suggestion: Partial<KnowledgeBaseArticle> | null) => void;
  applyAiDocSuggestion: () => void;
  onUpdateData: (key: 'knowledgeBase', newList: any, idToRemove?: string) => void;
}

const StandardsWorkflowsTab: React.FC<Props> = ({
  mode,
  list,
  searchTerm,
  setSearchTerm,
  selectedCategory,
  setSelectedCategory,
  categories,
  isEditing,
  setIsEditing,
  currentArticle,
  setCurrentArticle,
  viewArticle,
  setViewArticle,
  isParsing,
  fileInputRef,
  handleDocumentUpload,
  aiDocSuggestion,
  setAiDocSuggestion,
  applyAiDocSuggestion,
  onUpdateData,
}) => {
  const filteredList = list.filter(item => {
    const matchesSearch =
      item.title.toLowerCase().includes(searchTerm.toLowerCase()) ||
      item.content.toLowerCase().includes(searchTerm.toLowerCase());
    const matchesCategory = selectedCategory === 'Tất cả' || item.category === selectedCategory;
    return matchesSearch && matchesCategory;
  });

  return (
    <div className="space-y-10 animate-in slide-in-from-bottom-4 duration-500">
      {/* KHO TÀI LIỆU GỐC & UPLOAD AI */}
      <div className="bg-white p-10 rounded-[3.5rem] border border-slate-200 shadow-xl relative overflow-hidden group">
        <div className="absolute top-0 right-0 p-8 opacity-5 group-hover:opacity-10 transition-opacity">
          <UploadCloud className="w-64 h-64 text-indigo-600" />
        </div>
        <div className="flex flex-col md:flex-row items-center justify-between gap-10 relative z-10">
          <div className="flex-1">
            <h3 className="text-2xl font-black text-slate-900 uppercase tracking-tight flex items-center gap-3">
              <div className="p-3 bg-indigo-50 text-indigo-600 rounded-2xl">
                <Upload className="w-6 h-6" />
              </div>
              Kho tài liệu gốc (Số hóa AI)
            </h3>
            <p className="text-sm font-normal text-slate-500 mt-2">
              Tải lên văn bản gốc (.pdf, .png, .jpg). Claude AI sẽ tự động bóc tách và chuyển
              thành Quy chuẩn Markdown để nhân viên tra cứu nhanh.
            </p>
          </div>
          <div className="flex-shrink-0">
            <input
              type="file"
              ref={fileInputRef}
              className="hidden"
              onChange={handleDocumentUpload}
              accept=".pdf,.png,.jpg,.jpeg"
            />
            <button
              onClick={() => fileInputRef.current?.click()}
              disabled={isParsing}
              className="px-14 py-6 bg-slate-900 hover:bg-black text-white rounded-[2rem] font-normal text-xs uppercase tracking-widest shadow-2xl flex items-center gap-4 active:scale-95 transition-all disabled:opacity-50"
            >
              {isParsing ? (
                <Loader2 className="w-6 h-6 animate-spin" />
              ) : (
                <UploadCloud className="w-6 h-6" />
              )}
              {isParsing ? 'Đang giải mã tài liệu...' : 'Tải lên văn bản (.pdf, .png)'}
            </button>
          </div>
        </div>

        {aiDocSuggestion && (
          <div className="mt-10 p-8 bg-indigo-50 border-2 border-dashed border-indigo-200 rounded-[2.5rem] animate-in zoom-in-95 duration-300">
            <div className="flex items-start justify-between mb-8">
              <div className="flex items-center gap-4">
                <div className="p-3 bg-indigo-600 text-white rounded-2xl shadow-lg">
                  <Sparkles className="w-6 h-6" />
                </div>
                <div>
                  <h4 className="font-black text-indigo-900 uppercase tracking-tight">
                    AI Đã Giải Mã Thành Công
                  </h4>
                  <p className="text-[10px] font-normal text-indigo-600 uppercase tracking-widest">
                    Đang xem trước bản thảo quy chuẩn
                  </p>
                </div>
              </div>
              <div className="flex gap-3">
                <button
                  onClick={() => setAiDocSuggestion(null)}
                  className="px-6 py-3 bg-white text-slate-400 rounded-xl font-normal text-[10px] uppercase shadow-sm"
                >
                  Bỏ qua
                </button>
                <button
                  onClick={applyAiDocSuggestion}
                  className="px-10 py-3 bg-indigo-600 text-white rounded-xl font-normal text-[10px] uppercase shadow-lg shadow-indigo-200"
                >
                  Lưu vào Quy chuẩn
                </button>
              </div>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-8 mb-6">
              <div className="space-y-2">
                <label className="text-[9px] font-normal text-indigo-400 uppercase ml-1">
                  Tiêu đề đề xuất
                </label>
                <input
                  type="text"
                  value={aiDocSuggestion.title}
                  onChange={e =>
                    setAiDocSuggestion({ ...aiDocSuggestion, title: e.target.value })
                  }
                  className="w-full px-6 py-4 bg-white border-none rounded-2xl font-normal text-slate-800"
                />
              </div>
              <div className="space-y-2">
                <label className="text-[9px] font-normal text-indigo-400 uppercase ml-1">
                  Danh mục đề xuất
                </label>
                <select
                  value={aiDocSuggestion.category}
                  onChange={e =>
                    setAiDocSuggestion({ ...aiDocSuggestion, category: e.target.value as any })
                  }
                  className="w-full px-6 py-4 bg-white border-none rounded-2xl font-normal text-slate-800"
                >
                  {categories.map(c => (
                    <option key={c} value={c}>
                      {c}
                    </option>
                  ))}
                </select>
              </div>
            </div>
            <div className="space-y-2">
              <label className="text-[9px] font-normal text-indigo-400 uppercase ml-1">
                Nội dung đã bóc tách (Markdown)
              </label>
              <textarea
                value={aiDocSuggestion.content}
                onChange={e =>
                  setAiDocSuggestion({ ...aiDocSuggestion, content: e.target.value })
                }
                className="w-full px-6 py-4 bg-white border-none rounded-2xl text-xs font-normal min-h-[200px]"
              />
            </div>
          </div>
        )}
      </div>

      <div className="flex flex-col md:flex-row gap-6">
        <div className="relative flex-1">
          <Search className="absolute left-6 top-1/2 -translate-y-1/2 text-slate-400 w-5 h-5" />
          <input
            type="text"
            placeholder={`Tìm kiếm ${mode === 'standards' ? 'quy chuẩn' : 'quy trình'}...`}
            value={searchTerm}
            onChange={e => setSearchTerm(e.target.value)}
            className="w-full pl-16 pr-6 py-5 bg-white border-2 border-slate-100 focus:border-indigo-500 rounded-[2rem] shadow-xl outline-none text-base font-normal transition-all"
          />
        </div>
        <div className="flex gap-4">
          <select
            value={selectedCategory}
            onChange={e => setSelectedCategory(e.target.value)}
            className="px-8 py-5 bg-white border-2 border-slate-100 rounded-[2rem] shadow-xl outline-none font-normal text-[10px] uppercase tracking-widest appearance-none min-w-[180px]"
          >
            <option value="Tất cả">Tất cả danh mục</option>
            {categories.map(cat => (
              <option key={cat} value={cat}>
                {cat}
              </option>
            ))}
          </select>
          <button
            onClick={() => {
              setCurrentArticle({ category: 'Vận hành' as any, title: '', content: '' });
              setIsEditing(true);
            }}
            className="px-8 py-5 bg-indigo-600 text-white rounded-[2rem] shadow-xl font-normal text-[10px] uppercase tracking-widest flex items-center gap-3 hover:bg-black transition-all"
          >
            <Plus className="w-5 h-5" />{' '}
            {mode === 'standards' ? 'Soạn Quy chuẩn mới' : 'Soạn Quy trình mới'}
          </button>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
        {filteredList.map(item => (
          <div
            key={item.id}
            className="bg-white p-8 rounded-[3rem] border border-slate-200 shadow-xl hover:shadow-2xl transition-all cursor-pointer group flex flex-col justify-between h-[360px]"
            onClick={() => setViewArticle(item)}
          >
            <div>
              <div className="flex items-center justify-between mb-6">
                <span className="px-4 py-1.5 bg-indigo-50 text-indigo-600 rounded-full text-[9px] font-normal uppercase tracking-widest border border-indigo-100">
                  {item.category}
                </span>
                <p className="text-[9px] font-normal text-slate-400">
                  {new Date(item.updatedAt).toLocaleDateString('vi-VN')}
                </p>
              </div>
              <h4 className="text-xl font-black text-slate-900 leading-tight group-hover:text-indigo-600 transition-colors line-clamp-3 uppercase tracking-tight">
                {item.title}
              </h4>

              {item.sourceFileName && (
                <div className="mt-4 flex items-center gap-2 p-2 bg-slate-50 rounded-xl border border-slate-100">
                  <FileSearch className="w-4 h-4 text-indigo-400" />
                  <span className="text-[8px] font-normal text-slate-400 uppercase truncate">
                    Bản gốc: {item.sourceFileName}
                  </span>
                </div>
              )}
            </div>
            <div className="flex items-center justify-between pt-6 border-t border-slate-50 mt-auto">
              <div className="flex items-center gap-4">
                <button
                  onClick={e => {
                    e.stopPropagation();
                    setCurrentArticle(item);
                    setIsEditing(true);
                  }}
                  className="p-2.5 text-slate-300 hover:text-indigo-600 hover:bg-indigo-50 rounded-xl transition-all"
                >
                  <Edit className="w-4 h-4" />
                </button>
                <button
                  onClick={e => {
                    e.stopPropagation();
                    onUpdateData(
                      'knowledgeBase',
                      list.filter(it => it.id !== item.id),
                      item.id
                    );
                  }}
                  className="p-2.5 text-slate-300 hover:text-rose-500 hover:bg-rose-50 rounded-xl transition-all"
                >
                  <Trash2 className="w-4 h-4" />
                </button>
              </div>
              <div className="flex items-center gap-1.5 text-slate-400 font-normal text-[10px] uppercase tracking-widest group-hover:text-indigo-600 transition-colors">
                Xem chi tiết <ChevronRight className="w-4 h-4" />
              </div>
            </div>
          </div>
        ))}
        {filteredList.length === 0 && (
          <div className="col-span-full py-20 text-center bg-white rounded-[3rem] border-2 border-dashed border-slate-100">
            <div className="w-16 h-16 bg-slate-50 rounded-2xl flex items-center justify-center mx-auto mb-4">
              {mode === 'standards' ? (
                <Library className="w-8 h-8 text-slate-300" />
              ) : (
                <Workflow className="w-8 h-8 text-slate-300" />
              )}
            </div>
            <p className="text-sm font-normal text-slate-400 uppercase tracking-widest">
              Chưa có nội dung {mode === 'standards' ? 'quy chuẩn' : 'quy trình'}
            </p>
          </div>
        )}
      </div>

      {/* MODALS */}
      {(isEditing || viewArticle) && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-4">
          <div
            className="absolute inset-0 bg-slate-900/60 backdrop-blur-md"
            onClick={() => {
              setIsEditing(false);
              setViewArticle(null);
            }}
          ></div>
          <div className="relative bg-white w-full max-w-4xl max-h-[90vh] overflow-y-auto rounded-[3.5rem] shadow-2xl p-10 md:p-14 animate-in zoom-in-95 duration-200 no-scrollbar">
            {isEditing ? (
              <div className="space-y-8">
                <div className="flex justify-between items-center mb-8">
                  <h3 className="text-2xl font-black text-slate-900 uppercase">
                    {mode === 'standards' ? 'Biên soạn Quy chuẩn' : 'Biên soạn Quy trình'}
                  </h3>
                  <button
                    onClick={() => setIsEditing(false)}
                    className="p-3 bg-slate-50 text-slate-400 hover:text-rose-500 rounded-2xl transition-all"
                  >
                    <X className="w-6 h-6" />
                  </button>
                </div>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  <div className="space-y-2">
                    <label className="text-[10px] font-normal text-slate-400 uppercase tracking-widest">
                      Tiêu đề
                    </label>
                    <input
                      type="text"
                      value={currentArticle?.title || ''}
                      onChange={e =>
                        setCurrentArticle({ ...currentArticle, title: e.target.value })
                      }
                      className="w-full px-6 py-4 bg-slate-50 rounded-2xl font-normal outline-none"
                    />
                  </div>
                  <div className="space-y-2">
                    <label className="text-[10px] font-normal text-slate-400 uppercase tracking-widest">
                      Danh mục
                    </label>
                    <select
                      value={currentArticle?.category || 'Vận hành'}
                      onChange={e =>
                        setCurrentArticle({ ...currentArticle, category: e.target.value as any })
                      }
                      className="w-full px-6 py-4 bg-slate-50 rounded-2xl font-normal outline-none appearance-none"
                    >
                      {categories.map(c => (
                        <option key={c} value={c}>
                          {c}
                        </option>
                      ))}
                    </select>
                  </div>
                </div>
                <div className="space-y-2">
                  <label className="text-[10px] font-normal text-slate-400 uppercase tracking-widest">
                    Nội dung (Markdown)
                  </label>
                  <textarea
                    value={currentArticle?.content || ''}
                    onChange={e =>
                      setCurrentArticle({ ...currentArticle, content: e.target.value })
                    }
                    className="w-full px-6 py-4 bg-slate-50 rounded-2xl font-normal outline-none min-h-[300px]"
                    placeholder="Sử dụng Markdown để định dạng văn bản..."
                  />
                </div>
                <button
                  onClick={() => {
                    if (currentArticle?.title && currentArticle?.content) {
                      const newArt = {
                        ...currentArticle,
                        id: currentArticle.id || crypto.randomUUID(),
                        updatedAt: new Date().toISOString(),
                      } as KnowledgeBaseArticle;
                      onUpdateData(
                        'knowledgeBase',
                        currentArticle.id
                          ? list.map(it => (it.id === currentArticle.id ? newArt : it))
                          : [newArt, ...list]
                      );
                      setIsEditing(false);
                    }
                  }}
                  className="w-full bg-indigo-600 text-white py-5 rounded-2xl font-normal uppercase text-xs shadow-xl tracking-[0.2em]"
                >
                  Lưu nội dung
                </button>
              </div>
            ) : (
              <div className="space-y-8">
                <div className="flex justify-between items-start">
                  <div>
                    <span className="px-4 py-1.5 bg-indigo-50 text-indigo-600 rounded-full text-[9px] font-normal uppercase tracking-widest mb-4 inline-block">
                      {viewArticle?.category}
                    </span>
                    <h3 className="text-3xl font-black text-slate-900 uppercase tracking-tight leading-tight">
                      {viewArticle?.title}
                    </h3>
                    {viewArticle?.sourceFileName && (
                      <a
                        href={viewArticle.sourceFileUrl || viewArticle.sourceFileData}
                        download={viewArticle.sourceFileName}
                        className="mt-4 flex items-center gap-2 px-6 py-3 bg-emerald-50 text-emerald-600 rounded-2xl border border-emerald-100 hover:bg-emerald-600 hover:text-white transition-all w-fit"
                      >
                        <FileDown className="w-5 h-5" />
                        <span className="text-[10px] font-normal uppercase">
                          Tải xuống tệp gốc ({viewArticle.sourceFileName})
                        </span>
                      </a>
                    )}
                  </div>
                  <button
                    onClick={() => setViewArticle(null)}
                    className="p-3 bg-slate-50 text-slate-400 hover:text-rose-500 rounded-2xl transition-all shadow-sm"
                  >
                    <X className="w-6 h-6" />
                  </button>
                </div>
                <div
                  className="markdown-content prose max-w-none bg-slate-50/50 p-10 rounded-[2.5rem] border border-slate-100"
                  dangerouslySetInnerHTML={{
                    __html: DOMPurify.sanitize(marked(viewArticle?.content || '') as string),
                  }}
                />
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
};

export default React.memo(StandardsWorkflowsTab);
