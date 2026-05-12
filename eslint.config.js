import js from '@eslint/js';
import tsPlugin from '@typescript-eslint/eslint-plugin';
import tsParser from '@typescript-eslint/parser';

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
    },
    rules: {
      // --- TypeScript ---
      // warn thay vì error vì codebase hiện có nhiều any — dần dần cải thiện
      '@typescript-eslint/no-explicit-any': 'warn',
      '@typescript-eslint/no-unused-vars': ['error', { argsIgnorePattern: '^_', varsIgnorePattern: '^_' }],
      '@typescript-eslint/no-require-imports': 'error',

      // --- console ---
      // Cấm console.log hoàn toàn (chỉ cho phép console.error trong catch)
      'no-console': ['warn', { allow: ['error'] }],

      // --- Code quality ---
      'no-debugger': 'error',
      'no-duplicate-imports': 'error',
      'prefer-const': 'error',
      'no-var': 'error',
      eqeqeq: ['error', 'always', { null: 'ignore' }],

      // Tắt rule từ js.recommended bị conflict với TypeScript
      'no-unused-vars': 'off',
      'no-undef': 'off',
    },
  },

  // Bỏ qua các thư mục không cần lint
  {
    ignores: [
      'dist/**',
      'node_modules/**',
      'imports/**',
      'coverage/**',
      '*.config.js',  // Tránh tự lint file này
      'vite.config.ts',
    ],
  },
];
