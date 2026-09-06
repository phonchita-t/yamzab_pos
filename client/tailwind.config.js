/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{js,jsx}'],
  theme: {
    extend: {
      colors: {
        // "spicy salad" palette — chilli red, lime, fish-sauce amber
        chilli: {
          50: '#fef2f2',
          100: '#fee2e2',
          200: '#fecaca',
          400: '#f87171',
          500: '#ef4444',
          600: '#dc2626',
          700: '#b91c1c',
          800: '#991b1b',
        },
        lime: {
          400: '#a3e635',
          500: '#84cc16',
          600: '#65a30d',
        },
        fishsauce: '#c2833a',
        charcoal: '#1c1917',
      },
      fontFamily: {
        sans: ['"Noto Sans Thai"', 'Inter', 'system-ui', 'sans-serif'],
      },
      keyframes: {
        'pulse-slow': { '0%,100%': { opacity: 1 }, '50%': { opacity: 0.6 } },
      },
      animation: { 'pulse-slow': 'pulse-slow 2s ease-in-out infinite' },
    },
  },
  plugins: [],
};
