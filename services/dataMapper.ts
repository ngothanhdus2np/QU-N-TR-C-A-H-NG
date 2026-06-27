import { 
  AppData, 
  BrandProfile, 
  ProductLine,
  SalaryPolicy,
  ViolationType,
  ViolationOccurrence,
  Holiday,
  ResponsibilityApproval,
  TetCampaign,
  ExpenseCategory,
  DailyBreakEvenConfig,
  POSInventorySettings,
  ShopeeCostConfig
} from '../types';
import { DEFAULT_BRAND } from '../constants/marketing';
import {
  DEFAULT_POLICIES,
  DEFAULT_EXPENSE_CATEGORIES,
  DEFAULT_POS_PAYMENT_SETTINGS,
  INITIAL_APP_DATA,
  normalizePOSPaymentSettings,
} from '../constants/defaultData';
import { buildVariantProductName } from '../src/lib';

type DbRow = Record<string, unknown>;
type ConfigRow = DbRow & { key?: string; value?: unknown };

// AUDIT-008: chỉ dùng is_return (explicit) — loại bỏ fallback prefix TH\d và finalAmount < 0
// để tránh false positive (đơn giảm giá 100% hoặc mã bắt đầu TH).
const inferIsReturnOrder = (_orderCode: unknown, _finalAmount: number, explicit: unknown) =>
  explicit === true;

interface DataMapperResults {
  brandProfile?: DbRow | null;
  employees?: DbRow[];
  policies?: DbRow[];
  revenue?: DbRow[];
  pGroups?: DbRow[];
  pGroupRev?: DbRow[];
  expenses?: DbRow[];
  attendance?: DbRow[];
  overtime?: DbRow[];
  sales?: DbRow[];
  shortages?: DbRow[];
  advances?: DbRow[];
  payroll?: DbRow[];
  perf?: DbRow[];
  kb?: DbRow[];
  promotions?: DbRow[];
  configs?: ConfigRow[];
  shopeeRevenue?: DbRow[];
  shopeeProductGroupRevenue?: DbRow[];
  shopeeSourceData?: DbRow[];
  shopeeInventoryIn?: DbRow[];
  shopeeInventoryOut?: DbRow[];
  posProducts?: DbRow[];
  posOrders?: DbRow[];
  posCustomers?: DbRow[];
  inventoryTransactions?: DbRow[];
  suppliers?: DbRow[];
  supplierDebts?: DbRow[];
}

const getConfigValue = (configs: ConfigRow[] | undefined, key: string) =>
  configs?.find(config => config.key === key)?.value;

const extractLegacySupplierCode = (notes?: unknown) => {
  if (typeof notes !== 'string') return undefined;
  return notes.match(/Mã NCC(?:\s+\w+)?:\s*(NCC\d+)/i)?.[1];
};

// Parse "SIZE:43|MÀU:ĐỎ" hoặc "MÀU:NÂU" thành { SIZE: "43", MÀU: "ĐỎ" }
const parseVariantAttrText = (text?: string): Record<string, string> => {
  if (!text) return {};
  const result: Record<string, string> = {};
  text.split('|').forEach(part => {
    const idx = part.indexOf(':');
    if (idx > 0) result[part.slice(0, idx).trim()] = part.slice(idx + 1).trim();
  });
  return result;
};

