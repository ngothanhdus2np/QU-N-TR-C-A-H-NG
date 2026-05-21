
import { supabaseAdmin as supabase } from './supabase';
import { AppData, Employee, SalaryPolicy, RevenueRecord, ExpenseRecord, AttendanceRecord, OvertimeRecord, SalesRecord, ShortageRecord, AdvanceRecord, PayrollRecord, StaffPerformanceRecord, KnowledgeBaseArticle, ProductGroup, ProductGroupRevenue, PromotionPlan } from '../types';
import { isUUID } from '../businessLogic';
import { auditService, isAudited } from './auditService';

export const TABLE_MAP: Record<string, string> = {
  employees: 'employees', salaryPolicies: 'salary_policies', revenue: 'revenue_records', expenses: 'expense_records',
  attendance: 'attendance_records', overtime: 'overtime_records', sales: 'sales_records', shortages: 'shortage_records',
  advances: 'advance_records', payroll: 'payroll_records', staffPerformance: 'staff_performance', knowledgeBase: 'knowledge_base',
  productGroups: 'product_groups', productGroupRevenue: 'product_group_revenue', promotions: 'promotions',
  brandProfile: 'brand_profile',
  shopeeRevenue: 'shopee_revenue_records',
  shopeeProductGroupRevenue: 'shopee_product_group_revenue',
  shopeeSourceData: 'shopee_source_data',
  shopeeInventoryIn: 'shopee_inventory_in',
  shopeeInventoryOut: 'shopee_inventory_out',
  posProducts: 'pos_products',
  posOrders: 'pos_orders',
  posCustomers: 'pos_customers',
  posSuppliers: 'pos_suppliers',
  inventoryTransactions: 'inventory_transactions'
};


