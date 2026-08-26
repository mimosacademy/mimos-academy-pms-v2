const DECIMAL_PATTERN = /^-?\d+(?:\.\d+)?$/;

export const decimalToString = (value) => {
  if (value === null || value === undefined || value === '') return '0';
  const text = String(value).trim();
  if (!DECIMAL_PATTERN.test(text)) {
    throw new TypeError(`Invalid decimal value: ${value}`);
  }
  return text;
};

export const decimalAdd = (...values) => {
  const normalized = values.map(decimalToString);
  let scale = 0;

  for (const value of normalized) {
    const [, fraction = ''] = value.split('.');
    scale = Math.max(scale, fraction.length);
  }

  const factor = 10n ** BigInt(scale);
  const total = normalized.reduce((sum, value) => {
    const negative = value.startsWith('-');
    const unsigned = negative ? value.slice(1) : value;
    const [whole, fraction = ''] = unsigned.split('.');
    const units = BigInt(`${whole}${fraction.padEnd(scale, '0') || '0'}`) * (factor / (10n ** BigInt(scale)));
    return sum + (negative ? -units : units);
  }, 0n);

  const negative = total < 0n;
  const absolute = negative ? -total : total;
  const digits = absolute.toString().padStart(scale + 1, '0');

  if (scale === 0) return `${negative ? '-' : ''}${digits}`;

  const whole = digits.slice(0, -scale) || '0';
  const fraction = digits.slice(-scale);
  return `${negative ? '-' : ''}${whole}.${fraction}`;
};

export const decimalSubtract = (a, b) =>
  decimalAdd(a, `-${decimalToString(b)}`);

export const decimalCompare = (a, b) => {
  const left = decimalToString(a);
  const right = decimalToString(b);
  const result = decimalSubtract(left, right);
  if (result === '0') return 0;
  return result.startsWith('-') ? -1 : 1;
};

export const decimalIsZero = (value) => decimalCompare(value, '0') === 0;
export const decimalIsPositive = (value) => decimalCompare(value, '0') > 0;

export const decimalToNumberForDisplay = (value) => {
  const n = Number(decimalToString(value));
  if (!Number.isFinite(n)) throw new TypeError(`Invalid decimal display value: ${value}`);
  return n;
};

export const formatCurrency = (amount, { currency = 'USD', locale, ...options } = {}) =>
  decimalToNumberForDisplay(amount).toLocaleString(locale, { style: 'currency', currency, ...options });

export const formatNumber = (value, { locale, ...options } = {}) =>
  decimalToNumberForDisplay(value).toLocaleString(locale, options);

export const formatDate = (date, { locale, ...options } = {}) => {
  if (!date) return '';
  const parsed = new Date(date);
  if (Number.isNaN(parsed.getTime())) return '';
  return parsed.toLocaleDateString(locale, { year: 'numeric', month: 'long', day: 'numeric', ...options });
};

export const truncate = (text, max = 120) => {
  if (!text) return '';
  return text.length <= max ? text : `${text.slice(0, max).trimEnd()}…`;
};

export const slugify = (text) =>
  String(text || '')
    .normalize('NFKD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9\s_-]/g, '')
    .replace(/[\s_-]+/g, '-')
    .replace(/^-+|-+$/g, '');

export const formatRM = (amount) =>
  `RM ${decimalToNumberForDisplay(amount).toLocaleString('en-MY', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;

export const formatRMCompact = (amount) => {
  const v = decimalToNumberForDisplay(amount);
  if (Math.abs(v) >= 1_000_000) return `RM ${(v / 1_000_000).toFixed(2)}M`;
  if (Math.abs(v) >= 1_000) return `RM ${(v / 1_000).toFixed(1)}K`;
  return formatRM(amount);
};

export const isOverdue = (dueDate, status) =>
  !!dueDate && new Date(dueDate) < new Date() && !['Completed', 'Done', 'PAID', 'Paid', 'Completed'].includes(status);
