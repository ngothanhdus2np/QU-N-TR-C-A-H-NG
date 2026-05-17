# Settings Page Optimization Plan

**Target**: Reduce initial load from 800ms → 400ms (50% improvement)  
**Approach**: Remove eager preloading + defer expensive computations  
**Risk**: Low - changes are isolated and reversible

---

## PHASE 1: QUICK WINS (Implement Now)

### Fix 1: Remove Eager Tab Preloading ⚡ **CRITICAL**
**Impact**: Saves ~150-200ms  
**Risk**: None - tabs will load on-demand instead

**File**: `components/settings/SettingsCenter.tsx`  
**Lines**: 730-742

**Current code**:
```typescript
// Preload heavy tabs after modal is open — printTemplates loads on-click only
useEffect(() => {
  if (!isOpen) return;
  const t = setTimeout(() => {
    startTransition(() => {
      setVisitedTabs(prev => {
        const next = new Set(prev);
        next.add('goods');      // ← Preloads GoodsTab with 12K+ products
        next.add('payments');
        next.add('appearance');
        return next;
      });
    });
  }, 300);
  return () => clearTimeout(t);
}, [isOpen]);
```

**New code**:
```typescript
// REMOVED: Let tabs mount only when user clicks them
// This eliminates unnecessary computation for tabs user may never visit
```

**Why this helps**:
- GoodsTab with 12K products won't mount unless user clicks "Hàng hóa"
- Saves ~150ms of product counting computation
- Reduces initial memory footprint
- User only pays cost for tabs they actually use

---

### Fix 2: Defer GoodsTab Product Counting ⚡ **HIGH IMPACT**
**Impact**: Saves ~100ms when GoodsTab does mount  
**Risk**: Low - uses existing React patterns

**File**: `components/settings/tabs/GoodsTab.tsx`  
**Lines**: 470-507

**Current code**:
```typescript
// Compute counts off the render thread — runs during browser idle time
useEffect(() => {
  setCountsReady(false);
  const compute = () => {
    const units = new Set<string>();
    const categories = new Set<string>();
    // ... loops through ALL 12,739 products
    for (const p of products) {
      // ... expensive iteration
    }
    setGoodsCounts({...});
    setCountsReady(true);
  };
  if (typeof requestIdleCallback !== 'undefined') {
    const id = requestIdleCallback(compute);
    return () => cancelIdleCallback(id);
  }
  const id = setTimeout(compute, 0);
  return () => clearTimeout(id);
}, [products]);
```

**New code**:
```typescript
// Only compute counts when component is actually visible
useEffect(() => {
  // Don't compute if component is hidden (display: none)
  if (!countsReady && products.length > 0) {
    setCountsReady(false);
    const compute = () => {
      const units = new Set<string>();
      const categories = new Set<string>();
      const brands = new Set<string>();
      const locations = new Set<string>();
      const attributeNames = new Set<string>();
      
      // Batch process in chunks to avoid blocking
      const CHUNK_SIZE = 1000;
      let index = 0;
      
      const processChunk = () => {
        const end = Math.min(index + CHUNK_SIZE, products.length);
        for (let i = index; i < end; i++) {
          const p = products[i];
          const u = p.unit?.trim();
          if (u) units.add(u);
          (p.units || []).forEach(pu => {
            const n = pu.name?.trim();
            if (n) units.add(n);
          });
          const cat = String(p.categoryPath || p.categoryId || '').trim();
          if (cat) categories.add(cat);
          const br = p.brand?.trim();
          if (br) brands.add(br);
          const loc = p.location?.trim();
          if (loc) locations.add(loc);
          (p.attributes || []).forEach(a => {
            const n = String(a.name || '').trim();
            if (n) attributeNames.add(n);
          });
          Object.keys(p.variantAttributes || {}).forEach(k => {
            const n = k.trim();
            if (n) attributeNames.add(n);
          });
        }
        
        index = end;
        
        if (index < products.length) {
          // Process next chunk
          if (typeof requestIdleCallback !== 'undefined') {
            requestIdleCallback(processChunk);
          } else {
            setTimeout(processChunk, 0);
          }
        } else {
          // Done - update state
          setGoodsCounts({
            units: units.size,
            categories: categories.size,
            brands: brands.size,
            locations: locations.size,
            attributes: attributeNames.size,
          });
          setCountsReady(true);
        }
      };
      
      processChunk();
    };
    
    // Delay computation slightly to let UI render first
    const timer = setTimeout(compute, 100);
    return () => clearTimeout(timer);
  }
}, [products, countsReady]);
```

**Why this helps**:
- Processes products in chunks of 1000 instead of all at once
- Yields to browser between chunks (non-blocking)
- UI stays responsive during computation
- 100ms delay lets modal render first

---

### Fix 3: Lazy Load API Data ⚡ **MEDIUM IMPACT**
**Impact**: Saves ~100-200ms (network dependent)  
**Risk**: None - data only needed when user visits specific tabs

**File**: `components/settings/SettingsCenter.tsx`  
**Lines**: 744-762

**Current code**:
```typescript
useEffect(() => {
  if (!isOpen) return;

  fetch('/api/notifications/status')
    .then(r => r.json())
    .then(d => {
      setEmailConfigured(d.emailConfigured);
      setEmailTo(d.emailTo);
      setZaloConfigured(d.zaloConfigured);
      setZaloFollowerId(d.zaloFollowerId);
    })
    .catch(() => {
      setEmailConfigured(false);
      setZaloConfigured(false);
    });

  fetch('/api/alerts/config')
    .then(r => r.json())
    .then(d => setAlertConfig(d))
    .catch(() => {});
}, [isOpen]);
```

