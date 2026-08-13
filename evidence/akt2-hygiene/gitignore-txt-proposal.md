# Proposal: un-ignore `.txt` under `evidence/` — NOT applied

**2026-08-13 · Act-2 closing hygiene, Unit 5 · proposed, deliberately not committed as a change**

## The trap

`.gitignore:2` is:

```gitignore
*.txt
```

Unanchored and unqualified, so it swallows **every** `.txt` file anywhere in the repo. It did
exactly that to Phase 3's four 390px DOM dumps, while `evidence/akt2-phase3-konsole/README.md`
cited all four by name — a README pointing at files that were not in the repo, and no error
anywhere to say so. `git add` on an ignored path fails silently unless you pass `-f`.

Phase 1 hit the same rule and survived it, because whoever wrote it happened to use `git add -f`
(`evidence/akt2-phase1/*.txt` are tracked). That is luck, not construction. The next person writing
evidence will lose it again, and the failure mode is the quiet one: the commit looks right, the
README looks right, and the file is gone.

## The proposed change

One line, appended after the existing rule:

```gitignore
*.txt
# …unchanged rules…

# Evidence is the exception: an evidence file that a report cites must be IN the repo.
# `*.txt` above is unanchored and swallows DOM dumps and curl output silently — `git add`
# on an ignored path fails without a word, so the loss is only found when someone follows
# a link in a README. (AKT 2 · Phase 3: four DOM dumps, cited and missing.)
!evidence/**/*.txt
```

## Why it is not applied here

A `.gitignore` change applies to **every future commit in the whole repo**, not to the four files
that prompted it. That is a standing policy change, and this sweep is explicitly docs-and-hygiene
with no behaviour changes. It is the founder's call.

## What to weigh

**For.** It closes the trap at the cause rather than at each symptom. The negation is narrow —
scoped to `evidence/`, nowhere else. Every other `*.txt` in the repo stays ignored. And it makes
the convention true: an evidence file a report cites is in the repo.

**Against.** `evidence/` is where large, generated, machine-written output lands. Un-ignoring
`.txt` there means the next person who dumps a 40 MB log into an evidence folder commits it without
noticing — the ignore rule is currently doing real work as an accident brake. Today's four files
are 15 KB total, so this is about the future, not the present.

**The middle option**, if the objection above bites: leave `.gitignore` alone and make the
convention explicit instead — every evidence README states that `.txt` needs `git add -f`, and
whoever writes one runs `git ls-files` against it before opening the PR. Cheaper, and it depends on
a human remembering, which is exactly what failed this time.

**Recommendation: apply the negation.** The failure it prevents is silent and the failure it risks
is loud — a large file in a diff gets noticed in review, a missing evidence file does not.

## If it is applied

The four Phase-3 files are already tracked (added with `-f` in this PR), so applying the negation
changes nothing about them. It only affects what happens next time. No other action is needed.
