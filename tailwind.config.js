/** @type {import('tailwindcss').Config} */
module.exports = {
  // src qovluğunu bura əlavə edirik:
  content: [
    "./src/app/**/*.{js,jsx,ts,tsx}",
    "./src/components/**/*.{js,jsx,ts,tsx}"
  ],
  presets: [require("nativewind/preset")],
  theme: {
    extend: {},
  },
  plugins: [],
}