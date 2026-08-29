import { describe, expect, it } from 'vitest';
import { ROLES, canAccess, visibleSections } from './roles';

// These tests guard the authorisation MODEL at the UI layer.
// They are convenience checks only — PostgreSQL RLS remains the real security
// boundary (see docs/PRODUCTION_READINESS.md §3). These tests exist to prevent
// accidental regressions in the role->module matrix.

describe('roles model', () => {
  it('exposes the documented application roles', () => {
    for (const role of [
      'super_admin',
      'manager',
      'masb_team',
      'staff',
      'finance',
      'sales',
      'programme_pic',
      'trainer',
      'viewer',
    ]) {
      expect(ROLES[role], `role ${role} should be defined`).toBeTruthy();
    }
  });

  it('reserves Administration for super_admin only', () => {
    for (const role of Object.keys(ROLES)) {
      expect({ role, access: canAccess(role, '/administration') }).toEqual({
        role,
        access: role === 'super_admin',
      });
    }
  });

  it('does not grant MASB_TEAM the Administration module', () => {
    // MASB_TEAM is a general operational role but must not inherit Super Admin
    // administration privileges (user approval/removal, bulk administration).
    expect(canAccess('masb_team', '/administration')).toBe(false);
    expect(
      visibleSections('masb_team').some((s) =>
        s.items.some((i) => i.path === '/administration'),
      ),
    ).toBe(false);
  });

  it('gives every role the Dashboard', () => {
    for (const role of Object.keys(ROLES)) {
      expect(canAccess(role, '/'), `role ${role} should see dashboard`).toBe(true);
    }
  });

  it('allows finance to reach invoices/payments, viewer does not', () => {
    expect(canAccess('finance', '/invoices')).toBe(true);
    expect(canAccess('finance', '/payments')).toBe(true);
    expect(canAccess('viewer', '/invoices')).toBe(false);
    expect(canAccess('viewer', '/payments')).toBe(false);
  });

  it('exposes only the sections a role may visit', () => {
    const sections = visibleSections('viewer');
    for (const section of sections) {
      for (const item of section.items) {
        expect(item.roles).toContain('viewer');
      }
    }
  });
});
