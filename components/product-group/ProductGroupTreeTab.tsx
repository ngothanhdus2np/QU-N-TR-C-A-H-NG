import React from 'react';
import {
  ChevronDown,
  ChevronLeft,
  ChevronRight,
  Edit2,
  HelpCircle,
  Plus,
  SortAsc,
  Trash2,
  Wand2,
} from 'lucide-react';
import { POSProduct, ProductGroup } from '../../types';
import { generateId } from '../../src/lib';

type GroupNode = {
  id: string;
  name: string;
  fullPath: string;
  level: number;
  count: number;
  children: GroupNode[];
};

interface ProductGroupTreeTabProps {
  groups: ProductGroup[];
  products: POSProduct[];
  onUpdateGroups: (newList: ProductGroup[]) => void;
}

const splitPath = (name: string) =>
  String(name || '')
    .split(' >> ')
    .map(part => part.trim())
    .filter(Boolean);

const ProductGroupTreeTab: React.FC<ProductGroupTreeTabProps> = ({ groups, products, onUpdateGroups }) => {
  const [expandedPaths, setExpandedPaths] = React.useState<Set<string>>(() => new Set());
  const [sortByName, setSortByName] = React.useState(false);
  const [page, setPage] = React.useState(1);

  const productCountByPath = React.useMemo(() => {
    const countMap = new Map<string, number>();

    products.forEach(product => {
      const rawPath = product.categoryPath || product.categoryId || '';
      const parts = splitPath(rawPath);
      if (parts.length === 0) return;

      let currentPath = '';
      parts.forEach(part => {
        currentPath = currentPath ? `${currentPath} >> ${part}` : part;
        countMap.set(currentPath, (countMap.get(currentPath) || 0) + 1);
      });
    });

    return countMap;
  }, [products]);

  const treeRows = React.useMemo(() => {
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

    groups.forEach(group => {
      const parts = splitPath(group.name);
      let currentPath = '';

      parts.forEach((part, index) => {
        const parentPath = currentPath;
        currentPath = currentPath ? `${currentPath} >> ${part}` : part;
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

    const sortNodes = (list: GroupNode[]) => {
      const sorted = sortByName ? [...list].sort((a, b) => a.name.localeCompare(b.name, 'vi-VN')) : list;
      sorted.forEach(node => {
        node.children = sortNodes(node.children);
      });
      return sorted;
    };

    const visible: GroupNode[] = [];
    const walk = (list: GroupNode[]) => {
      list.forEach(node => {
        visible.push(node);
        if (expandedPaths.has(node.fullPath)) walk(node.children);
      });
    };

    walk(sortNodes(roots));
    return visible;
  }, [expandedPaths, groups, productCountByPath, sortByName]);

  const totalGroups = groups.length;
  const pageSize = 12;
  const totalPages = Math.max(1, Math.ceil(treeRows.length / pageSize));
  const pageRows = treeRows.slice((page - 1) * pageSize, page * pageSize);

  React.useEffect(() => {
    if (page > totalPages) setPage(totalPages);
  }, [page, totalPages]);

  const addGroup = () => {
    const name = window.prompt('Nhập tên nhóm hàng. Dùng "Cha >> Con" để tạo nhóm con.');
    const cleanName = String(name || '').trim();
    if (!cleanName) return;
    if (groups.some(group => group.name.toLocaleLowerCase('vi-VN') === cleanName.toLocaleLowerCase('vi-VN'))) {
      window.alert('Nhóm hàng đã tồn tại.');
      return;
    }
    onUpdateGroups([...groups, { id: generateId(), name: cleanName }]);
  };

  const editGroup = (node: GroupNode) => {
    const nextName = window.prompt('Sửa tên nhóm hàng', node.fullPath);
    const cleanName = String(nextName || '').trim();
    if (!cleanName || cleanName === node.fullPath) return;

    onUpdateGroups(
      groups.map(group =>
        group.name === node.fullPath || group.name.startsWith(`${node.fullPath} >> `)
          ? { ...group, name: group.name.replace(node.fullPath, cleanName) }
          : group
      )
    );
  };

  const deleteGroup = (node: GroupNode) => {
    const confirmed = window.confirm(`Xóa nhóm "${node.name}" và các nhóm con?`);
    if (!confirmed) return;
    onUpdateGroups(groups.filter(group => group.name !== node.fullPath && !group.name.startsWith(`${node.fullPath} >> `)));
  };

  const autoConvertToHierarchy = () => {
    const confirmed = window.confirm(
      'Tự động chuyển đổi các nhóm hàng thành cấu trúc phân cấp?\n\n' +
      'Ví dụ:\n' +
      '• "DÉP NAM" → "DÉP" >> "DÉP NAM"\n' +
      '• "GIÀY CAO GÓT" → "GIÀY" >> "GIÀY CAO GÓT"\n\n' +
      'Lưu ý: Thao tác này sẽ tạo thêm các nhóm cha mới.'
    );
    
    if (!confirmed) return;

    const newGroups = new Set<string>();
    const commonParents = ['GIÀY', 'DÉP', 'SANDAL', 'BÚP', 'CAO', 'BALO', 'SỤC', 'KIỂU'];

    groups.forEach(group => {
      const name = group.name;
      
      // Skip if already hierarchical
      if (name.includes(' >> ')) {
        newGroups.add(name);
        return;
      }

      const words = name.split(' ').filter(Boolean);
      
      if (words.length >= 2) {
        const firstWord = words[0];
        
        if (commonParents.includes(firstWord)) {
          // Add parent
          newGroups.add(firstWord);
          // Add as child
          newGroups.add(`${firstWord} >> ${name}`);
        } else {
          // Keep as is
          newGroups.add(name);
        }
      } else {
        // Single word, keep as is
        newGroups.add(name);
      }
    });

    const updatedGroups = Array.from(newGroups).map(name => ({
      id: groups.find(g => g.name === name)?.id || generateId(),
      name
    }));

    onUpdateGroups(updatedGroups);
    window.alert(`Đã chuyển đổi thành công! Tạo ${updatedGroups.length} nhóm hàng (bao gồm cả nhóm cha mới).`);
  };

  return (
    <div className="animate-in fade-in duration-300">
      <div className="grid grid-cols-1 gap-5 xl:grid-cols-[1fr_260px]">
        <section className="overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm">
          <div className="flex items-start gap-4 border-b border-slate-100 px-8 py-7">
            <button type="button" className="mt-1 rounded-lg p-1 text-slate-500 hover:bg-slate-100">
              <ChevronLeft className="h-5 w-5" />
            </button>
            <div>
              <h2 className="text-xl font-bold text-slate-900">Nhóm hàng</h2>
              <p className="mt-1 text-sm text-slate-500">
                Quản lý hàng hóa theo chủng loại, đặc tính, công năng.
              </p>
            </div>
          </div>

          <div className="flex items-center justify-end gap-3 border-b border-slate-100 px-8 py-4">
            <button
              type="button"
              onClick={autoConvertToHierarchy}
              className="inline-flex h-10 items-center gap-2 rounded-lg border border-indigo-200 bg-indigo-50 px-4 text-sm font-normal text-indigo-700 hover:bg-indigo-100"
            >
              <Wand2 className="h-4 w-4" />
              Tự động phân cấp
            </button>
            <button
              type="button"
              onClick={addGroup}
              className="inline-flex h-10 items-center gap-2 rounded-lg border border-slate-200 bg-white px-4 text-sm font-normal text-slate-800 hover:border-blue-200 hover:text-blue-700"
            >
              <Plus className="h-4 w-4" />
              Tạo nhóm hàng
            </button>
            <button
              type="button"
              onClick={() => setSortByName(prev => !prev)}
              className={`inline-flex h-10 items-center gap-2 rounded-lg border px-4 text-sm font-normal ${
                sortByName
                  ? 'border-blue-200 bg-blue-50 text-blue-700'
                  : 'border-slate-200 bg-white text-slate-800 hover:border-blue-200 hover:text-blue-700'
              }`}
            >
              <SortAsc className="h-4 w-4" />
              Thứ tự hiển thị
            </button>
          </div>

          <div className="px-8 py-5">
            <div className="overflow-hidden border border-slate-100">
              <table className="w-full border-collapse text-left text-sm">
                <thead>
                  <tr className="bg-slate-100 text-xs font-bold text-slate-800">
                    <th className="px-4 py-3">Tên nhóm hàng</th>
                    <th className="w-36 px-4 py-3 text-left">SL hàng hóa</th>
                    <th className="w-28 px-4 py-3 text-center">Thao tác</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {pageRows.map(node => {
                    const isExpanded = expandedPaths.has(node.fullPath);
                    const hasChildren = node.children.length > 0;

                    return (
                      <tr key={node.fullPath} className="hover:bg-slate-50">
                        <td className="px-4 py-3">
                          <div className="flex items-center gap-2" style={{ paddingLeft: `${node.level * 28}px` }}>
                            {hasChildren ? (
                              <button
                                type="button"
                                onClick={() => {
                                  setExpandedPaths(prev => {
                                    const next = new Set(prev);
                                    if (next.has(node.fullPath)) next.delete(node.fullPath);
                                    else next.add(node.fullPath);
                                    return next;
                                  });
                                }}
                                className="rounded p-0.5 text-slate-600 hover:bg-slate-100"
                              >
                                {isExpanded ? <ChevronDown className="h-4 w-4" /> : <ChevronRight className="h-4 w-4" />}
                              </button>
                            ) : (
                              <span className="h-5 w-5" />
                            )}
                            <span className={node.level === 0 ? 'font-normal text-slate-900' : 'text-slate-800'}>
                              {node.name}
                            </span>
                          </div>
                        </td>
                        <td className="px-4 py-3 tabular-nums text-slate-900">{node.count}</td>
                        <td className="px-4 py-3">
                          <div className="flex items-center justify-center gap-3 text-slate-700">
                            <button type="button" onClick={() => editGroup(node)} className="hover:text-blue-700">
                              <Edit2 className="h-4 w-4" />
                            </button>
                            <button type="button" onClick={() => deleteGroup(node)} className="hover:text-rose-600">
                              <Trash2 className="h-4 w-4" />
                            </button>
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>

            <div className="mt-4 flex items-center gap-4 text-sm text-slate-600">
              <button
                type="button"
                disabled={page <= 1}
                onClick={() => setPage(prev => Math.max(1, prev - 1))}
                className="rounded p-1 text-slate-400 hover:bg-slate-100 disabled:opacity-40"
              >
                <ChevronLeft className="h-4 w-4" />
              </button>
              <span className="rounded-lg border border-slate-200 px-4 py-1.5 text-slate-900">{page}</span>
              <button
                type="button"
                disabled={page >= totalPages}
                onClick={() => setPage(prev => Math.min(totalPages, prev + 1))}
                className="rounded p-1 text-slate-400 hover:bg-slate-100 disabled:opacity-40"
              >
                <ChevronRight className="h-4 w-4" />
              </button>
              <span className="font-normal text-slate-700">Tổng {totalGroups} nhóm hàng</span>
            </div>
          </div>
        </section>

        <aside className="h-fit rounded-xl bg-white px-5 py-6 shadow-sm">
          <div className="mb-6 flex items-center gap-3 text-blue-600">
            <HelpCircle className="h-5 w-5" />
            <h3 className="text-base font-bold">Gợi ý</h3>
          </div>
          <p className="text-sm leading-relaxed text-slate-700">
            Tổ chức nhóm hàng theo cấp bậc để lọc và chọn hàng loạt hàng hóa tiện lợi hơn.
          </p>
          <button type="button" className="mt-4 text-left text-sm font-normal text-blue-600 hover:text-blue-700">
            Tìm hiểu cách quản lý nhóm hàng
          </button>
        </aside>
      </div>
    </div>
  );
};

export default ProductGroupTreeTab;
