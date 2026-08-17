/**
 * Render every auth mail Goblin can send to a file, so the founder can look at
 * them before a single real message goes out (AKT1-STRANG-2 · U4).
 *
 * Uses the REAL templates and the REAL link builder — the only thing that is not
 * real is the token, which is a placeholder. Nothing is sent; Resend is never
 * touched.
 *
 *   pnpm --filter @goblin/api exec tsx src/scripts/render-auth-mail-previews.ts
 *
 * Each mail carries German AND English in one message (that is the template
 * design — see lib/auth-email-templates.ts), so one file per type is the
 * complete bilingual artifact.
 */
import { mkdirSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import {
  renderAuthEmail,
  buildConfirmUrl,
  type AuthEmailType,
} from '../lib/auth-email-templates';

const TYPES: AuthEmailType[] = ['recovery', 'signup', 'email_change', 'magiclink', 'invite'];
const OUT_DIR = join(process.cwd(), '../../_sprint/akt1-strang-2/mail-previews');
const ORIGIN = process.env.NEXT_PUBLIC_APP_URL ?? 'https://www.justgoblin.com';
const RECIPIENT = 'vinc.hafner3@gmail.com';

mkdirSync(OUT_DIR, { recursive: true });

const index: string[] = [];

for (const type of TYPES) {
  const actionUrl = buildConfirmUrl({
    origin: ORIGIN,
    tokenHash: 'PREVIEW-TOKEN-HASH-not-a-real-token',
    type,
  });
  const { subject, html, text } = renderAuthEmail(type, { email: RECIPIENT, actionUrl });
  const file = `${type}.html`;
  const textFile = `${type}.txt`;
  writeFileSync(join(OUT_DIR, file), html, 'utf8');
  // The plain-text alternative part goes out with every one of these mails, so a
  // preview that showed only the HTML would be a preview of half the message.
  writeFileSync(join(OUT_DIR, textFile), text, 'utf8');
  index.push(`| \`${type}\` | ${subject} | [${file}](./${file}) | [${textFile}](./${textFile}) |`);
  // eslint-disable-next-line no-console
  console.log(`${type.padEnd(14)} subject="${subject}"  html ${html.length} B / text ${text.length} B -> ${file}, ${textFile}`);
}

writeFileSync(
  join(OUT_DIR, 'README.md'),
  [
    '# Auth-Mail-Vorschauen (AKT1-STRANG-2 · U4)',
    '',
    'Mit den echten Templates gerendert, **nichts verschickt**. Der Token im Button-Link',
    'ist ein Platzhalter — die Links funktionieren bewusst nicht.',
    '',
    `Empfänger im Beispiel: \`${RECIPIENT}\` · Origin: \`${ORIGIN}\``,
    '',
    'Jede Mail trägt Deutsch **und** Englisch in einer Nachricht — eine Datei pro Typ',
    'ist also die vollständige zweisprachige Vorschau.',
    '',
    'Jede Mail geht als **multipart/alternative** raus — HTML *und* Textteil.',
    '',
    '| Typ | Betreff | HTML | Text |',
    '|---|---|---|---|',
    ...index,
    '',
    'Neu erzeugen:',
    '',
    '```',
    'pnpm --filter @goblin/api exec tsx src/scripts/render-auth-mail-previews.ts',
    '```',
  ].join('\n'),
  'utf8',
);

// eslint-disable-next-line no-console
console.log(`\n${TYPES.length} previews + README written to ${OUT_DIR}`);
