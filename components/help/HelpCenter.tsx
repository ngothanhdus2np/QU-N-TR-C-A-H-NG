import React, { useState, useEffect, useRef } from 'react';
import {
  Rocket, ShoppingCart, Package, Truck, Users, UserCheck,
  BarChart2, Settings, ChevronRight, BookOpen, Search,
} from 'lucide-react';
import { HELP_CATEGORIES, HELP_ARTICLES, HelpArticle } from '../../data/helpArticles';

const CATEGORY_ICONS: Record<string, React.ReactNode> = {
  rocket: <Rocket className="w-4 h-4" />,
  'shopping-cart': <ShoppingCart className="w-4 h-4" />,
  package: <Package className="w-4 h-4" />,
  truck: <Truck className="w-4 h-4" />,
  users: <Users className="w-4 h-4" />,
  'user-check': <UserCheck className="w-4 h-4" />,
  'bar-chart': <BarChart2 className="w-4 h-4" />,
  settings: <Settings className="w-4 h-4" />,
};

function renderMarkdown(content: string): React.ReactNode[] {
  const lines = content.split('\n');
  const elements: React.ReactNode[] = [];
  let i = 0;
  let key = 0;

  while (i < lines.length) {
    const line = lines[i];

    if (line.startsWith('## ')) {
      const id = line.slice(3).toLowerCase().replace(/[^a-z0-9\s]/g, '').trim().replace(/\s+/g, '-');
      elements.push(
        <h2 key={key++} id={id} className="text-lg font-700 text-slate-800 mt-8 mb-3 pb-2 border-b border-slate-100 scroll-mt-20">
          {renderInline(line.slice(3))}
        </h2>
      );
      i++; continue;
    }

    if (line.startsWith('### ')) {
      elements.push(
        <h3 key={key++} className="text-base font-semibold text-slate-700 mt-5 mb-2">
          {renderInline(line.slice(4))}
        </h3>
      );
      i++; continue;
    }

    if (line.startsWith('> ')) {
      elements.push(
        <div key={key++} className="border-l-4 border-amber-300 bg-amber-50 px-4 py-2.5 my-3 rounded-r-lg text-sm text-amber-800">
          {renderInline(line.slice(2))}
        </div>
      );
      i++; continue;
    }

    if (line === '---') {
      elements.push(<hr key={key++} className="my-6 border-slate-100" />);
      i++; continue;
    }

    // Table
    if (line.startsWith('|')) {
      const tableLines: string[] = [];
      while (i < lines.length && lines[i].startsWith('|')) {
        if (!lines[i].match(/^\|[-\s|]+\|$/)) tableLines.push(lines[i]);
        i++;
      }
      if (tableLines.length > 0) {
        const headers = tableLines[0].split('|').filter(c => c.trim()).map(c => c.trim());
        const rows = tableLines.slice(1).map(r => r.split('|').filter(c => c.trim()).map(c => c.trim()));
        elements.push(
          <div key={key++} className="overflow-x-auto my-4">
            <table className="w-full text-sm border-collapse">
              <thead>
                <tr className="bg-slate-50">
                  {headers.map((h, hi) => (
                    <th key={hi} className="text-left px-3 py-2 font-semibold text-slate-600 border border-slate-200 text-xs uppercase tracking-wide">
                      {renderInline(h)}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {rows.map((row, ri) => (
                  <tr key={ri} className="even:bg-slate-50/50">
                    {row.map((cell, ci) => (
                      <td key={ci} className="px-3 py-2 text-slate-700 border border-slate-200">
                        {renderInline(cell)}
                      </td>
                    ))}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        );
      }
      continue;
    }

    // Bullet list
    if (line.startsWith('- ')) {
      const items: string[] = [];
      while (i < lines.length && lines[i].startsWith('- ')) {
        items.push(lines[i].slice(2));
        i++;
      }
      elements.push(
        <ul key={key++} className="my-3 space-y-1.5 pl-1">
          {items.map((item, ii) => (
            <li key={ii} className="flex gap-2 text-sm text-slate-700">
              <span className="mt-1.5 w-1.5 h-1.5 rounded-full bg-slate-400 shrink-0" />
              <span>{renderInline(item)}</span>
            </li>
          ))}
        </ul>
      );
      continue;
    }

    if (line.trim() === '') { i++; continue; }

    elements.push(
      <p key={key++} className="text-sm text-slate-700 leading-relaxed my-2">
        {renderInline(line)}
      </p>
    );
    i++;
  }

  return elements;
}

function renderInline(text: string): React.ReactNode {
  const parts = text.split(/(\*\*[^*]+\*\*)/g);
  return parts.map((part, i) => {
    if (part.startsWith('**') && part.endsWith('**')) {
      return <strong key={i} className="font-semibold text-slate-800">{part.slice(2, -2)}</strong>;
    }
    return part;
  });
}

export default function HelpCenter() {
  const [selectedArticleId, setSelectedArticleId] = useState<string>('overview-dashboard');
  const [expandedCategories, setExpandedCategories] = useState<Set<string>>(new Set(['getting-started']));
  const [searchQuery, setSearchQuery] = useState('');
  const [activeSection, setActiveSection] = useState('');
  const contentRef = useRef<HTMLDivElement>(null);

  const article: HelpArticle | undefined = HELP_ARTICLES[selectedArticleId];

  const category = HELP_CATEGORIES.find(c => c.id === article?.categoryId);

  const filteredCategories = searchQuery.trim()
    ? HELP_CATEGORIES.map(cat => ({
        ...cat,
        articles: cat.articles.filter(a =>
          a.title.toLowerCase().includes(searchQuery.toLowerCase())
        ),
      })).filter(cat => cat.articles.length > 0)
    : HELP_CATEGORIES;

  const toggleCategory = (id: string) => {
    setExpandedCategories(prev => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id); else next.add(id);
      return next;
    });
  };

  const selectArticle = (id: string) => {
    setSelectedArticleId(id);
    contentRef.current?.scrollTo({ top: 0, behavior: 'smooth' });
    const cat = HELP_CATEGORIES.find(c => c.articles.some(a => a.id === id));
    if (cat) setExpandedCategories(prev => new Set([...prev, cat.id]));
  };

  // Track active section via scroll
  useEffect(() => {
    const el = contentRef.current;
    if (!el || !article) return;
    const handler = () => {
      const headings = el.querySelectorAll('h2[id]');
      let current = '';
      headings.forEach(h => {
        if (h.getBoundingClientRect().top < 140) current = h.id;
      });
      setActiveSection(current);
    };
    el.addEventListener('scroll', handler);
    return () => el.removeEventListener('scroll', handler);
  }, [article]);

  const scrollToSection = (id: string) => {
    const el = contentRef.current?.querySelector(`#${id}`);
    el?.scrollIntoView({ behavior: 'smooth', block: 'start' });
  };

  return (
    <div className="flex h-full min-h-0 bg-slate-50">
      {/* ── Sidebar trái: danh mục ── */}
      <aside className="w-64 shrink-0 bg-white border-r border-slate-100 flex flex-col overflow-hidden">
        {/* Search */}
        <div className="p-3 border-b border-slate-100">
          <div className="flex items-center gap-2 bg-slate-50 rounded-lg px-3 py-2">
            <Search className="w-3.5 h-3.5 text-slate-400 shrink-0" />
            <input
              value={searchQuery}
              onChange={e => setSearchQuery(e.target.value)}
              placeholder="Tìm bài hướng dẫn..."
              className="flex-1 bg-transparent text-xs text-slate-700 placeholder-slate-400 outline-none"
            />
          </div>
        </div>

        {/* Category list */}
        <nav className="flex-1 overflow-y-auto py-2">
          {filteredCategories.map(cat => (
            <div key={cat.id}>
              <button
                onClick={() => toggleCategory(cat.id)}
                className="w-full flex items-center gap-2.5 px-4 py-2 text-xs font-semibold text-slate-500 uppercase tracking-wide hover:text-slate-700 transition-colors"
              >
                <span className="text-slate-400">{CATEGORY_ICONS[cat.icon]}</span>
                <span className="flex-1 text-left">{cat.label}</span>
                <ChevronRight className={`w-3 h-3 transition-transform ${expandedCategories.has(cat.id) ? 'rotate-90' : ''}`} />
              </button>

              {expandedCategories.has(cat.id) && (
                <div className="pb-1">
                  {cat.articles.map(a => (
                    <button
                      key={a.id}
                      onClick={() => selectArticle(a.id)}
                      className={`w-full text-left text-xs px-6 py-1.5 transition-colors ${
                        selectedArticleId === a.id
                          ? 'text-red-600 font-medium bg-red-50 border-r-2 border-red-500'
                          : HELP_ARTICLES[a.id]
                            ? 'text-slate-600 hover:text-slate-900 hover:bg-slate-50'
                            : 'text-slate-400 cursor-not-allowed'
                      }`}
                      disabled={!HELP_ARTICLES[a.id]}
                    >
                      {a.title}
                      {!HELP_ARTICLES[a.id] && (
                        <span className="ml-1.5 text-[10px] text-slate-300">Sắp có</span>
                      )}
                    </button>
                  ))}
                </div>
              )}
            </div>
          ))}
        </nav>
      </aside>

      {/* ── Main content ── */}
      <div ref={contentRef} className="flex-1 overflow-y-auto">
        {article ? (
          <div className="max-w-3xl mx-auto px-8 py-10">
            {/* Breadcrumb */}
            <div className="flex items-center gap-1.5 text-xs text-slate-400 mb-6">
              <BookOpen className="w-3.5 h-3.5" />
              <span>Hướng dẫn sử dụng</span>
              {category && (
                <>
                  <span>›</span>
                  <span>{category.label}</span>
                </>
              )}
              <span>›</span>
              <span className="text-slate-600">{article.title}</span>
            </div>

            {/* Title */}
            <h1 className="text-2xl font-bold text-slate-900 mb-8">{article.title}</h1>

            {/* Article body */}
            <div>{renderMarkdown(article.content)}</div>

            {/* Footer nav */}
            <div className="mt-12 pt-6 border-t border-slate-100 text-xs text-slate-400 text-center">
              Có thắc mắc? Liên hệ quản trị viên hệ thống.
            </div>
          </div>
        ) : (
          <div className="flex flex-col items-center justify-center h-full text-center px-8">
            <BookOpen className="w-12 h-12 text-slate-200 mb-4" />
            <p className="text-slate-500 font-medium">Chọn một bài hướng dẫn từ danh mục bên trái</p>
          </div>
        )}
      </div>

      {/* ── TOC phải ── */}
      {article && article.sections.length > 0 && (
        <aside className="w-52 shrink-0 hidden xl:block">
          <div className="sticky top-0 pt-10 pr-6 pl-4">
            <p className="text-[11px] font-semibold text-slate-400 uppercase tracking-wide mb-3">Mục lục</p>
            <nav className="space-y-1">
              {article.sections.map(sec => {
                const secId = sec.title.toLowerCase().replace(/[^a-z0-9\s]/g, '').trim().replace(/\s+/g, '-');
                const isActive = activeSection === secId;
                return (
                  <button
                    key={sec.id}
                    onClick={() => scrollToSection(secId)}
                    className={`block w-full text-left text-xs py-1 px-2 rounded transition-colors ${
                      isActive
                        ? 'text-red-600 font-medium bg-red-50'
                        : 'text-slate-500 hover:text-slate-800 hover:bg-slate-50'
                    }`}
                  >
                    {sec.title}
                  </button>
                );
              })}
            </nav>
          </div>
        </aside>
      )}
    </div>
  );
}
