import type { Config } from "tailwindcss";

const config: Config = {
  content: ["./app/**/*.{ts,tsx}", "./components/**/*.{ts,tsx}"],
  theme: {
    extend: {
      colors: {
        base: "#0B0E11",
        surface: "#12161C",
        surface2: "#181D25",
        border: "#232933",
        accent: "#22D3A8",
        danger: "#F04452",
        warn: "#F0B429",
        muted: "#8A94A6",
      },
      borderRadius: {
        xl2: "1.25rem",
      },
    },
  },
  plugins: [],
};
export default config;
