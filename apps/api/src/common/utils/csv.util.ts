/**
 * Minimal RFC-4180 CSV serialization with CSV-injection (formula) hardening.
 *
 * - Fields containing a comma, double-quote, CR, or LF are wrapped in double
 *   quotes with internal quotes doubled.
 * - Fields beginning with a formula trigger (`= + - @`, tab, or CR) are prefixed
 *   with a single quote so spreadsheet apps do not evaluate them as formulas.
 */
const FORMULA_TRIGGER = /^[=+\-@\t\r]/;

export function csvField(value: unknown): string {
  if (value === null || value === undefined) return '';
  let str = String(value);
  if (FORMULA_TRIGGER.test(str)) {
    str = `'${str}`;
  }
  if (/[",\n\r]/.test(str)) {
    str = `"${str.replace(/"/g, '""')}"`;
  }
  return str;
}

export function csvRow(fields: ReadonlyArray<unknown>): string {
  return fields.map(csvField).join(',');
}

export function toCsv(
  header: ReadonlyArray<unknown>,
  rows: ReadonlyArray<ReadonlyArray<unknown>>,
): string {
  return [csvRow(header), ...rows.map(csvRow)].join('\n');
}
