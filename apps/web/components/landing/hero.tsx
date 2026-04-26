"use client";

export function Hero() {
  return (
    <section className="pt-24 pb-32 px-4" style={{ backgroundColor: 'var(--goblin-cream)' }}>
      <div className="max-w-4xl mx-auto text-center space-y-8">
        <h1 
          className="font-fraunces font-bold leading-tight"
          style={{ 
            fontSize: 'clamp(36px, 8vw, 72px)',
            color: 'var(--goblin-bark)'
          }}
        >
          Build weird stuff.
          <br />
          Deploy from anywhere.
        </h1>

        <p 
          className="text-xl max-w-2xl mx-auto"
          style={{ color: 'var(--goblin-slate)' }}
        >
          Your AI workshop in the cloud. No token panic. No laptop limits.
          <br />
          Your goblin handles the rest.
        </p>

        <div className="flex flex-col sm:flex-row items-center justify-center gap-4 pt-4">
          <a
            href="/login"
            className="w-full sm:w-auto px-8 py-3 rounded-lg font-medium text-white text-center min-h-[44px] flex items-center justify-center"
            style={{ backgroundColor: 'var(--goblin-moss)' }}
          >
            Start building free
          </a>
          <a
            href="#how-it-works"
            className="px-8 py-3 rounded-lg font-medium"
            style={{ color: 'var(--goblin-moss)' }}
          >
            See how it works
          </a>
        </div>

        <div className="pt-8 flex flex-wrap items-center justify-center gap-6 text-sm" style={{ color: 'var(--goblin-gray)' }}>
          <span>Fair-use unlimited inference</span>
          <span className="text-xl">·</span>
          <span>BYOK support</span>
          <span className="text-xl">·</span>
          <span>GitHub push</span>
        </div>
      </div>
    </section>
  );
}