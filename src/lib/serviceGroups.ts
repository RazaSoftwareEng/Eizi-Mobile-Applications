import type { Service } from '@/lib/types';

/** How services are grouped on the home screen. Matched by name; anything new lands in "More services". */
const GROUPS: { title: string; names: string[] }[] = [
  { title: 'Cleaning & home', names: ['house cleaner', 'cleaner', 'dishwasher', 'laundry', 'gardener'] },
  { title: 'Repairs & fixes', names: ['electrician', 'plumber', 'ac technician', 'carpenter', 'painter'] },
  { title: 'Care & daily help', names: ['cook', 'babysitter', 'driver'] },
];

export function groupServices(services: Service[]) {
  const used = new Set<number>();
  const groups = GROUPS.map((g) => {
    const items = g.names
      .map((n) => services.find((s) => s.name.trim().toLowerCase() === n))
      .filter((s): s is Service => !!s && !used.has(s.id));
    items.forEach((s) => used.add(s.id));
    return { title: g.title, items };
  });
  const rest = services.filter((s) => !used.has(s.id));
  if (rest.length) groups.push({ title: 'More services', items: rest });
  return groups.filter((g) => g.items.length);
}
