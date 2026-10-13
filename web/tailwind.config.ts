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
        neo: {
          yellow: "#FEF08A",
          yellowDark: "#FDE047",
          blue: "#BAE6FD",
          blueLight: "#E0F2FE",
          green: "#86EFAC",
          greenLight: "#DCFCE7",
          pink: "#F472B6",
          pinkLight: "#FCE7F3",
          cream: "#FFFDF7",
          surface: "#FFFFFF",
          border: "#000000",
          card: "#FFFFFF",
        },
        obsidian: "#000000",
        titanium: "#18181B",
        surface: "#FFFFFF",
        grid: {
          accent: "#000000",
          monad: "#836EF9",
          cyan: "#00F5D4",
          pass: "#16A34A",
          degraded: "#D97706",
          fail: "#DC2626",
        },
      },
      boxShadow: {
        neo: "4px 4px 0px 0px #000000",
        "neo-sm": "2px 2px 0px 0px #000000",
        "neo-lg": "6px 6px 0px 0px #000000",
        "neo-xl": "8px 8px 0px 0px #000000",
        "neo-hover": "2px 2px 0px 0px #000000",
      },
      borderRadius: {
        xs: "2px",
      },
    },
  },
  plugins: [],
};

export default config;
