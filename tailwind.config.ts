import type { Config } from "tailwindcss";

const config: Config = {
  content: ["./src/app/**/*.{ts,tsx}", "./src/components/**/*.{ts,tsx}"],
  theme: {
    extend: {
      fontFamily: {
        sans: ["DM Sans", "system-ui", "sans-serif"],
        display: ["Syne", "system-ui", "sans-serif"],
        mono: ["JetBrains Mono", "monospace"],
      },
      colors: {
        surface: {
          DEFAULT: "#f6f5f1",
          card: "#ffffff",
          border: "#e4e3de",
          "border-strong": "#d1d0cb",
        },
        sidebar: {
          DEFAULT: "#111318",
          hover: "#1a1d25",
          border: "#1e2130",
          text: "#94a3b8",
          active: "#ffffff",
          accent: "#2dd4bf",
        },
      },
    },
  },
  plugins: [],
};

export default config;
