import { ImageResponse } from 'next/og';

export const runtime = 'edge';

export const alt = 'Goblin - The Cloud Workshop for Builders';
export const size = {
  width: 1200,
  height: 630,
};
export const contentType = 'image/png';

export default async function Image() {
  return new ImageResponse(
    (
      <div
        style={{
          width: '100%',
          height: '100%',
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          justifyContent: 'center',
          backgroundColor: 'var(--brand-green)',
        }}
      >
        <div
          style={{
            fontSize: 128,
            fontWeight: 700,
            color: 'white',
            letterSpacing: '-0.02em',
            marginBottom: 16,
          }}
        >
          Goblin
        </div>
        <div
          style={{
            fontSize: 36,
            color: 'var(--brand-gold)',
            fontWeight: 500,
          }}
        >
          The Cloud Workshop for Builders
        </div>
      </div>
    ),
    {
      ...size,
    }
  );
}