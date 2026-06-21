export function actualTimestampNow(date: Date = new Date()): string {
  return `${date.toISOString()}-0000-0000000000000000`;
}

