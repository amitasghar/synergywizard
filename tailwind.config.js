/** @type {import('tailwindcss').Config} */
// Palette sampled from the banner art: night-sky navy, wizard violet, logo gold, tagline teal.
export default {
  content: ["./index.html", "./src/**/*.{ts,tsx}"],
  theme: {
    extend: {
      colors: {
        ink: {
          950: "#070a1c",
          900: "#0d1230",
          850: "#121840",
          800: "#19204d",
          700: "#262e63",
        },
        text: "#ece9f7",
        muted: "#a8abcf",
        faint: "#7277a3",
        gold: { DEFAULT: "#e8c46f", soft: "#2b2412" },
        violet: { DEFAULT: "#a58bff", deep: "#6e51df", soft: "#1e1847" },
        teal: { DEFAULT: "#6fdbe6" },
        stat: "#a9b8ff",
      },
      fontFamily: {
        sans: ["Inter", "ui-sans-serif", "system-ui", "sans-serif"],
        display: ["Cinzel", "Georgia", "serif"],
      },
    },
  },
  plugins: [],
};
