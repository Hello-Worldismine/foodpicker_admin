/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{js,ts,jsx,tsx}'],
  theme: {
    extend: {
      colors: {
        primary: '#22A06B',
        'primary-light': '#E9F8F1',
        'primary-dark': '#1a7d52',
        charcoal: '#1F2933',
        'soft-gray': '#F5F6F7',
        'warm-orange': '#FF8A3D',
        'alert-red': '#E5484D',
      },
    },
  },
  plugins: [],
}

