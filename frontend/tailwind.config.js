/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        isisens: {
          bg: '#050B18',
          secondary: '#0B1424',
          card: '#122036',
          orange: '#FF792D',
          cyan: '#12D9E8',
          success: '#20D58C',
          warning: '#FFBD35',
          danger: '#FF5050',
          text: '#FFFFFF',
          muted: '#AEBCCB',
        }
      },
      fontFamily: {
        sans: ['Inter', 'system-ui', '-apple-system', 'BlinkMacSystemFont', 'Segoe UI', 'Roboto', 'sans-serif'],
      },
      boxShadow: {
        'neon-orange': '0 0 18px rgba(255, 121, 45, 0.35), inset 0 0 12px rgba(255, 121, 45, 0.15)',
        'neon-cyan': '0 0 18px rgba(18, 217, 232, 0.3), inset 0 0 12px rgba(18, 217, 232, 0.12)',
        'glass': '0 8px 32px 0 rgba(2, 6, 16, 0.65)',
      }
    },
  },
  plugins: [],
}

