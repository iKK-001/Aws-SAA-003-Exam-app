import type { Config } from 'tailwindcss';

const config: Config = {
  content: [
    './app/**/*.{js,ts,jsx,tsx,mdx}',
    './components/**/*.{js,ts,jsx,tsx,mdx}',
  ],
  theme: {
    extend: {
      fontFamily: {
        sans: ['var(--font-quicksand)', 'system-ui', 'sans-serif'],
      },
      colors: {
        aws: {
          navy: '#232F3E',
          orange: '#FF9900',
          'blue-deep': '#146EB4',
          'blue-soft': '#1E88E5',
          'blue-light': '#E8F4FC',
          'slate-soft': '#F7F9FC',
        },
        mint: {
          DEFAULT: '#99E6C9',
          light: '#D1FAE5',
          dark: '#059669',
        },
        strawberry: {
          DEFAULT: '#F9A8D4',
          light: '#FCE7F3',
          dark: '#DB2777',
        },
        lavender: {
          DEFAULT: '#E9D5FF',
          light: '#F5F3FF',
        },
      },
      borderRadius: {
        '2xl': '20px',
        '3xl': '30px',
        '4xl': '40px',
      },
      boxShadow: {
        soft: '0 2px 8px rgba(20, 110, 180, 0.08)',
        card: '0 4px 12px rgba(35, 47, 62, 0.06)',
        drawer: '0 -4px 24px rgba(35, 47, 62, 0.12)',
        float: '0 8px 24px rgba(251, 146, 60, 0.18)',
        'float-mint': '0 8px 24px rgba(16, 185, 129, 0.2)',
        'float-lavender': '0 6px 20px rgba(167, 139, 250, 0.2)',
      },
      minHeight: {
        safe: 'calc(100vh - env(safe-area-inset-bottom, 0px) - 4rem)',
      },
      keyframes: {
        shake: {
          '0%, 100%': { transform: 'translateX(0)' },
          '10%, 30%, 50%, 70%, 90%': { transform: 'translateX(-4px)' },
          '20%, 40%, 60%, 80%': { transform: 'translateX(4px)' },
        },
        pop: {
          '0%': { transform: 'scale(1)' },
          '50%': { transform: 'scale(1.05)' },
          '100%': { transform: 'scale(1)' },
        },
      },
      animation: {
        shake: 'shake 0.5s ease-in-out',
        pop: 'pop 0.3s ease-out',
      },
    },
  },
  plugins: [],
};

export default config;
