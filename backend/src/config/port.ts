import { existsSync, readFileSync } from 'node:fs';

export const DEFAULT_PORT = 3847;

export function resolvePort(configFilePath: string): number {
  const fromEnv = parsePort(process.env.PORT);
  if (fromEnv !== undefined) return fromEnv;

  if (existsSync(configFilePath)) {
    try {
      const raw = readFileSync(configFilePath, 'utf8');
      const parsed = JSON.parse(raw) as { port?: unknown };
      const fromFile = parsePort(parsed.port);
      if (fromFile !== undefined) return fromFile;
    } catch (err) {
      console.warn(
        `[config] Failed to read ${configFilePath}, using fallback. Detail:`,
        err,
      );
    }
  }

  return DEFAULT_PORT;
}

function parsePort(value: unknown): number | undefined {
  if (value === undefined || value === null || value === '') return undefined;
  const n = typeof value === 'number' ? value : Number(value);
  if (!Number.isInteger(n) || n < 1 || n > 65535) return undefined;
  return n;
}
