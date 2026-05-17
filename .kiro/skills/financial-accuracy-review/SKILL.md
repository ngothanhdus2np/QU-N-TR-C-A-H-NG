---
name: Financial Accuracy Review
description: Review and validate financial calculations for accuracy and business rule compliance
keywords: finance, accounting, payroll, revenue, COGS, calculations
---

# Financial Accuracy Review Skill

## Purpose
Ensure all financial calculations in CFO Brain 4.0 are accurate, consistent, and follow proper accounting principles.

## When to Use
- Before modifying payroll calculations
- When changing revenue/expense logic
- After updating pricing or discount rules
- Before month-end closing
- When adding new financial features

## Critical Financial Rules

### 1. Payroll Calculations

#### Standard Working Days (P1 - HIGH)

**Rule:** Always use 26 standard working days, NOT calendar days.

```typescript
// ❌ WRONG - Inconsistent daily rates
const daysInMonth = new Date(year, month + 1, 0).getDate(); // 28-31
const dailyRate = baseSalary / daysInMonth;

// ✅ CORRECT - Consistent daily rates
const STANDARD_WORKING_DAYS = 26;
const dailyRate = baseSalary / STANDARD_WORKING_DAYS;
```

**Why:** Using calendar days causes:
- February: Higher daily rate (salary / 28)
- January: Lower daily rate (salary / 31)
- Unfair compensation across months

**Test Cases:**
```typescript
describe('Payroll Daily Rate', () => {
  it('should use 26 standard working days', () => {
    const baseSalary = 5200000; // 5.2M VND
    const dailyRate = calculateDailyRate(baseSalary);
    expect(dailyRate).toBe(200000); // 5.2M / 26 = 200K
  });

  it('should be consistent across all months', () => {
    const baseSalary = 5200000;
    const janRate = calculateDailyRate(baseSalary, 2026, 0); // January
    const febRate = calculateDailyRate(baseSalary, 2026, 1); // February
    expect(janRate).toBe(febRate); // Must be equal!
  });
});
```

#### Net Salary Floor (P1 - HIGH)

**Rule:** Net salary cannot be negative.

```typescript
// ❌ WRONG - Can go negative
const netSalary = baseSalary - violations - uniformDeductions;

// ✅ CORRECT - Floor at zero
const netSalary = Math.max(0, baseSalary - violations - uniformDeductions);
```

**Business Decision Needed:**
- Should excess penalties carry over to next month?
- Should there be a warning when deductions exceed salary?
- Should there be a maximum penalty percentage?

**Test Cases:**
```typescript
describe('Net Salary Calculation', () => {
  it('should not allow negative net salary', () => {
    const result = calculateNetSalary({
      baseSalary: 5000000,
      violations: 6000000,
      uniformDeductions: 500000
    });
    expect(result).toBe(0);
  });

  it('should warn when deductions exceed salary', () => {
    const warnings = [];
    calculateNetSalary({
      baseSalary: 5000000,
      violations: 6000000
    }, warnings);
    expect(warnings).toContain('Deductions exceed base salary');
  });
});
```

### 2. Revenue Calculations

#### Net Revenue Formula

```typescript
// ✅ CORRECT - After discounts
const netRevenue = totalAmount - discount;
```

**Components:**
- `totalAmount` = Sum of (price × quantity) for all items
- `discount` = Total discount amount (can be percentage or fixed)
- `netRevenue` = What customer actually pays

#### Gross Profit Formula

```typescript
// ✅ CORRECT - Revenue minus COGS
const grossProfit = netRevenue - totalCogs;
```

**Critical:** COGS must be captured at transaction time!

```typescript
// ✅ CORRECT - Capture COGS at sale time
const transactionItem = {
  productId: product.id,
  quantity: quantity,
  price: product.price,
  importPrice: product.importPrice, // ← Capture NOW
  cogs: product.importPrice * quantity // ← Calculate NOW
};
```

**Why:** Import prices change over time. If you recalculate COGS later using current import price, historical profit will be wrong.

**Test Cases:**
```typescript
describe('Gross Profit Calculation', () => {
  it('should use COGS from transaction time', () => {
    const transaction = {
      netRevenue: 100000,
      items: [
        { quantity: 2, importPrice: 20000 } // COGS = 40,000
      ]
    };
    const grossProfit = calculateGrossProfit(transaction);
    expect(grossProfit).toBe(60000); // 100K - 40K
  });

  it('should not recalculate COGS from current prices', () => {
    // Product import price changed from 20K to 25K
    const transaction = {
      netRevenue: 100000,
      items: [
        { productId: 'P1', quantity: 2, importPrice: 20000 }
      ]
    };
    
    // Update product price
    updateProduct('P1', { importPrice: 25000 });
    
    // Gross profit should still use old COGS
    const grossProfit = calculateGrossProfit(transaction);
    expect(grossProfit).toBe(60000); // NOT 50,000!
  });
});
```

### 3. Loyalty Points

#### Dynamic Configuration (P1 - MEDIUM)

**Rule:** Use configurable point rate, not hardcoded values.

```typescript
// ❌ WRONG - Hardcoded
const points = Math.floor(netPayable / 10000);

// ✅ CORRECT - Dynamic config
const loyaltyPointRate = settings.loyaltyPointRate || 10000;
const points = Math.floor(netPayable / loyaltyPointRate);
```

**Configuration:**
```typescript
interface Settings {
  loyaltyPointRate: number; // VND per point (default: 10000)
  loyaltyPointsEnabled: boolean;
  loyaltyPointsExpireDays?: number;
}
```

