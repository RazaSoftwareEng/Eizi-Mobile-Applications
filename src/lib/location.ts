import * as Location from 'expo-location';
import { Linking, Platform } from 'react-native';

export type Coords = { latitude: number; longitude: number };

export type PickedLocation = Coords & {
  /** Best-effort street address from the phone's geocoder — empty if it couldn't be resolved. */
  address: string;
};

export class LocationError extends Error {
  constructor(
    message: string,
    /** True when the user must change it in phone Settings (permission permanently denied). */
    readonly openSettings = false,
  ) {
    super(message);
  }
}

/** Ask for permission (foreground only, never background) and read the phone's current position + address. */
export async function getCurrentLocation(): Promise<PickedLocation> {
  const perm = await Location.requestForegroundPermissionsAsync();
  if (!perm.granted) {
    throw new LocationError(
      perm.canAskAgain
        ? 'Location permission is needed to share where the service is required.'
        : 'Location is turned off for Eizi. Allow it in your phone settings, then try again.',
      !perm.canAskAgain,
    );
  }

  if (!(await Location.hasServicesEnabledAsync())) {
    if (Platform.OS === 'android') {
      // Shows the system "Turn on location" dialog; rejects if the user says no.
      await Location.enableNetworkProviderAsync().catch(() => {
        throw new LocationError('Please turn on location (GPS) on your phone and try again.');
      });
    } else {
      throw new LocationError('Please turn on Location Services in Settings and try again.', true);
    }
  }

  const pos = await Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.High });
  const coords = { latitude: pos.coords.latitude, longitude: pos.coords.longitude };

  let address = '';
  try {
    const [place] = await Location.reverseGeocodeAsync(coords);
    if (place) address = formatPlace(place);
  } catch {
    // Geocoder unavailable (no internet / no Play services) — coordinates are still saved.
  }
  return { ...coords, address };
}

function formatPlace(p: Location.LocationGeocodedAddress): string {
  if (p.formattedAddress) return p.formattedAddress;
  const street = [p.streetNumber, p.street].filter(Boolean).join(' ');
  const parts = [p.name && p.name !== street && p.name !== p.streetNumber ? p.name : null, street, p.district, p.city ?? p.subregion, p.region];
  return [...new Set(parts.filter((x): x is string => !!x && x.trim().length > 0))].join(', ');
}

export function hasCoords(b: { latitude: number | null; longitude: number | null }): b is Coords {
  return b.latitude != null && b.longitude != null;
}

/** Google Maps turn-by-turn directions to the spot (opens the Maps app if installed, otherwise the browser). */
export function openDirections({ latitude, longitude }: Coords) {
  return Linking.openURL(`https://www.google.com/maps/dir/?api=1&destination=${latitude},${longitude}&travelmode=driving`);
}

/** Google Maps with a pin on the spot. */
export function openInMaps({ latitude, longitude }: Coords) {
  return Linking.openURL(`https://www.google.com/maps/search/?api=1&query=${latitude},${longitude}`);
}
