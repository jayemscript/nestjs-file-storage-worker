import { registerAs } from '@nestjs/config';

export const DEFAULT_ALLOWED_MIME_TYPES = [
  'image/jpeg',
  'image/png',
  'image/gif',
  'image/webp',
  'application/pdf',
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  'audio/mpeg',
  'audio/wav',
  'video/mp4',
  'video/webm',
] as const;

export interface StorageConfiguration {
  provider: 'local' | 's3';
  localRoot: string;
  s3Region?: string;
  s3Bucket?: string;
  maxFileSizeBytes: number;
  maxBulkFileCount: number;
  maxBulkTotalSizeBytes: number;
  allowedMimeTypes: string[];
  hardDeleteAdminKey: string;
}

function positiveInteger(value: string | undefined, fallback: number): number {
  const parsed = Number(value ?? fallback);
  return Number.isSafeInteger(parsed) && parsed > 0 ? parsed : fallback;
}

export default registerAs('storage', (): StorageConfiguration => {
  const configuredMimeTypes = process.env.ALLOWED_MIME_TYPES?.split(',')
    .map((mimeType) => mimeType.trim().toLowerCase())
    .filter(Boolean);

  return {
    provider: process.env.STORAGE_PROVIDER === 's3' ? 's3' : 'local',
    localRoot: process.env.LOCAL_STORAGE_ROOT ?? './upload',
    s3Region: process.env.AWS_S3_REGION ?? '',
    s3Bucket: process.env.AWS_S3_BUCKET ?? '',
    maxFileSizeBytes: positiveInteger(
      process.env.MAX_FILE_SIZE_BYTES,
      10 * 1024 * 1024,
    ),
    maxBulkFileCount: positiveInteger(process.env.MAX_BULK_FILE_COUNT, 10),
    maxBulkTotalSizeBytes: positiveInteger(
      process.env.MAX_BULK_TOTAL_SIZE_BYTES,
      50 * 1024 * 1024,
    ),
    allowedMimeTypes:
      configuredMimeTypes && configuredMimeTypes.length > 0
        ? configuredMimeTypes
        : [...DEFAULT_ALLOWED_MIME_TYPES],
    hardDeleteAdminKey: process.env.HARD_DELETE_ADMIN_KEY ?? '',
  };
});
