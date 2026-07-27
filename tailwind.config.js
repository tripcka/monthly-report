/** @type {import('tailwindcss').Config} */
module.exports = {
  content: [
    "./app/**/*.{js,jsx}",
    "./components/**/*.{js,jsx}",
    "./lib/**/*.{js,jsx}",
  ],
  theme: {
    extend: {
      colors: {
        navy: "#1B1B2F",
        orange: "#E8562C",
        card: "#F3EFE9",
        graytxt: "#4B5563",
        muted: "#9CA3AF",
        lightgray: "#E5E2DD",
      },
      fontFamily: {
        sans: ["Noto Sans KR", "sans-serif"],
      },
    },
  },
  plugins: [],
};
