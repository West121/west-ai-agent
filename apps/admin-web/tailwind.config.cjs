/** @type {import('tailwindcss').Config} */
module.exports = {
  content: ['./index.html', './src/**/*.{ts,tsx}'],
  theme: {
    extend: {
      boxShadow: {
        soft: '0 20px 80px rgba(15, 23, 42, 0.28)',
      },
      backgroundImage: {
        'admin-grid':
          'linear-gradient(rgba(148, 163, 184, 0.10) 1px, transparent 1px), linear-gradient(90deg, rgba(148, 163, 184, 0.10) 1px, transparent 1px)',
      },
    },
  },
  plugins: [],
};
