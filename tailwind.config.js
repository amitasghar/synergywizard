/** @type {import('tailwindcss').Config} */
// Palette matches 90sGamer.com (Windows 98 desktop via 98.css).
export default {
  content: ["./index.html", "./src/**/*.{ts,tsx}"],
  corePlugins: { preflight: false },
  theme: {
    extend: {
      colors: {
        teal: "#008080",
        gray: "#c0c0c0",
        navy: "#000080",
        pink: "#ff2bd6",
        lime: "#39ff14",
        cyan: "#00e5ff",
        yellow: "#ffe600",
        ink: "#111",
      },
      fontFamily: {
        ui: ["Tahoma", "Verdana", "'Segoe UI'", "sans-serif"],
        prose: ["Verdana", "Tahoma", "Geneva", "sans-serif"],
        pixel: ["'Press Start 2P'", "monospace"],
      },
    },
  },
  plugins: [],
};
