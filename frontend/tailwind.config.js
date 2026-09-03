/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        primary: {
          DEFAULT: '#1A7A45', // Green
          dark: '#0B3D2E',    // Dark Green
          darker: '#072419',  // Darker Green
          light: '#E6F4EC',   // Light Green
        },
        amber: {
          DEFAULT: '#F59E0B',
          light: '#FEF3C7',
          dark: '#D97706',
        },
        cream: '#FAF8F4',
        text: '#111827',
        muted: '#6B7280',
        border: '#E5E7EB',
      },
      fontFamily: {
        outfit: ['Outfit', 'sans-serif'],
        inter: ['Inter', 'sans-serif'],
        mono: ['DM Mono', 'monospace'],
      }
    },
  },
  plugins: [],
}
