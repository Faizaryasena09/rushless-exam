/** @type {import('tailwindcss').Config} */
const config = {
  content: [
    './pages/**/*.{js,ts,jsx,tsx,mdx}',
    './components/**/*.{js,ts,jsx,tsx,mdx}',
    './app/**/*.{js,ts,jsx,tsx,mdx}',
  ],
  theme: {
    extend: {
      colors: {
        primary: {
          light: '#81d4fa', // A fresh, light blue
          DEFAULT: '#2196f3', // A standard blue
          dark: '#1976d2', // A darker blue
        },
        // You can add more custom colors here if needed
      },
    },
  },
  plugins: [],
};

export default config;
