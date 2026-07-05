'use client';

// MOBILE-1: JS-side mobile detection for the card→reader→diff state machine.
// The layout CSS already branches at 860px (SessionPane); this mirrors that
// breakpoint so the surface can render a different tree on phones (cards) vs
// desktop (editor front door) without regressing either. SSR renders false
// (desktop-first for the server pass); the client corrects on mount.

import { useEffect, useState } from 'react';

export function useIsMobile(maxWidth = 860): boolean {
  const [isMobile, setIsMobile] = useState(false);
  useEffect(() => {
    const mq = window.matchMedia(`(max-width: ${maxWidth}px)`);
    const update = () => setIsMobile(mq.matches);
    update();
    mq.addEventListener('change', update);
    return () => mq.removeEventListener('change', update);
  }, [maxWidth]);
  return isMobile;
}
