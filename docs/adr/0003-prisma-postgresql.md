# ADR 0003: Prisma With PostgreSQL

Date: 2026-07-13

Status: Accepted for Phase 1

## Context

The product requires relational modelling, migrations, transactions, constraints, indexes, and type-safe data access. PostgreSQL is the source of truth for tenant and business data.

## Decision

Use PostgreSQL with Prisma ORM and explicit migrations.

## Alternatives

- Drizzle ORM.
- TypeORM.
- Raw SQL with query builders.
- MongoDB.

## Consequences

- Schema, migrations, and generated client are centralized in a shared database package.
- Raw SQL must be exceptional and reviewed.
- Tenant predicates and bounded queries must be enforced at repository/service boundaries.
