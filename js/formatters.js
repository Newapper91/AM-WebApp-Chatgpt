/**
 * formatters.js
 * --------------
 * Small, dependency-free formatting helpers. Centralizing these means every
 * dollar/percent/date in the UI looks consistent, and you only need to
 * change formatting in one place.
 */

const Fmt = {
  /** $1,234.56 (or -$1,234.56). Always 2 decimal places. */
  currency(value) {
    if (value === null || value === undefined || Number.isNaN(value)) return '—';
    return value.toLocaleString('en-US', {
      style: 'currency',
      currency: 'USD',
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    });
  },

  /** $1,234 - rounded to whole dollars, useful for large totals. */
  currencyRounded(value) {
    if (value === null || value === undefined || Number.isNaN(value)) return '—';
    return value.toLocaleString('en-US', {
      style: 'currency',
      currency: 'USD',
      minimumFractionDigits: 0,
      maximumFractionDigits: 0,
    });
  },

  /** 6.50% - percent value already expressed as e.g. 6.5 (not 0.065). */
  percent(value, decimals = 2) {
    if (value === null || value === undefined || Number.isNaN(value)) return '—';
    return `${value.toFixed(decimals)}%`;
  },

  /** "Jan 2031" */
  monthYear(date) {
    if (!date) return '—';
    return date.toLocaleDateString('en-US', { month: 'short', year: 'numeric' });
  },

  /** "January 15, 2031" */
  longDate(date) {
    if (!date) return '—';
    return date.toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' });
  },

  /** "3 years, 2 months" (handles singular/plural and zero cases) */
  yearsMonths(totalMonths) {
    const months = Math.round(totalMonths);
    const sign = months < 0 ? '-' : '';
    const abs = Math.abs(months);
    const y = Math.floor(abs / 12);
    const m = abs % 12;
    const parts = [];
    if (y > 0) parts.push(`${y} year${y === 1 ? '' : 's'}`);
    if (m > 0 || parts.length === 0) parts.push(`${m} month${m === 1 ? '' : 's'}`);
    return sign + parts.join(', ');
  },

  /** Parse a number input safely, returning a fallback (default 0) if invalid/empty. */
  num(value, fallback = 0) {
    const n = parseFloat(value);
    return Number.isFinite(n) ? n : fallback;
  },
};

window.Fmt = Fmt;
