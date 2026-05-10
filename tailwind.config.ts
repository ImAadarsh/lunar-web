import type { Config } from "tailwindcss";

const config: Config = {
  content: ["./src/pages/**/*.{js,ts,jsx,tsx,mdx}", "./src/components/**/*.{js,ts,jsx,tsx,mdx}", "./src/app/**/*.{js,ts,jsx,tsx,mdx}"],
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
    },
  },
  plugins: [],
};

export default config;
