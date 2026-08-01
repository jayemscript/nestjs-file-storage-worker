import { registerAs } from '@nestjs/config';

export interface FilePurgeConfiguration {
  enabled: boolean;
  retentionDays: number;
  batchSize: number;
}

function positiveInteger(value: string | undefined, fallback: number): number {
  const parsed = Number(value ?? fallback);
  return Number.isSafeInteger(parsed) && parsed > 0 ? parsed : fallback;
}

export default registerAs('filePurge', (): FilePurgeConfiguration => ({
  enabled: process.env.FILE_PURGE_ENABLED?.toLowerCase() === 'true',
  retentionDays: positiveInteger(process.env.DELETED_FILE_RETENTION_DAYS, 30),
  batchSize: positiveInteger(process.env.FILE_PURGE_BATCH_SIZE, 100),
}));
