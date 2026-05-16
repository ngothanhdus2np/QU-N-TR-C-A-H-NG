import React, { useEffect, useMemo, useRef, useState } from 'react';
import { ChevronDown, ChevronRight, Search } from 'lucide-react';
import { ProductGroup } from '../../types';

type GroupNode = {
  id: string;
  name: string;
  fullPath: string;
  level: number;
  count: number;
  children: GroupNode[];
};

interface ProductGroupTreePickerProps {
  groups: ProductGroup[];
  selectedPaths: string[];
  onSelectionChange: (paths: string[]) => void;
  productCountByPath?: Map<string, number>;
  placeholder?: string;
  className?: string;
  popupPlacement?: 'bottom' | 'right';
}

const splitPath = (name: string) =>
  String(name || '')
    .split(/\s*(?:>>|>|\/)\s*/g)
    .map(part => part.trim())
    .filter(Boolean);

const joinPath = (parts: string[]) => parts.join(' >> ');

const ProductGroupTreePicker: React.FC<ProductGroupTreePickerProps> = ({
  groups,
  selectedPaths,
  onSelectionChange,
  productCountByPath = new Map(),
  placeholder = 'Chọn nhóm hàng',
  className = '',
  popupPlacement = 'bottom',
}) => {
  const pickerRef = useRef<HTMLDivElement>(null);
  const [isOpen, setIsOpen] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');
  const [expandedPaths, setExpandedPaths] = useState<Set<string>>(() => new Set());

  useEffect(() => {
    if (!isOpen) return;

    const handlePointerDown = (event: MouseEvent) => {
      if (!pickerRef.current?.contains(event.target as Node)) {
        setIsOpen(false);
      }
    };

    document.addEventListener('mousedown', handlePointerDown);
    return () => document.removeEventListener('mousedown', handlePointerDown);
  }, [isOpen]);

  // Build tree structure (same logic as ProductGroupTreeTab)
  const treeNodes = useMemo(() => {
    const nodes = new Map<string, GroupNode>();
    const roots: GroupNode[] = [];

    const ensureNode = (fullPath: string, level: number): GroupNode => {
      const existing = nodes.get(fullPath);
      if (existing) return existing;

      const parts = splitPath(fullPath);
      const node: GroupNode = {
        id: groups.find(group => group.name === fullPath)?.id || fullPath,
        name: parts[parts.length - 1] || fullPath,
        fullPath,
        level,
        count: productCountByPath.get(fullPath) || 0,
        children: [],
      };
      nodes.set(fullPath, node);
      return node;
    };

    const sourcePaths = new Set<string>();
    groups.forEach(group => {
      const parts = splitPath(group.name);
      parts.forEach((_, index) => {
        sourcePaths.add(joinPath(parts.slice(0, index + 1)));
      });
    });
    productCountByPath.forEach((_, path) => {
      const parts = splitPath(path);
      parts.forEach((__, index) => {
        sourcePaths.add(joinPath(parts.slice(0, index + 1)));
      });
    });

    sourcePaths.forEach(path => {
      const parts = splitPath(path);
      let currentPath = '';

      parts.forEach((part, index) => {
        const parentPath = currentPath;
        currentPath = joinPath(parts.slice(0, index + 1));
        const node = ensureNode(currentPath, index);

        if (!parentPath) {
          if (!roots.some(root => root.fullPath === node.fullPath)) roots.push(node);
          return;
        }

        const parent = ensureNode(parentPath, index - 1);
        if (!parent.children.some(child => child.fullPath === node.fullPath)) {
          parent.children.push(node);
        }
      });
    });

    return { nodes, roots };
  }, [groups, productCountByPath]);

  const filteredAndVisibleNodes = useMemo(() => {
    const visible: GroupNode[] = [];
    const searchLower = searchTerm.toLowerCase().trim();
    const searchExpandedPaths = new Set<string>();

    const matchesSearch = (node: GroupNode): boolean => {
      if (!searchLower) return true;
      return node.name.toLowerCase().includes(searchLower) || node.fullPath.toLowerCase().includes(searchLower);
    };

    const hasMatchingDescendant = (node: GroupNode): boolean => {
      if (matchesSearch(node)) return true;
      return node.children.some(child => hasMatchingDescendant(child));
    };

    const walk = (list: GroupNode[]) => {
      list.forEach(node => {
        const nodeMatches = matchesSearch(node);
        const descendantMatches = hasMatchingDescendant(node);

        if (nodeMatches || descendantMatches) {
          visible.push(node);
          
          if (searchLower && descendantMatches && node.children.length > 0) {
            searchExpandedPaths.add(node.fullPath);
          }

          if (expandedPaths.has(node.fullPath) || searchExpandedPaths.has(node.fullPath)) {
            walk(node.children);
          }
        }
      });
    };

    walk(treeNodes.roots);
    return visible;
  }, [treeNodes, expandedPaths, searchTerm]);

  const toggleExpand = (fullPath: string) => {
    setExpandedPaths(prev => {
      const next = new Set(prev);
      if (next.has(fullPath)) {
        next.delete(fullPath);
      } else {
        next.add(fullPath);
      }
      return next;
    });
  };

  const toggleSelection = (fullPath: string) => {
    const isSelected = selectedPaths.includes(fullPath);
    if (isSelected) {
      onSelectionChange(selectedPaths.filter(path => path !== fullPath));
    } else {
      onSelectionChange([...selectedPaths, fullPath]);
    }
  };

  const displayText = useMemo(() => {
    if (selectedPaths.length === 0) return placeholder;
    if (selectedPaths.length === 1) {
      const parts = splitPath(selectedPaths[0]);
      return parts[parts.length - 1];
    }
    return `${selectedPaths.length} nhóm đã chọn`;
  }, [selectedPaths, placeholder]);

  const popupClassName =
    popupPlacement === 'right'
      ? 'absolute left-full top-0 z-30 ml-3 w-[440px] overflow-hidden rounded-xl border border-slate-200 bg-white shadow-xl'
      : 'absolute right-0 top-full z-30 mt-2 w-96 overflow-hidden rounded-xl border border-slate-200 bg-white shadow-xl';

  return (
    <div ref={pickerRef} className={`relative ${className}`}>
      <button
        type="button"
        onClick={() => {
          setIsOpen(prev => !prev);
          setSearchTerm('');
        }}
        className="flex h-12 min-w-52 items-center justify-between gap-3 rounded-xl border border-slate-200 bg-white px-4 text-left text-sm font-normal text-slate-500 transition-all hover:border-indigo-300 hover:text-slate-800"
      >
        <span className={selectedPaths.length > 0 ? 'text-slate-800' : ''}>
          {displayText}
        </span>
        <ChevronDown className="h-4 w-4 text-slate-400" />
      </button>

      {isOpen && (
        <div className={popupClassName}>
          {/* Search Header */}
          <div className="border-b border-slate-100 p-3">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-slate-400" />
              <input
                autoFocus
                className="h-9 w-full rounded-lg border border-slate-200 bg-white pl-9 pr-3 text-sm font-normal outline-none transition-all placeholder:text-slate-300 focus:border-indigo-400"
                placeholder="Tìm nhóm hàng"
                value={searchTerm}
                onChange={e => setSearchTerm(e.target.value)}
              />
            </div>
          </div>

          {/* Tree List - Same as ProductGroupTreeTab */}
          <div className="max-h-96 overflow-y-auto">
            {filteredAndVisibleNodes.length === 0 && (
              <div className="px-4 py-8 text-center text-sm font-normal text-slate-300">
                Không tìm thấy nhóm hàng
              </div>
            )}

            {filteredAndVisibleNodes.map(node => {
              const isExpanded = expandedPaths.has(node.fullPath) || Boolean(searchTerm.trim());
              const hasChildren = node.children.length > 0;
              const isSelected = selectedPaths.includes(node.fullPath);

              return (
                <div
                  key={node.fullPath}
                  className="flex items-center gap-2 border-b border-slate-50 px-4 py-2.5 hover:bg-slate-50"
                  style={{ paddingLeft: `${16 + node.level * 24}px` }}
                >
                  {/* Expand/Collapse Button */}
                  {hasChildren ? (
                    <button
                      type="button"
                      onClick={e => {
                        e.stopPropagation();
                        toggleExpand(node.fullPath);
                      }}
                      className="shrink-0 rounded p-0.5 text-slate-600 hover:bg-slate-200"
                    >
                      {isExpanded ? (
                        <ChevronDown className="h-3.5 w-3.5" />
                      ) : (
                        <ChevronRight className="h-3.5 w-3.5" />
                      )}
                    </button>
                  ) : (
                    <span className="h-4 w-4 shrink-0" />
                  )}

                  {/* Checkbox */}
                  <label className="flex flex-1 cursor-pointer items-center gap-3">
                    <input
                      type="checkbox"
                      checked={isSelected}
                      onChange={() => toggleSelection(node.fullPath)}
                      className="h-4 w-4 rounded border-slate-300 text-indigo-600 focus:ring-indigo-500"
                    />
                    <span className={`flex-1 text-sm ${node.level === 0 ? 'font-normal text-slate-900' : 'font-normal text-slate-700'}`}>
                      {node.name}
                    </span>
                    {node.count > 0 && (
                      <span className="text-xs font-normal tabular-nums text-slate-400">
                        ({node.count})
                      </span>
                    )}
                  </label>
                </div>
              );
            })}
          </div>

          {/* Footer Actions */}
          <div className="flex items-center justify-between border-t border-slate-100 bg-slate-50/70 px-4 py-3">
            <button
              type="button"
              onClick={() => onSelectionChange([])}
              className="text-sm font-normal text-slate-500 transition-colors hover:text-rose-600"
            >
              Bỏ chọn
            </button>
            <button
              type="button"
              onClick={() => setIsOpen(false)}
              className="rounded-xl bg-indigo-600 px-4 py-2 text-sm font-normal text-white transition-colors hover:bg-indigo-700"
            >
              Áp dụng
            </button>
          </div>
        </div>
      )}
    </div>
  );
};

export default ProductGroupTreePicker;
