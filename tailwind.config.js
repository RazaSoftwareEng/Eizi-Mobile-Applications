/** @type {import('tailwindcss').Config} */
module.exports = {
  content: ['./src/**/*.{js,jsx,ts,tsx}'],
  presets: [require('nativewind/preset')],
  theme: {
    extend: {
      colors: {
        // Primary — deep teal: calm, clean, trustworthy (home services)
        brand: {
          50: '#EEF9F7',
          100: '#D5F0EB',
          200: '#A9E0D6',
          300: '#73C9BA',
          400: '#3FAE9C',
          500: '#14917F',
          600: '#0E7A6B',
          700: '#0B6358',
          800: '#0A4F47',
          900: '#083B36',
        },
        // Accent — warm amber for prices, highlights and promos
        accent: {
          50: '#FFF8EB',
          100: '#FEEBC8',
          400: '#FBBF24',
          500: '#F59E0B',
          600: '#D97706',
          700: '#B45309',
        },
        surface: '#F5F7FA',
        ink: '#0F172A',
        line: '#E2E8F0',
      },
    },
  },
  plugins: [],
};
