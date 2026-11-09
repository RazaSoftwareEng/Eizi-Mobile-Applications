import {
  AirVent,
  Baby,
  Bike,
  BrushCleaning,
  Car,
  ChefHat,
  Dog,
  Droplets,
  Flower2,
  Hammer,
  Laptop,
  Lock,
  PaintRoller,
  Scissors,
  Shirt,
  Toolbox,
  Truck,
  Utensils,
  WashingMachine,
  Wrench,
  Zap,
  type LucideIcon,
} from 'lucide-react'

/**
 * `value` is the MaterialCommunityIcons name stored in services.icon and drawn by the mobile app.
 * `Icon` is the closest Lucide icon, used only to preview it here in the admin portal.
 */
export const SERVICE_ICONS: { value: string; label: string; Icon: LucideIcon }[] = [
  { value: 'dishwasher', label: 'Dishwasher', Icon: Utensils },
  { value: 'chef-hat', label: 'Chef hat', Icon: ChefHat },
  { value: 'flash', label: 'Electricity', Icon: Zap },
  { value: 'pipe-wrench', label: 'Pipe wrench', Icon: Wrench },
  { value: 'broom', label: 'Broom', Icon: BrushCleaning },
  { value: 'spray-bottle', label: 'Spray bottle', Icon: Droplets },
  { value: 'saw-blade', label: 'Saw / woodwork', Icon: Hammer },
  { value: 'hammer-wrench', label: 'Hammer & wrench', Icon: Hammer },
  { value: 'format-paint', label: 'Paint roller', Icon: PaintRoller },
  { value: 'air-conditioner', label: 'Air conditioner', Icon: AirVent },
  { value: 'washing-machine', label: 'Washing machine', Icon: WashingMachine },
  { value: 'tshirt-crew-outline', label: 'Clothes', Icon: Shirt },
  { value: 'baby-face-outline', label: 'Baby', Icon: Baby },
  { value: 'car-outline', label: 'Car', Icon: Car },
  { value: 'truck-outline', label: 'Truck / moving', Icon: Truck },
  { value: 'bike', label: 'Bike / delivery', Icon: Bike },
  { value: 'flower-outline', label: 'Garden', Icon: Flower2 },
  { value: 'content-cut', label: 'Scissors / salon', Icon: Scissors },
  { value: 'dog', label: 'Pets', Icon: Dog },
  { value: 'laptop', label: 'Computer / IT', Icon: Laptop },
  { value: 'lock-outline', label: 'Locksmith', Icon: Lock },
  { value: 'toolbox-outline', label: 'General / toolbox', Icon: Toolbox },
]

const BY_NAME: Record<string, string> = {
  dishwasher: 'dishwasher',
  cook: 'chef-hat',
  electrician: 'flash',
  plumber: 'pipe-wrench',
  'house cleaner': 'broom',
  carpenter: 'saw-blade',
  painter: 'format-paint',
  'ac technician': 'air-conditioner',
  laundry: 'washing-machine',
  babysitter: 'baby-face-outline',
  driver: 'car-outline',
  gardener: 'flower-outline',
}

/** Same fallback rules as the mobile app (old rows may still hold emoji). */
export function resolveIcon(service: { name: string; icon: string }) {
  const value = SERVICE_ICONS.some((i) => i.value === service.icon)
    ? service.icon
    : (BY_NAME[service.name.trim().toLowerCase()] ?? 'toolbox-outline')
  return SERVICE_ICONS.find((i) => i.value === value) ?? SERVICE_ICONS[SERVICE_ICONS.length - 1]
}
