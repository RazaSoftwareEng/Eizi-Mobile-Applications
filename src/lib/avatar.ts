import { ImageManipulator, SaveFormat } from 'expo-image-manipulator';
import * as ImagePicker from 'expo-image-picker';
import { Platform } from 'react-native';

import { supabase } from '@/lib/supabase';

const BUCKET = 'avatars';
const SIZE = 400; // px — sharp on 3× screens at the largest size we show (84pt)

/** Upload problem with the step it happened at and what usually fixes it — shown to the user as-is. */
export class AvatarError extends Error {
  constructor(
    readonly step: 'Permission' | 'Processing' | 'Upload' | 'Check' | 'Saving',
    message: string,
    readonly hint = '',
  ) {
    super(message);
  }
  /** Full text for an alert. */
  get details() {
    return `Step: ${this.step}\n${this.message}${this.hint ? `\n\nHow to fix: ${this.hint}` : ''}`;
  }
}

export function uploadHint(msg: string) {
  const m = msg.toLowerCase();
  if (m.includes('bucket not found')) return 'Photo storage is not set up. Run the latest supabase/schema.sql in Supabase SQL Editor.';
  if (m.includes('row-level security') || m.includes('unauthorized') || m.includes('403'))
    return 'Storage permissions are missing. Run the latest supabase/schema.sql, then log out and in again.';
  if (m.includes('mime') || m.includes('content type')) return 'This image type is not allowed by the "avatars" bucket. Run the latest supabase/schema.sql.';
  if (m.includes('too large') || m.includes('maximum allowed size') || m.includes('413')) return 'The photo is too big for the bucket limit. Try another photo.';
  if (m.includes('profiles_avatar_own_file')) return 'The photo must be stored in this user’s own folder. Update the app and try again.';
  if (m.includes('network') || m.includes('fetch')) return 'Check the internet connection and try again.';
  return 'Try again. If it keeps failing, send this message to the Eizi team.';
}

/**
 * Lets the user pick a photo, crops it square, shrinks it to 400×400 and compresses it (~20–60 KB),
 * uploads it to avatars/<user-id>/…, checks the file really opens, and returns the new public URL.
 * Returns null if the user cancelled. Throws AvatarError with the failing step otherwise.
 */
export async function pickAndUploadAvatar(userId: string): Promise<{ url: string; bytes: number } | null> {
  const perm = await ImagePicker.requestMediaLibraryPermissionsAsync();
  if (!perm.granted) {
    throw new AvatarError('Permission', 'Eizi is not allowed to open your photos.', 'Allow photo access for Eizi in your phone Settings, then try again.');
  }

  const picked = await ImagePicker.launchImageLibraryAsync({
    mediaTypes: ['images'],
    allowsEditing: true,
    aspect: [1, 1],
    quality: 1, // we compress ourselves below
  });
  if (picked.canceled || !picked.assets?.[0]) return null;
  const asset = picked.assets[0];

  // Resize + compress, taking the bytes straight from the encoder (base64). Reading the file back with
  // fetch(file://) can return an empty body on some Android phones, which uploads a 0-byte image.
  const format = Platform.OS === 'android' ? SaveFormat.WEBP : SaveFormat.JPEG;
  let body: ArrayBuffer;
  try {
    const ctx = ImageManipulator.manipulate(asset.uri, { maxWidth: 1200, maxHeight: 1200 });
    const landscape = (asset.width || 1) >= (asset.height || 1);
    ctx.resize(landscape ? { height: SIZE } : { width: SIZE });
    const rendered = await ctx.renderAsync();
    const saved = await rendered.saveAsync({ compress: 0.72, format, base64: true });
    if (!saved.base64) throw new Error('the image encoder returned no data');
    body = base64ToBytes(saved.base64);
  } catch (e) {
    throw new AvatarError('Processing', `Could not prepare this photo (${(e as Error).message}).`, 'Try a different photo, e.g. one taken with the phone camera.');
  }
  if (body.byteLength < 100) {
    throw new AvatarError('Processing', `The prepared photo is empty (${body.byteLength} bytes).`, 'Try a different photo.');
  }

  const ext = format === SaveFormat.WEBP ? 'webp' : 'jpg';
  const contentType = ext === 'jpg' ? 'image/jpeg' : 'image/webp';
  const path = `${userId}/avatar-${Date.now()}.${ext}`;
  const { error } = await supabase.storage.from(BUCKET).upload(path, body, { contentType, cacheControl: '31536000', upsert: false });
  if (error) throw new AvatarError('Upload', error.message, uploadHint(error.message));

  const url = supabase.storage.from(BUCKET).getPublicUrl(path).data.publicUrl;

  // Make sure the uploaded file can actually be opened (bucket public, file reachable).
  let status = 0;
  try {
    status = (await fetch(url, { headers: { Range: 'bytes=0-15' } })).status;
  } catch {
    // Network blip while checking — the upload itself succeeded, carry on.
  }
  if (status >= 400) {
    throw new AvatarError(
      'Check',
      `The photo was uploaded but cannot be opened (HTTP ${status}).`,
      'Make sure the "avatars" bucket is Public in Supabase Storage (run the latest supabase/schema.sql).',
    );
  }
  return { url, bytes: body.byteLength };
}

/** Removes an old photo file (best effort) — only works for files in the user's own folder. */
export async function removeAvatarFile(url: string | null | undefined) {
  const marker = `/storage/v1/object/public/${BUCKET}/`;
  const i = url?.indexOf(marker) ?? -1;
  if (!url || i < 0) return;
  await supabase.storage.from(BUCKET).remove([decodeURIComponent(url.slice(i + marker.length))]);
}

const B64 = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/';
function base64ToBytes(b64: string): ArrayBuffer {
  const clean = b64.replace(/[^A-Za-z0-9+/]/g, '');
  const out = new Uint8Array(Math.floor((clean.length * 3) / 4));
  let o = 0;
  for (let i = 0; i < clean.length; i += 4) {
    const n =
      (B64.indexOf(clean[i]) << 18) |
      (B64.indexOf(clean[i + 1]) << 12) |
      ((B64.indexOf(clean[i + 2] ?? 'A') & 63) << 6) |
      (B64.indexOf(clean[i + 3] ?? 'A') & 63);
    out[o++] = (n >> 16) & 255;
    if (i + 2 < clean.length) out[o++] = (n >> 8) & 255;
    if (i + 3 < clean.length) out[o++] = n & 255;
  }
  return out.buffer.slice(0, o);
}

export function countWords(text: string) {
  const t = text.trim();
  return t ? t.split(/\s+/).length : 0;
}

export const BIO_MAX_WORDS = 500;
