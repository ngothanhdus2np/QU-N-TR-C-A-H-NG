import { supabaseAdmin as supabase } from './supabase';
import { AppData, InventoryTransaction } from '../types';
import { buildVariantProductName, isUUID } from '../src/lib';

export const TABLE_MAP: Record<string, string> = {
  employees: 'employees',
  salaryPolicies: 'salary_policies',
  revenue: 'revenue_records',
  expenses: 'expense_records',
  attendance: 'attendance_records',
  overtime: 'overtime_records',
  sales: 'sales_records',
  shortages: 'shortage_records',
  advances: 'advance_records',
  payroll: 'payroll_records',
  staffPerformance: 'staff_performance',
  knowledgeBase: 'knowledge_base',
  productGroups: 'product_groups',
  productGroupRevenue: 'product_group_revenue',
  promotions: 'promotions',
  brandProfile: 'brand_profile',
  shopeeRevenue: 'shopee_revenue_records',
  shopeeProductGroupRevenue: 'shopee_product_group_revenue',
  shopeeSourceData: 'shopee_source_data',
  shopeeInventoryIn: 'shopee_inventory_in',
  shopeeInventoryOut: 'shopee_inventory_out',
  posProducts: 'pos_products',
  posOrders: 'pos_orders',
  posCustomers: 'pos_customers',
  inventoryTransactions: 'inventory_transactions',
  suppliers: 'suppliers',
  supplierDebts: 'supplier_debts',
  cashflow: 'cashflow_records',
  recurringExpenses: 'recurring_expenses',
};

