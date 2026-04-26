import { LoginForm } from "@/components/auth/login-form";
import { Check } from "lucide-react";

const PROOF_POINTS = [
  "No token panic",
  "Build from anywhere",
  "Ship to GitHub in one click"
];

export default function LoginPage() {
  return (
    <main className="min-h-screen flex">
      {/* LEFT — Moss brand panel (hidden on mobile) */}
      <div
        className="hidden lg:flex lg:w-2/5 flex-col justify-between p-12 relative overflow-hidden"
        style={{ backgroundColor: "var(--goblin-moss)" }}
      >
        {/* Grid decoration */}
        <div
          className="absolute inset-0 pointer-events-none opacity-[0.04]"
          style={{
            backgroundImage:
              "linear-gradient(rgba(255,255,255,1) 1px, transparent 1px), linear-gradient(90deg, rgba(255,255,255,1) 1px, transparent 1px)",
            backgroundSize: "40px 40px"
          }}
        />

        <div className="relative z-10">
          <a href="/">
            <h1
              className="font-fraunces font-bold mb-2"
              style={{ fontSize: "48px", color: "var(--goblin-ochre)", letterSpacing: "-1px" }}
            >
              Goblin.
            </h1>
          </a>
          <p
            className="text-lg"
            style={{
              color: "rgba(255,255,255,0.6)",
              fontFamily: "var(--font-dm-sans)"
            }}
          >
            The cloud workshop for builders.
          </p>
        </div>

        <div className="relative z-10 space-y-4">
          {PROOF_POINTS.map((point) => (
            <div key={point} className="flex items-center gap-3">
              <span
                className="w-5 h-5 rounded-full flex items-center justify-center shrink-0"
                style={{ backgroundColor: "rgba(201,147,58,0.25)" }}
              >
                <Check className="w-3 h-3" style={{ color: "var(--goblin-ochre)" }} strokeWidth={3} />
              </span>
              <span
                className="text-sm"
                style={{
                  color: "rgba(255,255,255,0.65)",
                  fontFamily: "var(--font-dm-sans)"
                }}
              >
                {point}
              </span>
            </div>
          ))}
        </div>

        <p
          className="relative z-10 text-xs"
          style={{ color: "rgba(255,255,255,0.2)", fontFamily: "var(--font-dm-sans)" }}
        >
          © 2026 Goblin
        </p>
      </div>

      {/* RIGHT — Login form */}
      <div
        className="flex-1 flex flex-col items-center justify-center px-6 py-12"
        style={{ backgroundColor: "var(--goblin-cream)" }}
      >
        {/* Mobile logo */}
        <div className="lg:hidden mb-10 text-center">
          <a href="/">
            <span
              className="font-fraunces font-bold text-4xl"
              style={{ color: "var(--goblin-moss)" }}
            >
              Goblin<span style={{ color: "var(--goblin-ochre)" }}>.</span>
            </span>
          </a>
        </div>

        <div className="w-full max-w-sm">
          <h2
            className="font-fraunces font-bold mb-2"
            style={{ fontSize: "28px", color: "var(--goblin-moss)" }}
          >
            Welcome back.
          </h2>
          <p
            className="text-sm mb-8"
            style={{
              color: "var(--goblin-meta)",
              fontFamily: "var(--font-dm-sans)"
            }}
          >
            Enter your email — we&apos;ll send a magic link.
          </p>

          <LoginForm />

          <p
            className="text-center mt-6 text-xs"
            style={{
              color: "var(--goblin-meta)",
              fontFamily: "var(--font-dm-sans)"
            }}
          >
            No password. No friction. Just your email.
          </p>
        </div>
      </div>
    </main>
  );
}
