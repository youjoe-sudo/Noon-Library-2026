/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{js,ts,jsx,tsx}'],
  theme: {
    extend: {
      fontFamily: {
        sans: ['var(--font-primary, Cairo)', 'system-ui', 'sans-serif'],
        serif: ['var(--font-heading, Amiri)', 'Georgia', 'serif'],
      },
      colors: {
        primary: {
          50: '#f0f9f4',
          100: '#dcf2e3',
          200: '#bbe4ca',
          300: '#8bcfa6',
          400: '#54b27e',
          500: '#2f955f',
          600: 'var(--color-primary, #1f7a4c)',
          700: 'var(--color-primary, #1f7a4c)',
          800: 'var(--color-primary, #1f7a4c)',
          900: '#13402c',
          950: '#0a2419',
        },
        accent: {
          50: '#fffbeb',
          100: '#fef3c7',
          200: '#fde68a',
          300: '#fcd34d',
          400: '#fbbf24',
          500: 'var(--color-accent, #f59e0b)',
          600: '#d97706',
          700: '#b45309',
          800: '#92400e',
          900: '#78350f',
        },
        ink: {
          50: 'var(--color-background, #f6f7f9)',
          100: '#eceef2',
          200: 'var(--color-border, #d5d9e0)',
          300: '#b0b7c4',
          400: '#8590a3',
          500: '#67738a',
          600: '#525c71',
          700: '#434b5c',
          800: '#3a414f',
          900: 'var(--color-text, #1f2430)',
          950: '#131620',
        },
      },
      boxShadow: {
        soft: '0 2px 8px -2px rgba(0,0,0,0.08), 0 4px 16px -4px rgba(0,0,0,0.06)',
        card: '0 1px 3px rgba(0,0,0,0.06), 0 8px 24px -8px rgba(0,0,0,0.08)',
      },
      keyframes: {
        'fade-in': {
          '0%': { opacity: '0', transform: 'translateY(8px)' },
          '100%': { opacity: '1', transform: 'translateY(0)' },
        },
        'slide-in': {
          '0%': { transform: 'translateX(-100%)' },
          '100%': { transform: 'translateX(0)' },
        },
        'scale-in': {
          '0%': { opacity: '0', transform: 'scale(0.95)' },
          '100%': { opacity: '1', transform: 'scale(1)' },
        },
        shimmer: {
          '0%': { backgroundPosition: '-1000px 0' },
          '100%': { backgroundPosition: '1000px 0' },
        },
      },
      animation: {
        'fade-in': 'fade-in 0.4s ease-out',
        'slide-in': 'slide-in 0.3s ease-out',
        'scale-in': 'scale-in 0.2s ease-out',
        shimmer: 'shimmer 2s infinite linear',
      },
    },
  },
  plugins: [],
};