export const dataMapper = {
  mapBrandProfile(bp: DbRow): BrandProfile {
    return {
      name: (bp.name as string) ?? DEFAULT_BRAND.name,
      story: (bp.story as string) ?? DEFAULT_BRAND.story,
      voice: (bp.voice as string) ?? DEFAULT_BRAND.voice,
      targetAudience: (bp.target_audience as string) ?? DEFAULT_BRAND.targetAudience,
      competitiveAdvantage: (bp.competitive_advantage as string) ?? DEFAULT_BRAND.competitiveAdvantage,
      logo: (bp.logo as string) ?? DEFAULT_BRAND.logo,
      inventory: (bp.inventory as ProductLine[]) ?? DEFAULT_BRAND.inventory,
      phone: (bp.phone as string) ?? DEFAULT_BRAND.phone,
      address: (bp.address as string) ?? DEFAULT_BRAND.address,
      hashtags: (bp.hashtags as string) ?? DEFAULT_BRAND.hashtags,
    };
  },

  mergeBy<T extends { id?: string; date?: string; sku?: string }>(
    cloud: T[],
    local: T[],
    key: keyof T = 'id'
  ): T[] {
    if (!cloud || cloud.length === 0) return local || [];
    if (!local || local.length === 0) return cloud || [];

    // Dùng Map để tránh O(n²) findIndex — đặc biệt quan trọng cho posOrders/posProducts lớn
    const cloudIndexMap = new Map<unknown, number>(cloud.map((c, i) => [c[key], i]));
    const merged = [...cloud];
    local.forEach(l => {
      const k = l[key];
      const idx = cloudIndexMap.get(k);
      if (idx === undefined) {
        // Local-only record (chưa sync lên cloud) → giữ lại
        merged.push(l);
      } else {
        // Cloud là source of truth — cloud fields thắng local.
        // Local chỉ bổ sung các field không có trên cloud (ví dụ: field frontend-only).
        merged[idx] = { ...l, ...merged[idx] };
      }
    });
    return merged;
  },

  normalizeEmployee(employee: DbRow) {
    const { resigned_date: _legacyResignedDate, ...rest } = employee || {};
    return {
      ...rest,
      resignedDate: employee?.resignedDate || employee?.resigned_date || '',
    };
  },

  mapAllData(rawResults: unknown, localData: Partial<AppData> | null): Partial<AppData> {
    const results = rawResults as DataMapperResults;
    const cloudEmployees = (results.employees || []).map(e => ({
      id: e.id,
      name: e.name,
      position: e.position,
      joinDate: e.join_date || e.joinDate,
      resignedDate: e.resigned_date || e.resignedDate,
      assignedPolicyId: e.assigned_policy_id || e.assignedPolicyId,
      dob: e.dob,
      phone: e.phone,
      address: e.address,
      bankAccountNumber: e.bank_account_number || e.bankAccountNumber,
      bankName: e.bank_name || e.bankName,
      bankAccountHolder: e.bank_account_holder || e.bankAccountHolder,
      notes: e.notes,
      photoUrl: e.photo_url || e.photoUrl,
      bloodType: e.blood_type || e.bloodType,
      email: e.email,
      carryForwardDebt: Number(e.carry_forward_debt || e.carryForwardDebt || 0),
    }));

    const cloudPolicies = (results.policies || []).map(p => ({
      id: p.id,
      name: p.name,
      salaryType: p.salary_type || 'monthly',
      baseSalary: Number(p.base_salary) ?? 0,
      isProRated: p.is_pro_rated ?? false,
      startThreshold: p.start_threshold ?? 0,
      endThreshold: p.end_threshold ?? 0,
      otRate: Number(p.ot_rate) ?? 0,
      commissionRate: Number(p.commission_rate) ?? 0,
      seniorityBonusPerYear: Number(p.seniority_bonus_per_year) ?? 0,
      attendanceAllowance: Number(p.attendance_allowance) ?? 0,
      cleaningAllowance: Number(p.cleaning_allowance) ?? 0,
      customerServiceAllowance: Number(p.customer_service_allowance) ?? 0,
      dinnerAllowance: Number(p.dinner_allowance) ?? 0,
      housingAllowance: Number(p.housing_allowance) ?? 0,
      responsibilityAllowance: Number(p.responsibility_allowance) ?? 0,
    }));

    const cloudRevenue = (results.revenue || []).map(r => ({
      id: r.id,
      date: r.date,
      totalGrossRevenue: r.total_gross_revenue || r.totalGrossRevenue || 0,
      discount: r.discount || 0,
      revenueOther: r.revenue_other || r.revenueOther || 0,
      returnsValue: r.returns_value || r.returnsValue || 0,
      netRevenue: r.net_revenue || r.netRevenue || 0,
      totalCogs: r.total_cogs || r.totalCogs || 0,
      grossProfit: r.gross_profit || r.grossProfit || 0,
    }));

    return {
      employees: this.mergeBy(
        cloudEmployees,
        (localData?.employees || []).map(employee =>
          this.normalizeEmployee(employee as unknown as DbRow)
        )
      ).map(employee => this.normalizeEmployee(employee as unknown as DbRow)),
      salaryPolicies:
        (cloudPolicies.length > 0 ? cloudPolicies : localData?.salaryPolicies || DEFAULT_POLICIES) as SalaryPolicy[],
      revenue: this.mergeBy(cloudRevenue, localData?.revenue || [], 'date'),
      productGroups: this.mergeBy(
        (results.pGroups || []).map(g => ({ id: g.id, name: g.name, target: g.target })),
        localData?.productGroups || []
      ),
      productGroupRevenue: this.mergeBy(
        (results.pGroupRev || []).map(r => ({
          id: r.id,
          date: r.date,
          groupId: r.group_id || r.groupId,
          groupName: r.group_name || r.groupName || 'Chưa phân loại',
          amount: Number(r.amount || r.Amount || 0),
          quantity: Number(r.quantity || r.Quantity || 0),
          returnsQuantity: Number(r.returns_quantity || r.returnsQuantity || 0),
          returnsValue: Number(r.returns_value || r.returnsValue || 0),
          netRevenue: Number(r.net_revenue || r.netRevenue || 0),
          cogs: Number(r.cogs || r.Cogs || 0),
        })),
        localData?.productGroupRevenue || []
      ),
      expenses: this.mergeBy(
        (results.expenses || []).map(e => ({
          id: e.id,
          date: e.date,
          category: e.category,
          amount: e.amount || 0,
          description: e.description,
        })),
        localData?.expenses || []
      ),
      attendance: this.mergeBy(
        (results.attendance || []).map(a => ({
          id: a.id,
          employeeId: a.employee_id || a.employeeId,
          employeeName: a.employee_name || a.employeeName,
          date: a.date,
          status: a.status,
          hours: a.hours || 0,
        })),
        localData?.attendance || []
      ),
      overtime: this.mergeBy(
        (results.overtime || []).map(o => ({
          id: o.id,
          employeeId: o.employee_id || o.employeeId,
          employeeName: o.employee_name || o.employeeName,
          date: o.date,
          hours: o.hours || 0,
          multiplier: o.multiplier || 1,
        })),
        localData?.overtime || []
      ),
      sales: this.mergeBy(
        (results.sales || []).map(s => ({
          id: s.id,
          employeeId: s.employee_id || s.employeeId,
          employeeName: s.employee_name || s.employeeName,
          date: s.date,
          salesAmount: s.sales_amount || s.salesAmount || 0,
          commissionRate: s.commission_rate || s.commissionRate || 0,
          commissionEarned: s.commission_earned || s.commissionEarned || 0,
        })),
        localData?.sales || []
      ),
      shortages: this.mergeBy(
        (results.shortages || []).map(sh => ({
          id: sh.id,
          employeeId: sh.employee_id || sh.employeeId,
          employeeName: sh.employee_name || sh.employeeName,
          date: sh.date,
          amount: sh.amount || 0,
        })),
        localData?.shortages || []
      ),
      advances: this.mergeBy(
        (results.advances || []).map(ad => ({
          id: ad.id,
          employeeId: ad.employee_id || ad.employeeId,
          employeeName: ad.employee_name || ad.employeeName,
          date: ad.date,
          amount: ad.amount || 0,
        })),
        localData?.advances || []
      ),
      payroll: this.mergeBy(
        (results.payroll || []).map(p => ({
          id: p.id,
          employeeId: p.employee_id || p.employeeId,
          employeeName: p.employee_name || p.employeeName,
          month: p.month,
          basicSalary: p.basic_salary || p.basicSalary || 0,
          allowance: p.allowance || 0,
          responsibilityPay: p.responsibility_pay || p.responsibilityPay || 0,
          overtimePay: p.overtime_pay || p.overtimePay || 0,
          commissionPay: p.commission_pay || p.commissionPay || 0,
          seniorityBonus: p.seniority_bonus || p.seniorityBonus || 0,
          holidayBonus: p.holiday_bonus || p.holidayBonus || 0,
          tetBonus: p.tet_bonus || p.tetBonus || 0,
          tetBonusBefore: p.tet_bonus_before || p.tetBonusBefore || 0,
          tetBonusAfter: p.tet_bonus_after || p.tetBonusAfter || 0,
          advance: p.advance || 0,
          shortage: p.shortage || 0,
          fine: p.fine || 0,
          netPay: p.net_pay || p.netPay || 0,
          seniorityDays: p.seniority_days || p.seniorityDays || 0,
          isOfficial: p.is_official || p.isOfficial,
          hasTetCommitment: p.has_tet_commitment || p.hasTetCommitment,
          calculationNote: p.calculation_note || p.calculationNote,
          carryForwardDeduction: p.carry_forward_deduction || p.carryForwardDeduction || 0,
          carryForwardDebtOut: p.carry_forward_debt_out || p.carryForwardDebtOut || 0,
        })),
        localData?.payroll || []
      ),
      staffPerformance: this.mergeBy(
        (results.perf || []).map(pf => ({
          id: pf.id,
          employeeId: pf.employee_id || pf.employeeId,
          employeeName: pf.employee_name || pf.employeeName,
          month: pf.month,
          totalSales: pf.total_sales || pf.totalSales || 0,
          totalIncome: pf.total_income || pf.totalIncome || 0,
          roi: pf.roi || 0,
          rank: pf.rank,
        })),
        localData?.staffPerformance || []
      ),
      knowledgeBase: this.mergeBy(
        (results.kb || []).map(k => ({
          id: k.id,
          category: k.category,
          title: k.title,
          content: k.content,
          updatedAt: k.updated_at || k.updatedAt,
          sourceFileName: k.source_file_name || k.sourceFileName,
          sourceFilePath: k.source_file_path || k.sourceFilePath,
          sourceFileUrl: k.source_file_url || k.sourceFileUrl,
          sourceFileType: k.source_file_type || k.sourceFileType,
          sourceFileSize: k.source_file_size || k.sourceFileSize,
          sourceFileData: k.source_file_data || k.sourceFileData,
        })),
        localData?.knowledgeBase || []
      ),
      promotions: this.mergeBy(
        (results.promotions || []).map(p => ({
          id: p.id,
          name: p.name,
          startDate: p.start_date || p.startDate,
          endDate: p.end_date || p.endDate,
          type: p.type,
          budget: p.budget || 0,
          targetRevenue: p.target_revenue || p.targetRevenue || 0,
          description: p.description,
          status: p.status,
          giftTiers: p.gift_tiers || p.giftTiers || [],
          actualRevenue: p.actual_revenue || p.actualRevenue || 0,
          actualCost: p.actual_cost || p.actualCost || 0,
          incrementalRevenue: p.incremental_revenue || p.incrementalRevenue || 0,
          actualRoi: p.actual_roi || p.actualRoi || 0,
        })),
        localData?.promotions || []
      ),
      violationTypes:
        (getConfigValue(results.configs, 'violation_types') || localData?.violationTypes || []) as ViolationType[],
      violationOccurrences:
        (getConfigValue(results.configs, 'violation_occurrences') ||
        localData?.violationOccurrences ||
        []) as ViolationOccurrence[],
      customDeductions:
        (getConfigValue(results.configs, 'custom_penalties') ||
        localData?.customDeductions ||
        INITIAL_APP_DATA.customDeductions) as string[],
      holidays: (getConfigValue(results.configs, 'holidays') || localData?.holidays || []) as Holiday[],
      responsibilityApprovals:
        (getConfigValue(results.configs, 'responsibility_approvals') ||
        localData?.responsibilityApprovals ||
        []) as ResponsibilityApproval[],
      tetCampaign:
        (getConfigValue(results.configs, 'tet_campaign') || localData?.tetCampaign || undefined) as TetCampaign | undefined,
      expenseCategories:
        (getConfigValue(results.configs, 'expense_categories') ||
        localData?.expenseCategories ||
        DEFAULT_EXPENSE_CATEGORIES) as ExpenseCategory[],
      dailyBreakEvenConfig:
        (getConfigValue(results.configs, 'daily_break_even_config') ||
        localData?.dailyBreakEvenConfig ||
        INITIAL_APP_DATA.dailyBreakEvenConfig) as DailyBreakEvenConfig,
      posPaymentSettings: normalizePOSPaymentSettings(
        getConfigValue(results.configs, 'pos_payment_settings') ||
          localData?.posPaymentSettings ||
          DEFAULT_POS_PAYMENT_SETTINGS
      ),
      posInventorySettings:
        (getConfigValue(results.configs, 'pos_inventory_settings') ||
        localData?.posInventorySettings ||
        INITIAL_APP_DATA.posInventorySettings) as POSInventorySettings,
      shopeeRevenue: this.mergeBy(
        (results.shopeeRevenue || []).map(r => ({
          id: r.id,
          date: r.date,
          totalGrossRevenue: r.total_gross_revenue || r.totalGrossRevenue || 0,
          discount: r.discount || 0,
          revenueOther: r.revenue_other || r.revenueOther || 0,
          returnsValue: r.returns_value || r.returnsValue || 0,
          netRevenue: r.net_revenue || r.netRevenue || 0,
          totalCogs: r.total_cogs || r.totalCogs || 0,
          grossProfit: r.gross_profit || r.grossProfit || 0,
        })),
        localData?.shopeeRevenue || [],
        'date'
      ),
      shopeeProductGroupRevenue: this.mergeBy(
        (results.shopeeProductGroupRevenue || []).map(r => ({
          id: r.id,
          date: r.date,
          groupId: r.group_id || r.groupId,
          groupName: r.group_name || r.groupName || 'Chưa phân loại',
          amount: Number(r.amount || r.Amount || 0),
          quantity: Number(r.quantity || r.Quantity || 0),
          returnsQuantity: Number(r.returns_quantity || r.returnsQuantity || 0),
          returnsValue: Number(r.returns_value || r.returnsValue || 0),
          netRevenue: Number(r.net_revenue || r.netRevenue || 0),
          cogs: Number(r.cogs || r.Cogs || 0),
        })),
        localData?.shopeeProductGroupRevenue || []
      ),
      shopeeSourceData: this.mergeBy(
        (results.shopeeSourceData || []).map(r => ({
          id: r.id,
          sku: r.sku,
          name: r.name,
          importPrice: r.import_price || r.importPrice || 0,
          salePrice: r.sale_price || r.salePrice || 0,
          status: r.status,
          groupId: r.group_id || r.groupId,
          starred: r.starred || false,
          imageUrl: r.image_url || r.imageUrl,
          description: r.description,
          shops: r.shops,
        })),
        localData?.shopeeSourceData || [],
        'sku'
      ),
      shopeeCosts:
        (getConfigValue(results.configs, 'shopee_costs') ||
        localData?.shopeeCosts ||
        INITIAL_APP_DATA.shopeeCosts) as ShopeeCostConfig,
      dailyAdsConfig:
        (getConfigValue(results.configs, 'daily_ads_config') ||
        localData?.dailyAdsConfig ||
        INITIAL_APP_DATA.dailyAdsConfig) as Record<string, number>,
      shopeeInventoryIn: this.mergeBy(
        (results.shopeeInventoryIn || []).map(r => ({
          id: r.id,
          date: r.date,
          sku: r.sku,
          quantity: r.quantity || 0,
          importPrice: r.import_price || r.importPrice || 0,
          note: r.note,
        })),
        localData?.shopeeInventoryIn || []
      ),
      shopeeInventoryOut: (() => {
        const merged = this.mergeBy(
          (results.shopeeInventoryOut || []).map(r => ({
            id: r.id,
            date: r.date,
            shipDate: r.ship_date || r.shipDate || r.date,
            status: r.status,
            orderId: r.order_id || r.orderId,
            trackingNumber: r.tracking_number || r.trackingNumber || r.order_id || r.orderId,
            sku: r.sku,
            quantity: r.quantity || r.Quantity || 0,
            salePrice: r.sale_price || r.salePrice || 0,
            customerPaid: r.customer_paid || r.customerPaid || 0,
            platformFee: r.platform_fee || r.platformFee || 0,
            paymentFee: r.payment_fee || r.paymentFee || 0,
            freeshipExtra: r.freeship_extra || r.freeshipExtra || 0,
            pishipFee: r.piship_fee || r.pishipFee || 0,
            vatTax: r.vat_tax || r.vatTax || 0,
            affiliateFee: r.affiliate_fee || r.affiliateFee || 0,
            handlingFee: r.handling_fee || r.handlingFee || 0,
            adsCost: r.ads_cost || r.adsCost || 0,
            adsTax: r.ads_tax || r.adsTax || 0,
            personalIncomeTax: r.personal_income_tax || r.personalIncomeTax || 0,
            netProfit: r.net_profit || r.netProfit || 0,
            address: r.address,
            shippingUnit: r.shipping_unit || r.shippingUnit,
            platform: r.platform || 'Shopee 2',
            productName: r.product_name || r.productName || '',
            profitStatus: r.profit_status || r.profitStatus || '',
          })),
          localData?.shopeeInventoryOut || []
        );
        // Dedup theo (orderId + sku) — 1 Shopee order có thể có nhiều SKU khác nhau.
        // Ưu tiên dòng có SKU/tên thật để dòng debug rỗng không che dữ liệu đúng.
        const score = (record: typeof merged[number]) =>
          (record.sku ? 100 : 0) +
          (record.productName && record.productName.toUpperCase() !== 'DEBUG' ? 20 : 0) +
          (Number(record.salePrice || 0) > 0 ? 10 : 0) +
          (record.status === 'OK' ? 1 : 0);
        const bestByOrder = new Map<string, typeof merged[number]>();
        for (const record of merged) {
          const key = record.orderId
            ? `${record.orderId}||${record.sku || ''}`
            : record.id;
          if (!key) continue;
          const existing = bestByOrder.get(key);
          if (!existing || score(record) > score(existing)) bestByOrder.set(key, record);
        }
        return Array.from(bestByOrder.values());
      })(),
      posProducts: this.mergeBy(
        (() => {
          const rawProducts = results.posProducts || [];
          const parentNameMap = new Map<string, string>();
          for (const p of rawProducts) {
            if (p.is_parent ?? p.isParent ?? false) {
              parentNameMap.set(p.id as string, (p.name || '') as string);
            }
          }
          return rawProducts.map(p => {
          const attrText = (p.attributes_text || p.attributesText || '') as string;
          const variantAttributes =
            p.variant_attributes ||
            p.variantAttributes ||
            parseVariantAttrText(attrText);
          const isParent = p.is_parent ?? p.isParent ?? false;
          const parentId = (p.parent_id || p.parentId || null) as string | null;
          const baseName = (!isParent && parentId)
            ? (parentNameMap.get(parentId) || (p.name || '') as string)
            : (p.name || '') as string;
          return {
            id: p.id,
            sku: p.sku || '',
            name: (!isParent && parentId)
              ? buildVariantProductName(baseName, variantAttributes as Record<string, string>)
              : baseName,
            categoryId: p.category_id || p.categoryId,
            categoryPath: p.category_path || p.categoryPath,
            importPrice: Number(p.import_price || p.importPrice || 0),
            salePrice: Number(p.sale_price || p.salePrice || 0),
            stock: Number(p.stock || 0),
            expectedOutOfStock: p.expected_out_of_stock || p.expectedOutOfStock,
            minStock: Number(p.min_stock || p.minStock || 0),
            maxStock: Number(p.max_stock || p.maxStock || 999999),
            unit: p.unit,
            baseUnitCode: p.base_unit_code || p.baseUnitCode,
            conversionValue: Number(p.conversion_value || p.conversionValue || 1),
            brand: p.brand,
            barcode: p.barcode,
            attributesText: p.attributes_text || p.attributesText,
            description: p.description,
            noteTemplate: p.note_template || p.noteTemplate,
            components: p.components,
            warranty: p.warranty,
            periodicMaintenance: p.periodic_maintenance || p.periodicMaintenance,
            allowPoints: p.allow_points ?? p.allowPoints ?? true,
            weight: Number(p.weight || 0),
            weightUnit: p.weight_unit || p.weightUnit,
            location: p.location,
            relatedSku: p.related_sku || p.relatedSku || null,
            createdAt: p.created_at || p.createdAt || null,
            discountPercent: Number(p.discount_percent || p.discountPercent || 0),
            customerOrders: Number(p.customer_orders || p.customerOrders || 0),
            directSale: p.direct_sale ?? p.directSale ?? true,
            productType: p.product_type || p.productType || 'Hàng hóa',
            images: p.images || [],
            status: p.status,
            units: p.units || [],
            attributes: p.attributes || [],
            variantAttributes,
            parentId: p.parent_id || p.parentId || null,
            isParent,
            variantCount: Number(p.variant_count ?? p.variantCount ?? 0),
          };
        });
        })(),
        localData?.posProducts || []
      ),
      posOrders: this.mergeBy(
        (results.posOrders || []).map(o => ({
          id: o.id,
          orderCode: o.order_code || o.orderCode,
          date: o.date,
          customerId: o.customer_id || o.customerId,
          customerName: o.customer_name || o.customerName,
          items: o.items || [],
          totalAmount: Number(o.total_amount || 0),
          discount: Number(o.discount || 0),
          finalAmount: Number(o.final_amount || 0),
          paymentMethod: o.payment_method || o.paymentMethod,
          staffId: o.staff_id || o.staffId,
          staffName: o.staff_name || o.staffName || '',
          createdBy: o.created_by || o.createdBy || o.staff_id || o.staffId,
          channel: o.channel || 'direct',
          channelName: o.channel_name || o.channelName || 'Bán trực tiếp',
          priceBookId: o.price_book_id || o.priceBookId || undefined,
          priceBookName: o.price_book_name || o.priceBookName || undefined,
          status: o.status || o.orderStatus || 'completed',
          notes: o.notes,
          pointsEarned: Number(o.points_earned || 0),
          isReturn: inferIsReturnOrder(
            o.order_code || o.orderCode,
            Number(o.final_amount || 0),
            o.is_return ?? o.isReturn
          ),
          refundAmount: Number(o.refund_amount || 0),
          cashReceived: (o.cash_received != null) ? Number(o.cash_received) : (o.cashReceived != null ? Number(o.cashReceived) : undefined),
          splitPayments: o.split_payments || o.splitPayments || undefined,
        })),
        localData?.posOrders || []
      ),
      posCustomers: this.mergeBy(
        (results.posCustomers || []).map(c => ({
          id: c.id,
          name: c.name,
          phone: c.phone,
          email: c.email,
          address: c.address,
          notes: c.notes || '',
          points: Number(c.points || 0),
          totalSpent: Number(c.total_spent || 0),
          debtAmount: Number(c.debt_amount || c.debtAmount || 0),
          lastVisit: c.last_visit || c.lastVisit,
          tier: c.tier || 'Standard',
          isStarred: !!c.is_starred || !!c.isStarred,
        })),
        localData?.posCustomers || []
      ),
      inventoryTransactions: this.mergeBy(
        (results.inventoryTransactions || []).map(t => ({
          id: t.id,
          date: t.date,
          type: t.type,
          items: t.items || [],
          note: t.note,
          referenceId: t.reference_id || t.referenceId,
          staffId: t.staff_id || t.staffId,
          supplierId: t.supplier_id || t.supplierId,
          supplierName: t.supplier_name || t.supplierName,
          totalAmount: Number(t.total_amount || t.totalAmount || 0),
          status: t.status,
          balancedDate: t.balanced_date || t.balancedDate,
          totalActualQty:
            t.total_actual_qty == null && t.totalActualQty == null
              ? undefined
              : Number(t.total_actual_qty ?? t.totalActualQty),
          totalDiff:
            t.total_diff == null && t.totalDiff == null
              ? undefined
              : Number(t.total_diff ?? t.totalDiff),
          increaseCount:
            t.increase_count == null && t.increaseCount == null
              ? undefined
              : Number(t.increase_count ?? t.increaseCount),
          decreaseCount:
            t.decrease_count == null && t.decreaseCount == null
              ? undefined
              : Number(t.decrease_count ?? t.decreaseCount),
          allowNegativeStock: t.allow_negative_stock || t.allowNegativeStock || false,
        })),
        localData?.inventoryTransactions || []
      ),
      suppliers: this.mergeBy(
        (results.suppliers || []).map(s => ({
          id: s.id,
          name: s.name,
          code: s.code || extractLegacySupplierCode(s.notes),
          phone: s.phone,
          email: s.email,
          address: s.address,
          group: s.supplier_group || s.group,
          status: s.status || 'active',
          notes: s.notes,
          companyName: s.company_name || s.companyName,
          taxCode: s.tax_code || s.taxCode,
          invoiceCompanyName: s.invoice_company_name || s.invoiceCompanyName,
          invoiceTaxCode: s.invoice_tax_code || s.invoiceTaxCode,
          invoicePhone: s.invoice_phone || s.invoicePhone,
          invoiceAddress: s.invoice_address || s.invoiceAddress,
        })),
        localData?.suppliers || []
      ),
      supplierDebts: this.mergeBy(
        (results.supplierDebts || []).map(d => ({
          id: d.id,
          supplierId: d.supplier_id || d.supplierId,
          supplierName: d.supplier_name || d.supplierName,
          date: d.date,
          type: d.type,
          amount: Number(d.amount || 0),
          description: d.description || '',
        })),
        localData?.supplierDebts || []
      ),
    };
  },
};
