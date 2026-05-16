# 📁 Cấu trúc dự án CFO Brain 4.0

## 🎯 Tổng quan

Dự án được tổ chức theo **Feature-based Architecture** với **Domain-Driven Design** principles.

## 📂 Cấu trúc thư mục

```
/
├── src/                          # Source code chính
│   ├── lib/                      # Business logic (pure functions)
│   │   ├── businessLogic.core.ts
│   │   ├── businessLogic.inventory.ts
│   │   ├── businessLogic.payroll.ts
│   │   ├── businessLogic.revenue.ts
│   │   ├── businessLogic.ts      # Main export
│   │   └── index.ts              # Barrel export
│   └── types/                    # Type definitions
│       └── index.ts              # Re-export from root types.ts
│
├── components/                   # React components (feature-based)
│   ├── pos/                      # POS module (40 components)
│   ├── revenue/                  # Revenue module
│   ├── payroll/                  # Payroll module
│   ├── expense/                  # Expense module
│   ├── marketing/                # Marketing module
│   ├── settings/                 # Settings module
│   ├── suppliers/                # Suppliers module
│   ├── purchase/                 # Purchase module
│   ├── audit/                    # Audit module
│   ├── dashboard/                # Dashboard module
│   ├── product-group/            # Product group module
│   ├── promotion/                # Promotion module
│   ├── shared/                   # Shared business components
│   │   └── index.ts              # Barrel export
│   └── ui/                       # Primitive UI components
│       └── index.ts              # Barrel export
│
├── hooks/                        # Custom React hooks
│   ├── useAppData.ts             # Global state management
│   ├── appReducer.ts             # Reducer logic
│   ├── stateTypes.ts             # State types
│   ├── useOfflineSync.ts         # Offline sync
│   ├── useMarketing.ts           # Marketing logic
│   └── useTheme.ts               # Theme switching
│
├── services/                     # Service layer
│   ├── apiService.ts             # Supabase CRUD
│   ├── dataMapper.ts             # Cloud ↔ localStorage
│   ├── posOrderService.ts        # POS business logic
│   ├── emailService.ts           # Email notifications
│   ├── zaloService.ts            # Zalo integration
│   ├── marketingClaudeService.ts # AI marketing
│   ├── exportService.ts          # Excel export
│   ├── validationService.ts      # Data validation
│   └── agents/                   # AI agents
│       ├── claudeClient.ts
│       ├── cfoAgent.ts
│       ├── alertAgent.ts
│       └── eodAgent.ts
│
├── routes/                       # Backend API routes
│   ├── ai.ts                     # Claude API endpoints
│   ├── data.ts                   # CRUD proxy
│   ├── facebook.ts               # Facebook OAuth
│   ├── import.ts                 # KiotViet sync
│   └── notifications.ts          # EOD report scheduler
│
├── constants/                    # Constants & config
│   ├── defaultData.ts
│   ├── marketing.ts
│   ├── navigation.ts
│   └── themes.ts
│
├── tests/                        # Test files
│   └── unit/                     # Unit tests
│       ├── businessLogic.test.ts
│       ├── businessLogic.inventory.test.ts
│       ├── businessLogic.payroll.test.ts
│       └── businessLogic.revenue.test.ts
│
├── docs/                         # Documentation
│   ├── AGENTS.md                 # Agent workflow guide
│   ├── HISTORY.md                # Development history
│   ├── DECISIONS.md              # Architecture decisions
│   ├── ROADMAP.md                # Feature roadmap
│   ├── ROLE_QA.md                # QA guidelines
│   ├── ROLE_REVIEWER.md          # Code review guidelines
│   ├── CLAUDE.md                 # Claude AI context
│   ├── CLAUDE.local.md           # Local Claude config
│   └── PROJECT_STRUCTURE.md      # This file
│
├── assets/                       # Static assets
│   ├── logos/                    # Bank/payment logos
│   │   ├── logo-acb-inkythuatso/
│   │   ├── logo-momo-inkythuatso/
│   │   └── logo-vietinbank-inkythuatso/
│   └── data/                     # Data files
│       ├── DanhSachSanPham_KV06052026-194714-029.xlsx
│       ├── tmpImage_*.JPG
│       ├── metadata.json
│       └── COMMIT_MESSAGE.txt
│
├── public/                       # Public static files
│   ├── logo.png
│   └── imports/
│
├── types.ts                      # All TypeScript types (legacy, will be moved to src/types/)
├── App.tsx                       # Main React component
├── index.tsx                     # React entry point
├── server.ts                     # Express server
├── supabase_setup.sql            # Database schema
│
├── package.json                  # Dependencies
├── tsconfig.json                 # TypeScript config
├── vite.config.ts                # Vite config
├── eslint.config.js              # ESLint config
├── .prettierrc                   # Prettier config
└── README.md                     # Project README
```

