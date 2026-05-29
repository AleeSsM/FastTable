import { decode } from 'base64-arraybuffer';
import * as ImagePicker from 'expo-image-picker';
import { Platform } from 'react-native';

import { supabase } from '@/lib/supabase';

export type AvatarPick = { uri: string; base64: string | null; ext: string; contentType: string };

/** Extensión limpia a partir del content-type (nunca del URL, que en web es un blob). */
function extFromMime(mime: string): string {
  switch (mime) {
    case 'image/png':
      return 'png';
    case 'image/webp':
      return 'webp';
    case 'image/heic':
      return 'heic';
    case 'image/heif':
      return 'heif';
    case 'image/gif':
      return 'gif';
    default:
      return 'jpg';
  }
}

/** Lanza la galería y devuelve la imagen elegida (cuadrada), o null si se cancela. */
export async function pickImage(): Promise<AvatarPick | null> {
  if (Platform.OS !== 'web') {
    const perm = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (!perm.granted) throw new Error('PERMISO_DENEGADO');
  }
  const res = await ImagePicker.launchImageLibraryAsync({
    mediaTypes: ['images'],
    allowsEditing: true,
    aspect: [1, 1],
    quality: 0.6,
    base64: true,
  });
  if (res.canceled || !res.assets?.length) return null;

  const asset = res.assets[0];
  const contentType =
    asset.mimeType && asset.mimeType.startsWith('image/') ? asset.mimeType : 'image/jpeg';
  const ext = extFromMime(contentType);
  return { uri: asset.uri, base64: asset.base64 ?? null, ext, contentType };
}

/** Convierte la imagen elegida en bytes, sin depender de que exista base64. */
async function pickToBytes(pick: AvatarPick): Promise<ArrayBuffer> {
  if (pick.base64) return decode(pick.base64);
  // Fallback robusto (web: blob:, nativo: file:/content:) cuando no hay base64.
  const res = await fetch(pick.uri);
  const buf = await res.arrayBuffer();
  if (!buf || buf.byteLength === 0) throw new Error('IMAGEN_VACIA');
  return buf;
}

/** Sube la imagen al bucket `avatars` en `<userId>/avatar.<ext>` y devuelve su URL pública. */
export async function uploadAvatar(userId: string, pick: AvatarPick): Promise<string> {
  const path = `${userId}/avatar.${pick.ext}`;
  const bytes = await pickToBytes(pick);
  const { error } = await supabase.storage
    .from('avatars')
    .upload(path, bytes, { contentType: pick.contentType, upsert: true });
  if (error) throw error;
  const { data } = supabase.storage.from('avatars').getPublicUrl(path);
  // `?v=` evita que se quede cacheada la foto anterior tras reemplazarla.
  return `${data.publicUrl}?v=${Date.now()}`;
}

/** Atajo: elegir + subir. Devuelve la URL pública o null si se cancela. */
export async function pickAndUploadAvatar(userId: string): Promise<string | null> {
  const pick = await pickImage();
  if (!pick) return null;
  return uploadAvatar(userId, pick);
}
