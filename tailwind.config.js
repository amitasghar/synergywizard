/** @type {import('tailwindcss').Config} */
export default {
  content: ["./index.html", "./src/**/*.{ts,tsx}"],
  theme: {
    extend: {
      colors: {
        background: "#0d0f12",
        accent: "#c8a96e",
        tagMechanic: "#2563eb",
        tagDamage: "#ef4444",
        tagClass: "#16a34a",
      },
      fontFamily: {
        sans: ["Inter", "ui-sans-serif", "system-ui"],
        mono: ["ui-monospace", "SFMono-Regular", "monospace"],
      },
      boxShadow: {
        amberGlow: "0 0 0 1px rgba(200,169,110,0.4), 0 0 12px rgba(200,169,110,0.25)",
      },
      keyframes: {
        pulseRing: {
          "0%, 100%": { boxShadow: "0 0 0 0 rgba(200,169,110,0.6)" },
          "50%": { boxShadow: "0 0 0 8px rgba(200,169,110,0)" },
        },
      },
      animation: { pulseRing: "pulseRing 1.6s ease-out infinite" },
    },
  },
  plugins: [],
};
