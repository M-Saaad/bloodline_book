/** @type {import('tailwindcss').Config} */
module.exports = {
  content: ['./app/**/*.{js,jsx,ts,tsx}', './components/**/*.{js,jsx,ts,tsx}'],
  presets: [require('nativewind/preset')],
  theme: {
    extend: {
      colors: {
        // Barn red. 600 is the brand and action color, 900 is the deep header red.
        // Red is never "stop": use `stop` (near black) for anything that blocks a sale.
        bloodline: {
          50: '#fdf1ee',
          100: '#fbe3dd',
          200: '#f5c6bb',
          300: '#e8977f',
          400: '#cf6548',
          500: '#bc4a30',
          600: '#a52f1a',
          700: '#8a2615',
          800: '#6f1f11',
          900: '#5e1a0e',
          950: '#35100a',
        },
        paper: '#f6f2ee',
        ink: '#1f1512',
        stop: '#1d1b1a',
        // Warm grays instead of cool Tailwind grays. Text grays are darker than
        // the defaults so small text stays readable in sunlight.
        gray: {
          50: '#f6f2ee',
          100: '#eee6df',
          200: '#e6ddd6',
          300: '#d9cec6',
          400: '#a89b94',
          500: '#5a4b46',
          600: '#4a3c37',
          700: '#3a2d29',
          800: '#2b201c',
          900: '#1f1512',
        },
      },
    },
  },
  plugins: [],
};
