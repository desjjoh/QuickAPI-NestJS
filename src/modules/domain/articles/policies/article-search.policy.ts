/** Query normalization only; stored article text is not rewritten. */
export function normalizeArticleSearch(search?: string): string {
  return (search ?? '').normalize('NFC').trim().replace(/\s+/gu, ' ');
}

/** Literal substring search with ! as the explicit SQL LIKE escape character. */
export function articleSearchPattern(search?: string): string | undefined {
  const term = normalizeArticleSearch(search);
  if (!term) return undefined;
  return `%${term.replace(/[!%_]/g, '!$&')}%`;
}
