const { heroui } = require("@heroui/theme");
/** @type {import('tailwindcss').Config} */
module.exports = {
  darkMode: ["class"],
  content: [
    "./pages/**/*.{js,ts,jsx,tsx,mdx}",
    "./components/**/*.{js,ts,jsx,tsx,mdx}",
    "./app/**/*.{js,ts,jsx,tsx,mdx}",
    "./node_modules/@heroui/theme/dist/components/avatar.js",
  ],
  theme: {
    extend: {
      colors: {
        background: "hsl(var(--background))",
        foreground: "hsl(var(--foreground))",
        card: {
          DEFAULT: "hsl(var(--card))",
          foreground: "hsl(var(--card-foreground))",
        },
        popover: {
          DEFAULT: "hsl(var(--popover))",
          foreground: "hsl(var(--popover-foreground))",
        },
        primary: {
          DEFAULT: "hsl(var(--primary))",
          foreground: "hsl(var(--primary-foreground))",
        },
        secondary: {
          DEFAULT: "hsl(var(--secondary))",
          foreground: "hsl(var(--secondary-foreground))",
        },
        muted: {
          DEFAULT: "hsl(var(--muted))",
          foreground: "hsl(var(--muted-foreground))",
        },
        accent: {
          DEFAULT: "hsl(var(--accent))",
          foreground: "hsl(var(--accent-foreground))",
        },
        destructive: {
          DEFAULT: "hsl(var(--destructive))",
          foreground: "hsl(var(--destructive-foreground))",
        },
        border: "hsl(var(--border))",
        input: "hsl(var(--input))",
        ring: "hsl(var(--ring))",
        chart: {
          1: "hsl(var(--chart-1))",
          2: "hsl(var(--chart-2))",
          3: "hsl(var(--chart-3))",
          4: "hsl(var(--chart-4))",
          5: "hsl(var(--chart-5))",
        },
        // Dashboard pilot (Employee Map, 2026-11-25): brand orange as a thin accent (rules, markers),
        // with a dark-mode value in globals.css. Never for filled boxes or large backgrounds.
        "accent-brand": "hsl(var(--accent-brand) / <alpha-value>)",
        // BB-145 — public site (landing, nav, footer). Not used inside the dashboard.
        brand: {
          DEFAULT: "#F68525", // buttons, accents (black text on it)
          hover: "#FF9A45",
          ink: "#1A1A1A", // headings and body text
          link: "#B4440A", // orange that passes contrast on white
          "link-hover": "#7C2D12",
          band: "#F2F2F2", // grey sections
          stage: "#121212", // dark backdrop behind product screens
          footer: "#111111",
        },
        // sidebar: {
        // 	DEFAULT: 'hsl(var(--sidebar-background))',
        // 	foreground: 'hsl(var(--sidebar-foreground))',
        // 	primary: 'hsl(var(--sidebar-primary))',
        // 	'primary-foreground': 'hsl(var(--sidebar-primary-foreground))',
        // 	accent: 'hsl(var(--sidebar-accent))',
        // 	'accent-foreground': 'hsl(var(--sidebar-accent-foreground))',
        // 	border: 'hsl(var(--sidebar-border))',
        // 	ring: 'hsl(var(--sidebar-ring))'
        // }
      },
      borderRadius: {
        lg: "var(--radius)",
        md: "calc(var(--radius) - 2px)",
        sm: "calc(var(--radius) - 4px)",
        brand: "2px", // BB-145 public site corners; also the Employee Map pilot (dashboard)
      },
      fontFamily: {
        // BB-145 — loaded with next/font in app/layout.jsx. font-display is also used for
        // page titles in the Employee Map pilot (dashboard).
        landing: ["var(--font-inter)", "system-ui", "sans-serif"],
        display: ["var(--font-inter-tight)", "var(--font-inter)", "sans-serif"],
      },
      keyframes: {
        "accordion-down": {
          from: {
            height: "0",
          },
          to: {
            height: "var(--radix-accordion-content-height)",
          },
        },
        "accordion-up": {
          from: {
            height: "var(--radix-accordion-content-height)",
          },
          to: {
            height: "0",
          },
        },
        "rail-fill": {
          from: { width: "0%" },
          to: { width: "100%" },
        },
      },
      animation: {
        "accordion-down": "accordion-down 0.2s ease-out",
        "accordion-up": "accordion-up 0.2s ease-out",
        "rail-fill": "rail-fill 7s linear both", // BB-145 hero rail progress

      },
    },
  },
  plugins: [require("tailwindcss-animate"), heroui()],
};