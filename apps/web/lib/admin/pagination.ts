// FOUNDER-WALK-2 U5.2 — admin Users pagination.
//
// The Users page filtered the SAME search twice: the server applied ?search=
// and returned up to `pageSize` rows, then the client re-ran users.filter(email
// includes search) AND drove the "Next" button off that re-filtered length
// (`filteredUsers.length < 20`). When the client filter dropped any server row
// (different match semantics, casing, a non-email match), the count fell below
// the page size and Next was wrongly disabled — a real page of results became
// unreachable.
//
// The fix removes the redundant client filter (the server already searched) and
// bases pagination on the RAW page fill. This pure helper is that rule.

/**
 * Whether a "Next page" exists, given how many rows the server returned for the
 * current page and the page size. A full page implies there may be more; a
 * short (or empty) page is the last one.
 */
export function hasNextPage(rowCount: number, pageSize: number): boolean {
  if (pageSize <= 0) return false;
  return rowCount >= pageSize;
}

/** Whether a "Previous page" exists for a 1-indexed page number. */
export function hasPrevPage(page: number): boolean {
  return page > 1;
}