export const sanitizeItem = (key: keyof AppData, item: any) => {
  // Common helper for cleaning numbers to avoid NaN errors in Supabase
  const n = (val: any) => {
    const parsed = Number(val);
    return isNaN(parsed) ? 0 : parsed;
  };

  if (key === 'posProducts') {
    const variantAttributes = item.variantAttributes || {};
    const name = item.parentId && !item.isParent
      ? buildVariantProductName(item.name, variantAttributes)
      : item.name;
    return {
      id: item.id,
      sku: item.isParent && !item.sku ? `__PARENT__${item.id}` : item.sku,
      name,
      category_id: item.categoryId,
      category_path: item.categoryPath || null,
      import_price: n(item.importPrice),
      sale_price: n(item.salePrice),
      stock: n(item.stock),
      expected_out_of_stock: item.expectedOutOfStock || null,
      min_stock: n(item.minStock),
      max_stock: n(item.maxStock) || 999999,
      unit: item.unit,
      base_unit_code: item.baseUnitCode || null,
      conversion_value: n(item.conversionValue) || 1,
      brand: item.brand,
      barcode: item.barcode,
      attributes_text: item.attributesText || null,
      description: item.description,
      note_template: item.noteTemplate || null,
      components: item.components || null,
      warranty: item.warranty,
      periodic_maintenance: item.periodicMaintenance || null,
      allow_points: !!item.allowPoints,
      weight: n(item.weight),
      weight_unit: item.weightUnit,
      location: item.location,
      related_sku: item.relatedSku || null,
      customer_orders: n(item.customerOrders || 0),
      direct_sale: item.directSale !== false,
      product_type: item.productType || 'Hàng hóa',
      images: item.images || [],
      status: item.status,
      units: item.units || [],
      attributes: item.attributes || [],
      variant_attributes: variantAttributes,
      parent_id: item.parentId || null,
      is_parent: item.isParent || false,
      variant_count: n(item.variantCount || 0),
    };
  }
  if (key === 'posOrders') {
    return {
      id: item.id,
      order_code: item.orderCode,
      date: item.date,
      customer_id: isUUID(item.customerId) ? item.customerId : null,
      customer_name: item.customerName,
      items: item.items || [],
      total_amount: n(item.totalAmount),
      discount: n(item.discount),
      final_amount: n(item.finalAmount),
      payment_method: item.paymentMethod,
      staff_id: item.staffId,
      notes: item.notes,
      points_earned: n(item.pointsEarned),
    };
  }
  if (key === 'posCustomers') {
    return {
      id: item.id,
      name: item.name,
      phone: item.phone,
      email: item.email,
      address: item.address,
      notes: item.notes || null,
      points: n(item.points),
      total_spent: n(item.totalSpent),
      last_visit: item.lastVisit,
      tier: item.tier,
    };
  }
  if (key === 'inventoryTransactions') {
    return {
      id: item.id,
      date: item.date,
      type: item.type,
      items: item.items || [],
      note: item.note,
      reference_id: item.referenceId,
      staff_id: item.staffId,
      supplier_id: item.supplierId || null,
      supplier_name: item.supplierName || null,
      total_amount: n(item.totalAmount),
      status: item.status || null,
      balanced_date: item.balancedDate || null,
      total_actual_qty: item.totalActualQty == null ? null : n(item.totalActualQty),
      total_diff: item.totalDiff == null ? null : n(item.totalDiff),
      increase_count: item.increaseCount == null ? null : n(item.increaseCount),
      decrease_count: item.decreaseCount == null ? null : n(item.decreaseCount),
    };
  }
  if (key === 'salaryPolicies') {
    return {
      id: item.id,
      name: item.name,
      salary_type: item.salaryType,
      base_salary: n(item.baseSalary),
      is_pro_rated: !!item.isProRated,
      start_threshold: n(item.startThreshold),
      end_threshold: n(item.endThreshold),
      ot_rate: n(item.otRate),
      commission_rate: n(item.commissionRate),
      seniority_bonus_per_year: n(item.seniorityBonusPerYear),
      attendance_allowance: n(item.attendanceAllowance),
      cleaning_allowance: n(item.cleaningAllowance),
      customer_service_allowance: n(item.customerServiceAllowance),
      dinner_allowance: n(item.dinnerAllowance),
      housing_allowance: n(item.housingAllowance),
      responsibility_allowance: n(item.responsibilityAllowance),
    };
  }
  if (key === 'productGroups')
    return { id: item.id, name: item.name, target: n(item.target) || null };
  if (key === 'attendance')
    return {
      id: item.id,
      employee_id: item.employeeId,
      employee_name: item.employeeName,
      date: item.date,
      status: item.status,
      hours: n(item.hours),
    };
  if (key === 'overtime')
    return {
      id: item.id,
      employee_id: item.employeeId,
      employee_name: item.employeeName,
      date: item.date,
      hours: n(item.hours),
      multiplier: n(item.multiplier) || 1,
    };
  if (key === 'sales')
    return {
      id: item.id,
      employee_id: item.employeeId,
      employee_name: item.employeeName,
      date: item.date,
      sales_amount: n(item.salesAmount),
      commission_rate: n(item.commissionRate),
      commission_earned: n(item.commissionEarned),
    };
  if (key === 'shortages')
    return {
      id: item.id,
      employee_id: item.employeeId,
      employee_name: item.employeeName,
      date: item.date,
      amount: n(item.amount),
    };
  if (key === 'advances')
    return {
      id: item.id,
      employee_id: item.employeeId,
      employee_name: item.employeeName,
      date: item.date,
      amount: n(item.amount),
    };
  if (key === 'payroll')
    return {
      id: item.id,
      employee_id: item.employeeId,
      employee_name: item.employeeName,
      month: item.month,
      basic_salary: Math.round(n(item.basicSalary)),
      allowance: Math.round(n(item.allowance)),
      responsibility_pay: Math.round(n(item.responsibilityPay)),
      overtime_pay: Math.round(n(item.overtimePay)),
      commission_pay: Math.round(n(item.commissionPay)),
      seniority_bonus: Math.round(n(item.seniorityBonus)),
      holiday_bonus: Math.round(n(item.holidayBonus)),
      tet_bonus: Math.round(n(item.tetBonus)),
      tet_bonus_before: Math.round(n(item.tetBonusBefore)),
      tet_bonus_after: Math.round(n(item.tetBonusAfter)),
      advance: Math.round(n(item.advance)),
      shortage: Math.round(n(item.shortage)),
      fine: Math.round(n(item.fine)),
      net_pay: Math.round(n(item.netPay)),
      seniority_days: Math.round(n(item.seniorityDays)),
      is_official: !!item.isOfficial,
      has_tet_commitment: !!item.hasTetCommitment,
      calculation_note: item.calculationNote || null,
    };
  if (key === 'staffPerformance')
    return {
      id: item.id,
      employee_id: item.employeeId,
      employee_name: item.employeeName,
      month: item.month,
      total_sales: Math.round(n(item.totalSales)),
      total_income: Math.round(n(item.totalIncome)),
      roi: n(item.roi),
      rank: item.rank || null,
    };
  if (key === 'employees') {
    const resDateVal = item.resignedDate;
    return {
      id: item.id,
      name: item.name,
      position: item.position,
      join_date: item.joinDate || item.join_date,
      resigned_date: resDateVal && String(resDateVal).trim() !== '' ? resDateVal : null,
      assigned_policy_id: item.assignedPolicyId || item.assigned_policy_id,
      dob: item.dob,
      phone: item.phone,
      address: item.address,
      bank_account_number: item.bankAccountNumber || item.bank_account_number,
      bank_name: item.bankName || item.bank_name,
      bank_account_holder: item.bankAccountHolder || item.bank_account_holder,
      notes: item.notes,
      photo_url: item.photoUrl || item.photo_url,
      blood_type: item.bloodType,
      email: item.email,
    };
  }
  if (key === 'expenses')
    return {
      id: item.id,
      date: item.date,
      category: item.category || 'Khác',
      amount: Math.round(n(item.amount)),
      description: item.description || null,
    };
  if (key === 'knowledgeBase') {
    const payload: Record<string, any> = {
      id: item.id,
      category: item.category || 'Khác',
      title: item.title,
      content: item.content || '',
      updated_at: item.updatedAt || new Date().toISOString(),
    };
    if (item.sourceFileName) payload.source_file_name = item.sourceFileName;
    if (item.sourceFilePath) payload.source_file_path = item.sourceFilePath;
    if (item.sourceFileUrl) payload.source_file_url = item.sourceFileUrl;
    if (item.sourceFileType) payload.source_file_type = item.sourceFileType;
    if (item.sourceFileSize) payload.source_file_size = n(item.sourceFileSize);
    return payload;
  }
  const k = key as string;
  if (k === 'revenue' || k === 'shopeeRevenue')
    return {
      id: item.id,
      date: item.date,
      total_gross_revenue: Math.round(n(item.totalGrossRevenue)),
      discount: Math.round(n(item.discount)),
      revenue_other: Math.round(n(item.revenueOther)),
      returns_value: Math.round(n(item.returnsValue)),
      net_revenue: Math.round(n(item.netRevenue)),
      total_cogs: Math.round(n(item.totalCogs)),
      gross_profit: Math.round(n(item.grossProfit)),
    };
  if (k === 'productGroupRevenue' || k === 'shopeeProductGroupRevenue')
    return {
      id: item.id,
      date: item.date,
      group_id: isUUID(item.groupId) ? item.groupId : null,
      group_name: item.groupName,
      amount: n(item.amount),
      quantity: n(item.quantity),
      returns_quantity: n(item.returnsQuantity),
      returns_value: n(item.returnsValue),
      net_revenue: n(item.netRevenue),
      cogs: n(item.cogs),
    };
  if (key === 'promotions')
    return {
      id: item.id,
      name: item.name,
      start_date: item.startDate,
      end_date: item.endDate,
      type: item.type,
      budget: n(item.budget),
      target_revenue: n(item.targetRevenue),
      description: item.description,
      status: item.status,
      gift_tiers: item.giftTiers || [],
      actual_revenue: n(item.actualRevenue),
      actual_cost: n(item.actualCost),
      incremental_revenue: n(item.incrementalRevenue),
      actual_roi: n(item.actualRoi),
    };
  if (key === 'brandProfile')
    return {
      id: '00000000-0000-0000-0000-000000000000',
      name: item.name || null,
      story: item.story,
      voice: item.voice,
      target_audience: item.targetAudience,
      competitive_advantage: item.competitiveAdvantage,
      logo: item.logo,
      inventory: item.inventory || [],
      phone: item.phone,
      address: item.address,
      hashtags: item.hashtags,
    };
  if (key === 'shopeeSourceData')
    return {
      id: item.id,
      sku: item.sku,
      name: item.name,
      import_price: n(item.importPrice),
      sale_price: n(item.salePrice),
      status: item.status,
    };
  if (key === 'shopeeInventoryIn')
    return {
      id: item.id,
      date: item.date,
      sku: item.sku,
      quantity: n(item.quantity),
      import_price: n(item.importPrice),
      note: item.note,
    };
  if (key === 'suppliers')
    return {
      id: item.id,
      name: item.name,
      code: item.code || null,
      phone: item.phone || null,
      email: item.email || null,
      address: item.address || null,
      supplier_group: item.group || null,
      status: item.status || 'active',
      notes: item.notes || null,
    };
  if (key === 'supplierDebts')
    return {
      id: item.id,
      supplier_id: item.supplierId,
      supplier_name: item.supplierName,
      date: item.date,
      type: item.type,
      amount: n(item.amount),
      description: item.description || '',
    };
  if (key === 'shopeeInventoryOut')
    return {
      id: item.id,
      date: item.date,
      status: item.status,
      order_id: item.orderId,
      sku: item.sku,
      quantity: n(item.quantity),
      sale_price: n(item.salePrice),
      platform_fee: n(item.platformFee),
      payment_fee: n(item.paymentFee),
      freeship_extra: n(item.freeshipExtra),
      affiliate_fee: n(item.affiliateFee),
      handling_fee: n(item.handlingFee),
      ads_cost: n(item.adsCost),
      ads_tax: n(item.adsTax),
      personal_income_tax: n(item.personalIncomeTax),
      net_profit: n(item.netProfit),
      address: item.address,
      shipping_unit: item.shippingUnit,
    };
  if (key === 'cashflow')
    return {
      id: item.id,
      date: item.date,
      type: item.type,
      category: item.category,
      amount: n(item.amount),
      description: item.description || null,
      reference_id: item.referenceId || null,
    };
  if (key === 'recurringExpenses')
    return {
      id: item.id,
      name: item.name,
      category: item.category,
      amount: n(item.amount),
      frequency: item.frequency,
      start_date: item.startDate,
      end_date: item.endDate || null,
      last_generated: item.lastGenerated || null,
      is_active: item.isActive !== false,
      description: item.description || null,
    };
  return item;
};

