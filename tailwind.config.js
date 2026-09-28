/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        brand: {
          blue: '#0A6CF5',
          darkBlue: '#0049B7',
          emerald: '#00D09C',
          darkEmerald: '#008764',
          slate: '#0F172A',
          card: '#1E293B',
        }
      }
    },
  },
  plugins: [],
}
