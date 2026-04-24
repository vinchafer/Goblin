import Link from "next/link";

export function Hero() {
  return (
    <section className="min-h-screen flex flex-col items-center justify-center px-4 relative overflow-hidden">
      <div className="absolute inset-0 opacity-5" style={{
        backgroundImage: `url("data:image/svg+xml,%3Csvg viewBox='0 0 400 400' xmlns='http://www.w3.org/2000/svg'%3E%3Cfilter id='noiseFilter'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.9' numOctaves='3' stitchTiles='stitch'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23noiseFilter)'/%3E%3C/svg%3E")`,
      }} />

      <div className="max-w-4xl text-center relative z-10">
        <h1
          className="text-8xl md:text-[12rem] font-bold mb-6 tracking-tight"
          style={{ fontFamily: 'Fraunces, Georgia, serif', color: 'var(--goblin-moss)' }}
        >
          Goblin
        </h1>

        <p className="text-xl md:text-2xl mb-10 max-w-xl mx-auto" style={{ color: 'var(--goblin-slate)' }}>
          The cloud workshop where vibe coders ship.
        </p>

        <div className="flex flex-col sm:flex-row gap-4 justify-center mb-8">
          <Link
            href="/login"
            className="px-8 py-3 rounded-lg font-medium"
            style={{ backgroundColor: 'var(--goblin-moss)', color: 'white' }}
          >
            Start building
          </Link>

          <button className="px-8 py-3 rounded-lg font-medium border" style={{ borderColor: 'var(--goblin-moss)', color: 'var(--goblin-moss)' }}>
            See how it works
          </button>
        </div>

        <p className="text-sm max-w-md mx-auto" style={{ color: 'var(--goblin-gray)' }}>
          No laptop setup. No token panic. Your goblin handles it.
        </p>
      </div>
    </section>
  );
}