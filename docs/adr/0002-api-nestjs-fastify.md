# ADR 0002: NestJS API With Fastify Adapter

Date: 2026-07-13

Status: Accepted for Phase 1

## Context

The primary backend needs versioned REST endpoints, OpenAPI documentation, validation, structured logging, authentication, authorization, tenant context, and clear separation between controllers and application services.

## Decision

Use NestJS with the Fastify adapter for the primary API.

## Alternatives

- Express directly.
- Fastify directly.
- Next.js route handlers as the main backend.
- tRPC.

## Consequences

- Controllers remain thin while services and repositories own business behavior.
- Fastify gives strong performance characteristics and a mature plugin ecosystem.
- NestJS abstractions require discipline to avoid overly large modules or service classes.
