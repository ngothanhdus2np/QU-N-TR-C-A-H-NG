import React, { useState, useRef, useMemo, useTransition } from 'react';
import DOMPurify from 'dompurify';
import { ProductGroup, ProductGroupRevenue, RevenueRecord, POSProduct, POSOrder } from '../types';
import {
  ChevronDown,
  ChevronRight,
  DollarSign,
  Sparkles,
  Loader2,
  Info,
  TrendingUp,
  DatabaseZap,
  X,
  FileText,
  Filter,
  FileSpreadsheet,
  ShieldAlert,
  Star,
  History,
  Boxes,
} from 'lucide-react';
import {
  cleanVNNumber,
  parseVNDate,
  parseHierarchyGroups,
  generateId,
  processExcelRawData,
  isUUID,
  type ParsedExcelRow,
} from '../src/lib';
import { marked } from 'marked';
import { useToast } from './ui/Toast';
import ProductGroupLedgerTab from './product-group/ProductGroupLedgerTab';
import ProductGroupMatrixTab from './product-group/ProductGroupMatrixTab';

type ViewMode = 'revenue' | 'quantity';
type ProductGroupSubTab = 'seasonality' | 'matrix' | 'ledger';

interface SeasonalRow {
  month: string;
  groupName: string;
  fullPath: string;
  displayName: string;
  level: number;
  quantity: number;
  amount: number;
  returnsQuantity: number;
  returnsValue: number;
  net: number;
  cogs: number;
  profit: number;
  margin: number;
  hasChildren: boolean;
}

interface Props {
  productGroups: ProductGroup[];
  products?: POSProduct[];
  orders?: POSOrder[];
  groupRevenue: ProductGroupRevenue[];
  list: RevenueRecord[];
  onUpdateGroups: (newList: ProductGroup[]) => void;
  onUpdateGroupRevenue: (newList: ProductGroupRevenue[]) => void;
  onUpdateRevenue: (newList: RevenueRecord[]) => void;
}

type PendingGroup = { name: string; level: number; fullPath: string; selected: boolean };
type PendingGroupRevenue = {
  date: string;
  fullPath: string;
  amount: number;
  quantity: number;
  returnsQuantity: number;
  returnsValue: number;
  netRevenue: number;
  cogs: number;
};
type ImportedGroupRow = ParsedExcelRow & { _smartGroup: string; _amount: number };
type LedgerMonthMetric = {
  quantity: number;
  amount: number;
  returnsQuantity: number;
  returnsValue: number;
  net: number;
  cogs: number;
};

type GroupTreeNode = {
  id: string;
  name: string;
  fullPath: string;
  level: number;
  rev: number;
  qty: number;
  selfRev: number;
  selfQty: number;
  percent: number;
  children: GroupTreeNode[];
};

type GroupMetricRow = {
  groupName: string;
  rev: number;
  qty: number;
};

