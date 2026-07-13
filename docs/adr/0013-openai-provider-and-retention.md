# ADR 0013: OpenAI First Behind An Internal Provider Boundary

Date: 2026-07-13

Status: Accepted for Phase 6; interface shell in Phase 1

## Context

AI-assisted recommendations require a first provider, schema validation, provenance, safe retention, and graceful degradation without coupling product workflows to a provider API.

## Decision

Implement OpenAI as the first adapter behind the internal `AIProvider` interface, using the official provider SDK and structured schema-validated outputs. Configure the model identifier through `OPENAI_MODEL`; do not scatter hardcoded model identifiers through the application.

Production does not store raw provider request or response bodies by default. Persist provider, model, prompt version, input hash, schema version, usage, estimated cost, latency, status, and error classification. Accepted product outputs, such as recommendations, become normal application entities.

Encrypted and redacted raw debugging payloads are allowed only behind an explicit feature flag and must expire within seven days. Never store hidden model reasoning. Send only tenant-authorized evidence and necessary context, never unrelated tenant data.

Core non-AI workflows remain available when the provider or AI service fails.

## Consequences

- Phase 1 validates optional provider configuration and defines the interface but makes no provider calls.
- Phase 6 must add schema tests, retention cleanup, cost estimation, and provider-failure tests before enabling the adapter.
