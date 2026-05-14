'use client';
import type { Icon as PhosphorIcon, IconWeight } from '@phosphor-icons/react';

export type { IconWeight };

interface IconProps {
  icon: PhosphorIcon;
  size?: number;
  weight?: IconWeight;
  className?: string;
  style?: React.CSSProperties;
  'aria-label'?: string;
}

export function Icon({
  icon: PhIcon,
  size = 20,
  weight = 'bold',
  className,
  style,
  'aria-label': ariaLabel,
}: IconProps) {
  return (
    <PhIcon
      size={size}
      weight={weight}
      className={className}
      style={style}
      aria-label={ariaLabel}
      aria-hidden={!ariaLabel}
    />
  );
}
