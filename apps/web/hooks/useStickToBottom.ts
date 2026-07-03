"use client";

import { useCallback, useEffect, useRef, useState } from "react";

// U0 (feel-sprint-2): auto-follow scroll that releases when the user scrolls up.
// The old pattern (`endRef.scrollIntoView` on every message update) re-pinned the
// view to the bottom on every streamed token, making it impossible to scroll up
// and read during generation (founder-reported on iPhone). Standard fix:
// - follow the bottom ONLY while the user is at (or near) the bottom;
// - the moment they scroll up, release the pin and keep their position;
// - a floating "↓ Zum Ende" chip re-enables following on tap or when they
//   scroll back down themselves.
//
// Attach `containerRef` to the scrollable message list and call `onContentChange`
// whenever content grows (messages/tokens). `atBottom` drives chip visibility.

const NEAR_BOTTOM_PX = 80;

export function useStickToBottom<T extends HTMLElement>() {
  const containerRef = useRef<T | null>(null);
  // followRef is the live value used inside scroll/content callbacks;
  // atBottom mirrors it into state for rendering the chip.
  const followRef = useRef(true);
  const [atBottom, setAtBottom] = useState(true);

  const isNearBottom = useCallback(() => {
    const el = containerRef.current;
    if (!el) return true;
    return el.scrollHeight - el.scrollTop - el.clientHeight <= NEAR_BOTTOM_PX;
  }, []);

  // Scroll handler distinguishes user scrolls from our own programmatic ones:
  // programmatic scrolls land at the bottom, so `isNearBottom` stays true and
  // follow mode survives; a user scroll-up makes it false and releases the pin.
  const handleScroll = useCallback(() => {
    const near = isNearBottom();
    followRef.current = near;
    setAtBottom(near);
  }, [isNearBottom]);

  const scrollToBottom = useCallback((behavior: ScrollBehavior = "auto") => {
    const el = containerRef.current;
    if (!el) return;
    el.scrollTo({ top: el.scrollHeight, behavior });
    followRef.current = true;
    setAtBottom(true);
  }, []);

  // Call when content grows (new message, streamed token). Instant (non-smooth)
  // so rapid token updates can't queue up competing smooth animations.
  const onContentChange = useCallback(() => {
    if (followRef.current) scrollToBottom("auto");
  }, [scrollToBottom]);

  // Keep pinned when the container itself resizes (e.g. keyboard, viewport).
  useEffect(() => {
    const el = containerRef.current;
    if (!el || typeof ResizeObserver === "undefined") return;
    const ro = new ResizeObserver(() => {
      if (followRef.current) scrollToBottom("auto");
    });
    ro.observe(el);
    return () => ro.disconnect();
  }, [scrollToBottom]);

  return { containerRef, atBottom, handleScroll, onContentChange, scrollToBottom };
}
