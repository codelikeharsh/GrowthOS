# ADR 0004: First-Party Authentication With Opaque Sessions

Date: 2026-07-13

Status: Accepted for Phase 2

## Context

The platform needs secure email/password authentication, verification, reset, invitations, session revocation, logout from all devices, audit logs, CSRF protection, and tenant-aware authorization.

## Decision

Use first-party, secure opaque sessions backed by PostgreSQL. Generate each raw session token with a cryptographically secure random generator and sufficient entropy. Send the raw token only in an `HttpOnly` cookie that is `Secure` in production and `SameSite=Lax` or stricter. Never place authentication tokens in local storage.

Store only the SHA-256 hash of the random token in PostgreSQL. Argon2id is required for passwords, but is deliberately not used to hash high-entropy session tokens. PostgreSQL is the source of truth. Redis may cache short-lived session lookups, but authentication must fall back to PostgreSQL when Redis is unavailable.

State-changing cookie-authenticated requests require CSRF protection and origin validation.

## Session Lifecycle

- Creation: after successful authentication, invalidate any pre-authentication session, generate a new random token, persist its SHA-256 hash and bounded expiry, then set the raw token cookie.
- Verification: hash the presented cookie, consult Redis only as an acceleration, and confirm the authoritative session, user state, expiry, and revocation state in PostgreSQL when the cache misses or is unavailable.
- Rotation: create a replacement session and revoke the old session atomically after login, password change, role change, and privilege elevation.
- Expiration: enforce absolute server-side expiry and clear an expired cookie. Idle expiry may be added only with a bounded renewal policy.
- Revocation: persist revocation in PostgreSQL and evict the cache entry so revocation takes effect immediately.
- Redis failure: continue authoritative PostgreSQL verification; never fail open or treat cached state as the source of truth.
- Current-device logout: revoke the presented session, evict it from Redis, and expire the cookie.
- All-device logout: revoke every active session for the user in one authoritative operation, evict corresponding cache entries, and expire the current cookie.

## Alternatives

- JWT access and refresh tokens.
- Third-party hosted auth.
- OAuth-first login.

## Consequences

- Session revocation and device lists are straightforward.
- API must implement CSRF protection for cookie-authenticated state changes.
- PostgreSQL queries remain on the critical authentication path when Redis is degraded, so they require bounded indexes and operational monitoring.
