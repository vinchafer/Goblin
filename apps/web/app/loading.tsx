import { GoblinLoader } from '@/components/ui/GoblinLoader';

export default function Loading() {
  return (
    <div style={{
      minHeight: '100dvh', display: 'flex', flexDirection: 'column',
      alignItems: 'center', justifyContent: 'center',
      background: 'var(--cream, #F7F4ED)',
    }}>
      <GoblinLoader variant="page" size="lg" />
    </div>
  );
}
