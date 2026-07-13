# ADR 0008: Private S3-Compatible Object Storage

Date: 2026-07-13

Status: Accepted for Phase 1

## Context

The product stores screenshots, private client files, report exports, content submissions, generated PDFs, project attachments, and lead exports.

## Decision

Use MinIO for local development and S3-compatible private object storage in production. Use signed upload and download URLs.

## Alternatives

- Store files in PostgreSQL.
- Public object URLs.
- Local filesystem storage.

## Consequences

- Files remain private by default.
- Upload confirmation and validation are separate from metadata creation.
- Abandoned uploads and retention need cleanup jobs.