## 🎨 Design Principles

### 1. **Feature-based Organization**
Components được tổ chức theo feature/module, không phải theo type (Button, Modal, etc.)

**✅ GOOD:**
```
components/pos/POSCart.tsx
components/pos/POSCheckout.tsx
```

**❌ BAD:**
```
components/Button.tsx
components/Modal.tsx
```

### 2. **Business Logic Separation**
Business logic tách biệt khỏi UI, dễ test, dễ reuse.

```typescript
// src/lib/businessLogic.payroll.ts
export const calculateEmployeePayroll = (...) => { ... }

// components/PayrollManager.tsx
import { calculateEmployeePayroll } from '../src/lib';
```

### 3. **Service Layer Pattern**
Services xử lý side effects (API calls, storage, external integrations).

```typescript
// services/apiService.ts
export const upsertItem = async (table, data) => { ... }
```

### 4. **Custom Hooks for Logic Reuse**
Logic phức tạp được extract thành custom hooks.

```typescript
// hooks/useAppData.ts
export const useAppData = () => { ... }
```

### 5. **Barrel Exports**
Mỗi thư mục có `index.ts` để export components/functions.

```typescript
// components/ui/index.ts
export { default as ConfirmDialog } from './ConfirmDialog';
export { default as Toast } from './Toast';

// Usage
import { ConfirmDialog, Toast } from '@/components/ui';
```

## 📝 Import Conventions

### Absolute Imports (Recommended)
```typescript
import { calculatePayroll } from '@/src/lib';
import { POSCart } from '@/components/pos';
import type { Employee } from '@/types';
```

### Relative Imports (Current)
```typescript
import { calculatePayroll } from '../src/lib';
import { POSCart } from './pos/POSCart';
import type { Employee } from '../types';
```

## 🧪 Testing Strategy

### Unit Tests
- Location: `tests/unit/`
- Coverage target: 70-80%
- Current: 74.13% ✅

### Test Files Naming
```
src/lib/businessLogic.payroll.ts
tests/unit/businessLogic.payroll.test.ts
```

## 📊 Module Sizes

| Module | Size | Files | Status |
|--------|------|-------|--------|
| POS | 672KB | 40 | ✅ Well organized |
| Revenue | 148KB | 9 | ✅ Well organized |
| Payroll | 92KB | 7 | ✅ Well organized |
| Settings | 88KB | 5 | ✅ Well organized |
| Marketing | 80KB | 5 | ✅ Well organized |
| Expense | 80KB | 7 | ✅ Well organized |

## 🔄 Migration Notes

### Recent Changes (2026-05-13)
1. ✅ Moved business logic from root to `src/lib/`
2. ✅ Moved test files to `tests/unit/`
3. ✅ Moved documentation to `docs/`
4. ✅ Moved assets to `assets/`
5. ✅ Created barrel exports for `src/lib/`
6. ✅ Created barrel exports for `components/ui/` and `components/shared/`

### Future Improvements
1. ⏳ Split `types.ts` into domain-specific files in `src/types/`
2. ⏳ Add path aliases in `tsconfig.json` for cleaner imports
3. ⏳ Add barrel exports for all component modules
4. ⏳ Move remaining root files to appropriate directories

## 🚀 Getting Started

### Development
```bash
npm run dev          # Start dev server (port 3000)
```

### Testing
```bash
npm test             # Run all tests
npm run check        # TypeScript check
npm run lint         # ESLint
npm run format       # Prettier
```

### Build
```bash
npm run build        # Build for production
```

## 📚 Related Documentation

- [AGENTS.md](./AGENTS.md) - Agent workflow and rules
- [HISTORY.md](./HISTORY.md) - Development history and TODO
- [DECISIONS.md](./DECISIONS.md) - Architecture decisions
- [ROADMAP.md](./ROADMAP.md) - Feature roadmap

## 🤝 Contributing

When adding new features:
1. Create feature folder in `components/`
2. Add business logic to `src/lib/`
3. Add types to `types.ts` (or `src/types/` when split)
4. Add services to `services/`
5. Write tests in `tests/unit/`
6. Update this documentation

---

**Last Updated:** 2026-05-13  
**Maintainer:** CFO Brain Development Team
