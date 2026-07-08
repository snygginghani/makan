# makan — Design System (Master)

AI-powered interactive map of Jordan. Arabic-first (RTL), bilingual. The map IS the
product — UI floats above it as frosted-glass panels.

## Direction

- **Style**: Dark-primary "cinematic map" — deep warm-black surfaces, glassmorphism
  panels (blur 16-20px, `rgba` borders), subtle glow on the primary accent. Light mode
  supported on content pages (place detail, admin) via tokens.
- **Personality**: أصيل ودافئ — Jordan's sandstone/Petra rose warmth against desert-night
  dark. Not techy-cold, not touristy-kitsch.
- **Anti-patterns**: no emoji icons (Lucide SVG only), no pure #000 backgrounds, no
  heavy 3D/parallax, no generic stock photos, one primary CTA per screen.

## Color tokens (CSS variables, dark = default)

| Token | Dark | Light | Usage |
|---|---|---|---|
| `--background` | `#0C0A09` (warm black) | `#FAF7F2` | page base |
| `--surface` | `#171310` | `#FFFFFF` | cards, panels |
| `--surface-glass` | `rgba(23,19,16,0.72)` | `rgba(255,255,255,0.78)` | floating panels over map |
| `--foreground` | `#F5EFE6` | `#1C1917` | primary text (≥4.5:1) |
| `--muted-foreground` | `#A89F94` | `#6B6259` | secondary text (≥3:1) |
| `--primary` | `#E2725B` (Petra terracotta) | `#C2410C` | CTA, highlights, active pins |
| `--primary-foreground` | `#1C0F0A` | `#FFFFFF` | text on primary |
| `--accent` | `#2DD4BF` (oasis teal) | `#0D9488` | AI/chat identity, links |
| `--border` | `rgba(245,239,230,0.10)` | `rgba(28,25,23,0.10)` | hairlines |
| `--destructive` | `#F87171` | `#DC2626` | errors, reports |
| `--ring` | `#E2725B` | `#C2410C` | focus rings (visible!) |

Category pin colors: viewpoint `#E2725B`, valley/waterfall `#38BDF8`, mountain `#A78BFA`,
cafe/restaurant `#FBBF24`, hiking `#4ADE80`, camping `#FB923C`, study `#818CF8`,
photo/hidden gem `#F472B6`.

## Typography

- **Arabic-first**: `IBM Plex Sans Arabic` for UI/body, `Noto Naskh Arabic` for
  display headings (place names, hero) — via `next/font/google`.
- Latin fallback lives inside the same stacks. `dir="rtl"` on `<html>`, `lang="ar"`.
- Scale: 12 / 14 / 16 (base) / 18 / 22 / 28 / 36. Body line-height 1.7 (Arabic needs air).
- Numerals: tabular for distances/ratings.

## Effects & motion

- Glass: `backdrop-blur-xl` + `bg-[var(--surface-glass)]` + `border-[var(--border)]`,
  radius 16px (`rounded-2xl`), shadow `0 8px 32px rgba(0,0,0,0.35)`.
- Motion: 150–300ms, `ease-out` enter / `ease-in` exit; chat messages stagger 40ms;
  map pin highlight = scale pulse via `transform` only. Respect `prefers-reduced-motion`.
- Primary button glow: `shadow-[0_0_24px_rgba(226,114,91,0.35)]` on hover only.

## Layout

- Map page: full-viewport map (`min-h-dvh`); chat sidebar 400px desktop (right in RTL),
  bottom sheet on mobile; filter chips top-center; place cards float bottom-left.
- Content pages: `max-w-6xl` container, 4/8px spacing rhythm.
- Breakpoints: 375 / 768 / 1024 / 1440. Touch targets ≥44px. `z` scale: 0/10/20/40/100.

## Accessibility

- Contrast AA minimum on both themes; focus visible on every interactive element;
  aria-labels on icon buttons; `aria-live="polite"` for chat answers & toasts;
  keyboard: chat input reachable, map pins have list alternative (cards panel).