const ProductGroupManager: React.FC<Props> = ({
  productGroups,
  products = [],
  orders = [],
  groupRevenue,
  onUpdateGroups,
  onUpdateGroupRevenue,
}) => {
  const { showToast } = useToast();
  const [activeSubTab, setActiveSubTab] = useState<ProductGroupSubTab>('seasonality');
  const [, startSubTabTransition] = useTransition();
  const [viewMode, setViewMode] = useState<ViewMode>('quantity');
  const [selectedMonthNum, setSelectedMonthNum] = useState<number>(new Date().getMonth() + 1);

  const [filterStartDate, setFilterStartDate] = useState<string>('');
  const [filterEndDate, setFilterEndDate] = useState<string>('');

  const [expandedNodesStrategic, setExpandedNodesStrategic] = useState<Set<string>>(new Set());
  const [expandedLedgerRows, setExpandedLedgerRows] = useState<Set<string>>(new Set());
  const [expandedCurrentGroups, setExpandedCurrentGroups] = useState<Set<string>>(new Set());
  const [expandedNextGroups, setExpandedNextGroups] = useState<Set<string>>(new Set());
  const [showAllCurrentGroups, setShowAllCurrentGroups] = useState(false);
  const [showAllNextGroups, setShowAllNextGroups] = useState(false);

  const [isDiagnosing, setIsDiagnosing] = useState(false);
  const [diagnosisResult, setDiagnosisResult] = useState<string | null>(null);

  const [isAuditMode, setIsAuditMode] = useState(false);
  const [isCommitting, setIsCommitting] = useState(false);
  const [pendingGroups, setPendingGroups] = useState<PendingGroup[]>([]);
  const [pendingGroupRevenue, setPendingGroupRevenue] = useState<PendingGroupRevenue[]>([]);
  const [groupConflicts, setGroupConflicts] = useState<
    { date: string; groupName: string; currentAmount: number; newAmount: number }[]
  >([]);
  const [conflictResolution, setConflictResolution] = useState<'overwrite' | 'skip' | 'add'>(
    'overwrite'
  );
  const [syncAccountingMonth, setSyncAccountingMonth] = useState(
    new Date().toISOString().slice(0, 7)
  );

  const fileInputRef = useRef<HTMLInputElement>(null);
  const formatNumber = (num: number) => Math.round(num || 0).toLocaleString('vi-VN');

  const changeSubTab = (tab: ProductGroupSubTab) => {
    startSubTabTransition(() => setActiveSubTab(tab));
  };

  const [groupFormData, setGroupFormData] = useState({
    date: new Date().toISOString().split('T')[0],
    groupId: '',
    amount: '',
    quantity: '',
    netRevenue: '',
    returnsQuantity: '',
    returnsValue: '',
    cogs: '',
  });

  const effectiveGroups = useMemo(() => {
    if (productGroups && productGroups.length > 0) return productGroups;
    const uniqueGroupNames = Array.from(new Set(groupRevenue.map(r => r.groupName))).filter(
      Boolean
    );
    return uniqueGroupNames.map(name => ({
      id: groupRevenue.find(r => r.groupName === name)?.groupId || generateId(),
      name: name,
    }));
  }, [productGroups, groupRevenue]);

  // --- NEW MIS TACTICAL LOGIC ---
  const nextMonthNum = selectedMonthNum === 12 ? 1 : selectedMonthNum + 1;
  const years = useMemo(() => {
    const ySet = new Set<string>();
    groupRevenue.forEach(r => ySet.add(r.date.split('-')[0]));
    return Array.from(ySet).sort((a, b) => b.localeCompare(a));
  }, [groupRevenue]);

  const orderYears = useMemo(() => {
    const ySet = new Set<string>();
    orders.forEach(order => {
      if (order.isReturn) return;
      const year = new Date(order.date).getFullYear();
      if (!Number.isNaN(year)) ySet.add(String(year));
    });
    return Array.from(ySet).sort((a, b) => b.localeCompare(a));
  }, [orders]);

  const productGroupPathMap = useMemo(() => {
    const map = new Map<string, string>();
    products.forEach(product => {
      const rawPath = product.categoryPath || product.categoryId || 'Chưa phân loại';
      const parts = String(rawPath)
        .split(/\s*(?:>>|>|\/)\s*/g)
        .map(part => part.trim())
        .filter(Boolean);
      map.set(product.id, parts.length > 0 ? parts.join(' >> ') : 'Chưa phân loại');
    });
    return map;
  }, [products]);

  const monthlyOrderGroupMetrics = useMemo(() => {
    const byMonth = new Map<number, { yearSet: Set<number>; groups: Map<string, GroupMetricRow> }>();

    orders.forEach(order => {
      if (order.isReturn) return;
      const orderDate = new Date(order.date);
      if (Number.isNaN(orderDate.getTime())) return;
      const month = orderDate.getMonth() + 1;
      const year = orderDate.getFullYear();
      let monthBucket = byMonth.get(month);
      if (!monthBucket) {
        monthBucket = { yearSet: new Set<number>(), groups: new Map<string, GroupMetricRow>() };
        byMonth.set(month, monthBucket);
      }
      monthBucket.yearSet.add(year);

      (order.items || []).forEach(item => {
        const groupName = productGroupPathMap.get(item.productId) || 'Chưa phân loại';
        const current = monthBucket.groups.get(groupName) || { groupName, rev: 0, qty: 0 };
        current.rev += item.total || item.price * item.quantity;
        current.qty += item.quantity || 0;
        monthBucket.groups.set(groupName, current);
      });
    });

    return byMonth;
  }, [orders, productGroupPathMap]);

  const buildGroupTree = (
    records: GroupMetricRow[],
    divisor = 1
  ): { roots: GroupTreeNode[]; totalRev: number; totalQty: number } => {
    const nodeMap = new Map<string, GroupTreeNode>();

    const ensureNode = (fullPath: string, level: number): GroupTreeNode => {
      const existing = nodeMap.get(fullPath);
      if (existing) return existing;
      const parts = fullPath.split(' >> ');
      const node: GroupTreeNode = {
        id: fullPath,
        name: parts[parts.length - 1] || fullPath,
        fullPath,
        level,
        rev: 0,
        qty: 0,
        selfRev: 0,
        selfQty: 0,
        percent: 0,
        children: [],
      };
      nodeMap.set(fullPath, node);

      if (parts.length > 1) {
        const parentPath = parts.slice(0, -1).join(' >> ');
        const parent = ensureNode(parentPath, level - 1);
        if (!parent.children.some(child => child.fullPath === fullPath)) parent.children.push(node);
      }

      return node;
    };

    records.forEach(record => {
      const parts = String(record.groupName || 'Chưa phân loại')
        .split(' >> ')
        .map(part => part.trim())
        .filter(Boolean);
      if (parts.length === 0) parts.push('Chưa phân loại');
      let currentPath = '';
      parts.forEach((part, index) => {
        currentPath = currentPath ? `${currentPath} >> ${part}` : part;
        ensureNode(currentPath, index + 1);
      });
      const leafPath = parts.join(' >> ');
      const leaf = ensureNode(leafPath, parts.length);
      leaf.selfRev += record.rev / divisor;
      leaf.selfQty += record.qty / divisor;
    });

    const computeTotals = (node: GroupTreeNode) => {
      node.children.forEach(computeTotals);
      node.rev = node.selfRev + node.children.reduce((sum, child) => sum + child.rev, 0);
      node.qty = node.selfQty + node.children.reduce((sum, child) => sum + child.qty, 0);
      node.children.sort((a, b) => (viewMode === 'revenue' ? b.rev - a.rev : b.qty - a.qty));
    };

    const roots = Array.from(nodeMap.values()).filter(node => node.level === 1);
    roots.forEach(computeTotals);
    roots.sort((a, b) => (viewMode === 'revenue' ? b.rev - a.rev : b.qty - a.qty));

    const totalRev = roots.reduce((sum, node) => sum + node.rev, 0);
    const totalQty = roots.reduce((sum, node) => sum + node.qty, 0);
    const denominator = viewMode === 'revenue' ? totalRev : totalQty;
    nodeMap.forEach(node => {
      const metric = viewMode === 'revenue' ? node.rev : node.qty;
      node.percent = denominator > 0 ? (metric / denominator) * 100 : 0;
    });

    return { roots, totalRev, totalQty };
  };

  const currentGroupTree = useMemo(() => {
    if (activeSubTab !== 'seasonality') return { roots: [], totalRev: 0, totalQty: 0 };
    const bucket = monthlyOrderGroupMetrics.get(selectedMonthNum);
    return buildGroupTree(Array.from(bucket?.groups.values() || []));
  }, [activeSubTab, monthlyOrderGroupMetrics, selectedMonthNum, viewMode]);

  const nextGroupTree = useMemo(() => {
    if (activeSubTab !== 'seasonality') return { roots: [], totalRev: 0, totalQty: 0 };
    const bucket = monthlyOrderGroupMetrics.get(nextMonthNum);
    return buildGroupTree(Array.from(bucket?.groups.values() || []), Math.max(bucket?.yearSet.size || 0, 1));
  }, [activeSubTab, monthlyOrderGroupMetrics, nextMonthNum, viewMode]);

  const thisMonthTactical = currentGroupTree.roots;
  const nextMonthTactical = nextGroupTree.roots;

  const strategicKPIs = useMemo(
    () => ({
      totalRev: currentGroupTree.totalRev,
      totalQty: currentGroupTree.totalQty,
    }),
    [currentGroupTree.totalQty, currentGroupTree.totalRev]
  );

  const matrixData = useMemo(() => {
    if (activeSubTab !== 'matrix') return [];
    const sortedGroups = [...effectiveGroups];
    const parentPaths = new Set<string>();
    const metricByPathYear = new Map<string, number>();

    for (const record of groupRevenue) {
      const rYear = record.date.split('-')[0];
      const rMonth = parseInt(record.date.split('-')[1]);
      if (rMonth !== selectedMonthNum) continue;

      const metric =
        viewMode === 'revenue'
          ? record.netRevenue || record.amount - (record.returnsValue || 0)
          : record.quantity || 0;
      const parts = record.groupName.split(' >> ');
      let currentPath = '';

      parts.forEach((part, index) => {
        currentPath = currentPath ? `${currentPath} >> ${part}` : part;
        const key = `${currentPath}__${rYear}`;
        metricByPathYear.set(key, (metricByPathYear.get(key) || 0) + metric);
        if (index < parts.length - 1) parentPaths.add(currentPath);
      });
    }

    return sortedGroups
      .map(g => {
        const parts = g.name.split(' >> ');
        const yearValues: Record<string, number> = {};
        let totalAllYearsMetric = 0;
        years.forEach(y => {
          const val = metricByPathYear.get(`${g.name}__${y}`) || 0;
          yearValues[y] = val;
          totalAllYearsMetric += val;
        });
        return {
          ...g,
          displayName: parts[parts.length - 1],
          level: parts.length,
          isParent: parentPaths.has(g.name),
          yearValues,
          totalAllYearsMetric,
        };
      })
      .filter(row => row.totalAllYearsMetric > 0)
      .sort((a, b) => b.totalAllYearsMetric - a.totalAllYearsMetric);
  }, [activeSubTab, effectiveGroups, groupRevenue, years, selectedMonthNum, viewMode]);

  const maxMatrixValue = useMemo(() => {
    let max = 0;
    matrixData.forEach(row => {
      (Object.values(row.yearValues) as number[]).forEach(v => {
        if (v > max) max = v;
      });
    });
    return max || 1;
  }, [matrixData]);

  const getHeatmapColor = (value: number) => {
    if (value <= 0) return 'transparent';
    const intensity = value / maxMatrixValue;
    const baseColor = viewMode === 'revenue' ? 'emerald' : 'indigo';
    if (intensity > 0.8) return `bg-${baseColor}-500 text-white font-normal`;
    if (intensity > 0.5) return `bg-${baseColor}-400 text-white font-normal`;
    if (intensity > 0.3) return `bg-${baseColor}-200 text-${baseColor}-900 font-normal`;
    return `bg-${baseColor}-50 text-${baseColor}-700 font-normal`;
  };

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    const isExcel = file.name.endsWith('.xlsx') || file.name.endsWith('.xls');
    reader.onload = event => {
      try {
        const fileContent = event.target?.result;
        if (!fileContent) return;
        const results = processExcelRawData(fileContent, isExcel);
        const mappedResults: ImportedGroupRow[] = results
          .map(r => {
            const gKey = Object.keys(r).find(k => ['nhomhang', 'nhomhanghoa', 'group'].includes(k));
            const amount = cleanVNNumber(
              r[Object.keys(r).find(k => ['doanhthu', 'tienhang', 'revenue'].includes(k))!]
            );
            const rawGroupName =
              gKey && r[gKey] ? String(r[gKey]).trim() : amount > 0 ? 'Chưa phân loại' : '';
            return { ...r, _smartGroup: rawGroupName, _amount: amount };
          })
          .filter(r => r._smartGroup !== '');
        const rawGroupNames = Array.from(new Set(mappedResults.map(r => r._smartGroup)));
        const hierarchyFound: PendingGroup[] = [];
        const existingPaths = effectiveGroups.map(g => g.name);
        rawGroupNames.forEach(raw => {
          parseHierarchyGroups(raw).forEach(node => {
            if (
              !existingPaths.includes(node.fullPath) &&
              !hierarchyFound.some(h => h.fullPath === node.fullPath)
            ) {
              hierarchyFound.push({ ...node, selected: true });
            }
          });
        });
        const mappedGroupRev = mappedResults.map(r => ({
          date:
            parseVNDate(
              r[Object.keys(r).find(k => ['ngay', 'thoigian', 'date', 'time'].includes(k))!]
            ) || 'AUTO_MONTH',
          fullPath: r._smartGroup,
          amount: r._amount,
          quantity: cleanVNNumber(
            r[Object.keys(r).find(k => ['slban', 'soluong', 'qty'].includes(k))!]
          ),
          returnsQuantity: cleanVNNumber(r.sltra || r.soluongtra),
          returnsValue: cleanVNNumber(r.giatritra || r.trahang),
          netRevenue: cleanVNNumber(r.doanhthuthuan || r.netrevenue),
          cogs: cleanVNNumber(r.tonggiavon || r.giavon),
        }));

        // Detect conflicts
        const conflicts: {
          date: string;
          groupName: string;
          currentAmount: number;
          newAmount: number;
        }[] = [];
        const [year, month] = syncAccountingMonth.split('-').map(Number);
        const lastDay = new Date(year, month, 0).getDate();
        const resolvedDate = `${syncAccountingMonth}-${lastDay.toString().padStart(2, '0')}`;

        mappedGroupRev.forEach(p => {
          const pDate = p.date === 'AUTO_MONTH' ? resolvedDate : p.date;
          const existing = groupRevenue.find(r => r.date === pDate && r.groupName === p.fullPath);
          if (existing) {
            conflicts.push({
              date: pDate,
              groupName: p.fullPath,
              currentAmount: existing.amount,
              newAmount: p.amount,
            });
          }
        });

        setGroupConflicts(conflicts);
        setPendingGroups(hierarchyFound.sort((a, b) => a.fullPath.localeCompare(b.fullPath)));
        setPendingGroupRevenue(mappedGroupRev);
        setIsAuditMode(true);
      } catch {
        showToast('Lỗi hệ thống khi xử lý file Excel.', 'error');
      }
    };
    if (isExcel) reader.readAsArrayBuffer(file);
    else reader.readAsText(file);
  };

  const handleCommitSync = async () => {
    setIsCommitting(true);
    try {
      const [year, month] = syncAccountingMonth.split('-').map(Number);
      const lastDay = new Date(year, month, 0).getDate();
      const resolvedDate = `${syncAccountingMonth}-${lastDay.toString().padStart(2, '0')}`;

      const newGroupsToSave: ProductGroup[] = pendingGroups
        .filter(g => g.selected)
        .map(g => ({ id: generateId(), name: g.fullPath }));
      const allGroupsMerged = [...effectiveGroups, ...newGroupsToSave];
      await onUpdateGroups(allGroupsMerged);

      const recordsToCommit: ProductGroupRevenue[] = pendingGroupRevenue
        .map(p => {
          const matchingGroup = allGroupsMerged.find(g => g.name === p.fullPath);
          const finalGroupId =
            matchingGroup?.id ||
            allGroupsMerged.find(g => p.fullPath.startsWith(g.name + ' >> '))?.id;
          return {
            id: generateId(),
            date: p.date === 'AUTO_MONTH' ? resolvedDate : p.date,
            groupId: finalGroupId || '',
            groupName: p.fullPath,
            amount: p.amount,
            quantity: p.quantity,
            returnsQuantity: p.returnsQuantity,
            returnsValue: p.returnsValue,
            netRevenue: p.netRevenue || p.amount - p.returnsValue,
            cogs: p.cogs,
          };
        })
        .filter(r => isUUID(r.groupId));

      let finalList = [...groupRevenue];

      if (conflictResolution === 'overwrite') {
        // Remove existing records that match date and groupName of new records
        const commitKeys = new Set(recordsToCommit.map(r => `${r.date}_${r.groupName}`));
        finalList = finalList.filter(r => !commitKeys.has(`${r.date}_${r.groupName}`));
        finalList = [...recordsToCommit, ...finalList];
      } else if (conflictResolution === 'skip') {
        // Only add records that don't already exist
        const existingKeys = new Set(groupRevenue.map(r => `${r.date}_${r.groupName}`));
        const filteredNew = recordsToCommit.filter(
          r => !existingKeys.has(`${r.date}_${r.groupName}`)
        );
        finalList = [...filteredNew, ...groupRevenue];
      } else {
        // Add (current behavior)
        finalList = [...recordsToCommit, ...groupRevenue];
      }

      await onUpdateGroupRevenue(finalList);
      setIsAuditMode(false);
      setGroupConflicts([]);
      showToast('Đồng bộ dữ liệu Nhóm hàng thành công!', 'success');
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : String(err);
      showToast(`Lỗi khi lưu dữ liệu: ${message}`, 'error');
    } finally {
      setIsCommitting(false);
    }
  };

  const runStrategicDiagnosis = async () => {
    setIsDiagnosing(true);
    setDiagnosisResult(null);
    try {
      const contextData = `
        BỐI CẢNH: Phân tích so sánh trọng tâm Tháng ${selectedMonthNum} và dự báo Tháng ${nextMonthNum}.
        DỮ LIỆU THỰC TẾ THÁNG ${selectedMonthNum}:
        ${thisMonthTactical.map(g => `- Nhóm ${g.name}: Chiếm ${g.percent.toFixed(1)}% tổng ${viewMode === 'revenue' ? 'doanh thu' : 'số lượng'}`).join('\n')}
        DỮ LIỆU LỊCH SỬ THÁNG ${nextMonthNum}:
        ${nextMonthTactical.map(g => `- Nhóm ${g.name}: Thường đạt TB ${viewMode === 'revenue' ? formatNumber(g.rev) + 'đ' : formatNumber(g.qty) + ' đv'}`).join('\n')}
        YÊU CẦU:
        1. Nhận định về sự chuyển dịch trọng tâm giữa 2 tháng.
        2. Cảnh báo "Điểm rơi doanh số" nếu có nhóm hàng sụt giảm mạnh vào tháng tới.
        3. Đề xuất hành động cụ thể (Nhập hàng, Clear stock, Marketing) cho 3 nhóm hàng quan trọng nhất.
      `;
      const response = await fetch('/api/ai/product-group-analysis', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ contextData }),
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || 'AI service error');
      setDiagnosisResult(data.result || 'Lỗi AI.');
    } catch {
      setDiagnosisResult(
        'Lỗi kết nối AI Advisor. Vui lòng kiểm tra ANTHROPIC_API_KEY trong .env.local.'
      );
    } finally {
      setIsDiagnosing(false);
    }
  };

  const handleAddGroupRevenue = (e: React.FormEvent) => {
    e.preventDefault();
    const amountVal = Number(groupFormData.amount) || 0;
    const quantityVal = Number(groupFormData.quantity) || 0;
    const cogsVal = Number(groupFormData.cogs) || 0;

    const selectedGroup = effectiveGroups.find(g => g.id === groupFormData.groupId);
    if (!selectedGroup) return;

    const newRecord: ProductGroupRevenue = {
      id: generateId(),
      date: groupFormData.date,
      groupId: groupFormData.groupId,
      groupName: selectedGroup.name,
      amount: amountVal,
      quantity: quantityVal,
      netRevenue: amountVal, // Simplified for manual entry
      cogs: cogsVal,
    };

    onUpdateGroupRevenue([newRecord, ...groupRevenue]);
    setGroupFormData({
      ...groupFormData,
      amount: '',
      quantity: '',
      netRevenue: '',
      returnsQuantity: '',
      returnsValue: '',
      cogs: '',
    });
  };

  const toggleNode = (fullPath: string) => {
    const newExpanded = new Set(expandedNodesStrategic);
    if (newExpanded.has(fullPath)) newExpanded.delete(fullPath);
    else newExpanded.add(fullPath);
    setExpandedNodesStrategic(newExpanded);
  };

  const toggleLedgerRow = (month: string, fullPath: string) => {
    const key = `${month}_${fullPath}`;
    const newExpanded = new Set(expandedLedgerRows);
    if (newExpanded.has(key)) newExpanded.delete(key);
    else newExpanded.add(key);
    setExpandedLedgerRows(newExpanded);
  };

  const visibleLedgerRows = useMemo(() => {
    if (activeSubTab !== 'ledger') return [];
    let filteredRevenue = [...groupRevenue];
    if (filterStartDate) filteredRevenue = filteredRevenue.filter(r => r.date >= filterStartDate);
    if (filterEndDate) filteredRevenue = filteredRevenue.filter(r => r.date <= filterEndDate);
    const monthMap: Record<string, Record<string, LedgerMonthMetric>> = {};
    filteredRevenue.forEach(rev => {
      const mY = rev.date.slice(0, 7);
      if (!monthMap[mY]) monthMap[mY] = {};
      const path = rev.groupName;
      if (!monthMap[mY][path])
        monthMap[mY][path] = {
          quantity: 0,
          amount: 0,
          returnsQuantity: 0,
          returnsValue: 0,
          net: 0,
          cogs: 0,
        };
      monthMap[mY][path].quantity += rev.quantity || 0;
      monthMap[mY][path].amount += rev.amount || 0;
      monthMap[mY][path].returnsValue += rev.returnsValue || 0;
      monthMap[mY][path].net += rev.netRevenue || (rev.amount || 0) - (rev.returnsValue || 0);
      monthMap[mY][path].cogs += rev.cogs || 0;
    });
    const finalData: SeasonalRow[] = [];
    Object.keys(monthMap)
      .sort((a, b) => b.localeCompare(a))
      .forEach(month => {
        const monthData = monthMap[month];
        const monthPaths = new Set<string>();
        Object.keys(monthData).forEach(path => {
          const parts = path.split(' >> ');
          let current = '';
          parts.forEach(p => {
            current = current ? `${current} >> ${p}` : p;
            monthPaths.add(current);
          });
        });
        const monthRows = Array.from(monthPaths).map(path => {
          const parts = path.split(' >> ');
          let q = 0,
            a = 0,
            rv = 0,
            n = 0,
            c = 0;
          Object.keys(monthData).forEach(dk => {
            if (dk === path || dk.startsWith(path + ' >> ')) {
              const m = monthData[dk];
              q += m.quantity;
              a += m.amount;
              rv += m.returnsValue;
              n += m.net;
              c += m.cogs;
            }
          });
          return {
            month,
            groupName: path,
            fullPath: path,
            displayName: parts[parts.length - 1],
            level: parts.length,
            quantity: q,
            amount: a,
            returnsQuantity: 0,
            returnsValue: rv,
            net: n,
            cogs: c,
            profit: n - c,
            margin: n > 0 ? ((n - c) / n) * 100 : 0,
            hasChildren: Array.from(monthPaths).some(p => p.startsWith(path + ' >> ')),
          };
        });
        monthRows.sort((a, b) => a.fullPath.localeCompare(b.fullPath));
        finalData.push(...monthRows);
      });
    return finalData.filter(row => {
      if (row.level === 1) return true;
      const parts = row.fullPath.split(' >> ');
      let currentPath = '';
      for (let i = 0; i < parts.length - 1; i++) {
        currentPath = currentPath ? `${currentPath} >> ${parts[i]}` : parts[i];
        if (!expandedLedgerRows.has(`${row.month}_${currentPath}`)) return false;
      }
      return true;
    });
  }, [activeSubTab, groupRevenue, expandedLedgerRows, filterStartDate, filterEndDate]);

  const renderGroupRows = (
    nodes: GroupTreeNode[],
    expanded: Set<string>,
    setExpanded: React.Dispatch<React.SetStateAction<Set<string>>>,
    actionMode = false,
    totalMetric = 0
  ): React.ReactNode[] => {
    const rows: React.ReactNode[] = [];
    const metricKey = viewMode === 'revenue' ? 'rev' : 'qty';
    const selfMetricKey = viewMode === 'revenue' ? 'selfRev' : 'selfQty';

    const renderNode = (node: GroupTreeNode, indexPath: string) => {
      const isExpanded = expanded.has(node.fullPath);
      const hasChildren = node.children.length > 0;
      const metric = node[metricKey];
      rows.push(
        <tr key={node.fullPath} className="border-b border-slate-50 hover:bg-slate-50 transition-colors">
          <td className="pl-5 pr-4 py-3">
            <div
              className="flex items-center gap-2"
              style={{ paddingLeft: Math.max(0, node.level - 1) * 18 }}
            >
              {hasChildren ? (
                <button
                  onClick={() =>
                    setExpanded(prev => {
                      const next = new Set(prev);
                      if (next.has(node.fullPath)) next.delete(node.fullPath);
                      else next.add(node.fullPath);
                      return next;
                    })
                  }
                  className="w-5 h-5 rounded-md text-slate-400 hover:bg-slate-100 hover:text-slate-700 flex items-center justify-center"
                >
                  {isExpanded ? <ChevronDown className="w-3.5 h-3.5" /> : <ChevronRight className="w-3.5 h-3.5" />}
                </button>
              ) : (
                <span className="w-5 h-5" />
              )}
              {node.level === 1 && (
                <span className="w-5 h-5 rounded-md bg-slate-100 text-slate-500 text-2xs font-bold flex items-center justify-center">
                  {indexPath}
                </span>
              )}
              <span className={`text-sm truncate ${node.level === 1 ? 'text-slate-700 font-semibold' : 'text-slate-600 font-medium'}`}>
                {node.name}
              </span>
            </div>
          </td>
          <td className="px-4 py-3 text-right">
            <span className="text-sm text-slate-700 font-medium">{node.percent.toFixed(1)}%</span>
          </td>
          <td className="px-4 py-3 text-right text-sm text-slate-500">
            {viewMode === 'revenue' ? `${formatNumber(metric)}đ` : `${formatNumber(metric)} đv`}
          </td>
          {actionMode && (
            <td className="pr-5 pl-4 py-3">
              <span className="text-xs text-slate-600">
                {node.level === 1 && Number(indexPath) <= 3 ? 'Ưu tiên nhập hàng' : 'Đẩy mạnh marketing'}
              </span>
            </td>
          )}
        </tr>
      );

      if (!isExpanded) return;

      const selfMetric = node[selfMetricKey];
      if (hasChildren && selfMetric > 0) {
        const selfPercent = totalMetric > 0 ? (selfMetric / totalMetric) * 100 : 0;
        rows.push(
          <tr key={`${node.fullPath}__direct`} className="border-b border-slate-50 bg-slate-50/40">
            <td className="pl-5 pr-4 py-2.5">
              <div className="flex items-center gap-2" style={{ paddingLeft: node.level * 18 + 20 }}>
                <span className="text-xs text-slate-500 font-medium">Khác / trực tiếp</span>
              </div>
            </td>
            <td className="px-4 py-2.5 text-right text-xs text-slate-500">{selfPercent.toFixed(1)}%</td>
            <td className="px-4 py-2.5 text-right text-xs text-slate-500">
              {viewMode === 'revenue' ? `${formatNumber(selfMetric)}đ` : `${formatNumber(selfMetric)} đv`}
            </td>
            {actionMode && <td className="pr-5 pl-4 py-2.5 text-xs text-slate-400">Theo dõi thêm</td>}
          </tr>
        );
      }

      node.children.forEach((child, childIndex) => renderNode(child, `${indexPath}.${childIndex + 1}`));
    };

    nodes.forEach((node, index) => renderNode(node, String(index + 1)));
    return rows;
  };

  return (
    <div className="h-full max-w-full overflow-y-auto p-6 pb-20 space-y-8 animate-in fade-in duration-500">
      {/* BỘ LỌC CHU KỲ HÀNG THÁNG */}
      <div className="bg-white p-8 md:p-10 rounded-[3.5rem] border border-slate-200 shadow-xl space-y-10">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-6">
          <div className="flex items-center gap-5">
            <div className="p-4 bg-indigo-600 text-white rounded-[1.5rem] shadow-lg">
              <History className="w-8 h-8" />
            </div>
            <div>
              <h3 className="text-2xl font-semibold text-slate-900 uppercase tracking-tight">
                Đối Soát Quy Luật Chu Kỳ
              </h3>
              <p className="text-xs text-indigo-600 font-normal uppercase tracking-widest mt-1">
                Tìm quy luật bán hàng qua nhiều năm
              </p>
            </div>
          </div>

          <div className="flex items-center gap-4 bg-slate-100 p-1.5 rounded-2xl border border-slate-200 shadow-inner">
            <button
              onClick={() => setViewMode('quantity')}
              className={`flex items-center gap-2 px-6 py-2.5 rounded-xl text-2xs font-normal uppercase tracking-widest transition-all ${viewMode === 'quantity' ? 'bg-white text-indigo-600 shadow-md' : 'text-slate-400 hover:text-slate-600'}`}
            >
              <Boxes className="w-4 h-4" /> Số lượng
            </button>
            <button
              onClick={() => setViewMode('revenue')}
              className={`flex items-center gap-2 px-6 py-2.5 rounded-xl text-2xs font-normal uppercase tracking-widest transition-all ${viewMode === 'revenue' ? 'bg-white text-emerald-600 shadow-md' : 'text-slate-400 hover:text-slate-600'}`}
            >
              <DollarSign className="w-4 h-4" /> Doanh thu
            </button>
          </div>
        </div>

        <div className="grid grid-cols-4 md:grid-cols-6 lg:grid-cols-12 gap-3">
          {Array.from({ length: 12 }, (_, i) => i + 1).map(m => (
            <button
              key={m}
              onClick={() => setSelectedMonthNum(m)}
              className={`group relative py-6 rounded-[1.5rem] text-xs font-normal transition-all border-2 overflow-hidden ${selectedMonthNum === m ? 'bg-indigo-600 border-indigo-600 text-white shadow-2xl scale-110 z-10' : 'bg-white border-slate-100 text-slate-400 hover:border-indigo-200 hover:bg-slate-50'}`}
            >
              <span className="relative z-10">THÁNG {m}</span>
              {selectedMonthNum === m && (
                <div className="absolute inset-0 bg-gradient-to-br from-white/20 to-transparent opacity-50"></div>
              )}
            </button>
          ))}
        </div>
      </div>

      <div className="flex bg-slate-100 p-1.5 rounded-[2rem] w-fit mx-auto shadow-sm border border-slate-200">
        <button
          onClick={() => changeSubTab('seasonality')}
          className={`flex items-center gap-2 px-8 py-4 rounded-[1.5rem] font-normal text-2xs uppercase tracking-widest transition-all ${activeSubTab === 'seasonality' ? 'bg-white text-emerald-600 shadow-xl' : 'text-slate-400 hover:text-slate-600'}`}
        >
          <Sparkles className="w-4 h-4" /> Dự Báo Chiến Lược
        </button>
        <button
          onClick={() => changeSubTab('matrix')}
          className={`flex items-center gap-2 px-8 py-4 rounded-[1.5rem] font-normal text-2xs uppercase tracking-widest transition-all ${activeSubTab === 'matrix' ? 'bg-white text-indigo-600 shadow-xl' : 'text-slate-400 hover:text-slate-600'}`}
        >
          <Filter className="w-4 h-4" /> Ma Trận Phân Tích Năm
        </button>
        <button
          onClick={() => changeSubTab('ledger')}
          className={`flex items-center gap-2 px-8 py-4 rounded-[1.5rem] font-normal text-2xs uppercase tracking-widest transition-all ${activeSubTab === 'ledger' ? 'bg-white text-blue-600 shadow-xl' : 'text-slate-400 hover:text-slate-600'}`}
        >
          <FileSpreadsheet className="w-4 h-4" /> Sổ Cái Nhóm Hàng
        </button>
      </div>

      {activeSubTab === 'seasonality' && (
        <div className="space-y-5 animate-in fade-in duration-300">
          <div className="grid grid-cols-4 gap-4">
            {[
              {
                label: `Sản lượng tháng ${selectedMonthNum}`,
                value: `${formatNumber(strategicKPIs.totalQty)} đv`,
                desc: 'Tổng bán từ hóa đơn cùng tháng qua các năm',
              },
              {
                label: `Doanh thu tháng ${selectedMonthNum}`,
                value: `${formatNumber(strategicKPIs.totalRev)}đ`,
                desc: 'Doanh thu hóa đơn cùng tháng',
              },
              {
                label: 'Dự báo tháng sau',
                value: `Tháng ${nextMonthNum}`,
                desc: `Dựa trên trung bình hóa đơn ${orderYears.length} năm`,
              },
              {
                label: 'Nhóm chủ lực',
                value: `${thisMonthTactical.length} nhóm`,
                desc: 'Nhóm đang đóng góp chính',
              },
            ].map(card => (
              <div key={card.label} className="bg-white rounded-xl border border-slate-100 shadow-sm px-5 py-4">
                <p className="text-xs text-slate-500 mb-1">{card.label}</p>
                <p className="text-2xl font-bold text-slate-800 mb-2">{card.value}</p>
                <p className="text-xs text-slate-400">{card.desc}</p>
              </div>
            ))}
          </div>

          <div className="grid grid-cols-1 xl:grid-cols-2 gap-5">
            <div className="bg-white rounded-xl border border-slate-100 shadow-sm overflow-hidden">
              <div className="px-5 py-3 border-b border-slate-100 flex items-center justify-between">
                <div>
                  <span className="text-sm font-semibold text-slate-700">
                    Trọng tâm tháng {selectedMonthNum}
                  </span>
                  <p className="text-xs text-slate-400 mt-0.5">
                    Xếp hạng thực tế theo {viewMode === 'revenue' ? 'doanh thu' : 'số lượng'}
                  </p>
                </div>
                {thisMonthTactical.length > 10 && (
                  <button
                    onClick={() => setShowAllCurrentGroups(value => !value)}
                    className="text-xs font-bold text-indigo-600 hover:text-indigo-700"
                  >
                    {showAllCurrentGroups ? 'Thu gọn' : 'Xem tất cả'}
                  </button>
                )}
              </div>
              <table className="w-full">
                <thead>
                  <tr className="border-b border-slate-100 bg-slate-50">
                    <th className="text-left pl-5 pr-4 py-2.5 text-xs font-medium text-slate-500">Nhóm hàng</th>
                    <th className="text-right px-4 py-2.5 text-xs font-medium text-slate-500">Đóng góp</th>
                    <th className="text-right pr-5 pl-4 py-2.5 text-xs font-medium text-slate-500">
                      {viewMode === 'revenue' ? 'Doanh thu' : 'Số lượng'}
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {thisMonthTactical.length === 0 ? (
                    <tr>
                      <td colSpan={3} className="px-5 py-8 text-center text-sm text-slate-400">
                        Không có dữ liệu tháng này.
                      </td>
                    </tr>
                  ) : (
                    renderGroupRows(
                      showAllCurrentGroups ? thisMonthTactical : thisMonthTactical.slice(0, 10),
                      expandedCurrentGroups,
                      setExpandedCurrentGroups,
                      false,
                      viewMode === 'revenue' ? currentGroupTree.totalRev : currentGroupTree.totalQty
                    )
                  )}
                </tbody>
              </table>
            </div>

            <div className="bg-white rounded-xl border border-slate-100 shadow-sm overflow-hidden">
              <div className="px-5 py-3 border-b border-slate-100 flex items-center justify-between">
                <div>
                  <span className="text-sm font-semibold text-slate-700">
                    Gợi ý chiến lược tháng {nextMonthNum}
                  </span>
                  <p className="text-xs text-slate-400 mt-0.5">
                    Dự báo dựa trên trung bình hóa đơn {orderYears.length} năm
                  </p>
                </div>
                {nextMonthTactical.length > 10 && (
                  <button
                    onClick={() => setShowAllNextGroups(value => !value)}
                    className="text-xs font-bold text-indigo-600 hover:text-indigo-700"
                  >
                    {showAllNextGroups ? 'Thu gọn' : 'Xem tất cả'}
                  </button>
                )}
              </div>
              <table className="w-full">
                <thead>
                  <tr className="border-b border-slate-100 bg-slate-50">
                    <th className="text-left pl-5 pr-4 py-2.5 text-xs font-medium text-slate-500">Nhóm hàng</th>
                    <th className="text-right px-4 py-2.5 text-xs font-medium text-slate-500">Đóng góp</th>
                    <th className="text-right px-4 py-2.5 text-xs font-medium text-slate-500">Dự báo</th>
                    <th className="text-left pr-5 pl-4 py-2.5 text-xs font-medium text-slate-500">Hành động</th>
                  </tr>
                </thead>
                <tbody>
                  {nextMonthTactical.length === 0 ? (
                    <tr>
                      <td colSpan={4} className="px-5 py-8 text-center text-sm text-slate-400">
                        Chưa đủ dữ liệu lịch sử cho tháng sau.
                      </td>
                    </tr>
                  ) : (
                    renderGroupRows(
                      showAllNextGroups ? nextMonthTactical : nextMonthTactical.slice(0, 10),
                      expandedNextGroups,
                      setExpandedNextGroups,
                      true,
                      viewMode === 'revenue' ? nextGroupTree.totalRev : nextGroupTree.totalQty
                    )
                  )}
                </tbody>
              </table>
            </div>
          </div>

          <div className="bg-white rounded-xl border border-slate-100 shadow-sm overflow-hidden">
            <div className="px-5 py-4 flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
              <div>
                <div className="flex items-center gap-2">
                  <Sparkles className="w-4 h-4 text-slate-400" />
                  <span className="text-sm font-semibold text-slate-700">Chẩn đoán chiến lược</span>
                </div>
                <p className="text-xs text-slate-400 mt-1">
                  Đối soát sự chuyển dịch từ tháng {selectedMonthNum} sang tháng {nextMonthNum} để tối ưu nhập hàng và marketing.
                </p>
              </div>
              <button
                onClick={runStrategicDiagnosis}
                disabled={isDiagnosing}
                className="inline-flex items-center justify-center gap-2 px-4 py-2 bg-indigo-600 hover:bg-indigo-500 text-white rounded-lg text-xs font-bold transition-colors disabled:opacity-50"
              >
                {isDiagnosing ? (
                  <Loader2 className="w-4 h-4 animate-spin" />
                ) : (
                  <DatabaseZap className="w-4 h-4" />
                )}
                {isDiagnosing ? 'Đang phân tích...' : 'Chạy chẩn đoán'}
              </button>
            </div>

            {diagnosisResult && (
              <div className="border-t border-slate-100 px-5 py-4">
                <div className="flex items-center justify-between mb-3">
                  <div className="flex items-center gap-2">
                    <FileText className="w-4 h-4 text-slate-400" />
                    <span className="text-xs font-semibold text-slate-600">Báo cáo phân tích chu kỳ</span>
                  </div>
                  <button
                    onClick={() => setDiagnosisResult(null)}
                    className="p-1.5 text-slate-300 hover:text-rose-500 transition-colors"
                  >
                    <X className="w-4 h-4" />
                  </button>
                </div>
                <div
                  className="markdown-content text-sm text-slate-700"
                  dangerouslySetInnerHTML={{
                    __html: DOMPurify.sanitize(marked.parse(String(diagnosisResult)) as string),
                  }}
                />
              </div>
            )}
          </div>
        </div>
      )}

      {activeSubTab === 'matrix' && (
        <ProductGroupMatrixTab
          selectedMonthNum={selectedMonthNum}
          viewMode={viewMode}
          years={years}
          matrixData={matrixData}
          expandedNodes={expandedNodesStrategic}
          formatNumber={formatNumber}
          getHeatmapColor={getHeatmapColor}
          onToggleNode={toggleNode}
        />
      )}

      {activeSubTab === 'ledger' && (
        <ProductGroupLedgerTab
          effectiveGroups={effectiveGroups}
          groupRevenue={groupRevenue}
          groupFormData={groupFormData}
          visibleLedgerRows={visibleLedgerRows}
          expandedLedgerRows={expandedLedgerRows}
          filterStartDate={filterStartDate}
          filterEndDate={filterEndDate}
          formatNumber={formatNumber}
          onSubmitGroupRevenue={handleAddGroupRevenue}
          onSetGroupFormData={setGroupFormData}
          onSetFilterStartDate={setFilterStartDate}
          onSetFilterEndDate={setFilterEndDate}
          onToggleLedgerRow={toggleLedgerRow}
          onUpdateGroupRevenue={onUpdateGroupRevenue}
        />
      )}

      {/* SYNC AUDIT MODAL */}
      {isAuditMode && (
        <div className="fixed inset-0 z-modal flex items-center justify-center p-4">
          <div
            className="absolute inset-0 bg-slate-900/60 backdrop-blur-md"
            onClick={() => setIsAuditMode(false)}
          ></div>
          <div className="relative bg-white w-full max-w-4xl max-h-[90vh] overflow-hidden rounded-[3.5rem] shadow-2xl animate-in zoom-in-95 duration-200 flex flex-col">
            <div className="p-10 border-b border-slate-100 bg-indigo-50 flex items-center justify-between">
              <div className="flex items-center gap-5">
                <div className="p-4 bg-indigo-600 text-white rounded-3xl shadow-xl">
                  <ShieldAlert className="w-8 h-8" />
                </div>
                <div>
                  <h3 className="text-2xl font-semibold text-slate-900 uppercase tracking-tight">
                    Đối Soát Nhóm Hàng
                  </h3>
                  <p className="text-2xs text-indigo-600 font-normal uppercase tracking-widest mt-1">
                    Phát hiện cấu trúc mới
                  </p>
                </div>
              </div>
              <button
                onClick={() => setIsAuditMode(false)}
                className="p-3 bg-white text-slate-400 hover:text-rose-600 rounded-2xl transition-all"
              >
                <X className="w-6 h-6" />
              </button>
            </div>

            <div className="flex-1 overflow-y-auto p-10 space-y-10 no-scrollbar">
              <div className="bg-amber-50 p-6 rounded-[2rem] border-2 border-dashed border-amber-200 flex items-start gap-5">
                <div className="p-2 bg-amber-500 text-white rounded-xl">
                  <Info className="w-6 h-6" />
                </div>
                <div>
                  <p className="text-xs font-normal text-amber-900 uppercase">Thông tin đồng bộ</p>
                  <p className="text-sm text-amber-800 mt-1 font-normal">
                    Tìm thấy <strong>{pendingGroupRevenue.length}</strong> dòng doanh thu.
                  </p>
                </div>
              </div>

              {pendingGroups.length > 0 && (
                <div className="space-y-6">
                  <h4 className="text-sm font-semibold text-slate-800 uppercase flex items-center gap-3">
                    <div className="w-2 h-2 bg-indigo-600 rounded-full"></div>
                    NHÓM HÀNG MỚI PHÁT HIỆN
                  </h4>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-3 max-h-[200px] overflow-y-auto pr-2">
                    {pendingGroups.map((g, idx) => (
                      <div
                        key={idx}
                        className="flex items-center gap-4 p-4 bg-slate-50 rounded-2xl border border-slate-100"
                      >
                        <input
                          type="checkbox"
                          checked={g.selected}
                          onChange={() => {
                            const next = [...pendingGroups];
                            next[idx].selected = !next[idx].selected;
                            setPendingGroups(next);
                          }}
                          className="w-5 h-5 rounded text-indigo-600"
                        />
                        <div>
                          <p className="text-2xs font-normal text-slate-400 uppercase">
                            Cấp {g.level}
                          </p>
                          <p className="text-xs font-normal text-slate-800 truncate">
                            {g.fullPath}
                          </p>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {groupConflicts.length > 0 && (
                <div className="space-y-6">
                  <h4 className="text-sm font-semibold text-rose-600 uppercase flex items-center gap-3">
                    <div className="w-2 h-2 bg-rose-600 rounded-full"></div>
                    PHÁT HIỆN {groupConflicts.length} DÒNG DỮ LIỆU TRÙNG LẶP
                  </h4>

                  <div className="bg-rose-50 p-6 rounded-3xl border border-rose-100 space-y-4">
                    <p className="text-xs font-normal text-rose-800 uppercase tracking-tight">
                      Chọn phương án xử lý trùng lặp:
                    </p>
                    <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                      {[
                        { id: 'overwrite', label: 'Ghi đè số mới', desc: 'Thay thế số cũ' },
                        { id: 'skip', label: 'Bỏ qua trùng', desc: 'Chỉ lấy dòng mới' },
                        { id: 'add', label: 'Cộng dồn thêm', desc: 'Cộng vào số cũ' },
                      ].map(opt => (
                        <button
                          key={opt.id}
                          onClick={() => setConflictResolution(opt.id as any)}
                          className={`p-4 rounded-2xl border-2 text-left transition-all ${conflictResolution === opt.id ? 'bg-white border-rose-500 shadow-md' : 'bg-white/50 border-transparent text-slate-400 hover:bg-white'}`}
                        >
                          <p
                            className={`text-2xs font-normal uppercase ${conflictResolution === opt.id ? 'text-rose-600' : 'text-slate-400'}`}
                          >
                            {opt.label}
                          </p>
                          <p className="text-[9px] font-normal mt-1">{opt.desc}</p>
                        </button>
                      ))}
                    </div>
                  </div>

                  <div className="max-h-[200px] overflow-y-auto pr-2 border border-slate-100 rounded-2xl">
                    <table className="w-full text-2xs text-left">
                      <thead className="bg-slate-50 sticky top-0">
                        <tr className="text-slate-400 font-semibold uppercase">
                          <th className="p-3">Ngày</th>
                          <th className="p-3">Nhóm hàng</th>
                          <th className="p-3 text-right">Số cũ</th>
                          <th className="p-3 text-right text-rose-600">Số mới</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-50">
                        {groupConflicts.map((c, i) => (
                          <tr key={i} className="hover:bg-slate-50">
                            <td className="p-3 font-normal">{c.date}</td>
                            <td className="p-3 font-normal truncate max-w-[150px]">
                              {c.groupName}
                            </td>
                            <td className="p-3 text-right">{formatNumber(c.currentAmount)}</td>
                            <td className="p-3 text-right font-normal text-rose-600">
                              {formatNumber(c.newAmount)}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              )}

              <div className="p-8 bg-slate-900 rounded-[2.5rem] text-white flex items-center justify-between">
                <div className="flex items-center gap-6">
                  <div className="text-center">
                    <p className="text-2xs font-normal text-slate-400 uppercase mb-1">
                      Tổng bản ghi
                    </p>
                    <p className="text-2xl font-normal">{pendingGroupRevenue.length}</p>
                  </div>
                  <div className="text-center">
                    <p className="text-2xs font-normal text-slate-400 uppercase mb-1">
                      Tổng doanh thu
                    </p>
                    <p className="text-2xl font-normal text-emerald-400">
                      {formatNumber(pendingGroupRevenue.reduce((s, r) => s + (r.amount || 0), 0))}đ
                    </p>
                  </div>
                </div>
                <div className="flex items-center gap-3">
                  <span className="text-2xs font-normal text-slate-400 uppercase">
                    Tháng hạch toán:
                  </span>
                  <input
                    type="month"
                    value={syncAccountingMonth}
                    onChange={e => setSyncAccountingMonth(e.target.value)}
                    className="bg-white/10 border border-white/20 rounded-xl px-4 py-2 text-xs font-normal text-white"
                  />
                </div>
              </div>
            </div>

            <div className="p-10 border-t border-slate-100 bg-slate-50/50 flex items-center justify-between">
              <button
                onClick={() => setIsAuditMode(false)}
                className="px-10 py-5 rounded-2xl font-normal text-xs text-slate-400 uppercase tracking-widest"
              >
                Hủy bỏ
              </button>
              <button
                onClick={handleCommitSync}
                disabled={isCommitting}
                className="px-14 py-5 bg-indigo-600 text-white rounded-2xl font-normal text-xs uppercase tracking-widest shadow-2xl flex items-center gap-4 transition-all disabled:opacity-50"
              >
                {isCommitting ? (
                  <Loader2 className="w-5 h-5 animate-spin" />
                ) : (
                  <DatabaseZap className="w-5 h-5" />
                )}
                Xác nhận đồng bộ lên Cloud
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default ProductGroupManager;
