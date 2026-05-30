/** @type {import('tailwindcss').Config} */
module.exports = {
  content: ["./src/**/*.{js,ts,jsx,tsx,mdx}"],
  theme: {
    extend: {
      colors: {
        arena: {
          50: "#fef2f2",
          100: "#fde3e3",
          500: "#ef4444",
          600: "#dc2626",
          700: "#b91c1c",
          800: "#1a1a2e",
          900: "#0f0f23",
          950: "#0a0a1a",
        },
        gold: "#ffd700",
        neon: "#39ff14",
      },
      fontFamily: {
        battle: ["Barlow Condensed", "var(--font-battle)", "Impact", "sans-serif"],
      },
      animation: {
        "pulse-glow": "pulseGlow 2s ease-in-out infinite",
        "bounce-in": "bounceIn 0.5s cubic-bezier(0.68, -0.55, 0.265, 1.55)",
        "slide-up": "slideUp 0.4s ease-out",
        "countdown": "countdown 1s linear infinite",
      },
      keyframes: {
        pulseGlow: {
          "0%, 100%": { boxShadow: "0 0 20px rgba(239, 68, 68, 0.4)" },
          "50%": { boxShadow: "0 0 40px rgba(239, 68, 68, 0.8)" },
        },
        bounceIn: {
          "0%": { transform: "scale(0.3)", opacity: "0" },
          "50%": { transform: "scale(1.05)" },
          "70%": { transform: "scale(0.9)" },
          "100%": { transform: "scale(1)", opacity: "1" },
        },
        slideUp: {
          "0%": { transform: "translateY(20px)", opacity: "0" },
          "100%": { transform: "translateY(0)", opacity: "1" },
        },
        countdown: {
          "0%": { transform: "scale(1)" },
          "50%": { transform: "scale(1.1)" },
          "100%": { transform: "scale(1)" },
        },
      },
    },
  },
  plugins: [],
};
