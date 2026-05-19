'use client';

import type { CSSProperties } from 'react';

interface SkeletonProps {
  width?: CSSProperties['width'];
  height?: CSSProperties['height'];
  borderRadius?: CSSProperties['borderRadius'];
  style?: CSSProperties;
  className?: string;
}

export function Skeleton({
  width = '100%',
  height = 16,
  borderRadius = 6,
  style,
  className,
}: SkeletonProps) {
  return (
    <div
      className={className}
      style={{
        width,
        height,
        borderRadius,
        background:
          'linear-gradient(90deg, var(--subtle) 0%, var(--div) 50%, var(--subtle) 100%)',
        backgroundSize: '200% 100%',
        animation: 'gobSkeletonShimmer 1.4s ease-in-out infinite',
        ...style,
      }}
    />
  );
}

export function SkeletonRow({ lines = 3 }: { lines?: number }) {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
      {Array.from({ length: lines }).map((_, i) => (
        <Skeleton
          key={i}
          height={14}
          width={i === lines - 1 ? '60%' : '100%'}
        />
      ))}
    </div>
  );
}

export function SkeletonCard() {
  return (
    <div
      style={{
        padding: 16,
        borderRadius: 12,
        background: 'var(--panel)',
        border: '1px solid var(--div)',
        display: 'flex',
        flexDirection: 'column',
        gap: 10,
      }}
    >
      <Skeleton height={20} width="55%" />
      <Skeleton height={12} />
      <Skeleton height={12} width="85%" />
    </div>
  );
}
