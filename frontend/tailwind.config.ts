import type { Config } from 'tailwindcss';

const config: Config = {
  content: ['./index.html', './src/**/*.{ts,tsx}'],
  darkMode: 'class',
  theme: {
    extend: {
      colors: {
        bg: {
          DEFAULT: '#0B0F19',
          soft: '#121214',
        },
        surface: {
          DEFAULT: '#1E293B',
          soft: '#202024',
        },
        text: {
          DEFAULT: '#F8FAFC',
          muted: '#94A3B8',
        },
        accent: {
          DEFAULT: '#6366F1',
          soft: '#3B82F6',
        },
      },
    },
  },
  plugins: [],
};

export default config;
