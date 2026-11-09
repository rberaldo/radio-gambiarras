// Reading and writing the committed data files.
import { readFile } from 'node:fs/promises';

/** Stable serialization, so identical data gives identical bytes (and no commit). */
export const toJson = (value: unknown) => `${JSON.stringify(value, null, 1)}\n`;

/** Parsed JSON, or undefined if the file does not exist yet. */
export async function readJson<T>(path: string): Promise<T | undefined> {
  try {
    return JSON.parse(await readFile(path, 'utf8')) as T;
  } catch (err) {
    if ((err as NodeJS.ErrnoException).code === 'ENOENT') return undefined;
    throw err;
  }
}

const addYears = (isoDate: string, years: number) => `${Number(isoDate.slice(0, 4)) + years}${isoDate.slice(4)}`;

/** True once at least `years` have passed since an ISO date. */
export function olderThanYears(isoDate: string, years: number, today: string): boolean {
  return addYears(isoDate, years) <= today;
}
