"use client";

// U0 (feel-sprint-2): floating chip shown while the user has scrolled away from
// the bottom of a chat. Tapping it jumps back to the end and re-enables
// auto-follow. Positioned by the parent (needs a relatively positioned anchor).

export function ScrollToEndChip({ onClick, bottom = 12 }: { onClick: () => void; bottom?: number | string }) {
  return (
    <button
      onClick={onClick}
      aria-label="Zum Ende des Chats springen"
      style={{
        position: "absolute",
        bottom,
        left: "50%",
        transform: "translateX(-50%)",
        zIndex: 20,
        display: "inline-flex",
        alignItems: "center",
        gap: 6,
        padding: "6px 14px",
        borderRadius: 999,
        border: "1px solid var(--div, #DDD7CC)",
        background: "var(--bone, #fff)",
        color: "var(--brand-green, #2D4A2B)",
        fontSize: 12.5,
        fontWeight: 600,
        fontFamily: "var(--font-sans)",
        cursor: "pointer",
        boxShadow: "0 2px 10px rgba(0,0,0,0.12)",
      }}
    >
      <span aria-hidden>↓</span>
      <span>Zum Ende</span>
    </button>
  );
}
