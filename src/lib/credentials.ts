import * as SecureStore from 'expo-secure-store';

/**
 * "Remember me" for the login form.
 * Stored in the device's encrypted keychain (iOS) / keystore (Android) — never in plain storage.
 */
const KEY = 'eizi.saved-login';

export type SavedLogin = { email: string; password: string };

export async function loadSavedLogin(): Promise<SavedLogin | null> {
  try {
    const raw = await SecureStore.getItemAsync(KEY);
    return raw ? (JSON.parse(raw) as SavedLogin) : null;
  } catch {
    return null; // e.g. web, or the keychain was reset
  }
}

export async function saveLogin(login: SavedLogin) {
  try {
    await SecureStore.setItemAsync(KEY, JSON.stringify(login));
  } catch {
    // Not fatal — the user just won't have the form pre-filled next time.
  }
}

export async function clearSavedLogin() {
  try {
    await SecureStore.deleteItemAsync(KEY);
  } catch {
    // ignore
  }
}
