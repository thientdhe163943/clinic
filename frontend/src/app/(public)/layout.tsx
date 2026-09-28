import type { ReactNode } from 'react';

// No longer loads a separate display font here — the Clinical Excellence
// System spec (docs/design.md mục 1, 2026-08-20) uses a single Inter family
// sitewide (loaded once in src/app/layout.tsx). `font-display` utility
// classes already used on public pages (SectionHeading, headings) now
// resolve to that same Inter stack via tailwind.config.ts, so this layout
// no longer needs its own font wrapper.
export default function PublicLayout({ children }: { children: ReactNode }) {
  return <>{children}</>;
}
