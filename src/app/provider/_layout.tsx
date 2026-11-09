import { RoleDrawer } from '@/components/RoleDrawer';

export default function ProviderLayout() {
  return (
    <RoleDrawer
      role="provider"
      items={[
        { name: 'index', href: '/provider', label: 'Dashboard', icon: 'grid-outline', iconActive: 'grid' },
        { name: 'services', href: '/provider/services', label: 'My services', icon: 'briefcase-outline', iconActive: 'briefcase' },
        { name: 'wallet', href: '/provider/wallet', label: 'Wallet', icon: 'wallet-outline', iconActive: 'wallet' },
        { name: 'profile', href: '/provider/profile', label: 'Profile', icon: 'person-outline', iconActive: 'person' },
      ]}
    />
  );
}
