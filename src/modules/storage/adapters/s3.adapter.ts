import { Injectable } from '@nestjs/common';
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
import {
  FileMediaError,
  FileMediaErrorCode,
} from '../../../common/errors/file-media.error';
import {
  PutObjectInput,
  PutObjectResult,
  StorageHealthResult,
  StorageProvider,
  StorageReadResult,
} from '../interfaces/storage-provider.interface';

const SAFE_KEY_SEGMENT = /^[a-zA-Z0-9][a-zA-Z0-9._-]*$/;

function getErrorCode(error: unknown): string | number | undefined {
  if (typeof error !== 'object' || error === null) {
    return undefined;
  }

  if ('code' in error) {
    const code = error.code;
    if (typeof code === 'string' || typeof code === 'number') {
      return code;
    }
  }

  if ('name' in error && typeof error.name === 'string') {
    return error.name;
  }

  if ('$metadata' in error) {
    const metadata = error.$metadata;
    if (
      typeof metadata === 'object' &&
      metadata !== null &&
      'httpStatusCode' in metadata &&
      typeof metadata.httpStatusCode === 'number'
    ) {
      return metadata.httpStatusCode;
    }
  }

  return undefined;
}

function isNotFoundError(error: unknown): boolean {
  const code = getErrorCode(error);
  return (
    code === 'NotFound' ||
    code === 'NoSuchKey' ||
    code === 'NotFoundException' ||
    code === 404 ||
    code === '404'
  );
}

function isAsyncIterable(
  value: unknown,
): value is AsyncIterable<Uint8Array | Buffer> {
  return (
    typeof value === 'object' &&
    value !== null &&
    Symbol.asyncIterator in value
  );
}

@Injectable()
export class S3StorageProvider implements StorageProvider {
  readonly name = 's3' as const;
  private readonly client: S3Client;
  private readonly bucket: string;

  constructor(configService: ConfigService) {
    const configuration =
      configService.getOrThrow<StorageConfiguration>('storage');

    const region = configuration.s3Region;
    const bucket = configuration.s3Bucket;
    if (!region || !bucket) {
      throw new FileMediaError(
        FileMediaErrorCode.STORAGE_OPERATION_FAILED,
        'S3 region and bucket must be configured',
      );
    }

    this.client = new S3Client({ region });
    this.bucket = bucket;
  }

  async putObject(input: PutObjectInput): Promise<PutObjectResult> {
    const key = this.resolveKey(input.key);

    try {
      await this.client.send(
        new PutObjectCommand({
          Bucket: this.bucket,
          Key: key,
          Body: input.body,
          IfNoneMatch: '*',
        }),
      );

      const object = await this.client.send(
        new HeadObjectCommand({ Bucket: this.bucket, Key: key }),
      );
      const size = object.ContentLength;

      if (typeof size !== 'number' || !Number.isSafeInteger(size)) {
        throw new Error('S3 did not return the stored object size');
      }

      return { key: input.key, size };
    } catch (error) {
      throw new FileMediaError(
        FileMediaErrorCode.STORAGE_OPERATION_FAILED,
        'The object could not be stored',
        { cause: error },
      );
    }
  }

  async openReadStream(keyValue: string): Promise<StorageReadResult> {
    const key = this.resolveKey(keyValue);

    try {
      const object = await this.client.send(
        new GetObjectCommand({ Bucket: this.bucket, Key: key }),
      );
      const stream = this.toReadable(object.Body);
      const size = object.ContentLength;

      if (
        !stream ||
        typeof size !== 'number' ||
        !Number.isSafeInteger(size)
      ) {
        throw new Error('S3 did not return a readable object and size');
      }

      return { stream, size };
    } catch (error) {
      throw new FileMediaError(
        FileMediaErrorCode.STORAGE_OPERATION_FAILED,
        'The object could not be read',
        { cause: error },
      );
    }
  }

  async objectExists(keyValue: string): Promise<boolean> {
    const key = this.resolveKey(keyValue);

    try {
      await this.client.send(
        new HeadObjectCommand({ Bucket: this.bucket, Key: key }),
      );
      return true;
    } catch (error) {
      if (isNotFoundError(error)) {
        return false;
      }
      throw new FileMediaError(
        FileMediaErrorCode.STORAGE_OPERATION_FAILED,
        'The object could not be checked',
        { cause: error },
      );
    }
  }

  async deleteObject(keyValue: string): Promise<void> {
    const key = this.resolveKey(keyValue);

    try {
      await this.client.send(
        new DeleteObjectCommand({ Bucket: this.bucket, Key: key }),
      );
    } catch (error) {
      if (isNotFoundError(error)) {
        return;
      }
      throw new FileMediaError(
        FileMediaErrorCode.STORAGE_OPERATION_FAILED,
        'The object could not be deleted',
        { cause: error },
      );
    }
  }

  async checkHealth(): Promise<StorageHealthResult> {
    try {
      await this.client.send(new HeadBucketCommand({ Bucket: this.bucket }));
      return { healthy: true, provider: this.name };
    } catch {
      return { healthy: false, provider: this.name };
    }
  }

  private resolveKey(key: string): string {
    if (key.length === 0 || key.includes('\\') || key.includes('\0')) {
      throw this.invalidKeyError();
    }

    const segments = key.split('/');
    if (
      segments.some(
        (segment) =>
          segment.length === 0 ||
          segment === '.' ||
          segment === '..' ||
          !SAFE_KEY_SEGMENT.test(segment),
      )
    ) {
      throw this.invalidKeyError();
    }

    return key;
  }

  private toReadable(body: unknown): Readable | undefined {
    if (body instanceof Readable) {
      return body;
    }
    if (isAsyncIterable(body)) {
      return Readable.from(body);
    }
    if (body instanceof Uint8Array) {
      return Readable.from([body]);
    }
    return undefined;
  }

  private invalidKeyError(): FileMediaError {
    return new FileMediaError(
      FileMediaErrorCode.STORAGE_OPERATION_FAILED,
      'The storage key is invalid',
    );
  }
}
