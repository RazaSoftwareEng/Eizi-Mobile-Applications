import * as Notifications from 'expo-notifications';
import { router } from 'expo-router';
import { useEffect, useRef } from 'react';

import { registerForPush } from '@/lib/notifications';
import { useAuth } from '@/providers/AuthProvider';

/** Screens a notification may open — anything else from the payload is ignored. */
const ALLOWED = new Set(['/provider', '/customer/bookings', '/customer/wallet', '/provider/wallet']);

function openFrom(response: Notifications.NotificationResponse | null | undefined) {
  const url = response?.notification.request.content.data?.url;
  if (typeof url === 'string' && ALLOWED.has(url)) router.navigate(url as never);
}

/** Registers this phone for the signed-in user's alerts and opens the right screen when one is tapped. */
export function PushNotifications() {
  const { session, profile, loading } = useAuth();
  const userId = session?.user.id;
  const handledLaunch = useRef(false);

  // Register once per signed-in user (also re-links the phone when a different account signs in).
  useEffect(() => {
    if (userId && profile?.role) registerForPush();
  }, [userId, profile?.role]);

  // Tapped while the app is running / in the background.
  useEffect(() => {
    const sub = Notifications.addNotificationResponseReceivedListener((r) => {
      if (userId) openFrom(r);
    });
    return () => sub.remove();
  }, [userId]);

  // Tapped while the app was closed: wait until the session is restored, then open it once.
  useEffect(() => {
    if (loading || !userId || handledLaunch.current) return;
    handledLaunch.current = true;
    Notifications.getLastNotificationResponseAsync()
      .then((r) => {
        openFrom(r);
        return Notifications.clearLastNotificationResponseAsync();
      })
      .catch(() => {});
  }, [loading, userId]);

  return null;
}
