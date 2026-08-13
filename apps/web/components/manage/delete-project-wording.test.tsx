/**
 * X1 — the delete confirmation says what happens to a PUBLISHED app before the click.
 *
 * The generic body has always mentioned "eine bereits veröffentlichte Live-Seite",
 * which reads as the Vercel preview to anyone who has one — and the two behave
 * nothing alike. A Vercel deployment stays on the builder's own account; a Living
 * App is removed from Goblin's plane and its address is retired for good. That is
 * the sentence that has to be on screen BEFORE the confirm, because afterwards
 * there is nothing to undo.
 *
 * Wording is pinned here rather than in an e2e run for the reason the hosted sheet
 * pins its own: the wording IS the honesty invariant, and a careless later edit
 * would soften it silently.
 */
import { describe, it, expect } from 'vitest';
import { renderToStaticMarkup } from 'react-dom/server';
import { ConfirmDialog } from './ManageDialogs';
import { manageLabels } from './labels';

const de = manageLabels('de');
const en = manageLabels('en');
const URL_ = 'https://meinladen.justgoblin.app';

const render = (body: string) =>
  renderToStaticMarkup(
    <ConfirmDialog
      open
      title={de.deleteProjectTitle}
      body={body}
      confirmLabel={de.delete}
      cancelLabel={de.cancel}
      onConfirm={() => {}}
      onClose={() => {}}
    />,
  );

describe('the published app is named, not implied', () => {
  it('puts the actual address in the dialog', () => {
    const html = render(`${de.deleteProjectBody} ${de.deleteProjectHosted(URL_)}`);
    expect(html).toContain('meinladen.justgoblin.app');
  });

  it('says it goes offline, the files go, and the address does not come back', () => {
    const body = de.deleteProjectHosted(URL_);
    expect(body).toContain('offline');
    expect(body).toContain('Dateien werden entfernt');
    // The consequence a builder would otherwise discover only by trying to republish.
    expect(body).toContain('dauerhaft vergeben');
    expect(body).toContain('nicht rückgängig');
  });

  it('does not promise the builder can reclaim their own name', () => {
    // `markOpsAppDeleted` keeps the tombstone precisely so nobody can — including them.
    expect(de.deleteProjectHosted(URL_)).toContain('auch du kannst sie nicht neu beanspruchen');
    expect(en.deleteProjectHosted(URL_)).toContain('not even you can claim it again');
  });

  it('falls back to the unchanged generic body when there is no published app', () => {
    const html = render(de.deleteProjectBody);
    expect(html).toContain('Projekt und alle seine Chats und Builds');
    expect(html).not.toContain('justgoblin.app');
    expect(html).not.toContain('dauerhaft vergeben');
  });
});

describe('bulk', () => {
  it('names every published address in the selection', () => {
    const body = de.bulkDeleteHosted([URL_, 'https://zweites.justgoblin.app']);
    expect(body).toContain('2 der ausgewählten Apps sind veröffentlicht');
    expect(body).toContain('meinladen.justgoblin.app');
    expect(body).toContain('zweites.justgoblin.app');
  });

  it('reads correctly for a single published app among many selected', () => {
    expect(de.bulkDeleteHosted([URL_])).toContain('Eine der ausgewählten Apps ist veröffentlicht');
    expect(en.bulkDeleteHosted([URL_])).toContain('One of the selected projects is published');
  });
});

describe('EN and DE stay in lockstep', () => {
  it('has both languages for both new strings', () => {
    for (const L of [de, en]) {
      expect(typeof L.deleteProjectHosted).toBe('function');
      expect(typeof L.bulkDeleteHosted).toBe('function');
      expect(L.deleteProjectHosted(URL_).length).toBeGreaterThan(80);
      expect(L.bulkDeleteHosted([URL_]).length).toBeGreaterThan(80);
    }
  });
});
