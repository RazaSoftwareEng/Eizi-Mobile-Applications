import Constants from 'expo-constants';
import * as Notifications from 'expo-notifications';
import { AndroidImportance, AndroidNotificationVisibility } from 'expo-notifications';
import { Platform } from 'react-native';

import { supabase } from '@/lib/supabase';

/**
 * Push notifications, end to end:
 *  1. After sign-in the phone asks permission and gets an Expo push token (registerForPush).
 *  2. The token is stored in Supabase via register_push_token() — tied to the signed-in user.
 *  3. Database triggers on `bookings` call Expo's push service for the right person
 *     (new booking → provider; accepted / declined / completed → customer; cancelled → provider).
 *  4. Tapping the notification opens the matching screen (see usePushNotifications).
 * On sign-out the token is removed, so a shared phone never gets the previous user's alerts.
 */

/** Must match the channelId the database sends and the sound file listed in app.json. */
export const BOOKING_CHANNEL = 'bookings';
const BOOKING_SOUND = 'booking.wav';
export const CONFIRMED_CHANNEL = 'confirmations';
const CONFIRMED_SOUND = 'confirmed.wav';

// Show the banner + play the sound even while the app is open.
Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldShowBanner: true,
    shouldShowList: true,
    shouldPlaySound: true,
    shouldSetBadge: false,
  }),
});

let currentToken: string | null = null;

async function ensureChannel() {
  if (Platform.OS !== 'android') return;
  // Android 8+: sound & importance belong to the channel (fixed once created — hence a dedicated id).
  await Notifications.setNotificationChannelAsync(BOOKING_CHANNEL, {
    name: 'Bookings',
    description: 'New booking requests and booking updates',
    importance: AndroidImportance.MAX,
    sound: BOOKING_SOUND,
    vibrationPattern: [0, 250, 150, 250],
    lightColor: '#0B6358',
    lockscreenVisibility: AndroidNotificationVisibility.PUBLIC,
  });
  // Happy "your booking is confirmed" alert gets its own cheerful chime.
  await Notifications.setNotificationChannelAsync(CONFIRMED_CHANNEL, {
    name: 'Booking confirmations',
    description: 'When a provider accepts your booking',
    importance: AndroidImportance.MAX,
    sound: CONFIRMED_SOUND,
    vibrationPattern: [0, 120, 80, 120, 80, 220],
    lightColor: '#0B6358',
    lockscreenVisibility: AndroidNotificationVisibility.PUBLIC,
  });
}

/**
 * Ask permission and save this phone's push token for the signed-in user.
 * Never throws — notifications are a bonus, the app must work without them
 * (e.g. permission denied, Expo Go on Android, emulator without Play services, offline).
 */
export async function registerForPush(): Promise<void> {
  try {
    await ensureChannel(); // must exist before asking on Android 13+

    let { status } = await Notifications.getPermissionsAsync();
    if (status !== 'granted') ({ status } = await Notifications.requestPermissionsAsync());
    if (status !== 'granted') return;

    const projectId = Constants.expoConfig?.extra?.eas?.projectId ?? Constants.easConfig?.projectId;
    if (!projectId) return;
    const { data: token } = await Notifications.getExpoPushTokenAsync({ projectId });

    const { error } = await supabase.rpc('register_push_token', { p_token: token, p_platform: Platform.OS });
    if (!error) currentToken = token;
  } catch (e) {
    if (__DEV__) console.log('[push] not available:', e instanceof Error ? e.message : e);
  }
}

/** Called before sign-out (while still authenticated) so this phone stops receiving the user's alerts. */
export async function unregisterPush(): Promise<void> {
  if (!currentToken) return;
  try {
    await supabase.rpc('unregister_push_token', { p_token: currentToken });
  } catch {
    // ignore — the token is reassigned on the next sign-in anyway
  }
  currentToken = null;
}
