# ADR 0001: Monorepo With pnpm Workspaces And Turborepo

Date: 2026-07-13

Status: Accepted for Phase 1

## Context

The product has multiple applications and shared packages: web, API, worker, AI service, contracts, database access, auth, logger, storage, email, analytics, testing, and tracker. Consistent TypeScript configuration, shared contracts, and coordinated CI are required.

## Decision

Use pnpm workspaces with Turborepo for the repository.

## Alternatives

- Separate repositories for each service.
- npm or Yarn workspaces without Turborepo.
- Nx.

## Consequences

- Shared package boundaries can be versioned and tested together.
- CI can cache tasks and enforce quality commands across workspaces.
- The repository must avoid creating packages without clear responsibility.
