/** @type {import('tailwindcss').Config} */
module.exports = {
  content: ["./app/**/*.{js,ts,jsx,tsx}", "./components/**/*.{js,ts,jsx,tsx}"],
  theme: {
    extend: {
      colors: {
        clinical: {
          blue: "#0d5c72",
          deep: "#083f4f",
          teal: "#1b8a7a",
        },
        ink: "#0e2233",
      },
      fontFamily: {
        mono: ["IBM Plex Mono", "SFMono-Regular", "monospace"],
        sans: ["IBM Plex Sans", "Segoe UI", "system-ui", "sans-serif"],
      },
    },
  },
  plugins: [],
};
