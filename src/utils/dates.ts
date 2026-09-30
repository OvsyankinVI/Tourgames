import { CATALOG_TIME_ZONE } from '../config';

const dayFormatter = new Intl.DateTimeFormat('en-CA', {
  timeZone: CATALOG_TIME_ZONE, year: 'numeric', month: '2-digit', day: '2-digit',
});
export function dayKey(date: Date | string): string {
  const parts = dayFormatter.formatToParts(new Date(date));
  return ['year', 'month', 'day'].map(type => parts.find(p => p.type === type)?.value).join('-');
}
export function addDays(day: string, amount: number): string {
  const date = new Date(`${day}T12:00:00Z`);
  date.setUTCDate(date.getUTCDate() + amount);
  return date.toISOString().slice(0, 10);
}
export function endOfWeek(day: string): string {
  const weekday = new Date(`${day}T12:00:00Z`).getUTCDay();
  return addDays(day, (7 - weekday) % 7);
}
export function hourInMoscow(value: string): number {
  return Number(new Intl.DateTimeFormat('en-GB', { timeZone: CATALOG_TIME_ZONE, hour: '2-digit', hourCycle: 'h23' }).format(new Date(value)));
}
export const TIME_RANGES: Record<string, [number, number]> = { morning: [0, 12], afternoon: [12, 18], evening: [18, 24] };
export function formatDate(value: string): string {
  return new Intl.DateTimeFormat('ru-RU', { timeZone: CATALOG_TIME_ZONE, day: 'numeric', month: 'long' }).format(new Date(value));
}
export function formatTime(value: string): string {
  return new Intl.DateTimeFormat('ru-RU', { timeZone: CATALOG_TIME_ZONE, hour: '2-digit', minute: '2-digit', hourCycle: 'h23' }).format(new Date(value));
}
export function formatDuration(minutes: number | null): string {
  if (minutes === null) return 'Длительность уточняется';
  return minutes % 60 === 0 ? `${minutes / 60} ч` : `${minutes} мин`;
}
