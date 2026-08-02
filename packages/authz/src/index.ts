import { MATRICES, type Resource, type Subject, type Verb, type WorkspaceType } from './matrix.js';
export type { Resource, Subject, Verb, WorkspaceType };
export { MATRICES } from './matrix.js';

export interface AuthzContext { resource: Resource; verb: Verb; workspaceType: WorkspaceType; subjectRole: Subject['role']; }

export function isAllowed(ctx: AuthzContext): boolean {
  const m = MATRICES[ctx.workspaceType][ctx.subjectRole];
  if (!m) return false;
  const verbs = m[ctx.resource];
  if (!verbs) return false;
  return verbs.has(ctx.verb);
}

/** Tenant guard: must return false unless the subject belongs to the workspace. */
export function canAccessWorkspace(args: { subject: Subject; targetWorkspaceId: string }): boolean {
  return args.subject.workspaceId === args.targetWorkspaceId;
}

export function describeRole(role: Subject['role']): string {
  return role;
}

/** Step-up check: certain verbs require recent re-auth (within windowMinutes). */
export const STEP_UP_VERBS: ReadonlyArray<Verb> = ['X'];
export function requiresStepUp(verb: Verb): boolean { return STEP_UP_VERBS.includes(verb); }
export const AUTHZ_VERSION = '0.1.0';
