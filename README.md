# NestJS File and Media Service

A provider-agnostic NestJS service for file storage and metadata. It supports a secure local filesystem provider for development and AWS S3 for staging or production without changing the file API.

## Requirements

- Node.js 22 or newer
- pnpm 11
- A MongoDB or MongoDB Atlas database

## Local setup

1. Install packages:

   ```bash
   pnpm install
   ```

2. Copy `.env.example` to `.env` and provide at least `MONGO_URI`, `MONGO_DB_NAME`, and a long `HARD_DELETE_ADMIN_KEY`.

   To enable browser-to-service local transfers, also configure the `TRANSFER_*` values, `FILE_SERVICE_PUBLIC_URL`, and at least one `API_KEYS` entry shown in `.env.example`.

3. Start the service:

   ```bash
   pnpm run start:dev
   ```

The local provider creates `./upload` automatically. The directory is ignored by Git and must never be committed.

To use S3, set `STORAGE_PROVIDER=s3` and configure `AWS_S3_REGION` and `AWS_S3_BUCKET`. The AWS SDK uses `AWS_ACCESS_KEY_ID` and `AWS_SECRET_ACCESS_KEY` when provided, or the standard AWS credential provider chain such as an IAM role.

## Verification

```bash
pnpm run lint
pnpm run build
pnpm run test --runInBand
pnpm run test:integration
pnpm run test:e2e
```

Integration and e2e tests use `MONGO_TEST_URI` when present, otherwise `MONGO_URI`. They refuse to run unless `MONGO_TEST_DB_NAME` ends in `_test`, and they clean only their own application-scoped records.

## Documentation

- [API documentation](docs/API_DOCUMENTATION.md)
- [Architecture](docs/ARCHITECTURE.md)
- [Monolith vs. microservices](docs/MONOLITH_VS_MICROSERVICES.md)
- [Local transfer authorization](docs/LOCAL_TRANSFER_AUTHORIZATION_PLAN.md)
- [Security](docs/SECURITY.md)

## Current limitations

- Uploads are buffered in memory within configured file/count limits. Downloads are streamed.
- `x-app-id` identifies the consuming application; it is not authentication.
- Short-lived local transfer authorization is opt-in and uses a process-local rate limiter. Multi-replica deployments need a distributed gateway limit.
- The server-mediated transfer flow is used for both local and S3 storage. Direct browser-to-S3 presigned transfers are not implemented.
- Files uploaded by the removed S3 proof of concept are not migrated because they have no MongoDB metadata.
