/** @type {import('tailwindcss').Config} */
module.exports = {
  content: ["./app/**/*.{js,jsx,ts,tsx}", "./src/**/*.{js,jsx,ts,tsx}"],
  darkMode: "class", // 启用 class 模式（.dark）
  theme: {
    extend: {
      colors: {
        background: "oklch(0.9885 0.0052 91.4554)",
        foreground: "oklch(0.3698 0.0209 48.133)",
        card: "oklch(0.9822 0.0071 91.4717)",
        popover: "oklch(0.9885 0.0052 91.4554)",
        primary: {
          DEFAULT: "oklch(0.4341 0.0392 41.9938)",
          foreground: "oklch(1 0 0)",
        },
        secondary: {
          DEFAULT: "oklch(0.92 0.0651 74.3695)",
          foreground: "oklch(0.3499 0.0685 40.8288)",
        },
        muted: {
          DEFAULT: "oklch(0.9675 0.0079 91.4797)",
          foreground: "oklch(0.5534 0.0226 48.2913)",
        },
        accent: {
          DEFAULT: "oklch(0.9531 0.0092 91.4925)",
          foreground: "oklch(0.3698 0.0209 48.133)",
        },
        destructive: {
          DEFAULT: "oklch(0.6271 0.1936 33.339)",
          foreground: "oklch(1 0 0)",
        },
        border: "oklch(0.9389 0 0)",
        input: "oklch(0.9389 0 0)",
        ring: "oklch(0.4341 0.0392 41.9938)",
        sidebar: {
          DEFAULT: "oklch(0.9847 0.0052 91.4556)",
          foreground: "oklch(0.4175 0.0244 48.1154)",
          primary: "oklch(0.4341 0.0392 41.9938)",
          "primary-foreground": "oklch(1 0 0)",
          accent: "oklch(0.9599 0.0079 91.4804)",
          "accent-foreground": "oklch(0.4341 0.0392 41.9938)",
          border: "oklch(0.9542 0 0)",
          ring: "oklch(0.4341 0.0392 41.9938)",
        },
      },
      borderRadius: {
        sm: "calc(0.375rem - 4px)",
        md: "calc(0.375rem - 2px)",
        lg: "0.375rem",
        xl: "calc(0.375rem + 4px)",
        "2xl": "calc(0.375rem + 8px)",
        "3xl": "calc(0.375rem + 12px)",
        "4xl": "calc(0.375rem + 16px)",
      },
      fontFamily: {
        sans: ['"Inter"', '"Segoe UI"', "roboto", "sans-serif"],
        serif: ["ui-serif", "georgia", "cambria", "serif"],
        mono: ["ui-monospace", "sfmono-regular", "menlo", "monaco", "monospace"],
      },
      letterSpacing: {
        tighter: "-0.05em",
        tight: "-0.025em",
        normal: "-0.01em",
        wide: "0.025em",
        wider: "0.05em",
        widest: "0.1em",
      },
      boxShadow: {
        "2xs": "0px 1px 2px 0px hsl(0 0% 0% / 1%)",
        xs: "0px 1px 2px 0px hsl(0 0% 0% / 1%)",
        sm: "0px 1px 2px 0px hsl(0 0% 0% / 3%), 0px 1px 2px -1px hsl(0 0% 0% / 3%)",
        DEFAULT: "0px 1px 2px 0px hsl(0 0% 0% / 3%), 0px 1px 2px -1px hsl(0 0% 0% / 3%)",
        md: "0px 1px 2px 0px hsl(0 0% 0% / 3%), 0px 2px 4px -1px hsl(0 0% 0% / 3%)",
        lg: "0px 1px 2px 0px hsl(0 0% 0% / 3%), 0px 4px 6px -1px hsl(0 0% 0% / 3%)",
        xl: "0px 1px 2px 0px hsl(0 0% 0% / 3%), 0px 8px 10px -1px hsl(0 0% 0% / 3%)",
        "2xl": "0px 1px 2px 0px hsl(0 0% 0% / 7%)",
      },
    },
  },
  plugins: [],
};
