import js from '@eslint/js';
import tsPlugin from '@typescript-eslint/eslint-plugin';
import tsParser from '@typescript-eslint/parser';
import reactHooks from 'eslint-plugin-react-hooks';

export default [
  // Áp dụng cho tất cả TS/TSX
  {
    files: ['**/*.ts', '**/*.tsx'],
    languageOptions: {
      parser: tsParser,
      parserOptions: {
        ecmaVersion: 'latest',
        sourceType: 'module',
      },
      globals: {
        // Node.js globals
        process: 'readonly',
        console: 'readonly',
        __dirname: 'readonly',
        __filename: 'readonly',
        Buffer: 'readonly',
        setTimeout: 'readonly',
        setInterval: 'readonly',
        clearInterval: 'readonly',
        URL: 'readonly',
        crypto: 'readonly',
        // Browser globals
        window: 'readonly',
        document: 'readonly',
        localStorage: 'readonly',
        sessionStorage: 'readonly',
        navigator: 'readonly',
        fetch: 'readonly',
        Request: 'readonly',
        Response: 'readonly',
        FormData: 'readonly',
        globalThis: 'readonly',
      },
    },
    plugins: {
      '@typescript-eslint': tsPlugin,
      'react-hooks': reactHooks,
    },
    rules: {
      // --- React Hooks ---
      // Trước 29/08/2026 codebase có sẵn comment `eslint-disable react-hooks/...`
      // nhưng plugin CHƯA từng được cài → eslint báo "rule not found" (8 error,
      // `npm run lint` luôn fail) và trên thực tế KHÔNG luật hook nào từng chạy
      // trên 245 file React. Chỉ bật 2 rule kinh điển; các rule React Compiler
      // khác của plugin v7 để lại cho đợt sau, tránh mở quá rộng một lúc.
      'react-hooks/rules-of-hooks': 'error', // gọi hook có điều kiện = bug thật
      'react-hooks/exhaustive-deps': 'warn', // ghi nhận trước, sửa ở đợt riêng

      // --- TypeScript ---
      // warn thay vì error vì codebase hiện có nhiều any — dần dần cải thiện
      '@typescript-eslint/no-explicit-any': 'warn',
      '@typescript-eslint/no-unused-vars': ['warn', { argsIgnorePattern: '^_', varsIgnorePattern: '^_' }],
      '@typescript-eslint/no-require-imports': 'error',

      // --- console ---
      // Cấm console.log hoàn toàn (chỉ cho phép console.error trong catch)
      'no-console': ['warn', { allow: ['error'] }],

      // --- Code quality ---
      'no-debugger': 'error',
      'no-duplicate-imports': 'warn',
      'prefer-const': 'error',
      'no-var': 'error',
      eqeqeq: ['error', 'always', { null: 'ignore' }],

      // Tắt rule từ js.recommended bị conflict với TypeScript
      'no-unused-vars': 'off',
      'no-undef': 'off',
    },
  },

  // Legacy/dynamic data-boundary modules still use intentionally loose payloads.
  // Keep the warning active for new modules while avoiding full-repo lint noise.
  {
    files: [
      'components/ChatInterface.tsx',
      'components/KnowledgeManager.tsx',
      'components/ProductGroupManager.tsx',
      'components/StaffManager.tsx',
      'components/marketing/MarketingManager.tsx',
      'components/pos/GoodsLegacyProductFormView.tsx',
      'components/pos/GoodsProductTableBody.tsx',
      'components/pos/OrderHistory.tsx',
      'components/pos/SupplierManager.tsx',
      'components/pos/useGoodsExcelImport.ts',
      'hooks/useAppData.ts',
      'services/apiService.ts',
      'services/dataMapper.ts',
    ],
    rules: {
      '@typescript-eslint/no-explicit-any': 'off',
    },
  },

  // Bỏ qua các thư mục không cần lint
  {
    ignores: [
      'dist/**',
      'node_modules/**',
      'imports/**',
      'coverage/**',
      'supabase/**',
      '*.config.js',  // Tránh tự lint file này
      'vite.config.ts',
    ],
  },
];
