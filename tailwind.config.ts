import type { Config } from "tailwindcss";

const config: Config = {
  content: [
    "./src/pages/**/*.{js,ts,jsx,tsx,mdx}",
    "./src/components/**/*.{js,ts,jsx,tsx,mdx}",
    "./src/app/**/*.{js,ts,jsx,tsx,mdx}",
  ],
  theme: {
    extend: {
      colors: {
        lunar: {
          50: "#edf6fa",
          100: "#d7eaf3",
          200: "#b4d5e8",
          300: "#80b5d4",
          400: "#4690bc",
          500: "#2b739f",
          600: "#1e5c84",
          700: "#194c6b",
          800: "#183f58",
          900: "#18354a",
          950: "#082334",
        },
      },
      fontFamily: {
        sans: ["var(--font-sans)", "system-ui", "sans-serif"],
        display: ["var(--font-display)", "var(--font-sans)", "system-ui", "sans-serif"],
      },
      boxShadow: {
        card: "0 1px 2px rgba(8, 35, 52, 0.04), 0 8px 24px rgba(8, 35, 52, 0.06)",
        "card-hover": "0 4px 12px rgba(8, 35, 52, 0.08), 0 16px 40px rgba(8, 35, 52, 0.1)",
        glow: "0 0 0 1px rgba(70, 144, 188, 0.2), 0 8px 32px rgba(70, 144, 188, 0.15)",
        sidebar: "4px 0 24px rgba(8, 35, 52, 0.12)",
      },
      keyframes: {
        "fade-up": {
          "0%": { opacity: "0", transform: "translateY(10px)" },
          "100%": { opacity: "1", transform: "translateY(0)" },
        },
        "fade-in": {
          "0%": { opacity: "0" },
          "100%": { opacity: "1" },
        },
        shimmer: {
          "100%": { transform: "translateX(100%)" },
        },
        "pulse-soft": {
          "0%": { opacity: "1" },
          "50%": { opacity: "0.65" },
          "100%": { opacity: "1" },
        },
      },
      animation: {
        "fade-up": "fade-up 0.45s cubic-bezier(0.22, 1, 0.36, 1) forwards",
        "fade-in": "fade-in 0.3s ease-out forwards",
        shimmer: "shimmer 1.8s ease-in-out infinite",
        "pulse-soft": "pulse-soft 2s ease-in-out infinite",
      },
    },
  },
  plugins: [],
};

export default config;
