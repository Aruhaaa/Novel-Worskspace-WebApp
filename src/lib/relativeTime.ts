import { locale, t } from '../i18n';

// One formatter per language, made when first needed
const formatters = new Map<string, Intl.RelativeTimeFormat>();
const formatter = (): Intl.RelativeTimeFormat | null => {
  if (typeof Intl === 'undefined' || !('RelativeTimeFormat' in Intl)) return null;
  const key = locale() ?? 'default';
  let f = formatters.get(key);
  if (!f) {
    f = new Intl.RelativeTimeFormat(locale(), { numeric: 'auto' });
    formatters.set(key, f);
  }
  return f;
};

/** "5 minutes ago", "yesterday", "3 weeks ago", in the language the app is showing. */
export const timeAgo = (iso: string, now: number = Date.now()): string => {
  const then = new Date(iso).getTime();
  if (Number.isNaN(then)) return '';
  const seconds = Math.round((then - now) / 1000);
  const abs = Math.abs(seconds);
  if (abs < 45) return t('just now');
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
  const f = formatter();
  return f ? f.format(value, unit) : new Date(then).toLocaleDateString(locale());
};
