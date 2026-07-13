# ADR 0015: No Impersonation And Restricted Platform Support Access

Date: 2026-07-13

Status: Accepted for MVP

## Context

Operators need system diagnostics without turning platform administrators into unrestricted tenant superusers.

## Decision

The MVP has no user impersonation. Platform administrators may initially access organisation metadata and status, usage totals, failed-job metadata, system health, and operational diagnostics that do not reveal private client content.

They may not casually access leads, client files, private comments, private business data, password information, session tokens, or payment credentials.

Any future scoped support-access workflow requires an explicit reason, selected organisation, explicit scope, a maximum 30-minute expiry, append-only audit event, organisation-owner notification, immediate revocation, and prohibition on data export and payment or authentication secret access.

## Consequences

- Operational endpoints must expose metadata rather than private payloads.
- Support access is a separate future capability, not ordinary platform-admin authorization.
- Phase 1 implements neither impersonation nor tenant support access.
