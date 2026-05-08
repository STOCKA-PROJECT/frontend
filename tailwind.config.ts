import type { Config } from 'tailwindcss'
import defaultTheme from 'tailwindcss/defaultTheme'

export default {
  content: [
    './app/components/**/*.{vue,ts}',
    './app/layouts/**/*.vue',
    './app/pages/**/*.vue',
    './app/composables/**/*.ts',
    './app/plugins/**/*.{ts,js}',
    './app/app.vue',
    './app/error.vue'
  ],
  theme: {
    extend: {
      screens: {
        lg: '960px'
      },
      colors: {
        bg: {
          DEFAULT: 'var(--c-bg)',
          card: 'var(--c-bg-card)',
          alt: 'var(--c-bg-alt)',
          soft: 'var(--c-bg-soft)',
          field: 'var(--c-field)'
        },
        field: {
          DEFAULT: 'var(--c-field)',
          focus: 'var(--c-field-focus)'
        },
        ink: {
          DEFAULT: 'var(--c-ink)',
          soft: 'var(--c-ink-soft)',
          muted: 'var(--c-ink-muted)'
        },
        line: {
          DEFAULT: 'var(--c-line)',
          strong: 'var(--c-line-strong)'
        },
        accent: {
          DEFAULT: 'var(--c-accent)',
          ink: 'var(--c-accent-ink)',
          soft: 'var(--c-accent-soft)'
        },
        warn: {
          DEFAULT: 'var(--c-warn)',
          bg: 'var(--c-warn-bg)',
          ink: 'var(--c-warn-ink)',
          soft: 'var(--c-warn-soft)'
        },
        danger: {
          DEFAULT: 'var(--c-danger)',
          soft: 'var(--c-danger-soft)'
        },
        ok: 'var(--c-ok)'
      },
      width: {
        sidebar: 'var(--sidebar-w)'
      },
      height: {
        topbar: 'var(--topbar-h)'
      },
      fontFamily: {
        sans: ['Inter', ...defaultTheme.fontFamily.sans],
        mono: ['ui-monospace', 'SFMono-Regular', 'Menlo', 'monospace']
      },
      maxWidth: {
        wrap: '1180px'
      },
      boxShadow: {
        soft: '0 1px 2px rgba(60, 50, 30, .04)',
        card: '0 4px 20px rgba(60, 50, 30, .06), 0 1px 2px rgba(60, 50, 30, .04)',
        elevated: '0 20px 60px rgba(60, 50, 30, .08), 0 2px 6px rgba(60, 50, 30, .04)'
      },
      letterSpacing: {
        tightish: '-0.015em',
        tighter2: '-0.025em',
        tighter3: '-0.03em'
      },
      transitionTimingFunction: {
        ease: 'cubic-bezier(.2, .7, .2, 1)'
      },
      keyframes: {
        reveal: {
          from: { opacity: '0', transform: 'translateY(18px)' },
          to: { opacity: '1', transform: 'translateY(0)' }
        },
        revealLeft: {
          from: { opacity: '0', transform: 'translateX(-24px)' },
          to: { opacity: '1', transform: 'translateX(0)' }
        },
        revealRight: {
          from: { opacity: '0', transform: 'translateX(24px)' },
          to: { opacity: '1', transform: 'translateX(0)' }
        },
        floaty: {
          '0%, 100%': { transform: 'perspective(900px) rotateY(var(--tilt-x, 0deg)) rotateX(var(--tilt-y, 0deg)) translateY(0)' },
          '50%': { transform: 'perspective(900px) rotateY(var(--tilt-x, 0deg)) rotateX(var(--tilt-y, 0deg)) translateY(-6px)' }
        },
        pulseDot: {
          '0%, 100%': { transform: 'scale(1)', opacity: '1' },
          '50%': { transform: 'scale(1.6)', opacity: '.55' }
        }
      },
      animation: {
        reveal: 'reveal .7s cubic-bezier(.2, .7, .2, 1) both',
        'reveal-left': 'revealLeft .75s cubic-bezier(.2, .7, .2, 1) both',
        'reveal-right': 'revealRight .75s cubic-bezier(.2, .7, .2, 1) both',
        floaty: 'floaty 7s ease-in-out infinite',
        'pulse-dot': 'pulseDot 1.8s ease-in-out infinite'
      }
    }
  },
  plugins: []
} satisfies Config
