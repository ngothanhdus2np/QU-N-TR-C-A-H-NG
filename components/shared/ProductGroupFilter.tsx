import React, { useState, useRef, useEffect, useMemo } from 'react';
import { Search, ChevronDown, ChevronRight } from 'lucide-react';
import { ProductGroup } from '../../types';

type FilterNode = {
  path: string;
  name: string;
  isSelectable: boolean;
  children: FilterNode[];
};

function buildFilterTree(paths: string[]): FilterNode[] {
  type Draft = { name: string; path: string; isSelectable: boolean; childMap: Map<string, Draft> };
  const rootMap = new Map<string, Draft>();
  for (const raw of paths) {
    const parts = raw.split(/\s*>>\s*/).map(s => s.trim()).filter(Boolean);
    if (!parts.length) continue;
    let map = rootMap;
    let soFar = '';
    for (let i = 0; i < parts.length; i++) {
      const p = parts[i];
      soFar = soFar ? `${soFar} >> ${p}` : p;
      const last = i === parts.length - 1;
      if (!map.has(p)) map.set(p, { name: p, path: soFar, isSelectable: last, childMap: new Map() });
      else if (last) map.get(p)!.isSelectable = true;
      map = map.get(p)!.childMap;
    }
  }
  const toNodes = (m: Map<string, Draft>): FilterNode[] =>
    Array.from(m.values())
      .sort((a, b) => a.name.localeCompare(b.name, 'vi', { numeric: true }))
      .map(n => ({ name: n.name, path: n.path, isSelectable: n.isSelectable, children: toNodes(n.childMap) }));
  return toNodes(rootMap);
}

function nodeMatches(node: FilterNode, q: string): boolean {
  return node.name.toLowerCase().includes(q) || node.children.some(c => nodeMatches(c, q));
}

function getSelectablePaths(node: FilterNode): string[] {
  const res: string[] = [];
  if (node.isSelectable) res.push(node.path);
  node.children.forEach(c => res.push(...getSelectablePaths(c)));
  return res;
}

interface ProductGroupFilterProps {
  productGroups: ProductGroup[];
  uniqueCategories: string[];
  categoryCounts?: Record<string, number>;
  selectedCategories: string[];
  onSelectionChange: (categories: string[]) => void;
  onApply?: () => void;
  placeholder?: string;
}

