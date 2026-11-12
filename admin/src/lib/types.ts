export type Role = 'customer' | 'provider'
export type BookingStatus = 'pending' | 'accepted' | 'rejected' | 'completed' | 'cancelled'

export const BOOKING_STATUSES: BookingStatus[] = ['pending', 'accepted', 'rejected', 'completed', 'cancelled']

export const STATUS_LABEL: Record<BookingStatus, string> = {
  pending: 'Pending',
  accepted: 'Confirmed',
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
}

export type Account = {
  id: string
  email: string | null
  last_sign_in_at: string | null
  email_confirmed_at: string | null
}

/** Profile merged with private auth data (admin only). */
export type UserRow = Profile & Partial<Omit<Account, 'id'>>

export type Service = {
  id: number
  name: string
  icon: string
  description: string
  image_url: string | null
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
  provider_id: string
  provider_service_id: number
  service_id: number
  hours: number
  hourly_rate: number
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
