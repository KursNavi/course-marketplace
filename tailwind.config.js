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

        // "Swiss Editorial" restyle tokens (additive) — originally homepage-only, now also used
        // on the search page (SearchPageView.jsx) for the "Bereiche entdecken" browse context.
        // Not part of SEGMENT_CONFIG, which still drives the rest of the site's segment colors.
        petrol: '#183642',
        petrolDark: '#0f232b',
        segBeruflich: '#347FA0', // Beruflich bleibt blau
        segKinder: '#39835B',    // Kinder & Jugend bleibt grün
        // Privat & Hobby bleibt orange — nutzt weiterhin den bestehenden `primary`-Token.
        borderSubtle: '#EBE4DE', // etwas wärmerer Rahmenton als `grey`, fürs Header/Hero-Umfeld
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