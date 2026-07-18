const PRIORITY_SIGNALS: readonly (readonly [signal: string, score: number])[] = [
  ["contact", 950],
  ["pricing", 940],
  ["booking", 930],
  ["checkout", 920],
  ["services", 900],
  ["service", 890],
  ["products", 880],
  ["product", 870],
  ["signup", 850],
  ["sign-up", 850],
  ["login", 840],
  ["about", 820],
  ["blog", 300],
];

export function scoreUrlPriority(input: string | URL): number {
  const url = input instanceof URL ? input : new URL(input);
  const normalizedPath = url.pathname.toLowerCase();

  if (normalizedPath === "/") {
    return 1_000;
  }

  for (const [signal, score] of PRIORITY_SIGNALS) {
    if (normalizedPath.includes(signal)) {
      return score;
    }
  }

  return 500;
}
