'use client';

import { useEffect, useState, type ReactNode } from 'react';
import { createPortal } from 'react-dom';

const PRINT_ROOT_ID = 'print-portal-root';

function getOrCreatePrintRoot(): HTMLElement {
  let el = document.getElementById(PRINT_ROOT_ID);
  if (!el) {
    el = document.createElement('div');
    el.id = PRINT_ROOT_ID;
    document.body.appendChild(el);
  }
  return el;
}

/**
 * Portals its children to a dedicated node appended directly to <body> —
 * a sibling of the app's own component tree, not nested inside it.
 *
 * Print slips used to just apply a `.print-only` class in place and rely on
 * `visibility: hidden` (on everything else) + `position: fixed` (on the
 * slip) to fake hiding the rest of the page. But a `visibility: hidden`
 * ancestor still occupies its full layout height, so the browser paginated
 * for that (invisible) height — any dashboard page taller than one A4 sheet
 * silently printed a blank extra page alongside the actual slip. Portaling
 * out lets the print stylesheet `display: none` the *entire* real app tree
 * (removing its height too) and reveal only this node — see globals.css.
 */
export function PrintPortal({ children }: { children: ReactNode }) {
  const [root, setRoot] = useState<HTMLElement | null>(null);

  useEffect(() => {
    setRoot(getOrCreatePrintRoot());
  }, []);

  if (!root) return null;
  return createPortal(children, root);
}
