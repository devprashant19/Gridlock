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
        obsidian: "#06080D",
        titanium: "#0E121B",
        surface: "#141A26",
        borderline: "#1E2638",
        grid: {
          950: "#06080D",
          900: "#0b0e14",
          850: "#10141f",
          800: "#141824",
          750: "#192030",
          700: "#1e2436",
          650: "#242c42",
          600: "#2b3248",
          accent: "#7c3aed",
          monad: "#836ef9",
          cyan: "#00f5d4",
          pass: "#10b981",
          degraded: "#f59e0b",
          fail: "#ff0055",
        },
      },
      keyframes: {
        radar: {
          "0%": { transform: "rotate(0deg)" },
          "100%": { transform: "rotate(360deg)" },
        },
        pulseGlow: {
          "0%, 100%": { opacity: "0.4", filter: "drop-shadow(0 0 4px rgba(131, 110, 249, 0.4))" },
          "50%": { opacity: "1", filter: "drop-shadow(0 0 12px rgba(131, 110, 249, 0.8))" },
        },
        wavePulse: {
          "0%, 100%": { transform: "scaleY(1)" },
          "50%": { transform: "scaleY(1.4)" },
        },
        scanLine: {
          "0%": { transform: "translateY(-100%)" },
          "100%": { transform: "translateY(1000%)" },
        },
        depthBreathe: {
          "0%, 100%": { opacity: "0.85" },
          "50%": { opacity: "1" },
        },
        slashAlert: {
          "0%, 100%": { backgroundColor: "rgba(255, 0, 85, 0.15)", borderColor: "rgba(255, 0, 85, 0.4)" },
          "50%": { backgroundColor: "rgba(255, 0, 85, 0.35)", borderColor: "rgba(255, 0, 85, 0.9)" },
        },
        fadeIn: {
          "0%": { opacity: "0", transform: "translateY(6px)" },
          "100%": { opacity: "1", transform: "translateY(0)" },
        },
      },
      animation: {
        radar: "radar 4s linear infinite",
        "pulse-glow": "pulseGlow 2.5s ease-in-out infinite",
        waveform: "wavePulse 1.8s ease-in-out infinite",
        scan: "scanLine 4s linear infinite",
        breathe: "depthBreathe 2s ease-in-out infinite",
        "slash-alert": "slashAlert 0.8s ease-in-out infinite",
        "fade-in": "fadeIn 0.25s ease-out forwards",
      },
    },
  },
  plugins: [],
};

export default config;
