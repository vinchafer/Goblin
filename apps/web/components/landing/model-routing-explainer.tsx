import { Cloud, Gift, Key } from "lucide-react";

const OPTIONS = [
  {
    icon: <Cloud className="w-6 h-6" />,
    title: "Goblin Hosted",
    description: "Our GPUs. Fair-use unlimited. Always on."
  },
  {
    icon: <Gift className="w-6 h-6" />,
    title: "Free-API Pool",
    description: "Gemini, Groq when available. Gratis extra."
  },
  {
    icon: <Key className="w-6 h-6" />,
    title: "Bring Your Own Key",
    description: "Your Claude, your OpenAI. No markup."
  }
];

export function ModelRoutingExplainer() {
  return (
    <section
      className="py-24 px-4"
      style={{ backgroundColor: "var(--goblin-cream2)" }}
    >
      <div className="max-w-5xl mx-auto">
        <h2
          className="font-fraunces font-bold text-center mb-4"
          style={{
            fontSize: "clamp(24px, 4vw, 40px)",
            color: "var(--goblin-bark)"
          }}
        >
          Three ways your goblin stays fed.
        </h2>
        <p
          className="text-center text-sm mb-14"
          style={{ color: "var(--goblin-meta)", fontFamily: "var(--font-dm-sans)" }}
        >
          Your goblin switches automatically. You never hit a wall.
        </p>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          {OPTIONS.map((option, i) => (
            <div
              key={i}
              className="p-6 rounded-2xl border text-center"
              style={{
                borderColor: "var(--goblin-border)",
                backgroundColor: "#fff"
              }}
            >
              <div
                className="w-12 h-12 rounded-xl mb-4 mx-auto flex items-center justify-center"
                style={{ backgroundColor: "rgba(30,58,28,0.07)" }}
              >
                <div style={{ color: "var(--goblin-moss)" }}>{option.icon}</div>
              </div>
              <h3
                className="font-semibold text-base mb-2"
                style={{ color: "var(--goblin-bark)", fontFamily: "var(--font-dm-sans)" }}
              >
                {option.title}
              </h3>
              <p
                className="text-sm"
                style={{ color: "var(--goblin-meta)", fontFamily: "var(--font-dm-sans)" }}
              >
                {option.description}
              </p>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
