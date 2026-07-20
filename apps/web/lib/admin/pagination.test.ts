import { describe, it, expect } from 'vitest';
import { hasNextPage, hasPrevPage } from './pagination';

describe('hasNextPage', () => {
  it('a full page implies there may be more', () => {
    expect(hasNextPage(20, 20)).toBe(true);
  });

  it('a short page is the last page', () => {
    expect(hasNextPage(13, 20)).toBe(false);
  });

  it('an empty page has no next', () => {
    expect(hasNextPage(0, 20)).toBe(false);
  });

  it('regression: the double-filter bug — a server-full page whose CLIENT-filtered\n' +
     'count fell below the page size must STILL offer Next (we now use the raw count)', () => {
    const serverReturned = 20;         // the server sent a full page
    const clientFilteredOut = 6;       // the redundant client filter dropped 6
    const buggyCount = serverReturned - clientFilteredOut; // 14 → old logic hid Next
    expect(hasNextPage(buggyCount, 20)).toBe(false);   // what the OLD code computed
    expect(hasNextPage(serverReturned, 20)).toBe(true); // what the FIX computes
  });

  it('guards a non-positive page size', () => {
    expect(hasNextPage(20, 0)).toBe(false);
  });
});

describe('hasPrevPage', () => {
  it('page 1 has no previous', () => expect(hasPrevPage(1)).toBe(false));
  it('page 2+ has a previous', () => expect(hasPrevPage(2)).toBe(true));
});
