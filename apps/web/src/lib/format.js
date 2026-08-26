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

  const total = normalized.reduce((sum, value) => {
    const negative = value.startsWith('-');
    const unsigned = negative ? value.slice(1) : value;
    const [whole, fraction = ''] = unsigned.split('.');

    const units = BigInt(
      `${whole}${fraction.padEnd(scale, '0') || '0'}`
    );

    return sum + (negative ? -units : units);
  }, 0n);

  const negative = total < 0n;
  const absolute = negative ? -total : total;
  const digits = absolute.toString().padStart(scale + 1, '0');

  if (scale === 0) {
    return `${negative ? '-' : ''}${digits}`;
  }

  const whole = digits.slice(0, -scale) || '0';
  const fraction = digits.slice(-scale);

  return `${negative ? '-' : ''}${whole}.${fraction}`;
};

const decimalNegate = (value) => {
  const normalized = decimalToString(value);

  if (normalized === '0' || /^-0(?:\.0+)?$/.test(normalized)) {
    return '0';
  }

  return normalized.startsWith('-')
    ? normalized.slice(1)
    : `-${normalized}`;
};

export const decimalSubtract = (a, b) =>
  decimalAdd(a, decimalNegate(b));

export const decimalCompare = (a, b) => {
  const left = decimalToString(a);
  const right = decimalToString(b);
  const result = decimalSubtract(left, right);

  if (result === '0') return 0;

  return result.startsWith('-') ? -1 : 1;
};

export const decimalIsZero = (value) =>
  decimalCompare(value, '0') === 0;

export const decimalIsPositive = (value) =>
  decimalCompare(value, '0') > 0;

export const decimalToNumberForDisplay = (value) => {
  const n = Number(decimalToString(value));

  if (!Number.isFinite(n)) {
    throw new TypeError(`Invalid decimal display value: ${value}`);
  }

  return n;
};

export const formatCurrency = (
  amount,
  { currency = 'USD', locale, ...options } = {}
) =>
  decimalToNumberForDisplay(amount).toLocaleString(locale, {
    style: 'currency',
    currency,
    ...options,
  });

export const formatNumber = (
  value,
  { locale, ...options } = {}
) =>
  decimalToNumberForDisplay(value).toLocaleString(locale, options);

export const formatDate = (
  date,
  { locale, ...options } = {}
) => {
  if (!date) return '';

  const parsed = new Date(date);

  if (Number.isNaN(parsed.getTime())) return '';

  return parsed.toLocaleDateString(locale, {
    year: 'numeric',
    month: 'long',
    day: 'numeric',
    ...options,
  });
};

export const truncate = (text, max = 120) =>
  !text
    ? ''
    : text.length <= max
      ? text
      : `${text.slice(0, max).trimEnd()}…`;

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
  `RM ${decimalToNumberForDisplay(amount).toLocaleString('en-MY', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })}`;

const decimalDivideByInteger = (value, divisor) => {
  if (!Number.isInteger(divisor) || divisor <= 0) {
    throw new RangeError(`Divisor must be a positive integer: ${divisor}`);
  }

  const normalized = decimalToString(value);
  const negative = normalized.startsWith('-');
  const unsigned = negative ? normalized.slice(1) : normalized;

  const [whole, fraction = ''] = unsigned.split('.');
  const sourceScale = fraction.length;

  const numerator = BigInt(`${whole}${fraction}` || '0');
  const divisorBigInt = BigInt(divisor);

  const quotient = numerator / divisorBigInt;
  const remainder = numerator % divisorBigInt;

  if (sourceScale === 0) {
    return `${negative ? '-' : ''}${quotient.toString()}`;
  }

  const quotientText = quotient
    .toString()
    .padStart(sourceScale + 1, '0');

  const wholePart =
    quotientText.slice(0, -sourceScale) || '0';

  const fractionPart =
    quotientText.slice(-sourceScale);

  let result = `${wholePart}.${fractionPart}`;

  if (remainder !== 0n) {
    let remainderValue = remainder;
    let extraFraction = '';

    const precision = 12;

    for (let index = 0; index < precision; index += 1) {
      remainderValue *= 10n;

      const digit = remainderValue / divisorBigInt;

      remainderValue %= divisorBigInt;

      extraFraction += digit.toString();

      if (remainderValue === 0n) break;
    }

    result = `${result}${extraFraction}`;
  }

  return `${negative ? '-' : ''}${result}`;
};

const decimalRoundToScale = (value, scale) => {
  const normalized = decimalToString(value);
  const negative = normalized.startsWith('-');
  const unsigned = negative ? normalized.slice(1) : normalized;

  const [whole, fraction = ''] = unsigned.split('.');

  const retained = fraction
    .padEnd(scale, '0')
    .slice(0, scale);

  const nextDigit =
    fraction.length > scale
      ? fraction.charAt(scale)
      : '0';

  let units = BigInt(
    `${whole}${retained}` || '0'
  );

  if (nextDigit >= '5') {
    units += 1n;
  }

  const digits = units
    .toString()
    .padStart(scale + 1, '0');

  if (scale === 0) {
    return `${negative ? '-' : ''}${digits}`;
  }

  return (
    `${negative ? '-' : ''}` +
    `${digits.slice(0, -scale) || '0'}.` +
    `${digits.slice(-scale)}`
  );
};

const decimalIntegerPart = (value) => {
  const normalized = decimalToString(value);
  const unsigned = normalized.startsWith('-')
    ? normalized.slice(1)
    : normalized;

  return BigInt(unsigned.split('.')[0] || '0');
};

export const formatRMCompact = (amount) => {
  const normalized = decimalToString(amount);

  const absoluteInteger = decimalIntegerPart(normalized);

  const million = 1_000_000n;
  const thousand = 1_000n;

  if (absoluteInteger >= million) {
    const scaled = decimalRoundToScale(
      decimalDivideByInteger(normalized, million),
      2
    );

    return `RM ${scaled}M`;
  }

  if (absoluteInteger >= thousand) {
    const scaled = decimalRoundToScale(
      decimalDivideByInteger(normalized, thousand),
      1
    );

    return `RM ${scaled}K`;
  }

  return formatRM(normalized);
};

export const isOverdue = (dueDate, status) =>
  !!dueDate &&
  new Date(dueDate) < new Date() &&
  ![
    'Completed',
    'Done',
    'PAID',
    'Paid',
  ].includes(status);
