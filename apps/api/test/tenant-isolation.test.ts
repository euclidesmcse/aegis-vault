import { describe, expect, it } from 'vitest';
import { canAccessWorkspace, isAllowed } from '@aegis/authz';

describe('Tenant isolation', () => {
  it('AC-TENANT-001: cross-tenant IDOR is forbidden by tenant guard', () => {
    const sub = { userId: 'u1', role: 'owner' as const, workspaceId: 'A', workspaceType: 'personal' as const };
    expect(canAccessWorkspace({ subject: sub, targetWorkspaceId: 'B' })).toBe(false);
  });

  it('personal member cannot export (step-up verb)', () => {
    // Personal matrix lacks admin/manager/member entries; only owner has X.
    expect(isAllowed({ resource: 'vaultItem', verb: 'X', workspaceType: 'personal', subjectRole: 'member' })).toBe(false);
  });

  it('business auditor cannot create membership', () => {
    expect(isAllowed({ resource: 'membership', verb: 'C', workspaceType: 'business', subjectRole: 'auditor' })).toBe(false);
  });

  it('family owner can export vault items', () => {
    expect(isAllowed({ resource: 'vaultItem', verb: 'X', workspaceType: 'family', subjectRole: 'owner' })).toBe(true);
  });
});
