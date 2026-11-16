import type { MapWorker } from '@/components/FreeMap';
import type { Coords } from '@/lib/location';

/**
 * DEMO DATA: placeholder workers scattered around the user so the map feels alive.
 * They are not real people. Replace with a server function that returns approximate positions
 * of online workers (never exact homes) before relying on this. Set to false to hide them.
 */
export const SHOW_DEMO_WORKERS = true;

const KINDS: MapWorker['kind'][] = ['clean', 'electric', 'cook', 'laundry', 'dish', 'clean', 'electric', 'cook'];

export const KIND_LABEL: Record<MapWorker['kind'], string> = {
  clean: 'Cleaning',
  cook: 'Cooking',
  electric: 'Electrician',
  laundry: 'Laundry',
  dish: 'Dishwashing',
};
export const KIND_COLOR: Record<MapWorker['kind'], string> = {
  clean: '#0E7A6B',
  cook: '#B45309',
  electric: '#4338CA',
  laundry: '#BE185D',
  dish: '#0891B2',
};

/** Same spot → same layout (seeded), so markers don't jump around on every render. */
function seeded(seed: number) {
  let s = seed >>> 0 || 1;
  return () => {
    s ^= s << 13;
    s ^= s >>> 17;
    s ^= s << 5;
    return ((s >>> 0) % 10000) / 10000;
  };
}

export function demoWorkersAround(c: Coords | null): MapWorker[] {
  if (!SHOW_DEMO_WORKERS || !c) return [];
  const rand = seeded(Math.round(c.latitude * 1000) * 7919 + Math.round(c.longitude * 1000));
  const kmPerDegLat = 111;
  const kmPerDegLng = 111 * Math.cos((c.latitude * Math.PI) / 180);
  return KINDS.map((kind, i) => {
    const dist = 0.25 + rand() * 1.6; // 250 m – 1.85 km
    const angle = rand() * Math.PI * 2;
    return {
      id: `demo-${i}`,
      kind,
      latitude: c.latitude + (dist * Math.sin(angle)) / kmPerDegLat,
      longitude: c.longitude + (dist * Math.cos(angle)) / kmPerDegLng,
    };
  });
}
