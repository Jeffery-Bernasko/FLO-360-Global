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
          DEFAULT: "#14532d",
          hover: "#166534",
          border: "#1a7a3d",
          text: "#a7d5b8",
          active: "#ffffff",
          accent: "#E88AAE",
        },
        brand: {
          green: "#1B6B3A",
          "green-deep": "#14532d",
          "green-light": "#16a34a",
          pink: "#E88AAE",
          "pink-light": "#F2A0BC",
          "pink-pale": "#fce4ec",
        },
      },
    },
  },
  plugins: [],
};

export default config;
