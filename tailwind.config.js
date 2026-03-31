/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{js,ts,jsx,tsx}'],
  darkMode: 'class',
  theme: {
    extend: {
      colors: {
        dark: {
          bg: 'rgb(var(--color-bg-rgb, 15 15 15) / <alpha-value>)',
          card: 'rgb(var(--color-card-rgb, 26 26 26) / <alpha-value>)',
          border: 'rgb(var(--color-border-rgb, 42 42 42) / <alpha-value>)',
          hover: 'rgb(var(--color-hover-rgb, 37 37 37) / <alpha-value>)',
        },
        accent: 'rgb(var(--color-accent-rgb, 99 102 241) / <alpha-value>)',
      },
      textColor: {
        base: 'rgb(var(--color-text-rgb, 243 244 246) / <alpha-value>)',
        sub: 'rgb(var(--color-text-sub-rgb, 156 163 175) / <alpha-value>)',
      },
    },
  },
  plugins: [],
};
