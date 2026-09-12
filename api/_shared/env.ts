export function env(name: string): string | undefined {
  const netlify = (globalThis as { Netlify?: { env: { get: (key: string) => string | undefined } } })
    .Netlify;
  if (netlify?.env) return netlify.env.get(name);
  const nodeProcess = (globalThis as { process?: { env?: Record<string, string | undefined> } }).process;
  return nodeProcess?.env?.[name];
}

export function requireEnv(name: string): string {
  const value = env(name);
  if (!value) {
    throw new Error(`${name} 환경 변수가 없습니다.`);
  }
  return value;
}
