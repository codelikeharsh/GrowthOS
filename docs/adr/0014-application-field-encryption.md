# ADR 0014: Application-Level Encryption For Selected Sensitive Fields

Date: 2026-07-13

Status: Accepted for later domain phases

## Context

Infrastructure encryption does not fully limit database-level exposure of lead content, private notes, integration secrets, and future OAuth credentials. Searchable contact fields need privacy-preserving lookup support.

## Decision

Use AES-256-GCM application-level authenticated encryption with a random nonce per value and key-version metadata for lead email, lead phone, lead message, raw form-submission payloads, private agency notes, private support-ticket notes, sensitive integration credentials, and future OAuth refresh tokens.

Use separate encryption and blind-index keys. Build HMAC-SHA-256 blind indexes from normalized email and phone values for exact searches. Development uses local environment keys; production uses AWS KMS-backed key management. Ordinary public business contact information is not field-encrypted by default.

## Consequences

- Key rotation and re-encryption require explicit operational procedures.
- Blind indexes support equality lookup, not arbitrary substring search.
- Domain encryption code is deferred until a listed field is implemented; Phase 1 adds no unused cryptography abstraction.
