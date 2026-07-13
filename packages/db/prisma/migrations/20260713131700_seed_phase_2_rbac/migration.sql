-- Prevent more than one live invitation for the same normalized email and organisation.
CREATE UNIQUE INDEX "organization_invitations_pending_email_key"
ON "organization_invitations" ("organization_id", "email")
WHERE "status" = 'PENDING';

INSERT INTO "roles" ("id", "name", "description", "updated_at") VALUES
  ('00000000-0000-4000-8000-000000000001', 'OWNER', 'Full organisation control and ownership responsibilities.', CURRENT_TIMESTAMP),
  ('00000000-0000-4000-8000-000000000002', 'ADMIN', 'Organisation administration without ownership transfer authority.', CURRENT_TIMESTAMP),
  ('00000000-0000-4000-8000-000000000003', 'MEMBER', 'Standard organisation member access.', CURRENT_TIMESTAMP),
  ('00000000-0000-4000-8000-000000000004', 'VIEWER', 'Read-only organisation access.', CURRENT_TIMESTAMP);

INSERT INTO "permissions" ("id", "name", "description") VALUES
  ('10000000-0000-4000-8000-000000000001', 'organization.read', 'Read organisation metadata.'),
  ('10000000-0000-4000-8000-000000000002', 'organization.update', 'Update organisation metadata.'),
  ('10000000-0000-4000-8000-000000000003', 'organization.members.read', 'Read organisation memberships.'),
  ('10000000-0000-4000-8000-000000000004', 'organization.members.invite', 'Invite organisation members.'),
  ('10000000-0000-4000-8000-000000000005', 'organization.members.remove', 'Remove organisation members.'),
  ('10000000-0000-4000-8000-000000000006', 'organization.members.roles.manage', 'Change non-owner organisation roles.'),
  ('10000000-0000-4000-8000-000000000007', 'organization.invitations.manage', 'Resend and revoke organisation invitations.');

INSERT INTO "role_permissions" ("id", "role_id", "permission_id")
SELECT gen_random_uuid(), role."id", permission."id"
FROM "roles" role
JOIN "permissions" permission ON (
  role."name" = 'OWNER'
  OR (role."name" = 'ADMIN' AND permission."name" IN (
    'organization.read',
    'organization.update',
    'organization.members.read',
    'organization.members.invite',
    'organization.members.remove',
    'organization.members.roles.manage',
    'organization.invitations.manage'
  ))
  OR (role."name" = 'MEMBER' AND permission."name" IN (
    'organization.read',
    'organization.members.read'
  ))
  OR (role."name" = 'VIEWER' AND permission."name" = 'organization.read')
);
