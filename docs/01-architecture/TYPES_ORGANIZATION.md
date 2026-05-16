# Types Organization Guide

**Date:** 2026-05-13  
**Status:** ✅ Completed

## Overview

The project's type definitions have been reorganized from a single 763-line `types.ts` file into 9 domain-specific files for better maintainability and scalability.

## Directory Structure

```
src/types/
├── index.ts              # Barrel export - re-exports all types
├── common.ts             # Shared types used across domains
├── employee.ts           # Employee & HR management
├── payroll.ts            # Salary & compensation
├── revenue.ts            # Revenue & financial analysis
├── dashboard.ts          # Dashboard analytics
├── pos.ts                # Point of Sale system
├── inventory.ts          # Inventory & supply chain
├── marketing.ts          # Marketing & promotions
├── shopee.ts             # Shopee marketplace integration
└── app.ts                # Application state management
```

## File Contents

### `common.ts` - Shared Types
Types used across multiple domains:
- `DiagnosisRange` - Time range selector type
- `ChatMessage` - AI chat message structure
- `AppAlert` - System alert/notification
- `AlertConfig` - Alert configuration
- `KnowledgeBaseArticle` - Knowledge base entry

### `employee.ts` - Employee & HR
Employee and HR management types:
- `Employee` - Employee profile
- `AttendanceRecord` - Daily attendance
- `OvertimeRecord` - Overtime hours
- `SalesRecord` - Sales performance
- `ShortageRecord` - Cash shortage
- `AdvanceRecord` - Salary advance
- `Holiday` - Holiday calendar
- `ViolationType` - Violation rules
- `ViolationOccurrence` - Violation instances
- `ResponsibilityApproval` - Responsibility pay approval
- `StaffPerformanceRecord` - Performance metrics

### `payroll.ts` - Payroll & Compensation
Salary and payroll types:
- `SalaryPolicy` - Salary policy configuration
- `TetCampaign` - Lunar New Year bonus campaign
- `PayrollRecord` - Monthly payroll result
- `PayrollSubTab` - Payroll UI tab type

### `revenue.ts` - Revenue & Financial
Revenue and financial analysis types:
- `RevenueRecord` - Daily revenue record
- `ProductGroup` - Product category
- `ProductGroupRevenue` - Revenue by product group
- `ExpenseRecord` - Expense entry
- `RecurringExpense` - Recurring expense rule
- `ExpenseCategory` - Expense category
- `CashFlowRecord` - Cash flow entry
- `RevenueSubTab` - Revenue UI tab type
- `RevenueAuditColumnKey` - Audit column identifier
- `RevenueAuditConflict` - Audit conflict resolution
- `DailyBreakEvenConfig` - Break-even configuration

### `dashboard.ts` - Dashboard Analytics
Dashboard visualization types:
- `DashboardFinancialInsights` - Financial KPIs
- `DashboardPreviousInsights` - Previous period comparison
- `DashboardBreakEvenAnalysis` - Break-even analysis
- `DashboardTrendPoint` - Trend chart data point
- `DashboardWaterfallItem` - Waterfall chart item
- `DashboardExpenseSlice` - Expense pie chart slice
- `DashboardDetailedExpense` - Detailed expense entry

### `pos.ts` - Point of Sale
POS system types:
- `POSProduct` - Product with variants
- `POSProductUnit` - Product unit conversion
- `POSProductAttribute` - Product attribute (color, size)
- `POSOrder` - Sales order
- `POSOrderItem` - Order line item
- `POSCustomer` - Customer profile
- `POSPaymentMethod` - Payment method type
- `POSPaymentSettings` - Payment configuration
- `POSPaymentAccount` - Bank/wallet account
- `POSPaymentChannelSettings` - Payment channel config

### `inventory.ts` - Inventory & Supply Chain
Inventory management types:
- `InventoryTransaction` - Stock movement record
- `Supplier` - Supplier profile
- `SupplierDebtRecord` - Supplier debt/payment

### `marketing.ts` - Marketing & Promotions
Marketing and content types:
- `PromotionPlan` - Promotion campaign
- `GiftTier` - Gift tier configuration
- `ContentStrategy` - Content strategy
- `ProductLine` - Product line
- `BrandProfile` - Brand profile
- `ContentPlanItem` - Content calendar item
- `StrategicAdvice` - AI strategic advice
- `GenerationRequest` - Content generation request

### `shopee.ts` - Shopee Integration
Shopee marketplace types:
- `ShopeeSourceItem` - Shopee product
- `ShopeeCostItem` - Cost item
- `ShopeeCostConfig` - Cost configuration
- `ShopeeInventoryInRecord` - Inventory in
- `ShopeeInventoryOutRecord` - Order/shipment

