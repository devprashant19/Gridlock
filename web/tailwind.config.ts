import type { Config } from "tailwindcss";

const config: Config = {
  darkMode: "class",
  content: [
    "./app/**/*.{js,ts,jsx,tsx,mdx}",
    "./components/**/*.{js,ts,jsx,tsx,mdx}",
    "./lib/**/*.{js,ts,jsx,tsx,mdx}",
  ],
  theme: {
    extend: {
      colors: {
        grid: {
          900: "#0b0e14",
          800: "#141824",
          700: "#1e2436",
          600: "#2b3248",
          accent: "#7c3aed",
          monad: "#836ef9",
          pass: "#10b981",
          degraded: "#f59e0b",
          fail: "#ef4444",
        },
      },
    },
  },
  plugins: [],
};
export default config;
