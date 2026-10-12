/** @type {import('tailwindcss').Config} */
module.exports = {
  darkMode: ["class"],
  content: ["./src/**/*.{js,jsx,ts,tsx}"],
  theme: {
    extend: {
      colors: {
        primary: {
          DEFAULT: "#FF6B00",
          foreground: "#FFFFFF"
        },
        secondary: {
          DEFAULT: "#D92828",
          foreground: "#FFFFFF"
        },
        background: "#FFF8F0",
        surface: "#FFFFFF",
        text: {
          DEFAULT: "#2D241E",
          muted: "#6B5D54"
        },
        accent: {
          DEFAULT: "#FACC15",
          foreground: "#2D241E"
        },
        success: "#10B981"
      },
      fontFamily: {
        heading: ["'Bebas Neue'", "sans-serif"],
        body: ["'Manrope'", "sans-serif"]
      },
      borderRadius: {
        lg: "var(--radius)",
        md: "calc(var(--radius) - 2px)",
        sm: "calc(var(--radius) - 4px)"
      }
    }
  },
  plugins: [require("tailwindcss-animate")]
};