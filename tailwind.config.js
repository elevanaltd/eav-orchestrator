/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        'eav-red': '#D40E43',
        'eav-green': '#4DB053',
        'eav-dark': '#241E4A',
        'eav-mid-dark': '#62187C',
        'eav-light': '#f8fafc',
        'eav-accent': '#7c3aed',
        'eav-warning': '#f59e0b',
        'eav-blue': '#3b82f6'
      },
      fontFamily: {
        sans: ['-apple-system', 'BlinkMacSystemFont', 'Segoe UI', 'Roboto', 'Oxygen', 'Ubuntu', 'sans-serif'],
      },
    },
  },
  plugins: [],
}
