/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  darkMode: 'class',
  theme: {
    extend: {
      colors: {
        light: {
          bg: '#F5F5F5',
          text: '#1A1A1A',
          ring: '#333333',
        },
        dark: {
          bg: '#0F172A',
          text: '#F1F5F9',
          ring: '#E5E7EB',
        }
      }
    },
  },
  plugins: [],
}
