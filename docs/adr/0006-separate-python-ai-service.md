# ADR 0006: Separate Python AI Service

Date: 2026-07-13

Status: Accepted for Phase 1

## Context

AI workflows need provider abstraction, structured outputs, prompt versioning, evaluation fixtures, validation, and provider SDK usage. The service should remain optional for core workflows.

## Decision

Create a separate internal Python FastAPI service using Pydantic, Ruff, mypy, pytest, and official provider SDKs when integrated.

## Alternatives

- Implement AI workflows inside the NestJS API.
- Implement AI workflows inside the Node.js worker only.
- Call AI providers directly from the frontend.

## Consequences

- AI logic can evolve independently and use Python ecosystem strengths.
- Internal service authentication and signed job communication are required.
- The API and worker must handle AI service failure without breaking core workflows.
- Provider choice, metadata, and retention are governed by [ADR 0013](0013-openai-provider-and-retention.md).
