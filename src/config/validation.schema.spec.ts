import { validateEnvironment } from './validation.schema';

describe('validateEnvironment', () => {
  const validEnvironment: Record<string, unknown> = {
    MONGO_URI: 'mongodb://localhost:27017',
    MONGO_DB_NAME: 'file_media_service',
    STORAGE_PROVIDER: 'local',
    LOCAL_STORAGE_ROOT: './upload',
    HARD_DELETE_ADMIN_KEY: 'a-long-development-key',
  };

  it('accepts the minimum Phase 1 configuration', () => {
    expect(validateEnvironment({ ...validEnvironment })).toEqual(
      validEnvironment,
    );
  });

  it('rejects a missing MongoDB URI', () => {
    const environment = { ...validEnvironment };
    delete environment.MONGO_URI;

    expect(() => validateEnvironment(environment)).toThrow(
      'MONGO_URI is required',
    );
  });

  it('accepts S3 configuration', () => {
    const environment = {
      ...validEnvironment,
      STORAGE_PROVIDER: 's3',
      AWS_S3_REGION: 'ap-southeast-1',
      AWS_S3_BUCKET: 'meal-guides-bucket',
      AWS_ACCESS_KEY_ID: 'test-access-key',
      AWS_SECRET_ACCESS_KEY: 'test-secret-key',
    };

    expect(validateEnvironment(environment)).toEqual(environment);
  });

  it('requires an S3 region and bucket when S3 is selected', () => {
    expect(() =>
      validateEnvironment({ ...validEnvironment, STORAGE_PROVIDER: 's3' }),
    ).toThrow('AWS_S3_REGION is required when STORAGE_PROVIDER is s3');
  });

  it('requires S3 credentials to be configured as a pair', () => {
    expect(() =>
      validateEnvironment({
        ...validEnvironment,
        STORAGE_PROVIDER: 's3',
        AWS_S3_REGION: 'ap-southeast-1',
        AWS_S3_BUCKET: 'meal-guides-bucket',
        AWS_ACCESS_KEY_ID: 'test-access-key',
      }),
    ).toThrow(
      'AWS_ACCESS_KEY_ID and AWS_SECRET_ACCESS_KEY must be configured together when provided',
    );
  });

  it('rejects an aggregate limit smaller than a single-file limit', () => {
    expect(() =>
      validateEnvironment({
        ...validEnvironment,
        MAX_FILE_SIZE_BYTES: '100',
        MAX_BULK_TOTAL_SIZE_BYTES: '99',
      }),
    ).toThrow(
      'MAX_BULK_TOTAL_SIZE_BYTES must be greater than or equal to MAX_FILE_SIZE_BYTES',
    );
  });

  it('accepts enabled transfer authorization with secure configuration', () => {
    const environment = {
      ...validEnvironment,
      TRANSFER_AUTHORIZATION_ENABLED: 'true',
      TRANSFER_TOKEN_SIGNING_KEY:
        'test-transfer-signing-key-at-least-32-characters',
      FILE_SERVICE_PUBLIC_URL: 'https://files.example.test',
      API_KEYS: 'admin-bff-key',
    };

    expect(validateEnvironment(environment)).toEqual(environment);
  });

  it('requires signing, URL, and API-key configuration when enabled', () => {
    expect(() =>
      validateEnvironment({
        ...validEnvironment,
        TRANSFER_AUTHORIZATION_ENABLED: 'true',
      }),
    ).toThrow('TRANSFER_TOKEN_SIGNING_KEY must be at least 32 characters');
  });

  it('limits transfer authorizations to one hour', () => {
    expect(() =>
      validateEnvironment({
        ...validEnvironment,
        TRANSFER_AUTHORIZATION_ENABLED: 'true',
        TRANSFER_TOKEN_SIGNING_KEY:
          'test-transfer-signing-key-at-least-32-characters',
        FILE_SERVICE_PUBLIC_URL: 'https://files.example.test',
        API_KEYS: 'admin-bff-key',
        TRANSFER_TOKEN_TTL_SECONDS: '3601',
      }),
    ).toThrow('TRANSFER_TOKEN_TTL_SECONDS must not exceed 3600');
  });

  it('requires an HTTPS public transfer URL in production', () => {
    expect(() =>
      validateEnvironment({
        ...validEnvironment,
        NODE_ENV: 'production',
        TRANSFER_AUTHORIZATION_ENABLED: 'true',
        TRANSFER_TOKEN_SIGNING_KEY:
          'test-transfer-signing-key-at-least-32-characters',
        FILE_SERVICE_PUBLIC_URL: 'http://files.example.test',
        API_KEYS: 'admin-bff-key',
      }),
    ).toThrow('FILE_SERVICE_PUBLIC_URL must use HTTPS in production');
  });
});
