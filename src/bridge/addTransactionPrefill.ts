export type AddTransactionPrefill = {
  notes?: string;
};

export function appendAddTransactionPrefill(
  candidateUrl: string,
  prefill: AddTransactionPrefill,
  baseUrl: string,
): string {
  let url: URL;
  let base: URL;

  try {
    base = new URL(baseUrl);
    url = new URL(candidateUrl, base);
  } catch {
    return candidateUrl;
  }

  if (url.origin !== base.origin || url.pathname !== '/transactions/new') {
    return candidateUrl;
  }

  if (prefill.notes && !url.searchParams.has('notes')) {
    url.searchParams.set('notes', prefill.notes);
  }

  return url.pathname + url.search + url.hash;
}
