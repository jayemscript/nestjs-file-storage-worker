import { ConfigService } from '@nestjs/config';
import {
  DeleteObjectCommand,
  GetObjectCommand,
  HeadBucketCommand,
  HeadObjectCommand,
  PutObjectCommand,
  S3Client,
} from '@aws-sdk/client-s3';
import { Readable } from 'node:stream';
import { StorageConfiguration } from '../../../config/storage.config';
import { FileMediaError } from '../../../common/errors/file-media.error';
import { S3StorageProvider } from './s3.adapter';

function configService(configuration: StorageConfiguration): ConfigService {
  return {
    getOrThrow: jest.fn().mockReturnValue(configuration),
  } as unknown as ConfigService;
}

describe('S3StorageProvider', () => {
  const configuration: StorageConfiguration = {
    provider: 's3',
    localRoot: './upload',
    s3Region: 'ap-southeast-1',
    s3Bucket: 'meal-guides-bucket',
    maxFileSizeBytes: 1024,
    maxBulkFileCount: 2,
    maxBulkTotalSizeBytes: 2048,
    allowedMimeTypes: ['image/png'],
    hardDeleteAdminKey: 'a-long-development-key',
  };

  afterEach(() => {
    jest.restoreAllMocks();
  });

  it('stores an object without overwriting an existing key', async () => {
    const send = jest
      .spyOn(S3Client.prototype, 'send')
      .mockResolvedValueOnce({} as never)
      .mockResolvedValueOnce({ ContentLength: 11 } as never);
    const provider = new S3StorageProvider(configService(configuration));

    await expect(
      provider.putObject({
        key: 'merchant-portal/image/2026/07/file.png',
        body: Buffer.from('image-bytes'),
      }),
    ).resolves.toEqual({
      key: 'merchant-portal/image/2026/07/file.png',
      size: 11,
    });

    expect(send).toHaveBeenCalledTimes(2);
    const putCommand = send.mock.calls[0]?.[0];
    expect(putCommand).toBeInstanceOf(PutObjectCommand);
    expect(putCommand.input).toMatchObject({
      Bucket: 'meal-guides-bucket',
      Key: 'merchant-portal/image/2026/07/file.png',
      IfNoneMatch: '*',
    });
  });

  it('streams an object from S3', async () => {
    jest.spyOn(S3Client.prototype, 'send').mockResolvedValue({
      Body: Readable.from(['image-', 'bytes']),
      ContentLength: 11,
    } as never);
    const provider = new S3StorageProvider(configService(configuration));

    const result = await provider.openReadStream(
      'merchant-portal/image/2026/07/file.png',
    );
    const chunks: Buffer[] = [];
    for await (const chunk of result.stream) {
      chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(String(chunk)));
    }

    expect(result.size).toBe(11);
    expect(Buffer.concat(chunks)).toEqual(Buffer.from('image-bytes'));
    expect(result.stream).toBeInstanceOf(Readable);
    expect(S3Client.prototype.send).toHaveBeenCalledWith(
      expect.any(GetObjectCommand),
    );
  });

  it('returns false for a missing object', async () => {
    jest.spyOn(S3Client.prototype, 'send').mockRejectedValue({
      name: 'NotFound',
      $metadata: { httpStatusCode: 404 },
    });
    const provider = new S3StorageProvider(configService(configuration));

    await expect(
      provider.objectExists('merchant-portal/image/2026/07/missing.png'),
    ).resolves.toBe(false);
  });

  it('rejects unsafe keys before calling S3', async () => {
    const send = jest.spyOn(S3Client.prototype, 'send');
    const provider = new S3StorageProvider(configService(configuration));

    await expect(
      provider.putObject({ key: '../outside.txt', body: Buffer.from('unsafe') }),
    ).rejects.toBeInstanceOf(FileMediaError);
    expect(send).not.toHaveBeenCalled();
  });

  it('checks bucket health and deletes objects', async () => {
    const send = jest
      .spyOn(S3Client.prototype, 'send')
      .mockResolvedValue({} as never);
    const provider = new S3StorageProvider(configService(configuration));

    await expect(provider.checkHealth()).resolves.toEqual({
      healthy: true,
      provider: 's3',
    });
    await expect(
      provider.deleteObject('merchant-portal/image/2026/07/file.png'),
    ).resolves.toBeUndefined();
    expect(send).toHaveBeenNthCalledWith(1, expect.any(HeadBucketCommand));
    expect(send).toHaveBeenNthCalledWith(2, expect.any(DeleteObjectCommand));
  });
});
