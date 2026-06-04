import React, { useMemo, useState, useRef, useEffect, useCallback } from 'react';
import { Check, ChevronDown, ChevronRight, X } from 'lucide-react';
import { ProductGroup } from '../../types';

type GroupNode = {
  path: string;
  name: string;
  isSelectable: boolean;
  children: GroupNode[];
};

function buildGroupTree(paths: string[]): GroupNode[] {
  type NodeDraft = {
    name: string;
    path: string;
    isSelectable: boolean;
    childMap: Map<string, NodeDraft>;
  };
  const rootMap = new Map<string, NodeDraft>();

  for (const rawPath of paths) {
    const parts = rawPath
      .split(/\s*>>\s*/)
      .map(s => s.trim())
      .filter(Boolean);
    if (parts.length === 0) continue;
    let currentMap = rootMap;
    let pathSoFar = '';
    for (let i = 0; i < parts.length; i++) {
      const part = parts[i];
      pathSoFar = pathSoFar ? `${pathSoFar} >> ${part}` : part;
      const isLast = i === parts.length - 1;
      if (!currentMap.has(part)) {
        currentMap.set(part, {
          name: part,
          path: pathSoFar,
          isSelectable: isLast,
          childMap: new Map(),
        });
      } else if (isLast) {
        currentMap.get(part)!.isSelectable = true;
      }
      currentMap = currentMap.get(part)!.childMap;
    }
  }

  const toNodes = (map: Map<string, NodeDraft>): GroupNode[] =>
    Array.from(map.values())
      .sort((a, b) => a.name.localeCompare(b.name, 'vi', { numeric: true }))
      .map(n => ({ name: n.name, path: n.path, isSelectable: n.isSelectable, children: toNodes(n.childMap) }));

  return toNodes(rootMap);
}

function matchesSearch(node: GroupNode, q: string): boolean {
  if (node.name.toLowerCase().includes(q)) return true;
  return node.children.some(c => matchesSearch(c, q));
}

interface GroupTreePickerProps {
  productGroups: ProductGroup[];
  products?: { categoryId?: string }[];
  value: string;
  onChange: (path: string) => void;
  placeholder?: string;
}

