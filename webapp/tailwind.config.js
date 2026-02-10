/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{js,ts,jsx,tsx}'],
  theme: {
    extend: {
      fontFamily: {
        ui: [
          'Space Grotesk',
          'ui-sans-serif',
          'system-ui',
          '-apple-system',
          'Segoe UI',
          'sans-serif',
        ],
        display: ['Fraunces', 'ui-serif', 'Georgia', 'serif'],
      },
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
        // SpeakMate premium tokens (derived from Telegram theme variables).
        sm: {
          bg: 'var(--sm-bg)',
          card: 'var(--sm-card)',
          card2: 'var(--sm-card-2)',
          border: 'var(--sm-border)',
          accent: 'var(--sm-accent)',
          accent2: 'var(--sm-accent-2)',
          energy: 'var(--sm-energy)',
          energy2: 'var(--sm-energy-2)',
          text: 'var(--sm-text)',
          muted: 'var(--sm-muted)',
          success: 'var(--sm-success)',
          warning: 'var(--sm-warning)',
          danger: 'var(--sm-danger)',
        },
      },
      boxShadow: {
        smcard: '0 10px 30px rgba(0,0,0,0.10)',
        smglow: '0 0 0 1px rgba(255,255,255,0.06), 0 18px 60px rgba(0,0,0,0.35)',
      },
      borderRadius: {
        smxl: '22px',
      },
    },
  },
  plugins: [],
}
