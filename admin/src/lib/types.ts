export type Role = 'customer' | 'provider'
export type BookingStatus = 'pending' | 'accepted' | 'rejected' | 'completed' | 'cancelled'

export const BOOKING_STATUSES: BookingStatus[] = ['pending', 'accepted', 'rejected', 'completed', 'cancelled']

export const STATUS_LABEL: Record<BookingStatus, string> = {
  pending: 'Finding worker',
  accepted: 'Assigned',
  rejected: 'Declined',
  completed: 'Completed',
  cancelled: 'Cancelled',
}

export type Profile = {
  id: string
  full_name: string
  phone: string | null
  role: Role | null
  created_at: string
  avatar_url?: string | null
  bio?: string
  city?: string
  service_id?: number | null
  rating_avg?: number
  rating_count?: number
}

export type Account = {
  id: string
  email: string | null
  last_sign_in_at: string | null
  email_confirmed_at: string | null
}

/** Profile merged with private auth data (admin only). */
export type UserRow = Profile & Partial<Omit<Account, 'id'>> & { cnic?: string | null; online?: boolean; service_name?: string | null }

export type Service = {
  id: number
  name: string
  icon: string
  description: string
  image_url: string | null
  visit_fee: number
  sort: number
  is_active: boolean
}

export type ServiceTask = {
  id: number
  service_id: number
  name: string
  base_price: number | null
  sort: number
  is_active: boolean
}

export type Listing = {
  id: number
  provider_id: string
  service_id: number
  hourly_rate: number
  description: string
  is_active: boolean
  created_at: string
  provider: { id: string; full_name: string } | null
  service: { id: number; name: string } | null
}

export type Booking = {
  id: number
  customer_id: string
  provider_id: string | null
  service_id: number
  tasks: { id: number; name: string }[]
  visit_fee: number
  quote_amount: number | null
  quote_note: string
  quote_status: 'none' | 'sent' | 'approved' | 'declined'
  rating: number | null
  review: string
  total_price: number
  scheduled_at: string
  address: string
  latitude: number | null
  longitude: number | null
  notes: string
  status: BookingStatus
  payment_method: 'cash' | 'wallet'
  payment_status: 'unpaid' | 'held' | 'released' | 'refunded'
  created_at: string
  customer: { full_name: string; phone: string | null } | null
  provider: { full_name: string; phone: string | null } | null
  service: { name: string } | null
}
