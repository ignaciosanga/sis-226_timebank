export function normalizeName(value: string): string {
  return value.normalize('NFKC').trim().replace(/\s+/gu, ' ');
}

export function nameKey(value: string): string {
  return normalizeName(value).toLocaleLowerCase('es');
}
