/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  darkMode: 'class',
  theme: {
    extend: {
      colors: {
        content: 'var(--text)',
        muted: 'var(--muted)',
        field: 'var(--field)',
        hover: 'var(--hover)',
        subtle: 'var(--border)',
        strong: 'var(--border-strong)',
        accent: 'var(--accent)',
        'accent-soft': 'var(--accent-soft)',
        'on-accent': 'var(--on-accent)',
        success: 'var(--success)',
        warning: 'var(--warning)',
        danger: 'var(--danger)',
        sapphire: {
          50: '#eef8ff',
          100: '#d8efff',
          200: '#b9e3fe',
          300: '#89d2fe',
          400: '#52b7fc',
          500: '#2b97f7',
          600: '#1479eb',
          700: '#0f61d5',
          800: '#134faa',
          900: '#154486',
          950: '#0d2b56',
        },
        island: {
          dark: '#0a0b0e',
          glass: 'rgba(15, 17, 23, 0.75)',
          border: 'rgba(255, 255, 255, 0.12)',
          card: 'rgba(25, 28, 38, 0.65)',
        }
      },
      backdropBlur: {
        'xs': '2px',
        '2xl': '24px',
        '3xl': '32px',
      },
      boxShadow: {
        'island': '0 20px 40px -15px rgba(0, 0, 0, 0.6), 0 0 1px 1px rgba(255, 255, 255, 0.12) inset',
        'glow': '0 0 25px -5px rgba(43, 151, 247, 0.4)',
        'notch': '0 12px 36px rgba(0, 0, 0, 0.8), 0 0 0 1px rgba(255, 255, 255, 0.08)',
      },
    },
  },
  plugins: [],
}
