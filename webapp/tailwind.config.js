/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{js,ts,jsx,tsx}'],
  theme: {
    extend: {
      colors: {
        // Telegram theme-aware colors via CSS variables
        tg: {
          bg: 'var(--tg-theme-bg-color, #ffffff)',
          text: 'var(--tg-theme-text-color, #000000)',
          hint: 'var(--tg-theme-hint-color, #999999)',
          link: 'var(--tg-theme-link-color, #2481cc)',
          button: 'var(--tg-theme-button-color, #2481cc)',
          'button-text': 'var(--tg-theme-button-text-color, #ffffff)',
          secondary: 'var(--tg-theme-secondary-bg-color, #f0f0f0)',
          header: 'var(--tg-theme-header-bg-color, #2481cc)',
          accent: 'var(--tg-theme-accent-text-color, #2481cc)',
          section: 'var(--tg-theme-section-bg-color, #ffffff)',
          'section-header': 'var(--tg-theme-section-header-text-color, #6d7885)',
          subtitle: 'var(--tg-theme-subtitle-text-color, #6d7885)',
          destructive: 'var(--tg-theme-destructive-text-color, #cc2424)',
        },
      },
    },
  },
  plugins: [],
}
