export const DEFAULT_TOOLS = ["칼", "도마", "프라이팬", "냄비", "주걱", "채칼"];

export function mergeToolOptions(...lists: Array<string[] | null | undefined>): string[] {
  const seen = new Set<string>();
  const result: string[] = [];
  for (const list of lists) {
    for (const item of list ?? []) {
      const name = item.trim();
      if (!name || seen.has(name)) continue;
      seen.add(name);
      result.push(name);
    }
  }
  return result;
}
