import { Cron } from 'croner';

const ALIASES: Record<string, string> = {
  '@yearly': '0 0 1 1 *', '@annually': '0 0 1 1 *', '@monthly': '0 0 1 * *',
  '@weekly': '0 0 * * 0', '@daily': '0 0 * * *', '@midnight': '0 0 * * *',
  '@hourly': '0 * * * *',
};

export function normalizeExpr(expr: string): string {
  return ALIASES[expr.trim().toLowerCase()] ?? expr.trim();
}

export function nextRunsTz(expr: string, n: number, tz: string): Date[] {
  const job = new Cron(normalizeExpr(expr), { timezone: tz === 'local' ? undefined : tz });
  return job.nextRuns(n);
}