// Giới hạn mặc định cho time-series tables — đủ cho 2 năm hoạt động
const DEFAULT_LIMIT = 2000;
const DEFAULT_META_LIMIT = 5000;
const SUPABASE_PAGE_SIZE = 1000;

const fetchAllRows = async (tableName: string, orderColumn = 'id') => {
  const allRows: any[] = [];
  let offset = 0;

  while (true) {
    const { data, error } = await supabase
      .from(tableName)
      .select('*')
      .order(orderColumn, { ascending: true })
      .range(offset, offset + SUPABASE_PAGE_SIZE - 1);

    if (error) return { data: allRows, error };
    const page = data || [];
    allRows.push(...page);
    if (page.length < SUPABASE_PAGE_SIZE) return { data: allRows, error: null };
    offset += SUPABASE_PAGE_SIZE;
  }
};

const postDataRoute = async (path: string, body: Record<string, unknown>) => {
  const res = await fetch(path, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok || data?.ok === false) {
    throw new Error(data?.error || `Yêu cầu ghi dữ liệu thất bại (${res.status})`);
  }
  return data;
};

export const apiService = {
  // Lấy một trang dữ liệu từ bất kỳ bảng nào (dùng cho lazy load / load thêm)
  async fetchTablePage(tableName: string, limit = 100, offset = 0) {
    const { data, error, count } = await supabase
      .from(tableName)
      .select('*', { count: 'exact' })
      .order('created_at', { ascending: false })
      .range(offset, offset + limit - 1);
    if (error) throw new Error(`Lỗi fetch ${tableName}: ${error.message}`);
    return { data: data ?? [], total: count ?? 0 };
  },

  async fetchAllData() {
    try {
      const [
        employees,
        policies,
        revenue,
        expenses,
        attendance,
        overtime,
        sales,
        shortages,
        advances,
        payroll,
        perf,
        kb,
        configs,
        pGroups,
        pGroupRev,
        promotions,
        brand,
        shopeeRevenue,
        shopeePGroupRev,
        shopeeSource,
        shopeeIn,
        shopeeOut,
        posProducts,
        posOrders,
        posCustomers,
        transactions,
        suppliers,
        supplierDebts,
        cashflow,
        recurringExpenses,
      ] = await Promise.all([
        supabase.from('employees').select('*').limit(500),
        supabase.from('salary_policies').select('*'),
        supabase
          .from('revenue_records')
          .select('*')
          .order('date', { ascending: false })
          .limit(DEFAULT_LIMIT),
        supabase
          .from('expense_records')
          .select('*')
          .order('date', { ascending: false })
          .limit(DEFAULT_LIMIT),
        supabase
          .from('attendance_records')
          .select('*')
          .order('date', { ascending: false })
          .limit(DEFAULT_LIMIT),
        supabase
          .from('overtime_records')
          .select('*')
          .order('date', { ascending: false })
          .limit(DEFAULT_LIMIT),
        supabase
          .from('sales_records')
          .select('*')
          .order('date', { ascending: false })
          .limit(DEFAULT_LIMIT),
        supabase
          .from('shortage_records')
          .select('*')
          .order('date', { ascending: false })
          .limit(DEFAULT_LIMIT),
        supabase
          .from('advance_records')
          .select('*')
          .order('date', { ascending: false })
          .limit(DEFAULT_LIMIT),
        supabase
          .from('payroll_records')
          .select('*')
          .order('month', { ascending: false })
          .limit(DEFAULT_LIMIT),
        supabase
          .from('staff_performance')
          .select('*')
          .order('month', { ascending: false })
          .limit(DEFAULT_LIMIT),
        supabase.from('knowledge_base').select('*').limit(DEFAULT_META_LIMIT),
        supabase.from('system_configs').select('*').limit(DEFAULT_META_LIMIT),
        supabase.from('product_groups').select('*').limit(DEFAULT_META_LIMIT),
        supabase
          .from('product_group_revenue')
          .select('*')
          .order('date', { ascending: false })
          .limit(DEFAULT_LIMIT),
        supabase.from('promotions').select('*').limit(DEFAULT_META_LIMIT),
        supabase.from('brand_profile').select('*').limit(1),
        supabase
          .from('shopee_revenue_records')
          .select('*')
          .order('date', { ascending: false })
          .limit(DEFAULT_LIMIT),
        supabase
          .from('shopee_product_group_revenue')
          .select('*')
          .order('date', { ascending: false })
          .limit(DEFAULT_LIMIT),
        supabase.from('shopee_source_data').select('*').limit(DEFAULT_META_LIMIT),
        supabase
          .from('shopee_inventory_in')
          .select('*')
          .order('date', { ascending: false })
          .limit(DEFAULT_LIMIT),
        supabase
          .from('shopee_inventory_out')
          .select('*')
          .order('date', { ascending: false })
          .limit(DEFAULT_LIMIT),
        fetchAllRows('pos_products'),
        supabase
          .from('pos_orders')
          .select('*')
          .order('date', { ascending: false })
          .limit(DEFAULT_LIMIT),
        supabase.from('pos_customers').select('*').limit(2000),
        supabase
          .from('inventory_transactions')
          .select('*')
          .order('date', { ascending: false })
          .limit(DEFAULT_LIMIT),
        supabase.from('suppliers').select('*').order('name', { ascending: true }).limit(DEFAULT_META_LIMIT),
        supabase
          .from('supplier_debts')
          .select('*')
          .order('date', { ascending: false })
          .limit(DEFAULT_LIMIT),
        supabase
          .from('cashflow_records')
          .select('*')
          .order('date', { ascending: false })
          .limit(DEFAULT_LIMIT),
        supabase
          .from('recurring_expenses')
          .select('*')
          .order('created_at', { ascending: false })
          .limit(DEFAULT_META_LIMIT),
      ]);

      const res_arr = [
        { name: 'Employees', res: employees },
        { name: 'Policies', res: policies },
        { name: 'Revenue', res: revenue },
        { name: 'Expenses', res: expenses },
        { name: 'Attendance', res: attendance },
        { name: 'Overtime', res: overtime },
        { name: 'Sales', res: sales },
        { name: 'Shortages', res: shortages },
        { name: 'Advances', res: advances },
        { name: 'Payroll', res: payroll },
        { name: 'Performance', res: perf },
        { name: 'KB', res: kb },
        { name: 'Configs', res: configs },
        { name: 'Groups', res: pGroups },
        { name: 'GroupRev', res: pGroupRev },
        { name: 'Promotions', res: promotions },
        { name: 'Brand', res: brand },
        { name: 'ShopeeRevenue', res: shopeeRevenue },
        { name: 'ShopeeGroupRev', res: shopeePGroupRev },
        { name: 'ShopeeSource', res: shopeeSource },
        { name: 'ShopeeInvIn', res: shopeeIn },
        { name: 'ShopeeInvOut', res: shopeeOut },
        { name: 'PosProducts', res: posProducts },
        { name: 'PosOrders', res: posOrders },
        { name: 'PosCustomers', res: posCustomers },
        { name: 'Transactions', res: transactions },
        { name: 'Suppliers', res: suppliers },
        { name: 'SupplierDebts', res: supplierDebts },
        { name: 'Cashflow', res: cashflow },
        { name: 'RecurringExpenses', res: recurringExpenses },
      ];

      const errors = res_arr
        .filter(r => r.res.error)
        .map(r => `[${r.name}] ${r.res.error?.message || 'Unknown'}`);

      return {
        data: {
          employees: employees.data,
          policies: policies.data,
          revenue: revenue.data,
          expenses: expenses.data,
          attendance: attendance.data,
          overtime: overtime.data,
          sales: sales.data,
          shortages: shortages.data,
          advances: advances.data,
          payroll: payroll.data,
          perf: perf.data,
          kb: kb.data,
          configs: configs.data,
          pGroups: pGroups.data,
          pGroupRev: pGroupRev.data,
          promotions: promotions.data,
          brandProfile: brand.data?.[0],
          shopeeRevenue: shopeeRevenue.data,
          shopeeProductGroupRevenue: shopeePGroupRev.data,
          shopeeSourceData: shopeeSource.data,
          shopeeInventoryIn: shopeeIn.data,
          shopeeInventoryOut: shopeeOut.data,
          posProducts: posProducts.data,
          posOrders: posOrders.data,
          posCustomers: posCustomers.data,
          inventoryTransactions: transactions.data,
          suppliers: suppliers.data,
          supplierDebts: supplierDebts.data,
          cashflow: cashflow.data,
          recurringExpenses: recurringExpenses.data,
        },
        errors: errors.length > 0 ? errors : null,
      };
    } catch (e: any) {
      return { data: {}, errors: [`Lỗi hệ thống nghiêm trọng: ${e.message}`] };
    }
  },

  async deleteItem(key: keyof AppData, id: string) {
    const tableName = TABLE_MAP[key as string];
    if (!tableName) {
      throw new Error(`Không tìm thấy bảng cho key: ${key}`);
    }
    await postDataRoute('/api/data/delete', { key, id });
    return { success: true, id, key };
  },

  async clearTable(key: keyof AppData) {
    const tableName = TABLE_MAP[key as string];
    if (!tableName) {
      throw new Error(`Không tìm thấy bảng cho key: ${key}`);
    }
    await postDataRoute('/api/data/clear', { key });
    return { success: true, key, message: `Đã xóa toàn bộ dữ liệu từ ${tableName}` };
  },

  async upsertItem(key: keyof AppData, item: any) {
    const tableName = TABLE_MAP[key as string];
    if (!tableName) {
      throw new Error(`Không tìm thấy bảng cho key: ${key}`);
    }
    const payload = sanitizeItem(key, item);
    await postDataRoute('/api/data/upsert', { key, payload, recordId: item.id });
    return { success: true, id: item.id, key };
  },

  async upsertMany(key: keyof AppData, items: any[]) {
    const tableName = TABLE_MAP[key as string];
    if (!tableName) {
      throw new Error(`Không tìm thấy bảng cho key: ${key}`);
    }
    const payload = items.map(item => sanitizeItem(key, item));
    await postDataRoute('/api/data/upsert-many', { key, payload });
    return { success: true, count: items.length, key };
  },

  async applyInventoryTransactionWithStock(transaction: InventoryTransaction) {
    const payload = sanitizeItem('inventoryTransactions', transaction);
    await postDataRoute('/api/data/inventory/apply', {
      transactionId: transaction.id,
      payload,
    });
    return { success: true, transactionId: transaction.id };
  },

  async deleteInventoryTransactionWithStock(transactionId: string) {
    await postDataRoute('/api/data/inventory/delete', { transactionId });
    return { success: true, transactionId };
  },

  async upsertConfig(key: string, value: any) {
    await postDataRoute('/api/data/config', { key, value });
    return { success: true, key, value };
  },
};
