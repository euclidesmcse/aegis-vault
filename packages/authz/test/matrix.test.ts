import { describe, expect, it } from 'vitest';
import { isAllowed, canAccessWorkspace } from '../src/index.js';
describe('RBAC matrix', () => {
  it('personal owner can export vault items', () => { expect(isAllowed({ resource: 'vaultItem', verb: 'X', workspaceType: 'personal', subjectRole: 'owner' })).toBe(true); });
  it('family member cannot export', () => { expect(isAllowed({ resource: 'vaultItem', verb: 'X', workspaceType: 'family', subjectRole: 'member' })).toBe(false); });
  it('business admin cannot access apiClient of another business', () => { expect(isAllowed({ resource: 'apiClient', verb: 'C', workspaceType: 'business', subjectRole: 'member' })).toBe(false); });
  it('auditor can read audit but not admin memberships', () => { expect(isAllowed({ resource: 'audit', verb: 'R', workspaceType: 'business', subjectRole: 'auditor' })).toBe(true); expect(isAllowed({ resource: 'membership', verb: 'C', workspaceType: 'business', subjectRole: 'auditor' })).toBe(false); });
  it('cross-workspace access is forbidden', () => { expect(canAccessWorkspace({ subject: { userId: 'u1', role: 'owner', workspaceId: 'A', workspaceType: 'personal' }, targetWorkspaceId: 'B' })).toBe(false); });
});
