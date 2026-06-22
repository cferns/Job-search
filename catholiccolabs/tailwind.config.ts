import type { Config } from "tailwindcss";

const config: Config = {
  content: [
    "./app/**/*.{ts,tsx}",
    "./components/**/*.{ts,tsx}",
  ],
  theme: {
    extend: {
      fontFamily: {
        serif: ["var(--font-serif)", "Georgia", "serif"],
        sans: ["var(--font-sans)", "system-ui", "sans-serif"],
      },
      colors: {
        ink: {
          DEFAULT: "#1f2a44",
          soft: "#475569",
        },
        navy: {
          DEFAULT: "#1e2a4a",
          dark: "#172038",
        },
        gold: "#c89b3c",
      },
    },
  },
  plugins: [],
};

export default config;
