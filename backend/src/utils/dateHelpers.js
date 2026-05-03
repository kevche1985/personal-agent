export function toISO(date) {
  if (!date) return null;
  return new Date(date).toISOString();
}

export function startOfMonth(date = new Date()) {
  return new Date(date.getFullYear(), date.getMonth(), 1);
}

export function toCronExpression(date) {
  const d = new Date(date);
  return `${d.getMinutes()} ${d.getHours()} ${d.getDate()} ${d.getMonth() + 1} *`;
}

export function centsToFloat(cents) {
  return cents / 100;
}

export function floatToCents(amount) {
  return Math.round(amount * 100);
}
