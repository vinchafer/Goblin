'use client';
import { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { createClient } from '@/lib/supabase/client';

const FEATURES = [
  {
    icon: '💬',
    title: 'Chat with AI',
    desc: 'Describe what you want to build in plain English. Your goblin understands.',
  },
  {
    icon: '→',
    title: 'Send to Code',
    desc: 'One tap sends AI output directly to your editor. No clipboard, no switching tabs.',
  },
  {
    icon: '🐙',
    title: 'Push to GitHub',
    desc: 'Deploy your project to GitHub — and from there to Vercel — in one click.',
  },
];

export default function DashboardPage() {
  const router = useRouter();
  const supabase = createClient();

  useEffect(() => {
    supabase
      .from('projects')
      .select('id')
      .order('last_active', { ascending: false })
      .limit(1)
      .then(({ data }) => {
        const rows = data as Array<{ id: string }> | null;
        if (rows?.[0]) router.replace(`/dashboard/project/${rows[0].id}`);
      });
  }, []);

  return (
    <div style={{
      display: 'flex', flexDirection: 'column',
      alignItems: 'center', justifyContent: 'center',
      height: '100%', padding: '48px 24px',
      textAlign: 'center', background: 'var(--cream)',
    }}>
      {/* Goblin emoji */}
      <div style={{ fontSize: 72, marginBottom: 24, lineHeight: 1 }}>👺</div>

      <h1 style={{
        fontFamily: 'Fraunces, serif', fontSize: 'clamp(28px, 5vw, 40px)',
        color: 'var(--moss)', fontWeight: 700,
        marginBottom: 12, letterSpacing: '-1px', lineHeight: 1.1,
      }}>
        Welcome to Goblin.
      </h1>

      <p style={{
        fontSize: 16, color: 'var(--meta)',
        maxWidth: 380, lineHeight: 1.65,
        marginBottom: 36, fontWeight: 300,
      }}>
        Create your first project to start building.
        Your goblin is ready.
      </p>

      <button
        onClick={() => router.push('/dashboard/new')}
        style={{
          background: 'var(--moss)', color: '#fff', border: 'none',
          borderRadius: 10, padding: '14px 28px',
          fontSize: 15, fontWeight: 500,
          cursor: 'pointer', fontFamily: 'DM Sans, sans-serif',
          transition: 'background 0.15s',
          display: 'inline-flex', alignItems: 'center', gap: 8,
          minHeight: 48,
        }}
        onMouseEnter={e => (e.currentTarget.style.background = 'var(--moss2)')}
        onMouseLeave={e => (e.currentTarget.style.background = 'var(--moss)')}
      >
        ＋ Create your first project →
      </button>

      {/* Feature cards */}
      <div style={{
        display: 'grid',
        gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))',
        gap: 16, maxWidth: 720,
        marginTop: 64, width: '100%',
      }}>
        {FEATURES.map(f => (
          <div
            key={f.title}
            style={{
              background: 'var(--panel)',
              border: '1px solid var(--border)',
              borderRadius: 12, padding: '20px 20px',
              textAlign: 'left',
            }}
          >
            <div style={{ fontSize: 28, marginBottom: 10, lineHeight: 1 }}>{f.icon}</div>
            <div style={{
              fontFamily: 'Fraunces, serif', fontSize: 16,
              color: 'var(--moss)', fontWeight: 700, marginBottom: 6,
            }}>{f.title}</div>
            <div style={{ fontSize: 13, color: 'var(--meta)', lineHeight: 1.55, fontWeight: 300 }}>{f.desc}</div>
          </div>
        ))}
      </div>
    </div>
  );
}