export const GroupTreePicker: React.FC<GroupTreePickerProps> = ({
  productGroups,
  products,
  value,
  onChange,
  placeholder = 'Chọn nhóm hàng',
}) => {
  const [open, setOpen] = useState(false);
  const [inputText, setInputText] = useState('');
  const [expanded, setExpanded] = useState<Set<string>>(new Set());
  const containerRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  const allPaths = useMemo(() => {
    const set = new Set<string>();
    for (const g of productGroups) if (g.name?.trim()) set.add(g.name.trim());
    if (products) {
      for (const p of products) if (p.categoryId?.trim()) set.add(p.categoryId.trim());
    }
    return Array.from(set);
  }, [productGroups, products]);

  const tree = useMemo(() => buildGroupTree(allPaths), [allPaths]);

  const leafName = value ? value.split('>>').pop()?.trim() ?? value : '';

  useEffect(() => {
    if (!open) {
      setInputText(leafName);
    }
  }, [open, leafName]);

  useEffect(() => {
    if (!open) return;
    const handler = (e: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setOpen(false);
        setInputText(leafName);
      }
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, [open, leafName]);

  const q = inputText.toLowerCase();

  const toggle = useCallback((path: string) =>
    setExpanded(prev => {
      const next = new Set(prev);
      if (next.has(path)) next.delete(path);
      else next.add(path);
      return next;
    }), []);

  const handleFocus = () => {
    setInputText('');
    setOpen(true);
  };

  const handleSelect = (path: string) => {
    onChange(path);
    setInputText(path.split('>>').pop()?.trim() ?? path);
    setOpen(false);
  };

  const handleClear = (e: React.MouseEvent) => {
    e.stopPropagation();
    onChange('');
    setInputText('');
    setOpen(false);
    inputRef.current?.focus();
  };

  const renderNode = (node: GroupNode, depth: number): React.ReactNode => {
    if (q && !matchesSearch(node, q)) return null;
    const hasChildren = node.children.length > 0;
    const isExpanded = q ? true : expanded.has(node.path);
    const isSelected = node.path === value;
    const isSelectable = node.isSelectable;

    return (
      <div key={node.path}>
        <div
          className={`flex items-center transition-colors ${isSelected ? 'bg-indigo-50' : 'hover:bg-slate-50'}`}
          style={{ paddingLeft: `${12 + depth * 18}px`, paddingRight: 8 }}
        >
          <button
            type="button"
            onMouseDown={e => { e.preventDefault(); if (hasChildren && !q) toggle(node.path); }}
            className="w-5 shrink-0 flex items-center justify-center text-slate-400"
          >
            {hasChildren ? (
              isExpanded ? <ChevronDown className="h-3.5 w-3.5" /> : <ChevronRight className="h-3.5 w-3.5" />
            ) : (
              <span className="h-1.5 w-1.5 rounded-full bg-slate-300 mx-auto block" />
            )}
          </button>
          <button
            type="button"
            disabled={!isSelectable}
            onMouseDown={e => { e.preventDefault(); }}
            onClick={() => { if (isSelectable) handleSelect(node.path); }}
            className={`flex-1 flex items-center gap-2 py-2.5 text-left text-sm min-w-0 ${!isSelectable ? 'cursor-default' : 'cursor-pointer'}`}
          >
            <span className={`flex-1 min-w-0 truncate ${
              isSelected ? 'text-indigo-700 font-semibold'
              : depth === 0 ? 'font-medium text-slate-800'
              : 'text-slate-700'
            } ${!isSelectable ? 'text-slate-400' : ''}`}>
              {node.name}
            </span>
            {isSelected && <Check className="h-3.5 w-3.5 text-indigo-600 shrink-0" />}
          </button>
        </div>
        {isExpanded && hasChildren && (
          <div>{node.children.map(c => renderNode(c, depth + 1))}</div>
        )}
      </div>
    );
  };

  return (
    <div className="relative w-full" ref={containerRef}>
      <div className="w-full flex items-center border border-slate-200 rounded-xl bg-white hover:border-indigo-400 transition-all overflow-hidden focus-within:border-indigo-400 focus-within:ring-2 focus-within:ring-indigo-100">
        <input
          ref={inputRef}
          type="text"
          value={inputText}
          placeholder={placeholder}
          onChange={e => { setInputText(e.target.value); setOpen(true); }}
          onFocus={handleFocus}
          className="flex-1 px-3 py-2.5 text-sm bg-transparent outline-none text-slate-800 placeholder:text-slate-400"
        />
        {value && (
          <button type="button" onClick={handleClear} className="px-2 text-slate-400 hover:text-slate-600 transition-colors">
            <X className="h-3.5 w-3.5" />
          </button>
        )}
        <span className="pr-3 text-slate-400">
          <ChevronDown className={`h-4 w-4 transition-transform ${open ? 'rotate-180' : ''}`} />
        </span>
      </div>

      {open && (
        <div className="absolute left-0 right-0 top-full mt-1 bg-white rounded-2xl shadow-2xl border border-slate-200 flex flex-col z-50">
          <div className="overflow-y-auto max-h-60 py-1">
            {tree.length === 0 ? (
              <p className="text-center text-xs text-slate-400 py-6">Chưa có nhóm hàng</p>
            ) : (
              tree.map(node => renderNode(node, 0))
            )}
          </div>
        </div>
      )}
    </div>
  );
};

interface GroupTreeInlineProps {
  productGroups: ProductGroup[];
  products?: { categoryId?: string }[];
  value: string;
  onChange: (path: string) => void;
}

export const GroupTreeInline: React.FC<GroupTreeInlineProps> = ({
  productGroups,
  products,
  value,
  onChange,
}) => {
  const [expanded, setExpanded] = useState<Set<string>>(new Set());

  const allPaths = useMemo(() => {
    const set = new Set<string>();
    for (const g of productGroups) if (g.name?.trim()) set.add(g.name.trim());
    if (products) {
      for (const p of products) if (p.categoryId?.trim()) set.add(p.categoryId.trim());
    }
    return Array.from(set);
  }, [productGroups, products]);

  const tree = useMemo(() => buildGroupTree(allPaths), [allPaths]);

  const toggle = useCallback((path: string) =>
    setExpanded(prev => {
      const next = new Set(prev);
      if (next.has(path)) next.delete(path);
      else next.add(path);
      return next;
    }), []);

  const renderNode = (node: GroupNode, depth: number): React.ReactNode => {
    const hasChildren = node.children.length > 0;
    const isExpanded = expanded.has(node.path);
    const isSelected = node.path === value;
    const isSelectable = node.isSelectable;

    return (
      <div key={node.path}>
        <div
          className={`flex items-center rounded-lg transition-colors cursor-pointer ${isSelected ? 'bg-indigo-50' : 'hover:bg-slate-50'}`}
          style={{ paddingLeft: `${8 + depth * 20}px`, paddingRight: 8 }}
          onClick={() => {
            if (hasChildren) toggle(node.path);
            if (isSelectable) onChange(node.path);
          }}
        >
          <span className="w-5 shrink-0 flex items-center justify-center text-slate-400">
            {hasChildren ? (
              isExpanded ? <ChevronDown className="h-3.5 w-3.5" /> : <ChevronRight className="h-3.5 w-3.5" />
            ) : (
              <span className="h-1.5 w-1.5 rounded-full bg-slate-300 mx-auto block" />
            )}
          </span>
          <span className={`flex-1 py-2 text-sm min-w-0 truncate ${
            isSelected ? 'text-indigo-700 font-semibold'
            : depth === 0 ? 'font-medium text-slate-800'
            : 'text-slate-700'
          } ${!isSelectable ? 'text-slate-400' : ''}`}>
            {node.name}
          </span>
          {isSelected && <Check className="h-3.5 w-3.5 text-indigo-600 shrink-0" />}
        </div>
        {isExpanded && hasChildren && (
          <div>{node.children.map(child => renderNode(child, depth + 1))}</div>
        )}
      </div>
    );
  };

  return (
    <div className="border border-slate-200 rounded-xl overflow-hidden">
      <div className="max-h-48 overflow-y-auto py-1">
        <div
          className={`flex items-center gap-2 px-3 py-2 rounded-lg mx-1 cursor-pointer transition-colors ${value === '' ? 'bg-indigo-50' : 'hover:bg-slate-50'}`}
          onClick={() => onChange('')}
        >
          <span className="w-5 shrink-0" />
          <span className={`flex-1 text-sm ${value === '' ? 'text-indigo-700 font-semibold' : 'text-slate-500'}`}>
            Không có nhóm cha
          </span>
          {value === '' && <Check className="h-3.5 w-3.5 text-indigo-600 shrink-0" />}
        </div>
        {tree.length === 0 ? (
          <p className="text-center text-xs text-slate-400 py-4">Chưa có nhóm hàng</p>
        ) : (
          tree.map(node => renderNode(node, 0))
        )}
      </div>
    </div>
  );
};
