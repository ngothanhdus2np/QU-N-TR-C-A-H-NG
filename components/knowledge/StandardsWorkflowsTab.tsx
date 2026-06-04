import React from 'react';
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
  FileDown,
  FileText,
} from 'lucide-react';
import DOMPurify from 'dompurify';
import { marked } from 'marked';

// Enable GFM breaks to render single newlines as <br> (essential for Word document fidelity)
marked.use({
  breaks: true,
  gfm: true,
});

import {
  KNOWLEDGE_SECTION_LABELS,
  KnowledgeSection,
  getKnowledgeSummaryBullets,
  getKnowledgeSummaryMarkdown,
  stripKnowledgeMeta,
  withKnowledgeSection,
} from '../../constants/systemKnowledgeSeed';

interface Props {
  mode: KnowledgeSection;
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
  embeddedInShell?: boolean;
}

const getArticlePreviewUrl = (article?: KnowledgeBaseArticle | null) => {
  if (!article) return '';
  if (article.sourcePreviewUrl) return article.sourcePreviewUrl;
  const sourceUrl = article.sourceFileUrl || article.sourceFileData || '';
  const sourceType = article.sourceFileType || '';
  const fileName = article.sourceFileName || '';
  const isPreviewableSource =
    sourceType === 'application/pdf' ||
    sourceType.startsWith('image/') ||
    /\.(pdf|png|jpe?g|webp)$/i.test(fileName);
  return isPreviewableSource ? sourceUrl : '';
};

const isImagePreview = (article?: KnowledgeBaseArticle | null) => {
  const sourceType = article?.sourceFileType || '';
  const fileName = article?.sourceFileName || '';
  const previewUrl = getArticlePreviewUrl(article);
  return (
    sourceType.startsWith('image/') ||
    /\.(png|jpe?g|webp)$/i.test(fileName) ||
    /^data:image\//i.test(previewUrl)
  );
};

const decodeImage = (src: string) =>
  new Promise<void>(resolve => {
    if (typeof window === 'undefined') {
      resolve();
      return;
    }

    const img = new Image();
    img.decoding = 'async';
    img.onload = () => {
      if ('decode' in img) {
        img
          .decode()
          .then(() => resolve())
          .catch(() => resolve());
      } else {
        resolve();
      }
    };
    img.onerror = () => resolve();
    img.src = src;
  });

const waitForNextPaint = () =>
  new Promise<void>(resolve => {
    if (typeof requestAnimationFrame !== 'function') {
      resolve();
      return;
    }

    requestAnimationFrame(() => {
      requestAnimationFrame(() => resolve());
    });
  });

const delay = (ms: number) => new Promise<void>(resolve => window.setTimeout(resolve, ms));

const getPreviewImageSources = (article: KnowledgeBaseArticle) => {
  const pageImages = article.sourcePageImages || [];
  if (pageImages.length > 0) return pageImages;
  const previewUrl = getArticlePreviewUrl(article);
  return previewUrl && isImagePreview(article) ? [previewUrl] : [];
};

const LoadingDocumentState = ({ title = 'Đang chuẩn bị file' }: { title?: string }) => (
  <div className="flex min-h-[520px] flex-col items-center justify-center gap-4 rounded-3xl border border-slate-200/70 bg-white p-8 text-center">
    <Loader2 className="h-8 w-8 animate-spin text-indigo-600" />
    <div className="space-y-1">
      <p className="text-xs font-normal uppercase tracking-widest text-slate-900">{title}</p>
      <p className="text-sm text-slate-500">Đang dựng ảnh tĩnh để vuốt xem mượt hơn.</p>
    </div>
  </div>
);

const MemoHtml = React.memo(
  ({ content, className = '' }: { content: string; className?: string }) => {
    const html = React.useMemo(() => DOMPurify.sanitize(marked(content) as string), [content]);

    return <div className={className} dangerouslySetInnerHTML={{ __html: html }} />;
  }
);

