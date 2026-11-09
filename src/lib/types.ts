export type Role = 'customer' | 'provider';
export type BookingStatus = 'pending' | 'accepted' | 'rejected' | 'completed' | 'cancelled';

export type Profile = {
  id: string;
  full_name: string;
  phone: string | null;
  role: Role | null;
};

export type Service = {
  id: number;
  name: string;
  icon: string;
  description: string;
  image_url?: string | null;
};

export type ProviderService = {
  id: number;
  provider_id: string;
  service_id: number;
  hourly_rate: number;
  description: string;
  is_active: boolean;
};

export type Booking = {
  id: number;
  customer_id: string;
  provider_id: string;
  provider_service_id: number;
  service_id: number;
  hours: number;
  hourly_rate: number;
  total_price: number;
  scheduled_at: string;
  address: string;
  notes: string;
  status: BookingStatus;
  created_at: string;
};
