import type { Config } from "tailwindcss";

const config: Config = {
  content: [
    "./app/**/*.{js,ts,jsx,tsx,mdx}",
    "./components/**/*.{js,ts,jsx,tsx,mdx}",
    "./lib/**/*.{js,ts,jsx,tsx,mdx}"
  ],
  theme: {
    extend: {
      colors: {
        ink: "#09111f",
        panel: "rgba(9, 17, 31, 0.88)",
        tram: "#f97316",
        bus: "#38bdf8",
        trolleybus: "#22c55e"
      },
      boxShadow: {
        panel: "0 20px 60px rgba(0, 0, 0, 0.38)"
      }
    }
  },
  plugins: []
};

export default config;
