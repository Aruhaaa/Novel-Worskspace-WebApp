const rtf = typeof Intl !== 'undefined' && 'RelativeTimeFormat' in Intl ? new Intl.RelativeTimeFormat(undefined, { numeric: 'auto' }) : null;

/** "5 minutes ago", "yesterday", "3 weeks ago". */
export const timeAgo = (iso: string, now: number = Date.now()): string => {
  const then = new Date(iso).getTime();
  if (Number.isNaN(then)) return '';
  const seconds = Math.round((then - now) / 1000);
  const abs = Math.abs(seconds);
  if (abs < 45) return 'just now';
  const steps: [number, Intl.RelativeTimeFormatUnit][] = [
    [60, 'minute'],
    [3600, 'hour'],
    [86400, 'day'],
    [604800, 'week'],
    [2629800, 'month'],
    [31557600, 'year'],
  ];
  let unit: Intl.RelativeTimeFormatUnit = 'minute';
  let size = 60;
  for (const [limit, name] of steps) {
    if (abs >= limit) {
      unit = name;
      size = limit;
    }
  }
  const value = Math.round(seconds / size);
  return rtf ? rtf.format(value, unit) : new Date(then).toLocaleDateString();
};
