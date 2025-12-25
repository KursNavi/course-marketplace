/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        // Official Brand Colors [Source: 83]
        primary: '#FA6E28',      // Orange (Main)
        primaryLight: '#FFF0EB', // Light Orange (Backgrounds)
        secondary: '#78B3CE',    // Blue
        secondaryLight: '#C8E6F0', // Light Blue
        beige: '#FAF5F0',        // Light Beige (Main Background)
        dark: '#333333',         // Black/Grey (Text)
        grey: '#EBEBEB',         // Light Grey (Borders)
      },
      fontFamily: {
        // Official Font Pair [Source: 156]
        sans: ['"Hind Madurai"', 'sans-serif'], // Body text
        heading: ['"Open Sans"', 'sans-serif'], // Headings
      }
    },
  },
  plugins: [],
}