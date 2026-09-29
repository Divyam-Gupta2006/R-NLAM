/** @type {import('tailwindcss').Config} */
const token = (name) => `rgb(var(--${name}) / <alpha-value>)`;

module.exports = {
  content: ['./app/**/*.{ts,tsx}', './components/**/*.{ts,tsx}', './views/**/*.{ts,tsx}', './context/**/*.{ts,tsx}', './lib/**/*.{ts,tsx}'],
  theme: {
    extend: {
      colors: {
        ink: { DEFAULT: token('ink'), muted: token('ink-muted') },
        surface: token('surface'),
        panel: token('panel'),
        line: token('line'),
        navy: { DEFAULT: token('navy'), soft: token('navy-soft') },
        saffron: { DEFAULT: token('saffron'), soft: token('saffron-soft') },
        bharat: { DEFAULT: token('green'), soft: token('green-soft') },
        danger: { DEFAULT: token('danger'), soft: token('danger-soft') },
        warning: { DEFAULT: token('warning'), soft: token('warning-soft') },
        info: { DEFAULT: token('info'), soft: token('info-soft') },
      },
    },
  },
  plugins: [],
};