### `app.ts` - Application State
Application state management types:
- `AppData` - Main application state
- `AppDataListKey` - List keys in AppData
- `AppDataItem` - Item type for a list
- `AppDataSurgicalUpdate` - Surgical update type
- `UpdateAppData` - Update function type

## Usage

### Importing Types

**Option 1: Import from barrel export (recommended)**
```typescript
import type { Employee, POSProduct, RevenueRecord } from '@/types';
```

**Option 2: Import from specific domain file**
```typescript
import type { Employee } from '@/types/employee';
import type { POSProduct } from '@/types/pos';
import type { RevenueRecord } from '@/types/revenue';
```

**Option 3: Import from root types.ts (backward compatible)**
```typescript
import type { Employee, POSProduct, RevenueRecord } from '../types';
```

### Path Aliases

The project uses path aliases for cleaner imports:

```typescript
// tsconfig.json
{
  "compilerOptions": {
    "paths": {
      "@/types": ["./types"],
      "@/lib": ["./src/lib"],
      "@/components/*": ["./components/*"],
      "@/hooks/*": ["./hooks/*"],
      "@/services/*": ["./services/*"],
      "@/constants/*": ["./constants/*"]
    }
  }
}
```

## Adding New Types

### Step 1: Identify the Domain
Determine which domain file the new type belongs to:
- Employee/HR → `employee.ts`
- Payroll/Salary → `payroll.ts`
- Revenue/Finance → `revenue.ts`
- Dashboard → `dashboard.ts`
- POS → `pos.ts`
- Inventory → `inventory.ts`
- Marketing → `marketing.ts`
- Shopee → `shopee.ts`
- App State → `app.ts`
- Shared/Common → `common.ts`

### Step 2: Add the Type
Add the type definition to the appropriate file:

```typescript
// src/types/employee.ts
export interface NewEmployeeType {
  id: string;
  name: string;
  // ... other fields
}
```

### Step 3: Export (Automatic)
The type is automatically exported through `src/types/index.ts` barrel export. No additional changes needed!

### Step 4: Use the Type
Import and use the new type:

```typescript
import type { NewEmployeeType } from '@/types';

const employee: NewEmployeeType = {
  id: '1',
  name: 'John Doe',
};
```

## Migration Guide

### For New Code
Use the new organized types:
```typescript
import type { Employee, POSProduct } from '@/types';
```

### For Existing Code
No changes required! The root `types.ts` still exists for backward compatibility. You can migrate imports gradually:

**Before:**
```typescript
import type { Employee } from '../types';
```

**After:**
```typescript
import type { Employee } from '@/types';
```

## Benefits

### 1. **Better Organization**
- Types grouped by domain/feature
- Easy to find related types
- Clear separation of concerns

### 2. **Improved Maintainability**
- Smaller files (50-150 lines vs 763 lines)
- Easier to review and modify
- Reduced merge conflicts

### 3. **Better Developer Experience**
- Faster IDE autocomplete
- Clearer import statements
- Logical type discovery

### 4. **Scalability**
- Clear place to add new types
- Domain boundaries well-defined
- Easy to refactor individual domains

### 5. **Backward Compatible**
- Root `types.ts` still exists
- No breaking changes
- Gradual migration possible

## Best Practices

### 1. Keep Types Close to Domain
Add types to the file that matches their domain. If unsure, use `common.ts`.

### 2. Use Barrel Exports
Always import from `@/types` or `@/types/[domain]`, not from individual files directly.

### 3. Document Complex Types
Add JSDoc comments for complex types:
```typescript
/**
 * Employee profile with HR information
 * @property id - Unique employee identifier
 * @property name - Full name
 * @property resignedDate - Optional resignation date
 */
export interface Employee {
  id: string;
  name: string;
  resignedDate?: string;
}
```

### 4. Avoid Circular Dependencies
If two domains need to reference each other, consider:
- Moving shared types to `common.ts`
- Using type imports only (not value imports)
- Restructuring the types

### 5. Keep AppData in app.ts
The main `AppData` interface should stay in `app.ts` as it aggregates all domains.

## Verification

All types are verified through:
- ✅ TypeScript compilation (`npm run check`)
- ✅ Test suite (`npm test` - 160 tests passing)
- ✅ No breaking changes
- ✅ Backward compatibility maintained

## Related Documentation

- [PROJECT_STRUCTURE.md](./PROJECT_STRUCTURE.md) - Overall project structure
- [REORGANIZATION_SUMMARY.md](./REORGANIZATION_SUMMARY.md) - Reorganization details
- [HISTORY.md](./HISTORY.md) - Development history

---

**Last Updated:** 2026-05-13  
**Maintainer:** CFO Brain Development Team
