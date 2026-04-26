"use client";

const QUESTIONS = [
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

export function FAQ() {
  return (
    <section
      id="faq"
      className="py-24 px-4"
      style={{ backgroundColor: "var(--goblin-cream)" }}
    >
      <div className="max-w-2xl mx-auto">
        <h2
          className="font-fraunces font-bold text-center mb-12"
          style={{
            fontSize: "clamp(24px, 4vw, 40px)",
            color: "var(--goblin-bark)"
          }}
        >
          Questions your goblin anticipated.
        </h2>

        <div className="space-y-2">
          {QUESTIONS.map((item, i) => (
            <details
              key={i}
              className="group border rounded-xl overflow-hidden transition-colors"
              style={{ borderColor: "var(--goblin-border)" }}
            >
              <summary
                className="flex items-center justify-between p-5 cursor-pointer list-none font-medium select-none"
                style={{
                  color: "var(--goblin-bark)",
                  fontFamily: "var(--font-dm-sans)"
                }}
              >
                {item.q}
                <span
                  className="ml-4 shrink-0 text-lg transition-transform group-open:rotate-45"
                  style={{ color: "var(--goblin-meta)" }}
                >
                  +
                </span>
              </summary>
              <div
                className="px-5 pb-5 text-sm leading-relaxed"
                style={{
                  color: "var(--goblin-meta)",
                  fontFamily: "var(--font-dm-sans)"
                }}
              >
                {item.a}
              </div>
            </details>
          ))}
        </div>
      </div>
    </section>
  );
}
