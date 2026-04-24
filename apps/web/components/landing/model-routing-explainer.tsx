import { Cloud, Gift, Key } from "lucide-react";

export function ModelRoutingExplainer() {
  const options = [
    {
      icon: <Cloud className="w-6 h-6" />,
      title: "Goblin Hosted",
      description: "Our GPUs. Fair-use unlimited. Always on."
    },
    {
      icon: <Gift className="w-6 h-6" />,
      title: "Free API Pool",
      description: "Gemini, Groq when available. Gratis extra."
    },
    {
      icon: <Key className="w-6 h-6" />,
      title: "Bring Your Own Key",
      description: "Your Claude, your OpenAI. No markup."
    }
  ];

  return (
    <section className="py-24 px-4 max-w-5xl mx-auto">
      <h2 className="text-3xl md:text-4xl font-semibold text-center mb-16" style={{ color: 'var(--goblin-slate)' }}>
        Three ways your goblin stays fed.
      </h2>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-6">
        {options.map((option, i) => (
          <div key={i} className="p-6 rounded-xl border text-center" style={{ borderColor: 'var(--goblin-light)' }}>
            <div className="w-12 h-12 rounded-lg mb-4 mx-auto flex items-center justify-center" style={{ backgroundColor: 'var(--goblin-light)' }}>
              <div style={{ color: 'var(--goblin-moss)' }}>{option.icon}</div>
            </div>
            <h3 className="font-semibold text-lg mb-2" style={{ color: 'var(--goblin-slate)' }}>{option.title}</h3>
            <p className="text-sm" style={{ color: 'var(--goblin-gray)' }}>{option.description}</p>
          </div>
        ))}
      </div>

      <p className="text-center text-sm max-w-lg mx-auto" style={{ color: 'var(--goblin-gray)' }}>
        Your goblin switches automatically. You never hit a wall.
      </p>
    </section>
  );
}