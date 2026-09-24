import type { Config } from "tailwindcss";

const config: Config = {
  content: ["./app/**/*.{ts,tsx}", "./components/**/*.{ts,tsx}"],
  theme: {
    extend: {
      colors: {
        base: "#0D0F12",
        surface: "#16191D",
        surfaceRaised: "#1C2025",
        border: "#262B31",
        text: {
          DEFAULT: "#ECEDEE",
          muted: "#8B929B",
          faint: "#565C64",
        },
        signal: {
          teal: "#3ADBC4",
          tealDim: "#1E3D38",
          amber: "#FF6B4A",
          amberDim: "#402620",
          red: "#F2545B",
          redDim: "#3A2124",
        },
      },
      fontFamily: {
        display: ["var(--font-space-grotesk)", "sans-serif"],
        sans: ["var(--font-inter)", "sans-serif"],
      },
      borderRadius: {
        panel: "10px",
        control: "6px",
      },
    },
  },
  plugins: [],
};

export default config;
