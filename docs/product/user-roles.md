# User Roles

## Platform Administrator

Trusted zero2one Growth OS operator with platform-level visibility. Initially can view organisation metadata and status, usage totals, failed-job metadata, system health, and non-content operational diagnostics. The MVP provides no impersonation and no casual access to leads, files, private comments, private business data, authentication secrets, session tokens, or payment credentials. Any future tenant-content support access is separate, explicitly scoped, owner-notified, append-only audited, immediately revocable, and limited to 30 minutes.

## Agency Owner

Owner of an agency organization. Can manage agency settings, invite staff, create client relationships, create business profiles, run audits, manage leads, create projects, assign staff, view agency analytics, manage billing, and configure integrations.

## Agency Administrator

Operational agency administrator. Can perform most agency workflows but cannot delete or transfer the agency, access highly sensitive billing configuration unless granted, or promote owners without authorization.

## Agency Member

Agency staff member with access to assigned clients, leads, projects, content requests, files, and reports according to permissions and relationship-level constraints.

## Business Owner

Owner of a business organization. Can manage business profile information, view reports and website findings, access assigned projects, submit content, approve deliverables, view enabled lead information, invite business staff, and view invoices and payment status.

## Business Member

Business staff user with scoped access granted by the business owner or agency relationship. Can usually view selected projects, submit content, comment, and review assigned items.

## Read-Only Viewer

Limited viewer for specific reports, projects, dashboards, or files. Cannot mutate business state.

## Role Modelling Notes

- A user can belong to multiple organizations.
- Organization membership role is not enough on its own. Protected actions must verify authentication, organization membership, role, named permission, resource ownership, and relationship-level access.
- Platform administrators are not ordinary tenant superusers. Support access should be separate, auditable, and minimized.
- Client-visible and agency-internal content must be separated at the data and authorization layer.
