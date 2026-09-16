import type { Config } from 'tailwindcss'
import tailwindcssAnimate from 'tailwindcss-animate'

export default {
  darkMode: ['class'],
  content: ['./index.html', './src/**/*.{ts,tsx}'],
  theme: {
    extend: {
      borderRadius: {
        DEFAULT: '10px',
        sm: '7px',
        md: '9px',
        lg: '12px',
        xl: '14px',
        '2xl': '16px',
      },
      fontSize: {
        '11': '0.6875rem',
        '12': '0.75rem',
        '13': '0.8125rem',
        '14': '0.875rem',
        '15': '0.9375rem',
        '16': '1rem',
        '17': '1.0625rem',
        '19': '1.1875rem',
        '20': '1.25rem',
        '22': '1.375rem',
        '26': '1.625rem',
        '28': '1.75rem',
        '40': '2.5rem',
      },
      colors: {
        background: 'hsl(var(--paper))',
        foreground: 'hsl(var(--ink))',
        card: {
          DEFAULT: 'hsl(var(--surface))',
          foreground: 'hsl(var(--ink))',
        },
        popover: {
          DEFAULT: 'hsl(var(--surface))',
          foreground: 'hsl(var(--ink))',
        },
        primary: {
          DEFAULT: 'hsl(var(--stamp))',
          foreground: 'hsl(var(--surface))',
        },
        secondary: {
          DEFAULT: 'hsl(var(--soft))',
          foreground: 'hsl(var(--ink-body))',
        },
        muted: {
          DEFAULT: 'hsl(var(--soft))',
          foreground: 'hsl(var(--ink-soft))',
        },
        accent: {
          DEFAULT: 'hsl(var(--pill-hover))',
          foreground: 'hsl(var(--ink))',
        },
        destructive: {
          DEFAULT: 'hsl(var(--void))',
          foreground: 'hsl(var(--surface))',
        },
        border: 'hsl(var(--line))',
        input: 'hsl(var(--line))',
        ring: 'hsl(var(--stamp))',

        // Vocabulario propio del sistema
        paper: 'hsl(var(--paper))',
        paperRule: 'hsl(var(--paper-rule))',
        surface: 'hsl(var(--surface))',
        well: 'hsl(var(--well))',
        soft: 'hsl(var(--soft))',
        hero: 'hsl(var(--hero))',
        line: 'hsl(var(--line))',
        ink: 'hsl(var(--ink))',
        inkDeep: 'hsl(var(--ink-deep))',
        inkBody: 'hsl(var(--ink-body))',
        inkMid: 'hsl(var(--ink-mid))',
        inkSoft: 'hsl(var(--ink-soft))',
        inkMute: 'hsl(var(--ink-mute))',
        stamp: 'hsl(var(--stamp))',
        pending: 'hsl(var(--pending))',
        void: 'hsl(var(--void))',
        chipStamp: 'hsl(var(--chip-stamp))',
        chipPending: 'hsl(var(--chip-pending))',
        chipVoid: 'hsl(var(--chip-void))',
        dotPending: 'hsl(var(--dot-pending))',
        dotVoid: 'hsl(var(--dot-void))',
        navHover: 'hsl(var(--nav-hover))',
        pillHover: 'hsl(var(--pill-hover))',
        badgeSoft: 'hsl(var(--badge-soft))',
      },
      height: {
        topbar: '60px',
        control: '38px',
        field: '42px',
        row: '58px',
      },
      width: {
        sidebar: '230px',
      },
    },
  },
  plugins: [tailwindcssAnimate],
} satisfies Config