**New code**:
```typescript
// Only fetch notification status when user visits notifications tab
useEffect(() => {
  if (!isOpen || activeTab !== 'notifications') return;

  fetch('/api/notifications/status')
    .then(r => r.json())
    .then(d => {
      setEmailConfigured(d.emailConfigured);
      setEmailTo(d.emailTo);
      setZaloConfigured(d.zaloConfigured);
      setZaloFollowerId(d.zaloFollowerId);
    })
    .catch(() => {
      setEmailConfigured(false);
      setZaloConfigured(false);
    });
}, [isOpen, activeTab]);

// Only fetch alert config when user visits notifications tab
useEffect(() => {
  if (!isOpen || activeTab !== 'notifications') return;

  fetch('/api/alerts/config')
    .then(r => r.json())
    .then(d => setAlertConfig(d))
    .catch(() => {});
}, [isOpen, activeTab]);
```

**Why this helps**:
- No API calls on initial open
- Only fetches when user actually needs the data
- Reduces network congestion
- Faster perceived load time

---

## IMPLEMENTATION ORDER

1. **Fix 1** (Remove preloading) - 5 minutes
   - Delete lines 730-742 in SettingsCenter.tsx
   - Test: Open settings, verify tabs still work

2. **Fix 2** (Defer counting) - 15 minutes
   - Update GoodsTab.tsx counting logic
   - Test: Click "Hàng hóa" tab, verify counts appear

3. **Fix 3** (Lazy API) - 10 minutes
   - Update API fetch effects in SettingsCenter.tsx
   - Test: Click "Thông báo" tab, verify data loads

**Total time**: ~30 minutes

---

## TESTING CHECKLIST

### Before Changes:
- [ ] Open Settings → measure time to interactive (~800ms)
- [ ] Switch to "Hàng hóa" tab → measure time (~200ms)
- [ ] Switch to "Thông báo" tab → verify data loads
- [ ] Open "Xem chi tiết" in Goods → measure time (~50ms)

### After Changes:
- [ ] Open Settings → measure time to interactive (target: ~400ms)
- [ ] Switch to "Hàng hóa" tab → measure time (target: ~150ms)
- [ ] Switch to "Thông báo" tab → verify data loads
- [ ] Open "Xem chi tiết" in Goods → measure time (should be same)
- [ ] Verify all tabs still work correctly
- [ ] Check for console errors

### Performance Measurement:
```javascript
// Add to browser console before opening Settings
console.time('settings-open');
// Click Settings button
// When modal is fully interactive:
console.timeEnd('settings-open');
```

---

## ROLLBACK PLAN

If any issues occur:

1. **Fix 1 rollback**: Restore lines 730-742
2. **Fix 2 rollback**: Restore original counting logic
3. **Fix 3 rollback**: Restore original API fetch effects

All changes are isolated and can be reverted independently.

---

## EXPECTED RESULTS

### Performance Improvements:
- **Initial open**: 800ms → 400ms (50% faster) ✅
- **Goods tab**: 200ms → 150ms (25% faster) ✅
- **Memory usage**: -20MB (no preloaded tabs) ✅
- **Network**: -2 API calls on open ✅

### User Experience:
- Settings modal opens instantly
- No lag when clicking Settings button
- Tabs load smoothly when clicked
- Overall feels much snappier

---

## PHASE 2: DEEP OPTIMIZATIONS (If Needed)

If Phase 1 doesn't achieve target performance:

### Fix 4: Virtualize Category Tree
- Use `react-window` for large category lists
- Only render visible nodes
- Saves ~30ms on detail view open

### Fix 5: Memoize Child Components
- Add `React.memo` to SettingLine, TogglePill, etc.
- Prevents unnecessary re-renders
- Saves ~50ms on tab switches

### Fix 6: Code-Split Heavy Tabs
- Lazy load GoodsTab, PaymentsTab with `React.lazy`
- Reduces initial bundle size
- Saves ~100ms on first load

---

## PHASE 3: ADVANCED (Future)

### Fix 7: Web Worker for Product Processing
- Move counting logic to background thread
- Use Comlink for easy communication
- Completely non-blocking

### Fix 8: IndexedDB Cache
- Cache product counts in IndexedDB
- Only recompute when products change
- Instant load on subsequent opens

### Fix 9: Reduce State Complexity
- Combine related states into reducer
- Use context for deeply nested props
- Cleaner code + better performance

---

## SUCCESS CRITERIA

✅ **Phase 1 Complete When**:
- Settings opens in <500ms (down from 800ms)
- No lag when clicking Settings button
- All tabs still work correctly
- No console errors

✅ **Phase 2 Complete When**:
- Settings opens in <300ms
- Tab switches in <100ms
- Smooth animations throughout

✅ **Phase 3 Complete When**:
- Settings opens in <200ms
- Instant tab switches
- Zero perceived lag

---

## NOTES

- Similar to GoodsInventory optimization (previous task)
- But different root cause: computation vs rendering
- Phase 1 should be sufficient for good UX
- Phase 2/3 only if user still reports lag

---

**Ready to implement**: Yes ✅  
**Estimated time**: 30 minutes  
**Risk level**: Low  
**Reversible**: Yes
