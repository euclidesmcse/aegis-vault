import { z } from 'zod';

export const WorkspaceTypeSchema = z.enum(['personal', 'family', 'business']);
export type WorkspaceType = z.infer<typeof WorkspaceTypeSchema>;

export const RoleSchema = z.enum(['owner', 'admin', 'manager', 'member', 'auditor', 'guest']);
export type Role = z.infer<typeof RoleSchema>;

export const WorkspaceSchema = z.object({
  id: z.string().min(1),
  type: WorkspaceTypeSchema,
  name: z.string().min(1).max(120),
  state: z.enum(['active', 'suspended', 'archived']),
  createdAt: z.string().datetime(),
  updatedAt: z.string().datetime(),
});
export type Workspace = z.infer<typeof WorkspaceSchema>;

export const MembershipSchema = z.object({
  workspaceId: z.string().min(1),
  userId: z.string().min(1),
  role: RoleSchema,
  state: z.enum(['active', 'invited', 'revoked']),
  invitedBy: z.string().nullable(),
  joinedAt: z.string().datetime().nullable(),
});
export type Membership = z.infer<typeof MembershipSchema>;

export const InviteRequestSchema = z.object({
  email: z.string().email(),
  role: RoleSchema,
});
export type InviteRequest = z.infer<typeof InviteRequestSchema>;

export const AcceptInviteRequestSchema = z.object({
  inviteId: z.string().min(1),
});
export type AcceptInviteRequest = z.infer<typeof AcceptInviteRequestSchema>;
