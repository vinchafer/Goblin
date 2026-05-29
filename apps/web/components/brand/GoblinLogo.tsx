"use client";

/**
 * GoblinLogo — Goblin v1.1 brand mark.
 *
 * Contract: GOBLIN_DESIGN_SYSTEM.md §B1.6 / brand-pack README.
 *
 *   state    : 'idle' | 'thinking' | 'working' | 'breath'   (default 'idle')
 *   size     : px, default 24
 *   variant  : 'gold' | 'ink' | 'green' | 'bone' | 'white'  (default 'gold')
 *   showWordmark : render the "GOBLIN" wordmark beside the mark (default false)
 *   className, aria-label
 *
 * The mark is the canonical g-mark from /public/brand/logo/_symbols.svg,
 * rendered inline with fill="currentColor" so the colour cascades via CSS
 * `color`. Animation uses the `goblin-mark--{state}` classes defined in
 * styles/design-tokens.css (which also carry the prefers-reduced-motion
 * resolution — thinking/working hold still, breath holds at 0.65 opacity).
 *
 * Usage:
 *   <GoblinLogo state="idle"      size={28} variant="gold" />   // app header
 *   <GoblinLogo state="thinking"  size={20} variant="gold" />   // chat stream
 *   <GoblinLogo state="working"   size={16} variant="gold" />   // build status
 *   <GoblinLogo state="breath"    size={64} variant="green" />  // loading splash
 */

import * as React from "react";

export type GoblinLogoState = "idle" | "thinking" | "working" | "breath";
export type GoblinLogoVariant = "gold" | "ink" | "green" | "bone" | "white";

export interface GoblinLogoProps {
  state?: GoblinLogoState;
  size?: number;
  variant?: GoblinLogoVariant;
  showWordmark?: boolean;
  className?: string;
  "aria-label"?: string;
}

const VARIANT_COLOR: Record<GoblinLogoVariant, string> = {
  gold:  "var(--brand-gold)",
  ink:   "var(--ink-deep)",
  green: "var(--brand-green)",
  bone:  "var(--bone)",
  white: "#FFFFFF",
};

// Canonical g-mark path (identical to /brand/logo/_symbols.svg #g-mark).
const G_MARK_PATH =
  "m 301.57431,532.05611 c -8.8544,-3.15614 -14.66533,-12.15416 -14.74731,-22.83569 -0.11377,-14.82307 7.04812,-21.59298 26.62254,-25.16547 13.26537,-2.42103 25.27879,-6.68664 41,-14.55789 16.99031,-8.50665 29.67124,-17.37517 42.784,-29.92136 17.13109,-16.39089 29.90427,-33.40215 39.45839,-52.55048 28.86834,-57.85781 30.69531,-119.74167 5.12122,-173.46795 -10.21922,-21.46862 -20.29062,-35.42591 -37.61625,-52.12989 -25.33371,-24.42472 -57.26718,-40.96275 -90.81667,-47.03304 -17.40042,-3.14836 -46.15388,-3.1583 -62.93069,-0.0218 -48.18454,9.00842 -90.80638,37.26649 -117.07081,77.61737 -15.97925,24.54945 -26.61532,54.5611 -29.25032,82.53527 l -0.80065,8.5 44.06089,44.44864 c 24.23349,24.44675 45.01375,45.24501 46.17836,46.21834 2.09361,1.74975 2.51172,1.37277 37.09789,-33.44864 19.23923,-19.37009 38.33049,-38.70584 42.42503,-42.96834 4.09454,-4.2625 7.88061,-7.75 8.41348,-7.75 0.53287,0 8.25138,7.3125 17.15224,16.25 l 16.18338,16.25 -58.858,59.25 c -32.3719,32.58754 -59.23572,59.25004 -59.69739,59.25004 -0.46166,0 -32.67569,-31.83868 -71.58674,-70.75262 L 53.949546,299.01998 v -11.69617 c 0,-13.67827 2.041826,-30.65183 5.629612,-46.79859 7.497459,-33.74217 24.127362,-68.21991 45.665712,-94.67591 l 6.65618,-8.17591 -9.33375,-27.32409 C 97.433744,95.321064 90.007504,73.849874 86.064546,62.635564 c -3.942955,-11.21431 -6.96228,-20.59639 -6.70961,-20.84906 0.679366,-0.67937 31.042324,18.57843 58.762914,37.27054 l 24.2866,16.37656 3.02254,-1.99654 c 5.42484,-3.58337 22.28236,-11.83216 32.498,-15.90206 33.01269,-13.15221 70.09919,-18.40145 105.60087,-14.9468 28.06032,2.73053 54.33379,10.47712 80.99615,23.88127 l 17.07246,8.58296 11.42587,-7.5136 c 29.67315,-19.51294 70.41697,-45.85917 70.61455,-45.66159 0.19853,0.19853 -28.02423,86.999656 -30.59984,94.112026 -0.97298,2.68682 -0.76123,3.29478 2.26388,6.5 9.12015,9.66315 23.05852,30.96888 31.09838,47.53595 10.15288,20.92119 17.43571,44.44115 21.22171,68.53565 2.6957,17.15575 2.43047,51.74514 -0.53648,69.96435 -5.73312,35.20542 -17.86945,69.83696 -33.65546,96.03727 -25.56036,42.42299 -63.32314,76.10326 -106.06279,94.59642 -25.85125,11.18566 -54.71658,16.8443 -65.78998,12.8972 z m 65.36876,-237.46523 c -11.31169,-3.44086 -17.8112,-13.11165 -16.74137,-24.90992 1.1843,-13.06062 9.13567,-20.88952 22.21843,-21.87618 6.99185,-0.52731 11.5486,1.04237 17.0511,5.87363 5.4415,4.7777 7.48214,9.58267 7.45635,17.55697 -0.027,8.34224 -2.16444,13.43656 -7.75096,18.47329 -5.79381,5.22362 -14.68951,7.17701 -22.23355,4.88221 z";

export const GoblinLogo: React.FC<GoblinLogoProps> = ({
  state = "idle",
  size = 24,
  variant = "gold",
  showWordmark = false,
  className,
  "aria-label": ariaLabel = "Goblin",
}) => {
  const markClass = state === "idle" ? undefined : `goblin-mark--${state}`;
  const wordmarkSize = Math.round(size * 0.75);

  return (
    <span
      className={className}
      role="img"
      aria-label={ariaLabel}
      style={{
        color: VARIANT_COLOR[variant],
        display: "inline-flex",
        alignItems: "center",
        gap: "0.5em",
        lineHeight: 0,
      }}
    >
      <svg
        className={markClass}
        width={size}
        height={size}
        viewBox="0 0 570 570"
        xmlns="http://www.w3.org/2000/svg"
        aria-hidden="true"
      >
        <path fill="currentColor" d={G_MARK_PATH} />
      </svg>
      {showWordmark && (
        <span
          style={{
            fontFamily: "var(--font-sans)",
            fontWeight: 600,
            letterSpacing: "0.08em",
            textTransform: "uppercase",
            fontSize: wordmarkSize,
            color: "currentColor",
          }}
        >
          GOBLIN
        </span>
      )}
    </span>
  );
};

export default GoblinLogo;
