/** @type {import('tailwindcss').Config} */
export default {
  content: ["./index.html", "./src/**/*.{ts,tsx}"],
  theme: {
    extend: {
      colors: {
        slate: {
          950: "#0f172a",
        },
        clinical: {
          teal: "#0e9aa7",
          blue: "#3f88c5",
          amber: "#f5a623",
        },
      },
      fontFamily: {
        sans: ["'Public Sans'", "'Source Sans 3'", "sans-serif"],
      },
    },
  },
  plugins: [],
};
