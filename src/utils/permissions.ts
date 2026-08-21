import type { User } from 'astrogators-shared-ui';

// Shared by EvaluationDetailPage and RuleBuilderPage (and now ModerationPage)
// so the admin/mod check doesn't drift between copies. `role` is a required
// field on shared-ui's `User` type as of 0.10.4 — no widening cast needed.

export function isAdmin(user: User | null): boolean {
  return user?.role === 'admin';
}

export function isMod(user: User | null): boolean {
  return user?.role === 'mod';
}

// Publish/manage rights over Protocols — admin and mod both get this,
// per mod-ledger's backend `_can_modify` (evaluations.py).
export function canModerate(user: User | null): boolean {
  return isAdmin(user) || isMod(user);
}
