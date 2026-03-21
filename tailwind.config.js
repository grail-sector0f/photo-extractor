/** @type {import('tailwindcss').Config} */
module.exports = {
  // Include all entrypoint files so Tailwind's purge step doesn't strip used classes
  content: ['./entrypoints/**/*.{html,ts,tsx}'],
  theme: {
    extend: {
      colors: {
        // MD3 Primary — blue action color used for buttons, rings, and interactive states
        'primary': '#1A73E8',
        'on-primary': '#FFFFFF',
        'primary-container': '#D3E3FD',
        'on-primary-container': '#062E6F',
        // MD3 Secondary — muted grey for secondary UI elements and badges
        'secondary': '#5F6368',
        'on-secondary': '#FFFFFF',
        'secondary-container': '#E8EAED',
        'on-secondary-container': '#3C4043',
        'secondary-fixed': '#E8EAED',
        // MD3 Tertiary — green used for selected-image checkmarks
        'tertiary': '#1E8E3E',
        'on-tertiary': '#FFFFFF',
        'tertiary-container': '#CEEAD6',
        'on-tertiary-container': '#0D652D',
        // MD3 Surface — background layers from lowest (white) to highest (light grey)
        'surface': '#FFFFFF',
        'on-surface': '#202124',
        'on-surface-variant': '#5F6368',
        'surface-container-lowest': '#FFFFFF',
        'surface-container-low': '#F8F9FA',
        'surface-container': '#F1F3F4',
        'surface-container-high': '#E8EAED',
        // MD3 Outline — border and divider colors
        'outline': '#DADCE0',
        'outline-variant': '#E8EAED',
        // MD3 Error — destructive actions and validation errors
        'error': '#D93025',
        'on-error': '#FFFFFF',
      },
      fontFamily: {
        // Manrope: headings, labels, and the download button (bundled in public/fonts/)
        'manrope': ['Manrope', 'system-ui', 'sans-serif'],
        // Inter: body text, inputs, and small labels (bundled in public/fonts/)
        'inter': ['Inter', 'system-ui', 'sans-serif'],
      },
      borderRadius: {
        // Matches MD3 shape scale used in the mockup
        'lg': '0.5rem',
        'xl': '0.75rem',
        '2xl': '1rem',
      },
    },
  },
  plugins: [],
};
