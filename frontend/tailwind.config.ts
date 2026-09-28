import type { Config } from 'tailwindcss';

const config: Config = {
  darkMode: ['class'],
  content: ['./src/**/*.{ts,tsx}'],
  theme: {
    extend: {
      colors: {
        border: 'hsl(var(--border))',
        input: 'hsl(var(--input))',
        ring: 'hsl(var(--ring))',
        background: 'hsl(var(--background))',
        foreground: 'hsl(var(--foreground))',
        primary: {
          DEFAULT: 'hsl(var(--primary))',
          foreground: 'hsl(var(--primary-foreground))',
        },
        secondary: {
          DEFAULT: 'hsl(var(--secondary))',
          foreground: 'hsl(var(--secondary-foreground))',
        },
        muted: {
          DEFAULT: 'hsl(var(--muted))',
          foreground: 'hsl(var(--muted-foreground))',
        },
        destructive: {
          DEFAULT: 'hsl(var(--destructive))',
          foreground: 'hsl(var(--destructive-foreground))',
        },
        card: {
          DEFAULT: 'hsl(var(--card))',
          foreground: 'hsl(var(--card-foreground))',
        },
        // Icon/support accent — Âu Cơ Health Design System's
        // "primary-container" blue (#0052a3), sitewide.
        accent: {
          DEFAULT: 'hsl(var(--accent))',
          foreground: 'hsl(var(--accent-foreground))',
        },
        // No separate darker brand shade in this spec — aliased to
        // --primary (globals.css) so existing `brand`/`bg-brand` call
        // sites don't need touching.
        brand: {
          DEFAULT: 'hsl(var(--brand))',
          foreground: 'hsl(var(--brand-foreground))',
        },
        // Âu Cơ Health Design System's "Secondary (Âu Cơ Red)" — used
        // sparingly for urgent notifications/health alerts/highlight
        // accents, distinct from the neutral `secondary` button color and
        // from `destructive` (error red). See globals.css for the mapping
        // rationale.
        'brand-red': {
          DEFAULT: 'hsl(var(--brand-red))',
          foreground: 'hsl(var(--brand-red-foreground))',
        },
        // Âu Cơ Health Design System's "Tertiary / Neutral Dark" (#303e46)
        // — footer background, secondary nav.
        tertiary: {
          DEFAULT: 'hsl(var(--tertiary))',
          foreground: 'hsl(var(--tertiary-foreground))',
        },
        // Spec's "Primary Fixed" (#d6e3ff) — light primary tint for
        // icon-circle backgrounds, banner sections, soft containers.
        'primary-fixed': {
          DEFAULT: 'hsl(var(--primary-fixed))',
          foreground: 'hsl(var(--primary-fixed-foreground))',
        },
      },
      borderRadius: {
        lg: '16px',
        md: '8px',
        sm: '4px',
      },
      boxShadow: {
        // Ambient shadow tokens from the Âu Cơ Health Design System spec's
        // "Elevation & Depth" section — ui/card.tsx uses `card` (Surface
        // Layer), dialog/modal surfaces use `modal` (Overlays), both
        // neutral black per spec (no more primary-tinted modal shadow).
        card: '0px 4px 12px rgba(0, 0, 0, 0.06)',
        modal: '0px 8px 24px rgba(0, 0, 0, 0.12)',
      },
      fontFamily: {
        // Be Vietnam Pro sitewide per the Âu Cơ Health Design System spec —
        // `display` intentionally aliases to the same stack as `sans` so
        // existing `font-display` class usages (SectionHeading, public
        // page headings) don't need touching one by one.
        sans: ['var(--font-sans)', 'Arial', 'sans-serif'],
        display: ['var(--font-sans)', 'Arial', 'sans-serif'],
      },
      keyframes: {
        marquee: {
          '0%': { transform: 'translateX(0%)' },
          '100%': { transform: 'translateX(-50%)' },
        },
      },
      animation: {
        marquee: 'marquee 30s linear infinite',
      },
    },
  },
  plugins: [],
};

export default config;
