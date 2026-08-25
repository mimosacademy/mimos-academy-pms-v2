export const formatCurrency = (amount, { currency = 'USD', locale, ...options } = {}) =>
	Number(amount || 0).toLocaleString(locale, { style: 'currency', currency, ...options });

export const formatNumber = (value, { locale, ...options } = {}) =>
	Number(value || 0).toLocaleString(locale, options);

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
  `RM ${Number(amount || 0).toLocaleString('en-MY', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;

export const formatRMCompact = (amount) => {
  const v = Number(amount || 0);
  if (Math.abs(v) >= 1_000_000) return `RM ${(v / 1_000_000).toFixed(2)}M`;
  if (Math.abs(v) >= 1_000) return `RM ${(v / 1_000).toFixed(1)}K`;
  return formatRM(v);
};

export const isOverdue = (dueDate, status) =>
  !!dueDate && new Date(dueDate) < new Date() && !['Completed', 'Done', 'PAID', 'Paid', 'Completed'].includes(status);
