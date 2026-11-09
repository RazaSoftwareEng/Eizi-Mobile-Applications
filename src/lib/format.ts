export function formatPrice(value: number | string) {
  return `Rs ${Math.round(Number(value)).toLocaleString('en-PK')}`;
}

export function formatDateTime(iso: string) {
  const d = new Date(iso);
  return d.toLocaleString('en-PK', {
    weekday: 'short',
    day: 'numeric',
    month: 'short',
    hour: 'numeric',
    minute: '2-digit',
  });
}

export function initials(name: string) {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return '?';
  return (parts[0][0] + (parts[1]?.[0] ?? '')).toUpperCase();
}
