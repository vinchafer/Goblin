import { Cpu, Zap, Monitor, Settings } from "lucide-react";

export function TheProblem() {
  const problems = [
    {
      icon: <Cpu className="w-6 h-6" />,
      title: "Hardware blocked",
      description: "You shouldn't need a $3000 laptop just to run an LLM."
    },
    {
      icon: <Zap className="w-6 h-6" />,
      title: "Token panic",
      description: "Counting tokens every 10 minutes instead of shipping code."
    },
    {
      icon: <Monitor className="w-6 h-6" />,
      title: "Stuck to your desk",
      description: "Why can't you build from your phone on the train?"
    },
    {
      icon: <Settings className="w-6 h-6" />,
      title: "IDE overwhelm",
      description: "17 extensions just to get started. Where's the fun?"
    }
  ];

  return (
    <section className="py-24 px-4 max-w-6xl mx-auto">
      <h2 className="text-3xl md:text-4xl font-semibold text-center mb-16" style={{ color: 'var(--goblin-slate)' }}>
        Building with AI shouldn't require a $3k laptop.
      </h2>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        {problems.map((problem, i) => (
          <div key={i} className="p-6 rounded-xl border" style={{ borderColor: 'var(--goblin-light)' }}>
            <div className="w-12 h-12 rounded-lg mb-4 flex items-center justify-center" style={{ backgroundColor: 'var(--goblin-light)' }}>
              <div style={{ color: 'var(--goblin-warn)' }}>{problem.icon}</div>
            </div>
            <h3 className="font-semibold text-lg mb-2" style={{ color: 'var(--goblin-slate)' }}>{problem.title}</h3>
            <p className="text-sm" style={{ color: 'var(--goblin-gray)' }}>{problem.description}</p>
          </div>
        ))}
      </div>
    </section>
  );
}