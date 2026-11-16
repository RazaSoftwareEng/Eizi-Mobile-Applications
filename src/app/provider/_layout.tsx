import { RoleDrawer } from '@/components/RoleDrawer';

export default function ProviderLayout() {
  return (
    <RoleDrawer
      role="provider"
      items={[
        { name: 'index', href: '/provider', label: 'Jobs', icon: 'grid-outline', iconActive: 'grid' },
        { name: 'wallet', href: '/provider/wallet', label: 'Wallet', icon: 'wallet-outline', iconActive: 'wallet' },
        { name: 'profile', href: '/provider/profile', label: 'Profile', icon: 'person-outline', iconActive: 'person' },
      ]}
    />
  );
}
