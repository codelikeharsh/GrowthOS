# ADR 0010: Payment Provider Abstraction With Razorpay First

Date: 2026-07-13

Status: Accepted for Phase 9

## Context

The initial market is India, so Razorpay is the first payment provider. The architecture should permit another provider later. Payment webhooks must be verified and idempotent.

## Decision

Create a payment-provider abstraction and implement Razorpay first.

## Alternatives

- Couple billing directly to Razorpay APIs.
- Use Stripe first.
- Defer payment abstraction.

## Consequences

- Provider-specific webhook verification and state mapping are isolated.
- Frontend payment confirmations are never trusted as final state.
- Payment state transitions must be transactional and auditable.
