import { ImageManipulator, SaveFormat } from 'expo-image-manipulator';
import * as ImagePicker from 'expo-image-picker';
import { Platform } from 'react-native';

import { supabase } from '@/lib/supabase';

const BUCKET = 'avatars';
const SIZE = 400; // px — sharp on 3× screens at the largest size we show (84pt)

/**
 * Lets the user pick a photo, crops it square, shrinks it to 400×400 and compresses it (~20–60 KB),
 * uploads it to avatars/<user-id>/… and returns the new public URL.
 * Returns null if the user cancelled.
 */
export async function pickAndUploadAvatar(userId: string): Promise<{ url: string; bytes: number } | null> {
  const perm = await ImagePicker.requestMediaLibraryPermissionsAsync();
  if (!perm.granted) throw new Error('Please allow photo access to choose a profile picture.');

  const picked = await ImagePicker.launchImageLibraryAsync({
    mediaTypes: ['images'],
    allowsEditing: true,
    aspect: [1, 1],
    quality: 1, // we compress ourselves below
  });
  if (picked.canceled || !picked.assets?.[0]) return null;
  const asset = picked.assets[0];

  // The picker already crops to a square. Decode at a bounded size (never loads a 12-MP photo fully into
  // memory), then shrink so the shorter side is 400px — aspect ratio kept, the round avatar shows the centre.
  const ctx = ImageManipulator.manipulate(asset.uri, { maxWidth: 1200, maxHeight: 1200 });
  const landscape = (asset.width || 1) >= (asset.height || 1);
  ctx.resize(landscape ? { height: SIZE } : { width: SIZE });
  const rendered = await ctx.renderAsync();
  // WebP is smallest; JPEG on iOS for broad encoder support.
  const format = Platform.OS === 'android' ? SaveFormat.WEBP : SaveFormat.JPEG;
  const saved = await rendered.saveAsync({ compress: 0.72, format });

  const body = await fetch(saved.uri).then((r) => r.arrayBuffer());
  const ext = format === SaveFormat.WEBP ? 'webp' : 'jpg';
  const path = `${userId}/avatar-${Date.now()}.${ext}`;
  const { error } = await supabase.storage
    .from(BUCKET)
    .upload(path, body, { contentType: `image/${ext === 'jpg' ? 'jpeg' : 'webp'}`, cacheControl: '31536000', upsert: false });
  if (error) {
    throw new Error(
      error.message.toLowerCase().includes('bucket not found')
        ? 'Photo storage is not set up yet — please try again later.'
        : error.message,
    );
  }
  return { url: supabase.storage.from(BUCKET).getPublicUrl(path).data.publicUrl, bytes: body.byteLength };
}

/** Removes an old photo file (best effort) — only works for files in the user's own folder. */
export async function removeAvatarFile(url: string | null | undefined) {
  const marker = `/storage/v1/object/public/${BUCKET}/`;
  const i = url?.indexOf(marker) ?? -1;
  if (!url || i < 0) return;
  await supabase.storage.from(BUCKET).remove([decodeURIComponent(url.slice(i + marker.length))]);
}

export function countWords(text: string) {
  const t = text.trim();
  return t ? t.split(/\s+/).length : 0;
}

export const BIO_MAX_WORDS = 500;