export const ProductGroupFilter: React.FC<ProductGroupFilterProps> = ({
  productGroups,
  uniqueCategories,
  categoryCounts = {},
  selectedCategories,
  onSelectionChange,
  onApply,
  placeholder = 'Chọn nhóm hàng',
}) => {
  const [isOpen, setIsOpen] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');
  const [pendingCategories, setPendingCategories] = useState<string[]>([]);
  const [expandedNodes, setExpandedNodes] = useState<Set<string>>(new Set());
  const [popupPos, setPopupPos] = useState({ top: 0, left: 0, width: 320 });
  const triggerRef = useRef<HTMLDivElement>(null);
  const popupRef = useRef<HTMLDivElement>(null);

  const categoryTree = useMemo(() => {
    const paths = new Set<string>();
    for (const g of productGroups) if (g.name?.trim()) paths.add(g.name.trim());
    for (const c of uniqueCategories) if (c?.trim()) paths.add(c.trim());
    return buildFilterTree(Array.from(paths));
  }, [productGroups, uniqueCategories]);

  useEffect(() => {
    if (!isOpen) return;
    const handler = (e: MouseEvent) => {
      if (
        popupRef.current && !popupRef.current.contains(e.target as Node) &&
        triggerRef.current && !triggerRef.current.contains(e.target as Node)
      ) {
        setIsOpen(false);
      }
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, [isOpen]);

  const openPopup = () => {
    if (isOpen) {
      setIsOpen(false);
      return;
    }
    if (triggerRef.current) {
      const rect = triggerRef.current.getBoundingClientRect();
      setPopupPos({ top: rect.top, left: rect.right + 8, width: 320 });
    }
    setPendingCategories([...selectedCategories]);
    setSearchTerm('');
    setExpandedNodes(new Set(categoryTree.map(n => n.path)));
    setIsOpen(true);
  };

  const handleApply = () => {
    onSelectionChange(pendingCategories);
    onApply?.();
    setIsOpen(false);
  };

  const renderNode = (node: FilterNode, depth: number): React.ReactNode => {
    const q = searchTerm.toLowerCase();
    if (q && !nodeMatches(node, q)) return null;
    const hasChildren = node.children.length > 0;
    const isExpanded = q ? true : expandedNodes.has(node.path);
    const selectablePaths = getSelectablePaths(node);
    const allChecked = selectablePaths.length > 0 && selectablePaths.every(p => pendingCategories.includes(p));
    const someChecked = !allChecked && selectablePaths.some(p => pendingCategories.includes(p));

    const handleCheck = () => {
      setPendingCategories(prev =>
        allChecked
          ? prev.filter(p => !selectablePaths.includes(p))
          : Array.from(new Set([...prev, ...selectablePaths]))
      );
    };

    const toggleExpand = (e: React.MouseEvent) => {
      e.stopPropagation();
      setExpandedNodes(prev => {
        const next = new Set(prev);
        if (next.has(node.path)) next.delete(node.path);
        else next.add(node.path);
        return next;
      });
    };

    return (
      <div key={node.path}>
        <div
          className="flex items-center gap-2 py-2 hover:bg-slate-50 border-b border-slate-50"
          style={{ paddingLeft: `${12 + depth * 16}px`, paddingRight: 12 }}
        >
          <button
            type="button"
            onClick={toggleExpand}
            className="w-4 h-4 flex items-center justify-center text-slate-400 shrink-0"
          >
            {hasChildren ? (
              isExpanded ? <ChevronDown className="h-3 w-3" /> : <ChevronRight className="h-3 w-3" />
            ) : (
              <span className="h-1.5 w-1.5 rounded-full bg-slate-200 mx-auto block" />
            )}
          </button>
          <input
            type="checkbox"
            checked={allChecked}
            ref={el => { if (el) el.indeterminate = someChecked; }}
            onChange={handleCheck}
            className="rounded border-slate-300 text-indigo-600 focus:ring-indigo-500 h-4 w-4 shrink-0 cursor-pointer"
          />
          <button
            type="button"
            onClick={handleCheck}
            className="flex-1 flex items-center justify-between min-w-0 text-left gap-2"
          >
            <span className={`text-sm truncate ${depth === 0 ? 'font-medium text-slate-800' : 'text-slate-700'}`}>
              {node.name}
            </span>
            {node.isSelectable && (categoryCounts[node.path] ?? 0) > 0 && (
              <span className="text-xs text-slate-400 tabular-nums shrink-0">
                ({categoryCounts[node.path]})
              </span>
            )}
          </button>
        </div>
        {isExpanded && hasChildren && (
          <div>{node.children.map(child => renderNode(child, depth + 1))}</div>
        )}
      </div>
    );
  };

  const displayText =
    selectedCategories.length === 0
      ? placeholder
      : selectedCategories.length === 1
        ? (selectedCategories[0].split(' >> ').pop() ?? selectedCategories[0])
        : `${selectedCategories.length} nhóm đã chọn`;

  return (
    <>
      {isOpen && (
        <div
          ref={popupRef}
          style={{
            position: 'fixed',
            top: popupPos.top,
            left: popupPos.left,
            width: popupPos.width,
            zIndex: 9999,
          }}
          className="bg-white rounded-2xl shadow-2xl border border-slate-200 flex flex-col overflow-hidden"
        >
          <div className="px-4 py-3 border-b border-slate-100">
            <span className="text-sm font-bold text-slate-800">Nhóm hàng</span>
          </div>
          <div className="px-3 py-2 border-b border-slate-100">
            <div className="relative">
              <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-slate-400" />
              <input
                autoFocus
                type="text"
                placeholder="Tìm kiếm"
                value={searchTerm}
                onChange={e => setSearchTerm(e.target.value)}
                className="w-full pl-8 pr-3 py-1.5 text-sm border border-indigo-400 rounded-lg outline-none bg-white"
              />
            </div>
          </div>
          <div className="overflow-y-auto max-h-64">
            {categoryTree.map(node => renderNode(node, 0))}
            {categoryTree.length === 0 && (
              <p className="px-4 py-6 text-sm text-slate-400 text-center">Chưa có nhóm hàng</p>
            )}
          </div>
          <div className="flex items-center justify-between px-4 py-3 border-t border-slate-100 bg-slate-50/60">
            <button
              type="button"
              onClick={() => {
                const allSelected = uniqueCategories.every(c => pendingCategories.includes(c));
                setPendingCategories(allSelected ? [] : [...uniqueCategories]);
              }}
              className="text-sm text-indigo-600 font-semibold hover:underline"
            >
              {uniqueCategories.every(c => pendingCategories.includes(c))
                ? 'Bỏ chọn tất cả'
                : 'Chọn tất cả'}
            </button>
            <button
              type="button"
              onClick={handleApply}
              className="px-5 py-1.5 bg-indigo-600 text-white text-sm font-bold rounded-xl hover:bg-indigo-700 transition-colors"
            >
              Áp dụng
            </button>
          </div>
        </div>
      )}

      <div
        ref={triggerRef}
        onClick={openPopup}
        className="w-full px-3 py-2 text-sm bg-white border border-slate-200 rounded-lg cursor-pointer hover:border-indigo-400 transition-all flex items-center justify-between"
      >
        <span className={selectedCategories.length > 0 ? 'text-slate-700 font-semibold' : 'text-slate-400'}>
          {displayText}
        </span>
        <ChevronDown className="h-3.5 w-3.5 text-slate-400 shrink-0" />
      </div>
    </>
  );
};
