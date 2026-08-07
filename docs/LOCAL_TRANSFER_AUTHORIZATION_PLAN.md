# Local Transfer Authorization Plan

## Status

Implemented for the local provider before the S3 phase.

## Goal

Allow a browser to transfer file bytes directly with the file service without exposing the BFF's permanent `x-api-key`.

```text
admin-portal -> admin-bff: request permission
admin-bff -> file-media-service: create short-lived authorization
admin-portal -> file-media-service: upload/download using temporary token
```

Local transfers still pass through the file service because the filesystem has no public HTTP API. Phase 2 S3 can preserve the authorization workflow while returning a presigned S3 URL for the byte transfer.

## Proposed API

Internal endpoints called by the BFF:

```http
POST /files/authorizations/upload
POST /files/:fileId/authorizations/download
```

Browser-facing transfer endpoints:

```http
POST /files/authorized-upload
GET /files/:fileId/authorized-download
```

The implemented browser-facing routes use an `Authorization: Bearer ...` header. Query-string tokens are intentionally unsupported to reduce leakage through URLs, logs, and browser history. They are named `authorized-*` rather than `direct-*` because local bytes still pass through the file-service backend.

## Token requirements

Each signed authorization must be:

- short-lived;
- scoped to `appId` and one operation (`upload` or `download`);
- scoped to `fileId` for downloads;
- constrained by upload size and allowed MIME types for uploads;
- cryptographically signed and validated without trusting browser headers;
- single-use where practical, using a unique token ID and replay store;
- rejected after expiration, reuse, tampering, or scope mismatch.

Permanent API keys, admin keys, filesystem paths, storage keys, and provider credentials must never be included in the browser response or token claims.

## Implemented milestones

1. Provider-agnostic transfer-authorization contracts and normalized errors.
2. Opt-in configuration for signing key, token lifetime, public URL, and rate limits.
3. BFF-only authorization endpoints with mandatory service API-key enforcement.
4. Local authorized-upload and authorized-download routes using temporary Bearer authorization.
5. HMAC validation, hashed single-use replay records, MongoDB TTL cleanup, and per-instance rate limiting.
6. Unit and e2e coverage for configuration, tampering, expiry, reuse, file scope, upload limits, and direct streams.
7. API, architecture, security, and client integration documentation.

The built-in rate limiter is process-local. Multi-replica production deployments must also enforce distributed limits at a gateway or shared rate-limit service.

## S3 migration

S3 storage keeps the same server-mediated authorization and transfer routes. Selecting `STORAGE_PROVIDER=s3` changes only the storage adapter used by the file service; the authorization response and browser flow remain unchanged. Switching back to `STORAGE_PROVIDER=local` continues to use the local provider.

Direct-to-S3 presigned uploads are a separate future workflow. They would require a safe metadata finalization workflow, such as pending metadata followed by object verification before the file becomes active, and are not enabled by this S3 adapter.
