import { Smartphone, MessageSquare, Sparkles, Rocket } from "lucide-react";

export function HowItWorks() {
  const steps = [
    {
      icon: <Smartphone className="w-6 h-6" />,
      title: "Log in from any device",
      description: "Your workshop is always ready. Phone, laptop, tablet — it doesn't matter."
    },
    {
      icon: <MessageSquare className="w-6 h-6" />,
      title: "Tell your goblin what to build",
      description: "Plain english works best. No prompt engineering required."
    },
    {
      icon: <Sparkles className="w-6 h-6" />,
      title: "Watch your project grow",
      description: "Real time file tree. Edit directly. Ask for changes."
    },
    {
      icon: <Rocket className="w-6 h-6" />,
      title: "Push to GitHub. Deploy anywhere.",
      description: "One click publish. Your code, your repo, your deployment."
    }
  ];

  return (
    <section className="py-24 px-4 max-w-5xl mx-auto">
      <h2 className="text-3xl md:text-4xl font-semibold text-center mb-16" style={{ color: 'var(--goblin-slate)' }}>
        Ship in four steps.
      </h2>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-8">
        {steps.map((step, i) => (
          <div key={i} className="text-center">
            <div className="relative mb-6">
              <div className="w-16 h-16 rounded-full mx-auto flex items-center justify-center" style={{ backgroundColor: 'var(--goblin-ochre)', color: 'white' }}>
                {step.icon}
              </div>
              <div className="absolute -top-2 -right-2 w-6 h-6 rounded-full font-bold text-sm flex items-center justify-center" style={{ backgroundColor: 'var(--goblin-moss)', color: 'white' }}>
                {i + 1}
              </div>
            </div>
            <h3 className="font-semibold text-lg mb-2" style={{ color: 'var(--goblin-slate)' }}>{step.title}</h3>
            <p className="text-sm" style={{ color: 'var(--goblin-gray)' }}>{step.description}</p>
          </div>
        ))}
      </div>
    </section>
  );
}