
import { supabase } from './supabase';

/**
 * Uploads a base64 or blob image to Supabase Storage and returns the public URL.
 * Uses a unique path based on user ID and timestamp to avoid collisions.
 */
export async function uploadImage(userId: string, bucket: string, fileName: string, fileBody: Blob | File): Promise<string | null> {
  const fileExt = fileName.split('.').pop();
  const path = `${userId}/${Date.now()}.${fileExt}`;

  const { error } = await supabase.storage
    .from(bucket)
    .upload(path, fileBody, {
      cacheControl: '3600',
      upsert: true
    });

  if (error) {
    console.error('Error uploading image:', error);
    return null;
  }

  const { data: { publicUrl } } = supabase.storage
    .from(bucket)
    .getPublicUrl(path);

  return publicUrl;
}
