/* Tailwind config — johnsonmugarra.com
 *
 * Colours are CSS custom properties, not literals, so a single
 * [data-theme="light"] block in src/tailwind.css flips the whole
 * palette. That is why light mode needs no !important overrides.
 *
 * Two families of accent:
 *   brand / secondary-fill  fixed ochre, for fills that sit under dark text
 *   primary / secondary     flips per theme, for text that sits on the page
 */

/** @param {string} v */
const token = (v) => `rgb(var(${v}) / <alpha-value>)`;

/** @type {import('tailwindcss').Config} */
module.exports = {
  darkMode: ['class', '[data-theme="dark"]'],
  content: ['./index.html', './404.html', './script.js', './charts.js'],
  theme: {
    extend: {
      colors: {
        background: token('--c-bg'),
        surface: token('--c-surface'),
        'surface-2': token('--c-surface-2'),
        'surface-3': token('--c-surface-3'),

        ink: token('--c-ink'),
        muted: token('--c-muted'),
        faint: token('--c-faint'),
        line: token('--c-line'),

        brand: token('--c-brand'),
        'brand-bright': token('--c-brand-bright'),
        'on-brand': token('--c-on-brand'),

        primary: token('--c-primary'),
        secondary: token('--c-secondary'),
        tertiary: token('--c-tertiary'),

        'secondary-fill': token('--c-secondary-fill'),
        positive: token('--c-positive'),
        warn: token('--c-warn'),
        danger: token('--c-danger'),
      },
      fontFamily: {
        body: ['"Plus Jakarta Sans"', 'ui-sans-serif', 'system-ui', '-apple-system', 'Segoe UI', 'Roboto', 'sans-serif'],
        headline: ['"Space Grotesk"', 'ui-sans-serif', 'system-ui', '-apple-system', 'Segoe UI', 'sans-serif'],
        mono: ['"JetBrains Mono"', 'ui-monospace', 'SFMono-Regular', 'Menlo', 'Consolas', 'monospace'],
      },
      fontSize: {
        /* Hero headline: scales with viewport, never smaller than 2.8rem */
        display: ['clamp(2.8rem, 1.8rem + 4.2vw, 5.25rem)', { lineHeight: '0.96', letterSpacing: '-0.028em' }],
      },
      borderRadius: {
        plate: '7px',
        control: '3px',
      },
      transitionTimingFunction: {
        out: 'cubic-bezier(0.23, 1, 0.32, 1)',
        spring: 'cubic-bezier(0.34, 1.56, 0.64, 1)',
      },
      maxWidth: {
        prose: '68ch',
      },
    },
  },
  plugins: [],
};
