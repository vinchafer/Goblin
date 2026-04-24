export function FAQ() {
  const questions = [
    {
      q: "What does 'fair-use unlimited' actually mean?",
      a: "You can build as much as you want. We don't throttle. If you're using 10x the average we might reach out, but this is for normal human builders, not bots."
    },
    {
      q: "Do I need to know how to code?",
      a: "No. But if you do know how to code, you'll love Goblin even more. We show you every line we write and let you edit directly."
    },
    {
      q: "Can I use my own Claude or OpenAI keys?",
      a: "Yes. Bring any API key you want. Goblin will use yours first before touching shared capacity. No markup, ever."
    },
    {
      q: "What happens to my projects if I cancel?",
      a: "They stay. You can always log back in and push them to GitHub. We won't delete your work."
    },
    {
      q: "Is my code private?",
      a: "Yes. Your projects are only visible to you. We never train on user code. Ever."
    },
    {
      q: "Where is my code stored?",
      a: "Encrypted at rest on European servers. Supabase Postgres for metadata, S3 compatible object storage for files."
    },
    {
      q: "Can I use Goblin on my phone?",
      a: "Yes. That's the whole point. Build from your bed. Build from the train. Build from wherever you happen to be."
    }
  ];

  return (
    <section className="py-24 px-4 max-w-3xl mx-auto">
      <h2 className="text-3xl md:text-4xl font-semibold text-center mb-16" style={{ color: 'var(--goblin-slate)' }}>
        Questions your goblin anticipated.
      </h2>

      <div className="space-y-3">
        {questions.map((item, i) => (
          <details key={i} className="border rounded-lg" style={{ borderColor: 'var(--goblin-light)' }}>
            <summary className="p-4 font-medium cursor-pointer list-none flex items-center justify-between" style={{ color: 'var(--goblin-slate)' }}>
              {item.q}
              <span className="text-lg">+</span>
            </summary>
            <div className="px-4 pb-4 text-sm" style={{ color: 'var(--goblin-gray)' }}>
              {item.a}
            </div>
          </details>
        ))}
      </div>
    </section>
  );
}