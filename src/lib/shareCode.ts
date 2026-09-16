const ALPHABET = "0123456789ABCDEFGHJKMNPQRSTVWXYZ";

export function normalizeShareCode(input: string): string | null {
  const raw = input
    .toUpperCase()
    .replace(/[^0-9A-Z]/g, "")
    .replace(/[IL]/g, "1")
    .replace(/O/g, "0")
    .replace(/U/g, "V");
  if (raw.length !== 8) return null;
  if ([...raw].some((ch) => !ALPHABET.includes(ch))) return null;
  return `${raw.slice(0, 4)}-${raw.slice(4)}`;
}

export function sharePath(code: string): string {
  return `/s/${encodeURIComponent(code)}`;
}
