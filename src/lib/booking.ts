import { supabase } from '@/lib/supabase';
import type { BookingStatus, PayMethod, PayStatus, QuoteStatus, TaskRef } from '@/lib/types';

/** One booking as both apps read it (the other party is joined as `person`). */
export type BookingRow = {
  id: number;
  service_id: number;
  customer_id: string;
  provider_id: string | null;
  tasks: TaskRef[];
  visit_fee: number;
  total_price: number;
  quote_amount: number | null;
  quote_note: string;
  quote_status: QuoteStatus;
  scheduled_at: string;
  created_at: string;
  accepted_at: string | null;
  completed_at: string | null;
  address: string;
  latitude: number | null;
  longitude: number | null;
  notes: string;
  status: BookingStatus;
  payment_method: PayMethod;
  payment_status: PayStatus;
  rating: number | null;
  review: string;
  service: { name: string; icon: string } | null;
  person: { full_name: string; phone: string | null; avatar_url: string | null; rating_avg?: number; rating_count?: number } | null;
};

const COLS =
  'id, service_id, customer_id, provider_id, tasks, visit_fee, total_price, quote_amount, quote_note, quote_status, scheduled_at, created_at, accepted_at, completed_at, address, latitude, longitude, notes, status, payment_method, payment_status, rating, review, service:services(name, icon)';

export const CUSTOMER_BOOKING_SELECT = `${COLS}, person:profiles!bookings_provider_id_fkey(full_name, phone, avatar_url, rating_avg, rating_count)`;
export const PROVIDER_BOOKING_SELECT = `${COLS}, person:profiles!bookings_customer_id_fkey(full_name, phone, avatar_url)`;

/** A request a worker can accept (from open_requests()). */
export type OpenRequest = {
  id: number;
  service_id: number;
  service_name: string;
  tasks: TaskRef[];
  address: string;
  notes: string;
  scheduled_at: string;
  created_at: string;
  visit_fee: number;
  customer_name: string;
  customer_avatar: string | null;
  distance_km: number | null;
};

/** Where a booking is in the journey — drives the badge, the timeline and which buttons show. */
export type Stage =
  | 'searching'      // waiting for a worker
  | 'assigned'       // worker accepted, on the way / inspecting
  | 'quote'          // price sent, waiting for the customer
  | 'declined'       // customer declined the price
  | 'working'        // price approved
  | 'completed'
  | 'cancelled';

export function stageOf(b: Pick<BookingRow, 'status' | 'quote_status'>): Stage {
  if (b.status === 'cancelled' || b.status === 'rejected') return 'cancelled';
  if (b.status === 'completed') return 'completed';
  if (b.status === 'pending') return 'searching';
  if (b.quote_status === 'sent') return 'quote';
  if (b.quote_status === 'approved') return 'working';
  if (b.quote_status === 'declined') return 'declined';
  return 'assigned';
}

export const ACTIVE_STAGES: Stage[] = ['searching', 'assigned', 'quote', 'declined', 'working'];

export function tasksText(tasks: TaskRef[] | null | undefined, max = 3) {
  const names = (tasks ?? []).map((t) => t.name);
  if (names.length <= max) return names.join(', ');
  return `${names.slice(0, max).join(', ')} + ${names.length - max} more`;
}

/** Calls a request function and turns a database error into a readable message. */
export async function bookingAction(fn: string, args: Record<string, unknown>) {
  const { error } = await supabase.rpc(fn, args);
  if (error) throw new Error(error.message);
}

export function timeAgo(iso: string) {
  const mins = Math.max(0, Math.round((Date.now() - new Date(iso).getTime()) / 60000));
  if (mins < 1) return 'just now';
  if (mins < 60) return `${mins} min ago`;
  const h = Math.round(mins / 60);
  if (h < 24) return `${h} hr ago`;
  return `${Math.round(h / 24)} d ago`;
}
