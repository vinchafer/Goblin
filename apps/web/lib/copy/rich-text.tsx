/**
 * WAVE-ABOUT-MANIFESTO · U1 — inline emphasis for long-form locale copy.
 *
 * The /about and /manifesto copy is prose, and its bolded lines are load-bearing:
 * "A tool you can't trust isn't a tool — it's a slot machine." and "you can leave."
 * are the memory hooks the page is built around. So the emphasis has to survive
 * the trip through the locale layer.
 *
 * There were two ways to do that and only one of them keeps the honesty bar:
 *
 *   • Split every emphasised run into its own locale key. The German translator
 *     then receives fragments ("you can leave.") with no sentence around them,
 *     and the rhythm — which is the whole mechanism of this copy — is destroyed
 *     before they start. Rejected.
 *   • Keep ONE key per paragraph, in plain prose, and mark emphasis inline. The
 *     translator reads and writes whole sentences. That is this file.
 *
 * The grammar is deliberately the smallest thing that covers the copy: `**bold**`
 * and `*italic*`, no nesting, no links, no lists, no HTML. It is NOT a markdown
 * renderer and must not grow into one — anything richer belongs in a component,
 * not in a translated string. Unknown or unbalanced markers are left as literal
 * text rather than swallowed, so a mistyped German string degrades to visible
 * asterisks instead of vanishing copy.
 *
 * No `dangerouslySetInnerHTML` anywhere: the parser emits React elements, so a
 * translated string can never inject markup.
 */

import { Fragment, type ReactNode } from 'react';

type Token = { text: string; bold: boolean; italic: boolean };

/**
 * Split a paragraph into emphasis runs.
 *
 * `**` is matched before `*` so a bold run is never read as two italics. A marker
 * with no closing partner is emitted as literal text (see the file header).
 * Exported for the unit test; pages use `<RichText>`.
 */
export function tokenizeEmphasis(input: string): Token[] {
  const tokens: Token[] = [];
  let plain = '';
  let i = 0;

  const flush = () => {
    if (plain) {
      tokens.push({ text: plain, bold: false, italic: false });
      plain = '';
    }
  };

  while (i < input.length) {
    const isBold = input.startsWith('**', i);
    const isItalic = !isBold && input[i] === '*';

    if (!isBold && !isItalic) {
      plain += input[i];
      i += 1;
      continue;
    }

    const marker = isBold ? '**' : '*';
    const close = input.indexOf(marker, i + marker.length);
    // Unbalanced, or an empty run like `**` / `* *` — keep the marker literal.
    if (close === -1 || close === i + marker.length) {
      plain += marker;
      i += marker.length;
      continue;
    }

    flush();
    tokens.push({
      text: input.slice(i + marker.length, close),
      bold: isBold,
      italic: isItalic,
    });
    i = close + marker.length;
  }

  flush();
  return tokens;
}

/**
 * Render one paragraph's worth of copy with its emphasis intact.
 *
 * Bold uses `<strong>` and italic `<em>` — the semantic elements, so the emphasis
 * a sighted reader sees is the same emphasis a screen reader announces.
 */
export function RichText({ children }: { children: string }): ReactNode {
  return tokenizeEmphasis(children).map((token, index) => {
    if (token.bold) return <strong key={index}>{token.text}</strong>;
    if (token.italic) return <em key={index}>{token.text}</em>;
    return <Fragment key={index}>{token.text}</Fragment>;
  });
}
