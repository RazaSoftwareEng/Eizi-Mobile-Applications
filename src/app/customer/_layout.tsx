import { RoleDrawer } from '@/components/RoleDrawer';

export default function CustomerLayout() {
  return (
    <RoleDrawer
      role="customer"
      items={[
        { name: 'index', href: '/customer', label: 'Home', icon: 'home-outline', iconActive: 'home' },
        { name: 'bookings', href: '/customer/bookings', label: 'My bookings', icon: 'calendar-outline', iconActive: 'calendar' },
        { name: 'profile', href: '/customer/profile', label: 'Profile', icon: 'person-outline', iconActive: 'person' },
      ]}
    />
  );
}
