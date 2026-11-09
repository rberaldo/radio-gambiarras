// Brazilian Portuguese formatting shared by every tool.

const numberFormat = new Intl.NumberFormat('pt-BR');

/** 46661 → "46.661". */
export function formatNumber(n: number): string {
  return numberFormat.format(n);
}

/** 4.86 with 1 digit → "4,9". */
export function formatDecimal(n: number, digits: number): string {
  return new Intl.NumberFormat('pt-BR', { minimumFractionDigits: digits, maximumFractionDigits: digits }).format(n);
}

/** "2026-10-23" → "23/10/2026". Returns the input unchanged if it is not an ISO date. */
export function formatDate(iso: string): string {
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(iso);
  return m ? `${m[3]}/${m[2]}/${m[1]}` : iso;
}

/** Whole days from one ISO date to another, or to today (UTC). */
export function daysSince(iso: string, today: Date = new Date()): number {
  const from = Date.parse(`${iso}T00:00:00Z`);
  const to = Date.UTC(today.getUTCFullYear(), today.getUTCMonth(), today.getUTCDate());
  return Math.floor((to - from) / 86_400_000);
}

/** "1 resultado", "2 resultados": picks the form by count. */
export function plural(n: number, one: string, many: string): string {
  return `${formatNumber(n)} ${n === 1 ? one : many}`;
}