export const sanitizeItem = (key: keyof AppData, item: any) => {
  // Common helper for cleaning numbers to avoid NaN errors in Supabase
  const n = (val: any) => {
    const parsed = Number(val);
    return isNaN(parsed) ? 0 : parsed;
  };

  if (key === 'posProducts') {
    return {
      id: item.id, sku: item.sku, name: item.name, category_id: item.categoryId,
      import_price: n(item.importPrice), sale_price: n(item.salePrice),
      stock: n(item.stock), min_stock: n(item.minStock),
      max_stock: n(item.maxStock) || 999999, unit: item.unit,
      brand: item.brand, barcode: item.barcode, description: item.description,
      warranty: item.warranty, allow_points: !!item.allowPoints,
      weight: n(item.weight), weight_unit: item.weightUnit,
      location: item.location, images: item.images || [], status: item.status,
      units: item.units || [], attributes: item.attributes || []
    };
  }
  if (key === 'posOrders') {
    return {
      id: item.id, order_code: item.orderCode, date: item.date,
      customer_id: isUUID(item.customerId) ? item.customerId : null, 
      customer_name: item.customerName,
      items: item.items || [], total_amount: n(item.totalAmount),
      discount: n(item.discount), final_amount: n(item.finalAmount),
      payment_method: item.paymentMethod, staff_id: item.staffId,
      notes: item.notes, points_earned: n(item.pointsEarned)
    };
  }
  if (key === 'posCustomers') {
    return {
      id: item.id, name: item.name, phone: item.phone, email: item.email,
      address: item.address, points: n(item.points),
      total_spent: n(item.totalSpent), last_visit: item.lastVisit,
      tier: item.tier
    };
  }
  if (key === 'posSuppliers') {
    return {
      id: item.id, name: item.name, phone: item.phone || null, email: item.email || null,
      address: item.address || null, contact_person: item.contactPerson || null,
      tax_code: item.taxCode || null, notes: item.notes || null,
      status: item.status || 'Active'
    };
  }
  if (key === 'inventoryTransactions') {
    return {
      id: item.id, date: item.date, type: item.type,
      items: item.items || [], note: item.note,
      reference_id: item.referenceId, staff_id: item.staffId,
      supplier_name: item.supplierName || null
    };
  }
  if (key === 'salaryPolicies') {
    return {
      id: item.id, name: item.name, salary_type: item.salaryType, base_salary: n(item.baseSalary), is_pro_rated: !!item.isProRated,
      start_threshold: n(item.startThreshold), end_threshold: n(item.endThreshold),
      ot_rate: n(item.otRate), commission_rate: n(item.commissionRate),
      seniority_bonus_per_year: n(item.seniorityBonusPerYear), attendance_allowance: n(item.attendanceAllowance),
      cleaning_allowance: n(item.cleaningAllowance), customer_service_allowance: n(item.customerServiceAllowance),
      dinner_allowance: n(item.dinnerAllowance), housing_allowance: n(item.housingAllowance), responsibility_allowance: n(item.responsibilityAllowance)
    };
  }
  if (key === 'productGroups') return { id: item.id, name: item.name, target: n(item.target) || null };
  if (key === 'attendance') return { id: item.id, employee_id: item.employeeId, employee_name: item.employeeName, date: item.date, status: item.status, hours: n(item.hours) };
  if (key === 'overtime') return { id: item.id, employee_id: item.employeeId, employee_name: item.employeeName, date: item.date, hours: n(item.hours), multiplier: n(item.multiplier) || 1 };
  if (key === 'sales') return { id: item.id, employee_id: item.employeeId, employee_name: item.employeeName, date: item.date, sales_amount: n(item.salesAmount), commission_rate: n(item.commissionRate), commission_earned: n(item.commissionEarned) };
  if (key === 'shortages') return { id: item.id, employee_id: item.employeeId, employee_name: item.employeeName, date: item.date, amount: n(item.amount) };
  if (key === 'advances') return { id: item.id, employee_id: item.employeeId, employee_name: item.employeeName, date: item.date, amount: n(item.amount) };
  if (key === 'payroll') return { 
    id: item.id, employee_id: item.employeeId, employee_name: item.employeeName, month: item.month, basic_salary: Math.round(n(item.basicSalary)), 
    allowance: Math.round(n(item.allowance)), responsibility_pay: Math.round(n(item.responsibilityPay)), overtime_pay: Math.round(n(item.overtimePay)), 
    commission_pay: Math.round(n(item.commissionPay)), seniority_bonus: Math.round(n(item.seniorityBonus)), holiday_bonus: Math.round(n(item.holidayBonus)), 
    tet_bonus: Math.round(n(item.tetBonus)), tet_bonus_before: Math.round(n(item.tetBonusBefore)), tet_bonus_after: Math.round(n(item.tetBonusAfter)),
    advance: Math.round(n(item.advance)), shortage: Math.round(n(item.shortage)), fine: Math.round(n(item.fine)), 
    net_pay: Math.round(n(item.netPay)), seniority_days: Math.round(n(item.seniorityDays)), is_official: !!item.isOfficial, has_tet_commitment: !!item.hasTetCommitment,
    calculation_note: item.calculationNote || null
  };
  if (key === 'staffPerformance') return {
    id: item.id, employee_id: item.employeeId, employee_name: item.employeeName, month: item.month,
    total_sales: Math.round(n(item.totalSales)), total_income: Math.round(n(item.totalIncome)),
    roi: n(item.roi), rank: item.rank || null
  };
  if (key === 'employees') {
    const resDateVal = item.resignedDate || item.resigned_date;
    return { 
      id: item.id, name: item.name, position: item.position, join_date: item.joinDate || item.join_date, 
      resigned_date: (resDateVal && String(resDateVal).trim() !== "") ? resDateVal : null, 
      assigned_policy_id: item.assignedPolicyId || item.assigned_policy_id, dob: item.dob, 
      phone: item.phone, address: item.address, bank_account_number: item.bankAccountNumber || item.bank_account_number, 
      bank_name: item.bankName || item.bank_name, bank_account_holder: item.bankAccountHolder || item.bank_account_holder, 
      notes: item.notes, photo_url: item.photoUrl || item.photo_url, blood_type: item.bloodType, email: item.email 
    };
  }
  if (key === 'expenses') return { id: item.id, date: item.date, category: item.category || 'Khác', amount: Math.round(n(item.amount)), description: item.description || null };
  const k = key as string;
  if (k === 'revenue' || k === 'shopeeRevenue') return { 
    id: item.id, 
    date: item.date, 
    total_gross_revenue: Math.round(n(item.totalGrossRevenue)), 
    discount: Math.round(n(item.discount)), 
    revenue_other: Math.round(n(item.revenueOther)), 
    returns_value: Math.round(n(item.returnsValue)), 
    net_revenue: Math.round(n(item.netRevenue)), 
    total_cogs: Math.round(n(item.totalCogs)), 
    gross_profit: Math.round(n(item.grossProfit))
  };
  if (k === 'productGroupRevenue' || k === 'shopeeProductGroupRevenue') return {
    id: item.id, date: item.date, 
    group_id: isUUID(item.groupId) ? item.groupId : null,
    group_name: item.groupName, amount: n(item.amount),
    quantity: n(item.quantity), returns_quantity: n(item.returnsQuantity), 
    returns_value: n(item.returnsValue), net_revenue: n(item.netRevenue), cogs: n(item.cogs)
  };
  if (key === 'promotions') return {
    id: item.id, name: item.name, start_date: item.startDate, end_date: item.endDate, type: item.type,
    budget: n(item.budget), target_revenue: n(item.targetRevenue), description: item.description, status: item.status,
    gift_tiers: item.giftTiers || [],
    actual_revenue: n(item.actualRevenue),
    actual_cost: n(item.actualCost),
    incremental_revenue: n(item.incrementalRevenue),
    actual_roi: n(item.actualRoi)
  };
  if (key === 'brandProfile') return {
    id: '00000000-0000-0000-0000-000000000000',
    story: item.story,
    voice: item.voice,
    target_audience: item.targetAudience,
    competitive_advantage: item.competitiveAdvantage,
    logo: item.logo,
    inventory: item.inventory || [],
    phone: item.phone,
    address: item.address,
    hashtags: item.hashtags
  };
  if (key === 'shopeeSourceData') return {
    id: item.id, sku: item.sku, name: item.name, import_price: n(item.importPrice),
    sale_price: n(item.salePrice), status: item.status
  };
  if (key === 'shopeeInventoryIn') return {
    id: item.id, date: item.date, sku: item.sku, quantity: n(item.quantity),
    import_price: n(item.importPrice), note: item.note
  };
  if (key === 'shopeeInventoryOut') return {
    id: item.id, date: item.date, status: item.status, order_id: item.orderId, sku: item.sku,
    quantity: n(item.quantity), sale_price: n(item.salePrice),
    platform_fee: n(item.platformFee), payment_fee: n(item.paymentFee),
    freeship_extra: n(item.freeshipExtra), affiliate_fee: n(item.affiliateFee),
    handling_fee: n(item.handlingFee), ads_cost: n(item.adsCost),
    ads_tax: n(item.adsTax), personal_income_tax: n(item.personalIncomeTax),
    net_profit: n(item.netProfit), address: item.address, shipping_unit: item.shippingUnit
  };
  return item;
};

