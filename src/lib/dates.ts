/** Today's date as YYYY-MM-DD in the writer's own time zone (not UTC), so a late-night session counts for that day. */
export const localDate = (d: Date = new Date()): string => {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
};

/** Whole days from today to a YYYY-MM-DD date, counting today. Negative once the date has passed. */
export const daysUntil = (dateStr: string, from: Date = new Date()): number => {
  const [y, m, d] = dateStr.split('-').map(Number);
  const target = new Date(y, (m || 1) - 1, d || 1);
  const start = new Date(from.getFullYear(), from.getMonth(), from.getDate());
  return Math.round((target.getTime() - start.getTime()) / 86400000) + 1;
};
