# ADR 0011: AWS Production Deployment Target

Date: 2026-07-13

Status: Accepted for production architecture

## Context

The desired production architecture includes managed containers, database, cache, storage, secrets, email, observability, and infrastructure as code.

## Decision

Target AWS using ECR, ECS Fargate, Application Load Balancer, RDS PostgreSQL, ElastiCache Redis, S3, CloudFront where appropriate, Secrets Manager, CloudWatch, SES, IAM roles, and Terraform.

## Alternatives

- Vercel plus managed database/cache.
- Kubernetes.
- Single VPS.

## Consequences

- Production design is cloud-portable enough at the service boundary but documented for AWS.
- Terraform must be introduced before production hardening.
- Earlier staging may use a simpler platform only if documented as an interim decision.