**Test Cases:**
```typescript
describe('Loyalty Points', () => {
  it('should use configured point rate', () => {
    const settings = { loyaltyPointRate: 10000 };
    const points = calculateLoyaltyPoints(100000, settings);
    expect(points).toBe(10); // 100K / 10K = 10 points
  });

  it('should handle different point rates', () => {
    const settings = { loyaltyPointRate: 5000 }; // More generous
    const points = calculateLoyaltyPoints(100000, settings);
    expect(points).toBe(20); // 100K / 5K = 20 points
  });

  it('should floor to integer points', () => {
    const settings = { loyaltyPointRate: 10000 };
    const points = calculateLoyaltyPoints(95000, settings);
    expect(points).toBe(9); // Floor(95K / 10K) = 9
  });
});
```

### 4. Inventory Validation

#### Prevent Negative Inventory (P0 - CRITICAL)

**Rule:** ALWAYS check inventory before allowing sale.

```typescript
// ✅ CORRECT - Check at multiple points
function addToCart(productId: string, quantity: number) {
  const product = getProduct(productId);
  
  // Check 1: At add to cart
  if (product.quantity < quantity) {
    throw new Error(`Insufficient inventory. Available: ${product.quantity}`);
  }
  
  // Add to cart...
}

function handleCheckout(cart: CartItem[]) {
  // Check 2: At checkout (inventory may have changed)
  for (const item of cart) {
    const product = getProduct(item.productId);
    if (product.quantity < item.quantity) {
      throw new Error(`Insufficient inventory for ${product.name}`);
    }
  }
  
  // Process checkout...
}
```

**Check Points:**
1. ✅ When adding to cart
2. ✅ When updating cart quantity
3. ✅ When scanning barcode
4. ✅ At final checkout confirmation

**Test Cases:**
```typescript
describe('Inventory Validation', () => {
  it('should prevent adding more than available', () => {
    const product = { id: 'P1', quantity: 5 };
    expect(() => addToCart('P1', 10)).toThrow('Insufficient inventory');
  });

  it('should check inventory at checkout', () => {
    // Add to cart when quantity is 10
    addToCart('P1', 8);
    
    // Someone else buys 5, now only 5 left
    updateInventory('P1', -5);
    
    // Checkout should fail
    expect(() => handleCheckout()).toThrow('Insufficient inventory');
  });
});
```

### 5. Currency Rounding

#### Always Round to Nearest Đồng

```typescript
// ✅ CORRECT - Round all currency values
const amount = Math.round(calculatedAmount);
const total = Math.round(subtotal + tax);
const discount = Math.round(total * discountPercent);
```

**Why:** Vietnamese đồng has no decimal places. Floating point errors can cause:
- Display issues (1000.0000001đ)
- Accounting mismatches
- Database precision issues

**Test Cases:**
```typescript
describe('Currency Rounding', () => {
  it('should round to nearest dong', () => {
    const price = 10000.7;
    expect(formatCurrency(price)).toBe(10001);
  });

  it('should handle floating point errors', () => {
    const subtotal = 33333.33 * 3; // = 99999.99
    expect(Math.round(subtotal)).toBe(100000);
  });
});
```

## Financial Validation Checklist

Before committing financial code changes:

### Calculations
- [ ] Payroll uses 26 standard working days
- [ ] Net salary floored at zero
- [ ] Loyalty points use dynamic config
- [ ] COGS captured at transaction time
- [ ] All currency values rounded

### Validation
- [ ] Inventory checked before sale
- [ ] Negative values prevented
- [ ] Division by zero handled
- [ ] Null/undefined values handled
- [ ] Edge cases tested

### Testing
- [ ] Unit tests for all calculations
- [ ] Edge case tests (zero, negative, very large)
- [ ] Month-end scenario tests
- [ ] Historical data integrity tests
- [ ] Manual calculation verification

### Documentation
- [ ] Business rules documented in code
- [ ] Formula explained in comments
- [ ] Assumptions stated clearly
- [ ] Edge cases documented
- [ ] Test cases cover requirements

## Common Financial Bugs

### Bug 1: Floating Point Precision

```typescript
// ❌ WRONG
const total = 0.1 + 0.2; // = 0.30000000000000004

// ✅ CORRECT
const total = Math.round((0.1 + 0.2) * 100) / 100;
// Or for currency: Math.round(total)
```

### Bug 2: Division by Zero

```typescript
// ❌ WRONG
const average = total / count; // count might be 0!

// ✅ CORRECT
const average = count > 0 ? total / count : 0;
```

### Bug 3: Null/Undefined in Calculations

```typescript
// ❌ WRONG
const total = price + discount; // discount might be undefined!

// ✅ CORRECT
const total = price + (discount || 0);
```

### Bug 4: Incorrect Order of Operations

```typescript
// ❌ WRONG
const discountedPrice = price - discount * quantity; // Wrong!

// ✅ CORRECT
const discountedPrice = (price - discount) * quantity;
```

## Testing Financial Logic

### Unit Test Template

```typescript
describe('Financial Calculation: [Name]', () => {
  describe('Happy Path', () => {
    it('should calculate correctly with valid inputs', () => {
      // Test normal case
    });
  });

  describe('Edge Cases', () => {
    it('should handle zero values', () => {});
    it('should handle negative values', () => {});
    it('should handle very large values', () => {});
    it('should handle null/undefined', () => {});
  });

  describe('Business Rules', () => {
    it('should enforce [specific rule]', () => {});
    it('should prevent [invalid scenario]', () => {});
  });

  describe('Precision', () => {
    it('should round correctly', () => {});
    it('should handle floating point errors', () => {});
  });
});
```

## Resources

- [Accounting Principles](https://www.accountingtools.com/articles/accounting-principles)
- [COGS Calculation](https://www.investopedia.com/terms/c/cogs.asp)
- [Gross Profit Formula](https://www.investopedia.com/terms/g/grossprofit.asp)
- [JavaScript Number Precision](https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/Number/EPSILON)
