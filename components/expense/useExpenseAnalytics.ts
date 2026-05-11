import React from 'react';
import { ExpenseCategory, ExpenseRecord, PayrollRecord, ProductGroupRevenue, RevenueRecord, DiagnosisRange } from '../../types';
import { calculateExpenseAnalysis, calculateMISMetrics, calculateTimeContext, getCategoryType } from '../../businessLogic';

interface UseExpenseAnalyticsArgs {
  list: ExpenseRecord[];
  categories: ExpenseCategory[];
  revenueList: RevenueRecord[];
  shopeeProductGroupRevenue: ProductGroupRevenue[];
  payrolls: PayrollRecord[];
  diagnosisRange: DiagnosisRange;
  diagStartDate: string;
  diagEndDate: string;
}

export const useExpenseAnalytics = ({
  list,
  categories,
  revenueList,
  shopeeProductGroupRevenue,
  payrolls,
  diagnosisRange,
  diagStartDate,
  diagEndDate
}: UseExpenseAnalyticsArgs) => {
  const parentCategories = React.useMemo(() => categories.filter(category => !category.parentId), [categories]);

  const timeContext = React.useMemo(() => {
    return calculateTimeContext(diagnosisRange, diagStartDate, diagEndDate);
  }, [diagnosisRange, diagStartDate, diagEndDate]);

  const filteredExpenses = React.useMemo(() => {
    return list.filter(expense => expense.date >= timeContext.start && expense.date <= timeContext.end);
  }, [list, timeContext]);

  const filteredRevenue = React.useMemo(() => {
    return revenueList.filter(revenue => revenue.date >= timeContext.start && revenue.date <= timeContext.end);
  }, [revenueList, timeContext]);

  const filteredPayrolls = React.useMemo(() => {
    const { start, end } = timeContext;
    return (payrolls || []).filter(payroll => {
      const monthStart = `${payroll.month}-01`;
      const monthEnd = `${payroll.month}-31`;
      return (monthStart >= start && monthStart <= end) || (monthEnd >= start && monthEnd <= end) || (start >= monthStart && start <= monthEnd);
    });
  }, [payrolls, timeContext]);

  const efficiencyData = React.useMemo(() => {
    return calculateExpenseAnalysis(filteredExpenses, filteredRevenue, filteredPayrolls, categories);
  }, [filteredExpenses, filteredRevenue, filteredPayrolls, categories]);

  const misMetrics = React.useMemo(() => {
    const durationMs = new Date(timeContext.end).getTime() - new Date(timeContext.start).getTime();
    const prevEnd = new Date(new Date(timeContext.start).getTime() - 86400000).toISOString().split('T')[0];
    const prevStart = new Date(new Date(prevEnd).getTime() - durationMs).toISOString().split('T')[0];

    const prevExpenses = list.filter(expense => expense.date >= prevStart && expense.date <= prevEnd);
    const prevRevenueList = revenueList.filter(revenue => revenue.date >= prevStart && revenue.date <= prevEnd);
    const prevRevTotal = prevRevenueList.reduce((sum, revenue) => sum + (Number(revenue.netRevenue) || 0) + (Number(revenue.revenueOther) || 0), 0);
    const prevCogsTotal = prevRevenueList.reduce((sum, revenue) => sum + (Number(revenue.totalCogs) || 0), 0);
    const prevPayrollList = (payrolls || []).filter(payroll => {
      const monthStart = `${payroll.month}-01`;
      const monthEnd = `${payroll.month}-31`;
      return (monthStart >= prevStart && monthStart <= prevEnd) || (monthEnd >= prevStart && monthEnd <= prevEnd) || (prevStart >= monthStart && prevStart <= monthEnd);
    });
    const prevPayrollTotal = prevPayrollList.reduce((sum, payroll) => sum + (Number(payroll.netPay) || 0), 0);

    const currentRevTotal = filteredRevenue.reduce((sum, revenue) => sum + (Number(revenue.netRevenue) || 0) + (Number(revenue.revenueOther) || 0), 0);
    const currentPayrollTotal = filteredPayrolls.reduce((sum, payroll) => sum + (Number(payroll.netPay) || 0), 0);
    const currentCogsTotal = efficiencyData.totalCogs;

    return calculateMISMetrics(
      { expenses: filteredExpenses, revenue: currentRevTotal, payroll: currentPayrollTotal, cogs: currentCogsTotal, categories },
      { expenses: prevExpenses, revenue: prevRevTotal, payroll: prevPayrollTotal, cogs: prevCogsTotal }
    );
  }, [filteredExpenses, filteredRevenue, filteredPayrolls, categories, list, revenueList, payrolls, timeContext, efficiencyData.totalCogs]);

  const processedList = React.useMemo(() => {
    return filteredExpenses.sort((a, b) => b.date.localeCompare(a.date));
  }, [filteredExpenses]);

  const groupedAnalysis = React.useMemo(() => {
    const fixedMap: Record<string, any> = {};
    const variableMap: Record<string, any> = {};
    const depreciationMap: Record<string, any> = {};
    const interestMap: Record<string, any> = {};

    efficiencyData.analysis.forEach(item => {
      const type = getCategoryType(item.name, categories);
      const category = categories.find(cat => cat.name === item.name);
      let groupName = item.name;

      if (category && category.parentId) {
        const parent = categories.find(cat => cat.id === category.parentId);
        if (parent && parent.parentId) {
          groupName = parent.name;
        }
      }

      const targetMap = type === 'interest' ? interestMap :
        type === 'depreciation' ? depreciationMap :
          type === 'fixed' ? fixedMap : variableMap;

      if (!targetMap[groupName]) {
        targetMap[groupName] = { name: groupName, amount: 0, ratio: 0 };
      }
      targetMap[groupName].amount += item.amount;
      targetMap[groupName].ratio += item.ratio;
    });

    return {
      fixed: Object.values(fixedMap).sort((a, b) => b.amount - a.amount),
      variable: Object.values(variableMap).sort((a, b) => b.amount - a.amount),
      depreciation: Object.values(depreciationMap).sort((a, b) => b.amount - a.amount),
      interest: Object.values(interestMap).sort((a, b) => b.amount - a.amount)
    };
  }, [efficiencyData.analysis, categories]);

  const categoryTotals = React.useMemo(() => {
    const totals: Record<string, number> = {};
    const salaryKeywords = ['lương', 'hoa hồng', 'thưởng doanh số', 'thưởng nhân viên', 'phụ cấp', 'tăng ca', 'thực nhận'];

    filteredExpenses.forEach(expense => {
      const catLower = expense.category.toLowerCase();
      if (salaryKeywords.some(keyword => catLower.includes(keyword))) return;

      const category = categories.find(cat => cat.name === expense.category);
      if (category) {
        totals[category.id] = (totals[category.id] || 0) + expense.amount;
      }
    });

    const parentToChildren: Record<string, string[]> = {};
    categories.forEach(category => {
      if (category.parentId) {
        if (!parentToChildren[category.parentId]) parentToChildren[category.parentId] = [];
        parentToChildren[category.parentId].push(category.id);
      }
    });

    const cogsCategory = categories.find(category => category.id === 'cat-cogs' || category.name.includes('COGS'));
    if (cogsCategory) {
      const storeCogs = revenueList
        .filter(revenue => revenue.date >= timeContext.start && revenue.date <= timeContext.end)
        .reduce((sum, revenue) => sum + (revenue.totalCogs || 0), 0);

      const shopeeCogs = shopeeProductGroupRevenue
        .filter(revenue => revenue.date >= timeContext.start && revenue.date <= timeContext.end)
        .reduce((sum, revenue) => sum + (revenue.cogs || 0), 0);

      totals[cogsCategory.id] = storeCogs + shopeeCogs;
    }

    const netSalaryCat = categories.find(category => category.id === 'cat-personnel-net' || category.name === 'Nhân sự (Thực nhận)') ||
      categories.find(category => category.name === 'Lương và Thưởng' || category.name === 'Lương nhân viên') ||
      categories.find(category => category.name.toLowerCase().includes('nhân sự') && category.parentId) ||
      categories.find(category => category.name.toLowerCase().includes('nhân sự'));

    const payrollNetPayTotal = filteredPayrolls.reduce((sum, payroll) => sum + (Number(payroll.netPay) || 0), 0);
    const ledgerSalaryTotal = list
      .filter(expense => expense.date >= timeContext.start && expense.date <= timeContext.end)
      .reduce((sum, expense) => {
        const catLower = expense.category.toLowerCase();
        if (salaryKeywords.some(keyword => catLower.includes(keyword))) {
          return sum + (Number(expense.amount) || 0);
        }
        return sum;
      }, 0);

    const finalPersonnelTotal = payrollNetPayTotal > 0 ? payrollNetPayTotal : ledgerSalaryTotal;
    if (netSalaryCat) totals[netSalaryCat.id] = finalPersonnelTotal;

    const getRecursiveTotal = (catId: string): number => {
      const direct = totals[catId] || 0;
      const children = parentToChildren[catId] || [];
      const childrenTotal = children.reduce((sum, childId) => sum + getRecursiveTotal(childId), 0);
      const combined = direct + childrenTotal;
      totals[catId] = combined;
      return combined;
    };

    parentCategories.forEach(parent => getRecursiveTotal(parent.id));
    return totals;
  }, [filteredExpenses, filteredPayrolls, categories, parentCategories, list, revenueList, shopeeProductGroupRevenue, timeContext]);

  const fixedParent = React.useMemo(() => parentCategories.find(category => category.id === 'cat-fixed' || category.name.toLowerCase().includes('cố định')), [parentCategories]);
  const variableParent = React.useMemo(() => parentCategories.find(category => category.id === 'cat-variable' || category.name.toLowerCase().includes('biến đổi')), [parentCategories]);
  const depreciationParent = React.useMemo(() => parentCategories.find(category => category.id === 'cat-depreciation-root' || category.name.toLowerCase().includes('khấu hao')), [parentCategories]);
  const interestParent = React.useMemo(() => parentCategories.find(category => category.id === 'cat-interest-root' || category.name.toLowerCase().includes('lãi vay')), [parentCategories]);

  const otherParents = React.useMemo(() =>
    parentCategories.filter(parent =>
      parent.id !== fixedParent?.id &&
      parent.id !== variableParent?.id &&
      parent.id !== depreciationParent?.id &&
      parent.id !== interestParent?.id
    ), [parentCategories, fixedParent, variableParent, depreciationParent, interestParent]);

  return {
    parentCategories,
    timeContext,
    filteredExpenses,
    filteredRevenue,
    filteredPayrolls,
    efficiencyData,
    misMetrics,
    processedList,
    groupedAnalysis,
    categoryTotals,
    fixedParent,
    variableParent,
    depreciationParent,
    interestParent,
    otherParents
  };
};
