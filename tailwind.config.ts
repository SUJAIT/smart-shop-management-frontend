import type { Config } from 'tailwindcss';

const c = (v: string) => `rgb(var(--${v}) / <alpha-value>)`;

const config: Config = {
  darkMode: 'class',
  content: ['./src/**/*.{ts,tsx}'],
  theme: {
    extend: {
      colors: {
        background: c('background'),
        foreground: c('foreground'),
        card: c('card'),
        muted: { DEFAULT: c('muted'), foreground: c('muted-foreground') },
        border: c('border'),
        input: c('input'),
        ring: c('ring'),
        primary: { DEFAULT: c('primary'), foreground: c('primary-foreground') },
        success: c('success'),
        warning: c('warning'),
        danger: c('danger'),
        meter: c('meter'),
      },
      fontFamily: { sans: ['var(--font-sans)', 'system-ui', 'sans-serif'] },
      borderRadius: { lg: '10px', md: '7px', sm: '5px' },
      keyframes: {
        'sweep': { from: { transform: 'rotate(-90deg)' } },
      },
    },
  },
  plugins: [require('tailwindcss-animate')],
};
export default config;
