---
inclusion: fileMatch
fileMatchPattern: "*.ts,*.tsx"
description: TypeScript and React best practices for CFO Brain 4.0
---

# TypeScript & React Standards

## Type Safety

### Always Define Explicit Types

```typescript
// ❌ BAD - Implicit any
const data = await supabase.from('products').select();

// ✅ GOOD - Explicit type
interface Product {
  id: string;
  name: string;
  price: number;
  quantity: number;
}

const { data, error } = await supabase
  .from('products')
  .select<Product>('*');
```

### Avoid Type Assertions

```typescript
// ❌ BAD - Unsafe type assertion
const product = data as Product;

// ✅ GOOD - Type guard
function isProduct(obj: unknown): obj is Product {
  return (
    typeof obj === 'object' &&
    obj !== null &&
    'id' in obj &&
    'name' in obj
  );
}

if (isProduct(data)) {
  // TypeScript knows data is Product here
}
```

## React Performance

### Optimize useMemo Dependencies

```typescript
// ❌ BAD - Too many dependencies
const summary = useMemo(() => {
  return calculateSummary(data);
}, [data, vatRate, settings, user, theme]); // theme doesn't affect calculation!

// ✅ GOOD - Minimal dependencies
const summary = useMemo(() => {
  return calculateSummary(data, vatRate);
}, [data, vatRate]);
```

### Virtualize Large Lists

```typescript
// ❌ BAD - Rendering 12,000+ items
{products.map(product => <ProductRow key={product.id} {...product} />)}

// ✅ GOOD - Use @tanstack/react-virtual
import { useVirtualizer } from '@tanstack/react-virtual';

const rowVirtualizer = useVirtualizer({
  count: products.length,
  getScrollElement: () => parentRef.current,
  estimateSize: () => 50,
});

{rowVirtualizer.getVirtualItems().map(virtualRow => (
  <ProductRow key={products[virtualRow.index].id} {...products[virtualRow.index]} />
))}
```

### Avoid Inline Functions in Props

```typescript
// ❌ BAD - Creates new function on every render
<Button onClick={() => handleClick(id)} />

// ✅ GOOD - Memoized callback
const handleButtonClick = useCallback(() => {
  handleClick(id);
}, [id, handleClick]);

<Button onClick={handleButtonClick} />
```

## State Management

### Use Custom Hooks for Complex State

```typescript
// ✅ GOOD - Extract to custom hook
function useProductSearch() {
  const [query, setQuery] = useState('');
  const [results, setResults] = useState<Product[]>([]);
  const [loading, setLoading] = useState(false);

  const search = useCallback(async (searchQuery: string) => {
    setLoading(true);
    try {
      const { data } = await supabase
        .from('products')
        .select()
        .ilike('name', `%${searchQuery}%`);
      setResults(data || []);
    } finally {
      setLoading(false);
    }
  }, []);

  return { query, setQuery, results, loading, search };
}
```

### Avoid Prop Drilling

```typescript
// ❌ BAD - Passing through many levels
<Parent settings={settings}>
  <Child settings={settings}>
    <GrandChild settings={settings} />
  </Child>
</Parent>

// ✅ GOOD - Use Context
const SettingsContext = createContext<Settings | null>(null);

function useSettings() {
  const context = useContext(SettingsContext);
  if (!context) throw new Error('useSettings must be used within SettingsProvider');
  return context;
}
```

## Error Handling

### Always Handle Supabase Errors

```typescript
// ❌ BAD - Ignoring errors
const { data } = await supabase.from('products').select();

// ✅ GOOD - Proper error handling
const { data, error } = await supabase.from('products').select();

if (error) {
  console.error('Failed to fetch products:', error);
  toast.error('Không thể tải danh sách sản phẩm');
  return;
}

if (!data) {
  console.warn('No products found');
  return;
}
```

### Use Error Boundaries

```typescript
// ✅ GOOD - Wrap components in error boundary
<ErrorBoundary fallback={<ErrorFallback />}>
  <ProductManager />
</ErrorBoundary>
```

## Component Organization

### File Structure

```
components/
├── ProductManager.tsx          # Main component
├── ProductManager.test.tsx     # Tests
└── hooks/
    └── useProductManager.tsx   # Custom hook
```

### Component Size

- Keep components under 300 lines
- Extract complex logic to custom hooks
- Split large components into smaller ones

### Naming Conventions

```typescript
// Components: PascalCase
function ProductCard() {}

// Hooks: camelCase with 'use' prefix
function useProductData() {}

// Utilities: camelCase
function formatCurrency() {}

// Constants: UPPER_SNAKE_CASE
const MAX_PRODUCTS = 1000;

// Types/Interfaces: PascalCase
interface ProductData {}
type ProductStatus = 'active' | 'inactive';
```

## Supabase Best Practices

### Use Typed Queries

```typescript
// ✅ GOOD - Type-safe query
const { data, error } = await supabase
  .from('products')
  .select('id, name, price, quantity')
  .eq('status', 'active')
  .order('name')
  .returns<Product[]>();
```

### Batch Operations

```typescript
// ❌ BAD - Multiple individual inserts
for (const product of products) {
  await supabase.from('products').insert(product);
}

// ✅ GOOD - Single batch insert
await supabase.from('products').insert(products);
```

### Use RLS Policies

```typescript
// ✅ GOOD - Rely on RLS, not client-side filtering
const { data } = await supabase
  .from('payroll_records')
  .select(); // RLS automatically filters by user permissions
```

## Testing Requirements

### Unit Tests for Business Logic

```typescript
describe('calculateNetSalary', () => {
  it('should not allow negative salary', () => {
    const result = calculateNetSalary({
      baseSalary: 5000000,
      violations: 6000000,
    });
    expect(result).toBe(0);
  });

  it('should use standard 26 working days', () => {
    const result = calculateDailyRate(5200000);
    expect(result).toBe(200000); // 5,200,000 / 26
  });
});
```

### Integration Tests for Critical Flows

```typescript
describe('POS Checkout', () => {
  it('should prevent negative inventory', async () => {
    // Setup: Product with quantity 5
    // Action: Try to sell 10
    // Assert: Should throw error
  });

  it('should calculate loyalty points correctly', async () => {
    // Setup: Purchase 100,000đ with 10,000đ per point rate
    // Action: Complete checkout
    // Assert: Customer gets 10 points
  });
});
```

## Code Review Checklist

Before submitting PR:
- [ ] All TypeScript errors resolved
- [ ] No `any` types (except where absolutely necessary)
- [ ] useMemo/useCallback used appropriately
- [ ] Large lists virtualized
- [ ] Error handling implemented
- [ ] Tests added for new logic
- [ ] No console.log statements
- [ ] Comments explain "why", not "what"
- [ ] Component size reasonable (<300 lines)
- [ ] Supabase queries typed correctly