const ArticleSummaryPanel = React.memo(({ article }: { article: KnowledgeBaseArticle }) => {
  const summaryMarkdown = React.useMemo(
    () => getKnowledgeSummaryMarkdown(article.content),
    [article.content]
  );

  return (
    <div className="rounded-2xl border border-slate-100 bg-slate-50/80 p-5">
      <p className="mb-3 text-2xs font-normal uppercase tracking-widest text-slate-400">
        Tóm tắt nhanh
      </p>
      <MemoHtml
        content={summaryMarkdown}
        className="markdown-content prose prose-sm max-w-none text-slate-600"
      />
    </div>
  );
});

const DocumentPreview = React.memo(({ article }: { article: KnowledgeBaseArticle }) => {
  const pageImages = article.sourcePageImages || [];
  const pageScrollRef = React.useRef<HTMLDivElement | null>(null);
  const previewUrl = getArticlePreviewUrl(article);
  const markdownContent = React.useMemo(
    () => stripKnowledgeMeta(article.content),
    [article.content]
  );

  React.useEffect(() => {
    if (pageScrollRef.current) {
      pageScrollRef.current.scrollTop = 0;
    }
  }, [article.id]);

  if (pageImages.length > 0) {
    return (
      <div className="flex h-full min-h-[520px] flex-col rounded-3xl border border-slate-200/70 bg-slate-100 p-3 sm:p-5">
        <div
          ref={pageScrollRef}
          className="min-h-0 flex-1 scroll-pt-0 overflow-y-auto overscroll-contain rounded-xl border border-slate-200 bg-slate-200/60 shadow-sm"
        >
          <div className="mx-auto flex w-full max-w-[980px] flex-col gap-4 py-2 sm:py-4">
            {pageImages.map((src, index) => (
              <figure key={src} className="overflow-hidden rounded-sm bg-white shadow-sm">
                <img
                  src={src}
                  alt={`${article.title} - Trang ${index + 1}`}
                  decoding="async"
                  loading="eager"
                  className="block h-auto w-full bg-white"
                />
              </figure>
            ))}
          </div>
        </div>
      </div>
    );
  }

  if (previewUrl) {
    return (
      <div className="rounded-3xl border border-slate-200/70 bg-slate-100 p-3 sm:p-5">
        <div className="overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm">
          {isImagePreview(article) ? (
            <img
              src={previewUrl}
              alt={article.title}
              decoding="async"
              loading="eager"
              className="mx-auto block h-auto w-full max-w-[980px] object-contain bg-white"
            />
          ) : (
            <div className="flex min-h-[520px] flex-col items-center justify-center gap-5 p-8 text-center">
              <div className="flex h-16 w-16 items-center justify-center rounded-2xl bg-indigo-50 text-indigo-600">
                <FileText className="h-8 w-8" />
              </div>
              <div className="max-w-md space-y-2">
                <p className="text-sm font-normal uppercase tracking-widest text-slate-900">
                  Bản PDF sẵn sàng
                </p>
                <p className="text-sm leading-6 text-slate-500">
                  Để tránh trình xem PDF nhúng làm treo trang Hệ thống sau một thời gian mở, PDF sẽ
                  được mở ở tab riêng.
                </p>
              </div>
              <div className="flex flex-wrap justify-center gap-3">
                <a
                  href={previewUrl}
                  target="_blank"
                  rel="noreferrer"
                  className="rounded-xl bg-indigo-600 px-5 py-3 text-xs font-normal uppercase tracking-widest text-white transition-all hover:bg-slate-900"
                >
                  Mở PDF
                </a>
              </div>
            </div>
          )}
        </div>
      </div>
    );
  }

  return (
    <div className="a4-container bg-slate-100 rounded-3xl border border-slate-200/50 p-3 sm:p-5 md:p-8 flex justify-center overflow-x-auto min-h-[750px]">
      <div className="a4-page w-full max-w-[800px] bg-white p-6 sm:p-10 md:p-14 rounded-[2px] relative overflow-hidden select-text">
        <div className="a4-header-line"></div>
        <div className="absolute inset-0 flex items-center justify-center pointer-events-none opacity-[0.02] rotate-[-28deg]">
          <div className="a4-watermark select-none">PHUC SANG</div>
        </div>
        <MemoHtml content={markdownContent} className="markdown-content relative z-10 max-w-none" />
      </div>
    </div>
  );
});

