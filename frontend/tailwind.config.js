/** @type {import('tailwindcss').Config} */
export default {
  content: ["./index.html", "./src/**/*.{js,ts,jsx,tsx}"],
  theme: {
    extend: {
      colors: {
        pitch: { 50: "#f0fdf4", 100: "#dcfce7", 600: "#16a34a", 700: "#15803d", 900: "#14532d" },
        gold: { 400: "#fbbf24", 500: "#f59e0b", 600: "#d97706" },
      },
    },
  },
  plugins: [],
};