export const apiService = {
  async fetchAllData() {
    try {
      const [
        employees, policies, revenue, expenses, attendance, overtime, sales, shortages, advances, payroll, perf, kb, configs, pGroups, pGroupRev, promotions, brand,
        shopeeRevenue, shopeePGroupRev, shopeeSource, shopeeIn, shopeeOut, posProducts, posOrders, posCustomers, posSuppliers, transactions
      ] = await Promise.all([
        supabase.from('employees').select('*').limit(10000),
        supabase.from('salary_policies').select('*'),
        supabase.from('revenue_records').select('*').limit(10000),
        supabase.from('expense_records').select('*').limit(10000),
        supabase.from('attendance_records').select('*').limit(10000),
        supabase.from('overtime_records').select('*').limit(10000),
        supabase.from('sales_records').select('*').limit(10000),
        supabase.from('shortage_records').select('*').limit(10000),
        supabase.from('advance_records').select('*').limit(10000),
        supabase.from('payroll_records').select('*').limit(10000),
        supabase.from('staff_performance').select('*').limit(10000),
        supabase.from('knowledge_base').select('*'),
        supabase.from('system_configs').select('*'),
        supabase.from('product_groups').select('*'),
        supabase.from('product_group_revenue').select('*').limit(10000),
        supabase.from('promotions').select('*'),
        supabase.from('brand_profile').select('*'),
        supabase.from('shopee_revenue_records').select('*').limit(10000),
        supabase.from('shopee_product_group_revenue').select('*').limit(10000),
        supabase.from('shopee_source_data').select('*'),
        supabase.from('shopee_inventory_in').select('*').limit(10000),
        supabase.from('shopee_inventory_out').select('*').limit(10000),
        supabase.from('pos_products').select('*').limit(10000),
        supabase.from('pos_orders').select('*').limit(10000),
        supabase.from('pos_customers').select('*').limit(10000),
        supabase.from('pos_suppliers').select('*').limit(10000),
        supabase.from('inventory_transactions').select('*').limit(10000)
      ]);

      const res_arr = [
        { name: 'Employees', res: employees }, { name: 'Policies', res: policies }, { name: 'Revenue', res: revenue },
        { name: 'Expenses', res: expenses }, { name: 'Attendance', res: attendance }, { name: 'Overtime', res: overtime },
        { name: 'Sales', res: sales }, { name: 'Shortages', res: shortages }, { name: 'Advances', res: advances },
        { name: 'Payroll', res: payroll }, { name: 'Performance', res: perf }, { name: 'KB', res: kb },
        { name: 'Configs', res: configs }, { name: 'Groups', res: pGroups }, { name: 'GroupRev', res: pGroupRev },
        { name: 'Promotions', res: promotions }, { name: 'Brand', res: brand }, { name: 'ShopeeRevenue', res: shopeeRevenue },
        { name: 'ShopeeGroupRev', res: shopeePGroupRev }, { name: 'ShopeeSource', res: shopeeSource },
        { name: 'ShopeeInvIn', res: shopeeIn }, { name: 'ShopeeInvOut', res: shopeeOut },
        { name: 'PosProducts', res: posProducts }, { name: 'PosOrders', res: posOrders },
        { name: 'PosCustomers', res: posCustomers }, { name: 'PosSuppliers', res: posSuppliers },
        { name: 'Transactions', res: transactions }
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
          posSuppliers: posSuppliers.data,
          inventoryTransactions: transactions.data
        },
        errors: errors.length > 0 ? errors : null
      };
    } catch (e: any) {
      return { data: {}, errors: [`Lỗi hệ thống nghiêm trọng: ${e.message}`] };
    }
  },

  async deleteItem(key: keyof AppData, id: string) {
    const tableName = TABLE_MAP[key as string];
    if (tableName) {
      const { error } = await supabase.from(tableName).delete().eq('id', id);
      if (error) {
        console.error(`Xóa thất bại [${tableName} - ${id}]:`, error);
        throw new Error(`Xóa thất bại: ${error.message}`);
      }
      if (isAudited(key as string)) {
        auditService.log(key as string, id, 'delete');
      }
      return true;
    }
    return null;
  },

  async clearTable(key: keyof AppData) {
    const tableName = TABLE_MAP[key as string];
    if (tableName) {
      const { error } = await supabase.from(tableName).delete().neq('id', '00000000-0000-0000-0000-000000000000');
      if (error) {
        console.error(`Xóa bảng thất bại [${tableName}]:`, error);
        throw new Error(`Xóa bảng thất bại: ${error.message}`);
      }
      if (isAudited(key as string)) {
        auditService.log(key as string, null, 'clear_table');
      }
      return true;
    }
    return null;
  },

  async upsertItem(key: keyof AppData, item: any) {
    const tableName = TABLE_MAP[key as string];
    if (tableName) {
      const payload = sanitizeItem(key, item);
      const { error } = await supabase.from(tableName).upsert(payload, { onConflict: 'id' });
      if (error) {
        console.error(`Ghi đè thất bại [${tableName} - ${item.id}]:`, error);
        throw new Error(`Ghi đè thất bại: ${error.message}`);
      }
      if (isAudited(key as string)) {
        auditService.log(key as string, item.id, 'upsert', payload);
      }
      return true;
    }
    return null;
  },

  async upsertMany(key: keyof AppData, items: any[]) {
    const tableName = TABLE_MAP[key as string];
    if (tableName) {
      const payload = items.map(item => sanitizeItem(key, item));
      
      const chunkSize = 100;
      let succeeded = 0;
      for (let i = 0; i < payload.length; i += chunkSize) {
        const chunk = payload.slice(i, i + chunkSize);
        const { error } = await supabase.from(tableName).upsert(chunk, { onConflict: 'id' });
        if (error) {
          console.error(`Ghi đè hàng loạt thất bại [${tableName} - chunk ${i}]:`, error);
          throw new Error(`Lỗi ở dòng ${i}: ${error.message} (Kiểm tra cấu trúc bảng ${tableName})`);
        }
        succeeded += chunk.length;
      }
      console.log(`[Sync] Upserted ${succeeded} items to ${tableName}`);
      return true;
    }
    return null;
  },

  async upsertConfig(key: string, value: any) {
    const { error } = await supabase.from('system_configs').upsert({ key, value });
    if (error) {
      console.error(`Lưu cấu hình thất bại [${key}]:`, error);
      throw new Error(`Cấu hình thất bại: ${error.message}`);
    }
    return true;
  }
};

