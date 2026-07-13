import type { Config } from "tailwindcss";
const config: Config = {
  darkMode: "class",
  content: ["./app/**/*.{ts,tsx}", "./components/**/*.{ts,tsx}"],
  theme: {
    extend: {
      colors: {
        bg:       "var(--bg)",
        card:     "var(--card)",
        card2:    "var(--card2)",
        border:   "var(--border)",
        txt:      "var(--txt)",
        sub:      "var(--sub)",
        muted:    "var(--muted)",
        accent:   "#10B981",
        danger:   "#EF4444",
        warn:     "#F59E0B",
      },
      borderRadius: { xl2: "1.125rem", xl3: "1.5rem" },
      fontSize: {
        "2xs": ["10px", "14px"],
        xs:    ["11px", "16px"],
        sm:    ["12px", "17px"],
        base:  ["13px", "19px"],
        lg:    ["15px", "22px"],
        xl:    ["17px", "24px"],
        "2xl": ["20px", "28px"],
        "3xl": ["26px", "34px"],
      },
    },
  },
  plugins: [],
};
export default config;
