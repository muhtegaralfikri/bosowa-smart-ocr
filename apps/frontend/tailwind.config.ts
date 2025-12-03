import type { Config } from 'tailwindcss';

const config: Config = {
  content: ['./src/**/*.{ts,tsx}'],
  theme: {
    extend: {
      colors: {
        sand: '#f7f2ec',
        ink: '#0f172a',
        primary: '#0b5ea8', // Bosowa blue
        primaryLight: '#e6f1fb',
        accent: '#0ea5e9',
      },
      fontFamily: {
        display: ['var(--font-sora)', 'sans-serif'],
        body: ['var(--font-sora)', 'system-ui', 'sans-serif'],
      },
    },
  },
  plugins: [],
};

export default config;
