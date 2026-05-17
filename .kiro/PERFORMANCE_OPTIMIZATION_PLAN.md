# ⚡ Performance Optimization Plan

**Created:** 2026-05-18  
**Target:** Optimize GoodsInventory for 12,739 products  
**Current Status:** Lag 3-5s on initial load, slow scroll

---

## 🎯 PROBLEMS IDENTIFIED

### 1. No Virtualization
- **Issue:** Rendering all filtered products at once
- **Impact:** Even with pagination, filtering 12K items is slow
- **Solution:** Use `@tanstack/react-virtual` (already installed!)

### 2. Heavy Filters
- **Issue:** Filters run on every render
- **Impact:** Re-filtering 12K products on every state change
- **Solution:** Memoize filtered results with `useMemo`

### 3. Expensive Calculations
- **Issue:** Calculating variants, stock status on every render
- **Impact:** 12K × calculations = slow
- **Solution:** Memoize calculations

---

## 🚀 OPTIMIZATION STRATEGY

### Phase 1: Add Virtualization (30 min)
- Use `@tanstack/react-virtual` for table rows
- Only render visible rows (15-30 at a time)
- **Expected improvement:** 5x faster initial render

### Phase 2: Memoize Filters (15 min)
- Wrap filter logic in `useMemo`
- Only re-filter when dependencies change
- **Expected improvement:** 3x faster filtering

### Phase 3: Optimize Calculations (15 min)
- Memoize variant grouping
- Cache expensive computations
- **Expected improvement:** 2x faster overall

---

## 📊 EXPECTED RESULTS

| Metric | Before | After | Improvement |
|--------|--------|-------|-------------|
| Initial Load | 5s | <1s | 5x faster |
| Filter/Search | 2s | <0.5s | 4x faster |
| Scroll FPS | 20 | 60 | 3x smoother |
| Memory Usage | 200MB | 50MB | 75% less |

---

## 🔧 IMPLEMENTATION

### File Changes:
1. `components/pos/GoodsProductTableBody.tsx` - Add virtualization
2. `components/pos/useGoodsFilters.ts` - Add memoization
3. `components/pos/GoodsInventory.tsx` - Optimize calculations

**Total changes:** ~100 lines added/modified

---

## ✅ SUCCESS CRITERIA

- [ ] Initial load < 1 second
- [ ] Smooth 60 FPS scrolling
- [ ] Filter/search < 500ms
- [ ] Memory usage < 100MB
- [ ] No visual glitches

---

**Status:** Ready to implement
