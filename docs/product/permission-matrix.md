# Permission Matrix

## Permission Model

The system uses named permissions mapped to organization roles. Backend code should ask for permissions rather than scattering hardcoded role checks. Resource ownership, tenant membership, and agency-client relationship access must be checked in addition to named permissions.

## Initial Permissions

| Permission                   | Platform Admin | Agency Owner | Agency Admin | Agency Member | Business Owner | Business Member | Read-Only Viewer |
| ---------------------------- | -------------- | ------------ | ------------ | ------------- | -------------- | --------------- | ---------------- |
| organization.read            | Yes            | Yes          | Yes          | Yes           | Yes            | Yes             | Scoped           |
| organization.update          | Support        | Yes          | Yes          | No            | Yes            | No              | No               |
| organization.members.read    | No             | Yes          | Yes          | Scoped        | Yes            | Scoped          | No               |
| organization.members.invite  | No             | Yes          | Yes          | No            | Yes            | No              | No               |
| organization.members.remove  | No             | Yes          | Yes          | No            | Yes            | No              | No               |
| organization.billing.manage  | No             | Yes          | Optional     | No            | Optional       | No              | No               |
| business.read                | No             | Yes          | Yes          | Scoped        | Yes            | Scoped          | Scoped           |
| business.update              | No             | Yes          | Yes          | Scoped        | Yes            | Scoped          | No               |
| business.integrations.manage | No             | Yes          | Yes          | No            | Yes            | No              | No               |
| website.read                 | No             | Yes          | Yes          | Scoped        | Yes            | Scoped          | Scoped           |
| website.manage               | No             | Yes          | Yes          | Scoped        | Yes            | No              | No               |
| website.audit.create         | No             | Yes          | Yes          | Scoped        | Yes            | No              | No               |
| website.audit.read           | No             | Yes          | Yes          | Scoped        | Yes            | Scoped          | Scoped           |
| lead.read                    | No             | Yes          | Yes          | Scoped        | Optional       | Optional        | Scoped           |
| lead.create                  | No             | Yes          | Yes          | Scoped        | Optional       | Optional        | No               |
| lead.update                  | No             | Yes          | Yes          | Scoped        | Optional       | No              | No               |
| lead.delete                  | No             | Yes          | Yes          | No            | Optional       | No              | No               |
| lead.assign                  | No             | Yes          | Yes          | Scoped        | No             | No              | No               |
| lead.export                  | No             | Yes          | Yes          | No            | Optional       | No              | No               |
| project.read                 | No             | Yes          | Yes          | Scoped        | Yes            | Scoped          | Scoped           |
| project.create               | No             | Yes          | Yes          | Scoped        | No             | No              | No               |
| project.update               | No             | Yes          | Yes          | Scoped        | Scoped         | Scoped          | No               |
| project.delete               | No             | Yes          | Yes          | No            | No             | No              | No               |
| project.approve              | No             | No           | No           | No            | Yes            | Scoped          | No               |
| content.read                 | No             | Yes          | Yes          | Scoped        | Yes            | Scoped          | Scoped           |
| content.submit               | No             | Yes          | Yes          | Scoped        | Yes            | Scoped          | No               |
| content.approve              | No             | Yes          | Yes          | Scoped        | Yes            | Scoped          | No               |
| file.read                    | No             | Yes          | Yes          | Scoped        | Yes            | Scoped          | Scoped           |
| file.upload                  | No             | Yes          | Yes          | Scoped        | Yes            | Scoped          | No               |
| file.delete                  | No             | Yes          | Yes          | Scoped        | Yes            | Scoped          | No               |
| invoice.read                 | No             | Yes          | Yes          | No            | Yes            | Scoped          | Scoped           |
| invoice.manage               | No             | Yes          | Optional     | No            | No             | No              | No               |
| payment.read                 | No             | Yes          | Optional     | No            | Yes            | No              | No               |
| report.read                  | No             | Yes          | Yes          | Scoped        | Yes            | Scoped          | Scoped           |
| report.create                | No             | Yes          | Yes          | Scoped        | No             | No              | No               |
| report.export                | No             | Yes          | Yes          | Scoped        | Yes            | Scoped          | Scoped           |
| admin.platform.read          | Yes            | No           | No           | No            | No             | No              | No               |
| admin.support_access.create  | Yes            | No           | No           | No            | No             | No              | No               |

## Implemented Phase 3 Permissions

| Permission group                 | Owner | Admin | Member default                  | Viewer default |
| -------------------------------- | ----- | ----- | ------------------------------- | -------------- |
| `agency_client.read`             | Yes   | Yes   | Assigned clients                | Assigned only  |
| Client create/update             | Yes   | Yes   | Update assigned clients         | No             |
| Suspend/terminate/assign manager | Yes   | Yes   | No                              | No             |
| Agency-internal note read/write  | Yes   | Yes   | No                              | No             |
| Client-visible note read/write   | Yes   | Yes   | Yes, within eligible assignment | Read only      |
| `business_profile.read/update`   | Yes   | Yes   | Read and update                 | Read only      |
| Business location/service manage | Yes   | Yes   | Yes                             | Read only      |
| Business hours/social manage     | Yes   | Yes   | Yes                             | Read only      |

The concrete migration seeds 20 named permissions under `agency_client.*`, `business_profile.*`,
`business_location.*`, `business_service.*`, `business_hours.*`, and
`business_social_link.*`. Organization type, active membership, eligible relationship state, and
account-manager assignment remain additional predicates; a permission name alone never grants
cross-tenant access. Platform administrators receive no implicit private client access.

## Notes

- The MVP has no impersonation or tenant-content support permission. A future `Support` grant may exist only through the reasoned, scoped, owner-notified, maximum 30-minute workflow in [ADR 0015](../adr/0015-platform-support-access.md).
- `Scoped` means access depends on assignment, relationship permissions, or explicit sharing.
- `Optional` means the permission can be granted by configuration but is not a default role capability.
- The organization permissions were versioned in Phase 2; the client/profile permissions were
  versioned and tested in Phase 3. Later-phase rows remain planning baselines.