const SummaryBullets = ({ content, className = '' }: { content: string; className?: string }) => {
  const bullets = React.useMemo(() => getKnowledgeSummaryBullets(content), [content]);
  return (
    <ul
      className={`list-disc space-y-2 pl-4 text-sm font-normal leading-6 text-slate-500 ${className}`}
    >
      {bullets.map((item, index) => (
        <li key={`${index}-${item.slice(0, 24)}`}>{item}</li>
      ))}
    </ul>
  );
};

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
  embeddedInShell = false,
}) => {
  const modeLabel = KNOWLEDGE_SECTION_LABELS[mode];
  const modeSearchLabel =
    mode === 'standards' ? 'quy chuẩn' : mode === 'workflows' ? 'quy trình' : 'biểu mẫu';
  const [preparingArticleId, setPreparingArticleId] = React.useState<string | null>(null);
  const prepareRunRef = React.useRef(0);

  const filteredList = React.useMemo(() => {
    const normalizedSearch = searchTerm.trim().toLowerCase();
    return list.filter(item => {
      const searchableText = [item.title, item.category, item.sourceFileName]
        .filter(Boolean)
        .join(' ')
        .toLowerCase();
      const matchesSearch = !normalizedSearch || searchableText.includes(normalizedSearch);
      const matchesCategory = selectedCategory === 'Tất cả' || item.category === selectedCategory;
      return matchesSearch && matchesCategory;
    });
  }, [list, searchTerm, selectedCategory]);

  const openArticle = React.useCallback(
    async (article: KnowledgeBaseArticle) => {
      const runId = prepareRunRef.current + 1;
      prepareRunRef.current = runId;
      const imageSources = getPreviewImageSources(article);

      setPreparingArticleId(article.id);
      await waitForNextPaint();

      if (imageSources.length > 0) {
        await Promise.all([
          Promise.allSettled(imageSources.map(src => decodeImage(src))),
          delay(450),
        ]);
      } else {
        await delay(250);
      }

      if (prepareRunRef.current !== runId) return;
      setViewArticle(article);
      setPreparingArticleId(null);
    },
    [setViewArticle]
  );

  React.useEffect(() => {
    return () => {
      prepareRunRef.current += 1;
    };
  }, []);

  const renderArticleDetail = (article: KnowledgeBaseArticle) => (
    <div className="h-full min-h-0 animate-in slide-in-from-right-4 duration-300">
      <div className="grid h-full min-h-0 grid-cols-1 items-stretch gap-6 lg:grid-cols-[minmax(0,1fr)_320px]">
        <DocumentPreview article={article} />

        <aside className="max-h-[calc(100vh-160px)] space-y-4 overflow-y-auto overscroll-contain pr-1 lg:sticky lg:top-0">
          <ArticleSummaryPanel article={article} />

          <div className="space-y-3 rounded-2xl border border-slate-100 bg-white p-5">
            <p className="text-2xs font-normal uppercase tracking-widest text-slate-400">
              Thông tin file
            </p>
            <div className="space-y-2 text-xs text-slate-600">
              <div className="flex justify-between gap-3">
                <span className="text-slate-400">Danh mục</span>
                <span className="text-right text-slate-800">{article.category}</span>
              </div>
              <div className="flex justify-between gap-3">
                <span className="text-slate-400">Cập nhật</span>
                <span className="text-right text-slate-800">
                  {new Date(article.updatedAt).toLocaleDateString('vi-VN')}
                </span>
              </div>
              {article.sourceFileName && (
                <div className="border-t border-slate-100 pt-2">
                  <p className="mb-1 text-slate-400">File gốc</p>
                  <p className="break-words text-slate-800">{article.sourceFileName}</p>
                </div>
              )}
            </div>
            {article.sourceFileName && (article.sourceFileUrl || article.sourceFileData) && (
              <a
                href={article.sourceFileUrl || article.sourceFileData}
                download={article.sourceFileName}
                className="mt-3 flex w-full items-center justify-center gap-2 rounded-xl border border-emerald-100 bg-emerald-50 px-4 py-3 text-emerald-600 transition-all hover:bg-emerald-600 hover:text-white"
              >
                <FileDown className="h-4 w-4" />
                <span className="text-2xs font-normal uppercase">Tải xuống tệp gốc</span>
              </a>
            )}
          </div>
        </aside>
      </div>
    </div>
  );

  return (
    <div
      className={
        embeddedInShell && viewArticle
          ? 'h-full min-h-0 animate-in slide-in-from-bottom-4 duration-500'
          : 'space-y-8 animate-in slide-in-from-bottom-4 duration-500'
      }
    >
      {/* KHO TÀI LIỆU GỐC & UPLOAD AI */}
      {!embeddedInShell && (
        <div className="bg-white p-10 rounded-[3.5rem] border border-slate-200 shadow-xl relative overflow-hidden group">
          <div className="absolute top-0 right-0 p-8 opacity-5 group-hover:opacity-10 transition-opacity">
            <UploadCloud className="w-64 h-64 text-indigo-600" />
          </div>
          <div className="flex flex-col md:flex-row items-center justify-between gap-10 relative z-10">
            <div className="flex-1">
              <h3 className="text-2xl font-semibold text-slate-900 uppercase tracking-tight flex items-center gap-3">
                <div className="p-3 bg-indigo-50 text-indigo-600 rounded-2xl">
                  <Upload className="w-6 h-6" />
                </div>
                Kho tài liệu gốc (Số hóa AI)
              </h3>
              <p className="text-sm font-normal text-slate-500 mt-2">
                Tải lên văn bản gốc (.pdf, .docx, .png, .jpg). Claude AI sẽ tự động bóc tách và
                chuyển thành Markdown để nhân viên tra cứu nhanh.
              </p>
            </div>
            <div className="flex-shrink-0">
              <input
                type="file"
                ref={fileInputRef}
                className="hidden"
                onChange={handleDocumentUpload}
                accept=".pdf,.docx,.png,.jpg,.jpeg"
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
                {isParsing ? 'Đang giải mã tài liệu...' : 'Tải lên văn bản (.pdf, .docx, .png)'}
              </button>
            </div>
          </div>
        </div>
      )}

      {aiDocSuggestion && (
        <div className="p-6 bg-indigo-50 border border-dashed border-indigo-200 rounded-2xl animate-in zoom-in-95 duration-300">
          <div className="flex items-start justify-between mb-6">
            <div className="flex items-center gap-3">
              <div className="p-2.5 bg-indigo-600 text-white rounded-xl shadow-lg">
                <Sparkles className="w-5 h-5" />
              </div>
              <div>
                <h4 className="font-semibold text-indigo-900 uppercase tracking-tight">
                  AI Đã Giải Mã Thành Công
                </h4>
                <p className="text-2xs font-normal text-indigo-600 uppercase tracking-widest">
                  Đang xem trước bản thảo {modeLabel.toLowerCase()}
                </p>
              </div>
            </div>
            <div className="flex gap-3">
              <button
                onClick={() => setAiDocSuggestion(null)}
                className="px-5 py-2.5 bg-white text-slate-400 rounded-xl font-normal text-2xs uppercase shadow-sm"
              >
                Bỏ qua
              </button>
              <button
                onClick={applyAiDocSuggestion}
                className="px-7 py-2.5 bg-indigo-600 text-white rounded-xl font-normal text-2xs uppercase shadow-lg shadow-indigo-200"
              >
                Lưu vào {modeLabel}
              </button>
            </div>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-5 mb-5">
            <div className="space-y-2">
              <label className="text-[9px] font-normal text-indigo-400 uppercase ml-1">
                Tiêu đề đề xuất
              </label>
              <input
                type="text"
                value={aiDocSuggestion.title}
                onChange={e => setAiDocSuggestion({ ...aiDocSuggestion, title: e.target.value })}
                className="w-full px-4 py-3 bg-white border-none rounded-xl font-normal text-slate-800"
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
                className="w-full px-4 py-3 bg-white border-none rounded-xl font-normal text-slate-800"
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
              onChange={e => setAiDocSuggestion({ ...aiDocSuggestion, content: e.target.value })}
              className="w-full px-4 py-3 bg-white border-none rounded-xl text-xs font-normal min-h-[160px]"
            />
          </div>
        </div>
      )}

      {!embeddedInShell && (
        <div className="flex flex-col md:flex-row gap-6">
          <div className="relative flex-1">
            <Search className="absolute left-6 top-1/2 -translate-y-1/2 text-slate-400 w-5 h-5" />
            <input
              type="text"
              placeholder={`Tìm kiếm ${modeSearchLabel}...`}
              value={searchTerm}
              onChange={e => setSearchTerm(e.target.value)}
              className="w-full pl-16 pr-6 py-5 bg-white border-2 border-slate-100 focus:border-indigo-500 rounded-[2rem] shadow-xl outline-none text-base font-normal transition-all"
            />
          </div>
          <div className="flex gap-4">
            <select
              value={selectedCategory}
              onChange={e => setSelectedCategory(e.target.value)}
              className="px-8 py-5 bg-white border-2 border-slate-100 rounded-[2rem] shadow-xl outline-none font-normal text-2xs uppercase tracking-widest appearance-none min-w-[180px]"
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
                setCurrentArticle({
                  category: mode === 'templates' ? 'Biểu mẫu' : 'Vận hành',
                  title: '',
                  content: withKnowledgeSection(mode, ''),
                });
                setIsEditing(true);
              }}
              className="px-8 py-5 bg-indigo-600 text-white rounded-[2rem] shadow-xl font-normal text-2xs uppercase tracking-widest flex items-center gap-3 hover:bg-black transition-all"
            >
              <Plus className="w-5 h-5" />{' '}
              {mode === 'standards'
                ? 'Soạn Quy chuẩn mới'
                : mode === 'workflows'
                  ? 'Soạn Quy trình mới'
                  : 'Tạo Biểu mẫu mới'}
            </button>
          </div>
        </div>
      )}

      {embeddedInShell && viewArticle ? (
        renderArticleDetail(viewArticle)
      ) : embeddedInShell && preparingArticleId ? (
        <LoadingDocumentState />
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
          {filteredList.map(item => (
            <div
              key={item.id}
              className={`bg-white p-8 rounded-[3rem] border border-slate-200 shadow-xl hover:shadow-2xl transition-all cursor-pointer group flex flex-col justify-between h-[360px] ${
                preparingArticleId === item.id ? 'pointer-events-none opacity-70' : ''
              }`}
              onClick={() => openArticle(item)}
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
                <h4 className="text-xl font-semibold text-slate-900 leading-tight group-hover:text-indigo-600 transition-colors line-clamp-3 uppercase tracking-tight">
                  {item.title}
                </h4>

                <div
                  className="mt-4 max-h-[132px] overflow-y-auto overscroll-contain pr-2 scrollbar-thin scrollbar-thumb-slate-200 scrollbar-track-transparent"
                  onClick={event => event.stopPropagation()}
                >
                  <SummaryBullets content={item.content} />
                </div>
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
                <div className="flex items-center gap-1.5 text-slate-400 font-normal text-2xs uppercase tracking-widest group-hover:text-indigo-600 transition-colors">
                  {preparingArticleId === item.id ? (
                    <>
                      Đang chuẩn bị <Loader2 className="h-4 w-4 animate-spin" />
                    </>
                  ) : (
                    <>
                      Xem chi tiết <ChevronRight className="w-4 h-4" />
                    </>
                  )}
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
                Chưa có nội dung {modeSearchLabel}
              </p>
            </div>
          )}
        </div>
      )}

      {/* MODALS */}
      {!embeddedInShell && (isEditing || viewArticle || preparingArticleId) && (
        <div className="fixed inset-0 z-modal flex items-center justify-center p-4">
          <div
            className="absolute inset-0 bg-slate-900/60 backdrop-blur-md"
            onClick={() => {
              prepareRunRef.current += 1;
              setPreparingArticleId(null);
              setIsEditing(false);
              setViewArticle(null);
            }}
          ></div>
          <div className="relative bg-white w-full max-w-7xl max-h-[90vh] overflow-y-auto rounded-[2rem] shadow-2xl p-6 md:p-8 animate-in zoom-in-95 duration-200 no-scrollbar">
            {isEditing ? (
              <div className="space-y-8">
                <div className="flex justify-between items-center mb-8">
                  <h3 className="text-2xl font-semibold text-slate-900 uppercase">
                    {mode === 'standards'
                      ? 'Biên soạn Quy chuẩn'
                      : mode === 'workflows'
                        ? 'Biên soạn Quy trình'
                        : 'Biên soạn Biểu mẫu'}
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
                    <label className="text-2xs font-normal text-slate-400 uppercase tracking-widest">
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
                    <label className="text-2xs font-normal text-slate-400 uppercase tracking-widest">
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
                  <label className="text-2xs font-normal text-slate-400 uppercase tracking-widest">
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
                        content: withKnowledgeSection(mode, currentArticle.content || ''),
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
            ) : preparingArticleId ? (
              <LoadingDocumentState />
            ) : (
              <div className="space-y-6">
                <div className="flex justify-between items-start gap-4 border-b border-slate-100 pb-5">
                  <div className="min-w-0" />
                  <button
                    onClick={() => setViewArticle(null)}
                    className="p-3 bg-slate-50 text-slate-400 hover:text-rose-500 rounded-2xl transition-all shadow-sm shrink-0"
                  >
                    <X className="w-6 h-6" />
                  </button>
                </div>
                <div className="grid grid-cols-1 lg:grid-cols-[minmax(0,1fr)_320px] gap-6 items-start">
                  {viewArticle ? <DocumentPreview article={viewArticle} /> : null}
                  <aside className="max-h-[calc(100vh-160px)] space-y-4 overflow-y-auto overscroll-contain pr-1 lg:sticky lg:top-0">
                    {viewArticle ? <ArticleSummaryPanel article={viewArticle} /> : null}
                    <div className="rounded-2xl border border-slate-100 bg-white p-5 space-y-3">
                      <p className="text-2xs font-normal uppercase tracking-widest text-slate-400">
                        Thông tin file
                      </p>
                      <div className="space-y-2 text-xs text-slate-600">
                        <div className="flex justify-between gap-3">
                          <span className="text-slate-400">Danh mục</span>
                          <span className="text-right text-slate-800">{viewArticle?.category}</span>
                        </div>
                        {viewArticle?.sourceFileName && (
                          <div className="pt-2 border-t border-slate-100">
                            <p className="text-slate-400 mb-1">File gốc</p>
                            <p className="text-slate-800 break-words">
                              {viewArticle.sourceFileName}
                            </p>
                          </div>
                        )}
                      </div>
                      {viewArticle?.sourceFileName &&
                        (viewArticle.sourceFileUrl || viewArticle.sourceFileData) && (
                          <a
                            href={viewArticle.sourceFileUrl || viewArticle.sourceFileData}
                            download={viewArticle.sourceFileName}
                            className="mt-3 flex items-center justify-center gap-2 px-4 py-3 bg-emerald-50 text-emerald-600 rounded-xl border border-emerald-100 hover:bg-emerald-600 hover:text-white transition-all w-full"
                          >
                            <FileDown className="w-4 h-4" />
                            <span className="text-2xs font-normal uppercase">
                              Tải xuống tệp gốc
                            </span>
                          </a>
                        )}
                    </div>
                  </aside>
                </div>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
};

export default React.memo(StandardsWorkflowsTab);
