/** @type {import('tailwindcss').Config} */
module.exports = {
  content: ['./app/**/*.{js,jsx,ts,tsx}', './components/**/*.{js,jsx,ts,tsx}'],
  presets: [require('nativewind/preset')],
  theme: {
    extend: {
      colors: {
        bloodline: {
          50: '#fdf4f3',
          100: '#fce8e6',
          200: '#f9d4d1',
          300: '#f4b3ad',
          400: '#ec857b',
          500: '#de5c50',
          600: '#ca4034',
          700: '#a93329',
          800: '#8c2e26',
          900: '#752c26',
          950: '#3f1310',
        },
      },
    },
  },
  plugins: [],
};
