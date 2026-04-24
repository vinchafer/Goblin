import { LoginForm } from '@/components/auth/login-form';

export default function LoginPage() {
  return (
    <main className="min-h-screen flex flex-col items-center justify-center px-4" style={{ backgroundColor: 'var(--goblin-cream)' }}>
      <div className="text-center mb-8">
        <h1
          className="font-[family-name:var(--font-fraunces)] text-5xl md:text-6xl font-bold mb-2"
          style={{ color: 'var(--goblin-moss)' }}
        >
          Goblin
        </h1>
        <p className="text-lg" style={{ color: 'var(--goblin-ochre)' }}>
          Your cloud workshop is waiting
        </p>
      </div>

      <LoginForm />
    </main>
  );
}