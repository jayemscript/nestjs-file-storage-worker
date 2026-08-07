import { Module } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { StorageConfiguration } from '../../config/storage.config';
import { S3StorageProvider } from './adapters/s3.adapter';
import { LocalStorageProvider } from './adapters/local.adapter';
import type { StorageProvider } from './interfaces/storage-provider.interface';
import { STORAGE_PROVIDER } from './storage.constants';

@Module({
  providers: [
    {
      provide: STORAGE_PROVIDER,
      inject: [ConfigService],
      useFactory: async (
        configService: ConfigService,
      ): Promise<StorageProvider> => {
        const configuration =
          configService.getOrThrow<StorageConfiguration>('storage');

        if (configuration.provider === 's3') {
          return new S3StorageProvider(configService);
        }

        const provider = new LocalStorageProvider(configService);
        await provider.onModuleInit();
        return provider;
      },
    },
  ],
  exports: [STORAGE_PROVIDER],
})
export class StorageModule {}
