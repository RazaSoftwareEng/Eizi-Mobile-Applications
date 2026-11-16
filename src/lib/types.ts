export type Role = 'customer' | 'provider';
export type BookingStatus = 'pending' | 'accepted' | 'rejected' | 'completed' | 'cancelled';
export type QuoteStatus = 'none' | 'sent' | 'approved' | 'declined';
export type PayMethod = 'cash' | 'wallet';
export type PayStatus = 'unpaid' | 'held' | 'released' | 'refunded';

export type Profile = {
  id: string;
  full_name: string;
  phone: string | null;
  role: Role | null;
  avatar_url?: string | null;
  bio?: string;
  city?: string;
  service_id?: number | null;
  rating_avg?: number;
  rating_count?: number;
};

/** A service category (Cleaning, Electrician …). */
export type Service = {
  id: number;
  name: string;
  icon: string;
  description: string;
  image_url?: string | null;
  visit_fee: number;
  sort: number;
  is_active: boolean;
};

/** A specific job inside a category (Fan Fitting & Repair …). */
export type ServiceTask = {
  id: number;
  service_id: number;
  name: string;
  base_price: number | null;
  sort: number;
  is_active: boolean;
};

export type TaskRef = { id: number; name: string };
