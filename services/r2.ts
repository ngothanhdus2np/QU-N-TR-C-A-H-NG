// Helper upload/xóa ảnh trên Cloudflare R2 (server-side, dùng S3 API).
// Cấu hình qua env (.env.local trên iMac):
//   R2_ENDPOINT            = https://<account_id>.r2.cloudflarestorage.com
//   R2_ACCESS_KEY_ID       = <R2 API token access key>
//   R2_SECRET_ACCESS_KEY   = <R2 API token secret>
//   R2_BUCKET              = phucsang-media
//   R2_PUBLIC_BASE         = https://img.phucsang.com.vn   (custom domain public của bucket)
// Nếu thiếu bất kỳ biến nào → isR2Configured() = false, caller tự fallback.
import { S3Client, PutObjectCommand, DeleteObjectCommand } from '@aws-sdk/client-s3';

const {
  R2_ENDPOINT,
  R2_ACCESS_KEY_ID,
  R2_SECRET_ACCESS_KEY,
  R2_BUCKET,
  R2_PUBLIC_BASE,
} = process.env;

const configured = Boolean(
  R2_ENDPOINT && R2_ACCESS_KEY_ID && R2_SECRET_ACCESS_KEY && R2_BUCKET && R2_PUBLIC_BASE,
);

let client: S3Client | null = null;
function getClient(): S3Client {
  if (!configured) throw new Error('R2 chưa được cấu hình (thiếu R2_* env)');
  if (!client) {
    client = new S3Client({
      region: 'auto',
      endpoint: R2_ENDPOINT,
      credentials: {
        accessKeyId: R2_ACCESS_KEY_ID as string,
        secretAccessKey: R2_SECRET_ACCESS_KEY as string,
      },
    });
  }
  return client;
}

export function isR2Configured(): boolean {
  return configured;
}

/** URL công khai của một object key trên R2 (qua custom domain). */
export function r2PublicUrl(key: string): string {
  const base = (R2_PUBLIC_BASE as string).replace(/\/+$/, '');
  const path = key.split('/').map(encodeURIComponent).join('/');
  return `${base}/${path}`;
}

/** Upload buffer lên R2, trả về { key, url }. */
export async function uploadToR2(
  key: string,
  body: Buffer,
  contentType: string,
): Promise<{ key: string; url: string }> {
  await getClient().send(
    new PutObjectCommand({
      Bucket: R2_BUCKET,
      Key: key,
      Body: body,
      ContentType: contentType,
      CacheControl: 'public, max-age=31536000, immutable',
    }),
  );
  return { key, url: r2PublicUrl(key) };
}

/** Xóa object theo key trên R2. */
export async function deleteFromR2(key: string): Promise<void> {
  await getClient().send(new DeleteObjectCommand({ Bucket: R2_BUCKET, Key: key }));
}
