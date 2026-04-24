import Link from "next/link";

export function Footer() {
  return (
    <footer className="py-16 px-4 border-t" style={{ borderColor: 'var(--goblin-light)' }}>
      <div className="max-w-6xl mx-auto">
        <div className="grid grid-cols-1 md:grid-cols-4 gap-8 mb-12">
          <div>
            <h3 className="text-2xl font-bold mb-3" style={{ fontFamily: 'Fraunces, Georgia, serif', color: 'var(--goblin-moss)' }}>Goblin</h3>
            <p className="text-sm" style={{ color: 'var(--goblin-gray)' }}>The cloud workshop for vibe coders.</p>
          </div>

          <div>
            <h4 className="font-medium mb-3" style={{ color: 'var(--goblin-slate)' }}>Product</h4>
            <ul className="space-y-2 text-sm" style={{ color: 'var(--goblin-gray)' }}>
              <li><Link href="/#pricing">Pricing</Link></li>
              <li><Link href="/#faq">FAQ</Link></li>
            </ul>
          </div>

          <div>
            <h4 className="font-medium mb-3" style={{ color: 'var(--goblin-slate)' }}>Community</h4>
            <ul className="space-y-2 text-sm" style={{ color: 'var(--goblin-gray)' }}>
              <li><a href="https://discord.gg/goblin">Discord</a></li>
              <li><a href="https://github.com/goblin-dev">GitHub</a></li>
              <li><a href="https://twitter.com/goblin_dev">Twitter</a></li>
            </ul>
          </div>

          <div>
            <h4 className="font-medium mb-3" style={{ color: 'var(--goblin-slate)' }}>Legal</h4>
            <ul className="space-y-2 text-sm" style={{ color: 'var(--goblin-gray)' }}>
              <li><Link href="/terms">Terms</Link></li>
              <li><Link href="/privacy">Privacy</Link></li>
              <li><Link href="/imprint">Imprint</Link></li>
            </ul>
          </div>
        </div>

        <div className="pt-6 border-t text-sm" style={{ borderColor: 'var(--goblin-light)', color: 'var(--goblin-gray)' }}>
          © {new Date().getFullYear()} Goblin. All rights reserved.
        </div>
      </div>
    </footer>
  );
}