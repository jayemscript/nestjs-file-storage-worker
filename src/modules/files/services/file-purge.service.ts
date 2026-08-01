import { Inject, Injectable, Logger } from '@nestjs/common';
import { Cron, CronExpression } from '@nestjs/schedule';
import { ConfigService } from '@nestjs/config';
import { FilePurgeConfiguration } from '../../../config/file-purge.config';
import { FILE_METADATA_REPOSITORY } from '../repositories/file-metadata.repository.interface';
import type { FileMetadataRepository } from '../repositories/file-metadata.repository.interface';
import { FilesService } from './files.service';

@Injectable()
export class FilePurgeService {
  private readonly logger = new Logger(FilePurgeService.name);
  private readonly enabled: boolean;
  private readonly retentionDays: number;
  private readonly batchSize: number;
  private isRunning = false;

  constructor(
    @Inject(FILE_METADATA_REPOSITORY)
    private readonly repository: FileMetadataRepository,
    private readonly filesService: FilesService,
    configService: ConfigService,
  ) {
    const configuration =
      configService.getOrThrow<FilePurgeConfiguration>('filePurge');
    this.enabled = configuration.enabled;
    this.retentionDays = configuration.retentionDays;
    this.batchSize = configuration.batchSize;
  }

  @Cron(CronExpression.EVERY_DAY_AT_3AM)
  // ! WARNING EVERYMINUTE IS FOR TESTING PURPOSES ONLY. CHANGE TO EVERY_DAY_AT_3AM BEFORE DEPLOYMENT
  // @Cron(CronExpression.EVERY_MINUTE)
  async purgeExpiredFiles(): Promise<void> {
    if (!this.enabled || this.isRunning) {
      return;
    }

    this.isRunning = true;
    try {
      const cutoff = new Date(
        Date.now() - this.retentionDays * 24 * 60 * 60 * 1000,
      );
      const records = await this.repository.findDeletedBefore(
        cutoff,
        this.batchSize,
      );

      let purged = 0;
      for (const record of records) {
        try {
          await this.filesService.permanentlyDeleteFile(
            record.appId,
            record.id,
          );
          purged += 1;
        } catch (error) {
          this.logger.error(
            `Failed to purge expired file ${record.id}`,
            error instanceof Error ? error.stack : undefined,
          );
        }
      }

      if (records.length > 0) {
        this.logger.log(
          `File purge completed: ${purged}/${records.length} expired files permanently deleted`,
        );
      }
    } finally {
      this.isRunning = false;
    }
  }
}
