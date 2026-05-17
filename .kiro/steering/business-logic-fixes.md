---
inclusion: auto
description: Business logic corrections based on FULL_EVALUATION_REPORT.md - affects financial accuracy
---

# Business Logic Fixes (P1)

## 💰 Payroll Calculation Issues

### Issue 1: Salary Calculated Using Calendar Days Instead of Standard Working Days

**Current Problem:**
```typescript
// ❌ WRONG - Uses calendar days (28-31 days)
const dailyRate = baseSalary / daysInMonth;
const actualSalary = dailyRate * actualDays;
```

**Impact:** Inconsistent daily wage rates across months. Employees get different daily rates in February (28 days) vs January (31 days).

**Correct Approach:**
```typescript
// ✅ CORRECT - Use standard working days (26 days)
const STANDARD_WORKING_DAYS = 26;
const dailyRate = baseSalary / STANDARD_WORKING_DAYS;
const actualSalary = dailyRate * actualDays;
```

**Action Required:**
- Update `PayrollManager.tsx` to use fixed 26-day standard
- Add configuration option for `workingDaysPerMonth` in Settings
- Recalculate historical payroll if needed

### Issue 2: Negative Net Salary Possible

**Current Problem:**
```typescript
// ❌ Can go negative
const netSalary = baseSalary - violations - uniformDeductions;
```

**Impact:** When penalties exceed salary, net salary becomes negative.

**Correct Approach:**
```typescript
// ✅ CORRECT - Floor at zero
const netSalary = Math.max(0, baseSalary - violations - uniformDeductions);
```

**Action Required:**
- Add `Math.max(0, ...)` to all net salary calculations
- Add UI warning when deductions exceed base salary
- Consider business rule: should penalties carry over to next month?

## 🎁 Loyalty Points Hardcoded

**Current Problem:**
```typescript
// ❌ Hardcoded 1% rate (1 point per 10,000đ)
const points = Math.floor(netPayable / 10000);
```

**Impact:** Cannot adjust loyalty program without code changes.

**Correct Approach:**
```typescript
// ✅ CORRECT - Use dynamic config
const loyaltyPointRate = settings.loyaltyPointRate || 10000; // Default 10,000đ per point
const points = Math.floor(netPayable / loyaltyPointRate);
```

**Action Required:**
- Add `loyaltyPointRate` to Settings configuration
- Update `POSComputer.tsx` checkout logic
- Add UI in Settings to configure point rate

## Financial Calculation Standards

### Always Follow These Rules:

1. **COGS (Cost of Goods Sold):**
   ```typescript
   // ✅ Capture at transaction time
   const cogs = product.importPrice * quantity;
   // Store in transaction record - never recalculate later
   ```

2. **Net Revenue:**
   ```typescript
   // ✅ After discounts
   const netRevenue = totalAmount - discount;
   ```

3. **Gross Profit:**
   ```typescript
   // ✅ Revenue minus COGS
   const grossProfit = netRevenue - totalCogs;
   ```

4. **Inventory Validation:**
   ```typescript
   // ✅ ALWAYS check before sale
   if (product.quantity < requestedQuantity) {
     throw new Error('Insufficient inventory');
   }
   ```

5. **Rounding:**
   ```typescript
   // ✅ Always round currency to nearest đồng
   const amount = Math.round(calculatedAmount);
   ```

## Testing Financial Logic

Before committing financial calculations:
- [ ] Test with edge cases (zero, negative, very large numbers)
- [ ] Verify rounding behavior
- [ ] Check for negative inventory
- [ ] Validate against manual calculations
- [ ] Test month-end scenarios
- [ ] Verify historical data integrity

## When Modifying Financial Code

ALWAYS:
1. Document the business rule in comments
2. Add unit tests for the calculation
3. Verify with accounting team if unsure
4. Consider impact on historical data
5. Add migration script if formula changes
