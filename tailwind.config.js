/** @type {import('tailwindcss').Config} */
module.exports = {
  // Include all entrypoint files so Tailwind's purge step doesn't strip used classes
  content: ['./entrypoints/**/*.{html,ts,tsx}'],
  theme: { extend: {} },
  plugins: [],
};
