-- 9B-4 Eval framework — task registry + per-run results

create table if not exists public.eval_tasks (
  id text primary key,
  category text not null,
  title text not null,
  prompt text not null,
  expected_keywords text[] not null default '{}',
  max_tokens int not null default 1000,
  enabled boolean not null default true,
  created_at timestamptz not null default now()
);

create table if not exists public.eval_results (
  id uuid primary key default gen_random_uuid(),
  task_id text not null references public.eval_tasks(id) on delete cascade,
  provider text not null,
  model text not null,
  run_id uuid not null,
  prompt_tokens int,
  completion_tokens int,
  latency_ms int,
  cost_usd numeric(10, 6),
  score numeric(4, 2),
  compiled boolean,
  output_text text,
  error text,
  created_at timestamptz not null default now()
);

create index if not exists eval_results_run_idx on public.eval_results(run_id, created_at desc);
create index if not exists eval_results_provider_idx on public.eval_results(provider, model, created_at desc);

alter table public.eval_tasks enable row level security;
alter table public.eval_results enable row level security;

drop policy if exists "Service role full access on eval_tasks" on public.eval_tasks;
create policy "Service role full access on eval_tasks"
  on public.eval_tasks for all
  using (auth.role() = 'service_role');

drop policy if exists "Service role full access on eval_results" on public.eval_results;
create policy "Service role full access on eval_results"
  on public.eval_results for all
  using (auth.role() = 'service_role');

-- Seed initial 5 tasks
insert into public.eval_tasks (id, category, title, prompt, expected_keywords) values
  ('coding-fizzbuzz-ts',  'coding',                'FizzBuzz in TypeScript',
   'Write a TypeScript function fizzBuzz(n: number): string[] that returns an array of strings 1..n with "Fizz" for multiples of 3, "Buzz" for multiples of 5, "FizzBuzz" for both. No explanation, just code.',
   array['fizzBuzz', 'string[]', 'Fizz', 'Buzz', '% 3', '% 5']),
  ('coding-debounce-js',  'coding',                'Debounce in JavaScript',
   'Write a JavaScript debounce(fn, wait) function. No explanation, just code.',
   array['debounce', 'setTimeout', 'clearTimeout', 'wait']),
  ('coding-react-hook',   'coding',                'React custom hook',
   'Write a React custom hook useLocalStorage<T>(key: string, initial: T) that syncs state with localStorage. TypeScript, no explanation.',
   array['useState', 'useEffect', 'localStorage', 'JSON.parse', 'JSON.stringify']),
  ('reasoning-prime',     'reasoning',             'Prime test reasoning',
   'Is 1099 a prime number? Answer yes or no, then briefly explain in one sentence.',
   array['yes', 'prime', '1099']),
  ('instruct-format-json','instruction-following', 'JSON Format',
   'Return ONLY a JSON object with keys "name" (string) and "age" (number), no markdown, no explanation. Use name="Alex" and age=30.',
   array['{', '"name"', '"Alex"', '"age"', '30', '}'])
on conflict (id) do update set
  title = excluded.title,
  prompt = excluded.prompt,
  expected_keywords = excluded.expected_keywords,
  category = excluded.category;
