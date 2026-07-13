# Phase 3 API Conventions And Endpoints

All routes are under `/api/v1`, require the Phase 2 opaque session, return JSON, and use the existing
CSRF token for mutations. Agency routes require `x-organization-id`. Business self-service routes
use `x-organization-id`; agency access to shared business resources uses
`x-agency-organization-id` with `x-relationship-id`. Request bodies never select a tenant.

## Agency Clients

- `GET|POST /agency-clients`
- `GET|PATCH /agency-clients/:relationshipId`
- `PATCH /agency-clients/:relationshipId/status`
- `PATCH /agency-clients/:relationshipId/account-manager`
- `GET|POST /agency-clients/:relationshipId/notes`
- `PATCH /agency-clients/:relationshipId/notes/:noteId`
- `GET|POST /agency-clients/:relationshipId/invitations`
- `POST /agency-clients/:relationshipId/invitations/:invitationId/resend`
- `DELETE /agency-clients/:relationshipId/invitations/:invitationId`

Client creation requires an `Idempotency-Key`. List endpoints use bounded cursor pagination. Mutable
relationship records use a numeric `version`; stale writes return a conflict. Lifecycle and other
domain failures expose stable error codes.

## Business Profile And Resources

- `GET|PATCH /business-profile`
- `GET|POST /business-profile/locations`
- `PATCH|DELETE /business-profile/locations/:locationId`
- `GET|POST /business-profile/services`
- `PATCH|DELETE /business-profile/services/:serviceId`
- `GET|PUT /business-profile/hours`
- `GET|POST /business-profile/social-links`
- `PATCH|DELETE /business-profile/social-links/:socialLinkId`
- `GET /business-profile/relationship`
- `GET|POST /business-profile/relationship/notes`

The API validates pricing modes, currencies, coordinates, normalized social URLs, hour intervals,
relationship state, named permissions, membership, and assignment. Business users never receive
agency-internal notes. Controllers do not authorize by hardcoded role name.
