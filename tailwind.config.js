/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./**/*.{js,ts,jsx,tsx}",
    "!./node_modules/**",
  ],
  theme: {
    extend: {
      fontFamily: {
        sans: ['Inter', 'ui-sans-serif', 'system-ui', '-apple-system', 'BlinkMacSystemFont', 'Segoe UI', 'sans-serif'],
      },

      fontSize: {
        // 2xs: dùng cho chip/badge/table-meta thay text-[10px]
        '2xs': ['10px', { lineHeight: '14px' }],
      },

      colors: {
        // Primary brand — thống nhất về indigo, thay bg-blue-*
        primary: {
          50:  '#eef2ff',
          100: '#e0e7ff',
          200: '#c7d2fe',
          500: '#6366f1',
          600: '#4f46e5',
          700: '#4338ca',
        },
        // Neutral tones dùng cho bg/border/text phụ
        muted: {
          warm: '#c3c4ba', // border/divider nhạt — thay [#c3c4ba]
          cool: '#a7bac5', // placeholder text   — thay [#a7bac5]
          dark: '#748090', // text secondary      — thay [#748090]
        },
        // Highlight backgrounds
        highlight: {
          yellow: '#f5f0cf', // nền highlight vàng — thay [#f5f0cf]
          blue:   '#a9dff3', // nền highlight xanh — thay [#a9dff3]
        },
      },

      boxShadow: {
        // Elevation system — dùng thay shadow-sm/md/xl/2xl ngẫu nhiên
        'card':     '0 1px 3px 0 rgb(0 0 0 / 0.06), 0 1px 2px -1px rgb(0 0 0 / 0.06)',
        'panel':    '0 4px 6px -1px rgb(0 0 0 / 0.07), 0 2px 4px -2px rgb(0 0 0 / 0.07)',
        'dropdown': '0 10px 15px -3px rgb(0 0 0 / 0.08), 0 4px 6px -4px rgb(0 0 0 / 0.08)',
        'modal':    '0 20px 25px -5px rgb(0 0 0 / 0.1), 0 8px 10px -6px rgb(0 0 0 / 0.1)',
      },

      zIndex: {
        // Z-index system — thay z-[100]/z-[9999]/z-[1000]... loạn
        'dropdown': '100',
        'sticky':   '200',
        'overlay':  '300',
        'modal':    '400',
        'toast':    '500',
        'tooltip':  '600',
      },
    },
  },
  plugins: [],
}
