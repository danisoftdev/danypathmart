/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{js,jsx}'],
  darkMode: 'class',
  theme: {
    extend: {
      colors: {
        'brand-green': '#2C7A4B',
        'brand-gold': '#F59E0B',
        'brand-red': '#EF4444',
        'brand-emerald': '#10B981',
        'brand-orange': '#F97316',
        'brand-purple': '#7C3AED',
        'brand-rose': '#F43F5E',
        'brand-light': '#FFF9F3',
        'brand-dark': '#121212',
        'brand-surface': '#FFFFFF',
        'brand-surface-dark': '#1E1E1E',
      },
      keyframes: {
        'pulse-ring': {
          '0%,100%': { opacity: '1' },
          '50%': { opacity: '0.4' },
        },
      },
    },
  },
  plugins: [],
};
