import type { Role } from '@aegis/contracts';
export type WorkspaceType = 'personal' | 'family' | 'business';
export type Resource = 'workspace' | 'membership' | 'group' | 'policy' | 'folder' | 'collection' | 'vaultItem' | 'share' | 'audit' | 'apiClient';
export type Verb = 'C' | 'R' | 'U' | 'D' | 'S' | 'X' | 'M';
export interface Subject { userId: string; role: Role; workspaceId: string; workspaceType: WorkspaceType; }

const businessMatrix: Record<Role, Partial<Record<Resource, Set<Verb>>>> = {
  owner:  { workspace: new Set(['C','R','U','D','M','S']), membership: new Set(['C','R','U','D','M']), group: new Set(['C','R','U','D','M']), policy: new Set(['C','R','U','D']), folder: new Set(['C','R','U','D']), collection: new Set(['C','R','U','D']), vaultItem: new Set(['C','R','U','D','S']), share: new Set(['C','R','U','D']), audit: new Set(['R']), apiClient: new Set(['C','R','U','D']) },
  admin:  { workspace: new Set(['R','M']), membership: new Set(['C','R','U','D']), group: new Set(['C','R','U','D']), policy: new Set(['C','R','U','D']), folder: new Set(['C','R','U','D']), collection: new Set(['C','R','U','D']), vaultItem: new Set(['C','R','U','D','S']), share: new Set(['C','R','U','D']), audit: new Set(['R']), apiClient: new Set(['C','R','U','D']) },
  manager:{ workspace: new Set(['R']), membership: new Set(['R']), group: new Set(['C','R','U','D']), policy: new Set(['R']), folder: new Set(['C','R','U','D']), collection: new Set(['C','R','U','D']), vaultItem: new Set(['C','R','U','D','S']), share: new Set(['C','R','U','D']), audit: new Set(['R']), apiClient: new Set([]) },
  member: { workspace: new Set(['R']), membership: new Set(['R']), group: new Set(['R']), policy: new Set(['R']), folder: new Set(['C','R','U']), collection: new Set(['R']), vaultItem: new Set(['C','R','U','S']), share: new Set(['C','R','U']), audit: new Set([]), apiClient: new Set([]) },
  auditor:{ workspace: new Set(['R']), membership: new Set(['R']), group: new Set(['R']), policy: new Set(['R']), folder: new Set(['R']), collection: new Set(['R']), vaultItem: new Set(['R']), share: new Set(['R']), audit: new Set(['R']), apiClient: new Set([]) },
  guest:  { workspace: new Set(['R']), vaultItem: new Set(['R']), collection: new Set(['R']) },
};
const personalMatrix: Record<Role, Partial<Record<Resource, Set<Verb>>>> = {
  owner:  { workspace: new Set(['C','R','U','D','M','S']), membership: new Set(['C','R','U','D','M']), group: new Set(['C','R','U','D','M']), policy: new Set(['C','R','U','D']), folder: new Set(['C','R','U','D']), collection: new Set(['C','R','U','D']), vaultItem: new Set(['C','R','U','D','S','X']), share: new Set(['C','R','U','D']), audit: new Set(['R']), apiClient: new Set(['C','R','U','D']) },
  admin:  new Object(),
  manager:new Object(), member:new Object(), auditor:new Object(), guest:new Object(),
};
const familyMatrix: Record<Role, Partial<Record<Resource, Set<Verb>>>> = {
  owner:  { workspace: new Set(['C','R','U','D','M','S']), membership: new Set(['C','R','U','D','M']), group: new Set(['C','R','U','D','M']), policy: new Set(['C','R','U','D']), folder: new Set(['C','R','U','D']), collection: new Set(['C','R','U','D']), vaultItem: new Set(['C','R','U','D','S','X']), share: new Set(['C','R','U','D']), audit: new Set(['R']) },
  admin:  { workspace: new Set(['R']), membership: new Set(['C','R','U','D']), group: new Set(['C','R','U','D']), folder: new Set(['C','R','U','D']), vaultItem: new Set(['C','R','U','D','S']), share: new Set(['C','R','U','D']), audit: new Set(['R']) },
  manager:new Object(),
  member: { workspace: new Set(['R']), membership: new Set(['R']), folder: new Set(['C','R','U']), collection: new Set(['R']), vaultItem: new Set(['C','R','U','S']), share: new Set(['C','R','U']) },
  auditor:{ workspace: new Set(['R']), audit: new Set(['R']), vaultItem: new Set(['R']), collection: new Set(['R']) },
  guest:  { workspace: new Set(['R']), vaultItem: new Set(['R']), collection: new Set(['R']) },
};

export const MATRICES = {
  personal: personalMatrix,
  family: familyMatrix,
  business: businessMatrix,
} as const;
