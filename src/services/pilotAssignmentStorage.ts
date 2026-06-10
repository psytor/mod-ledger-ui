import { getAccessToken } from 'astrogators-shared-ui';
import type { ModSnapshot, PilotAssignment } from '@/types/pilotAssignment';
import { pilotAssignmentsApi, type PilotMigrationResult } from './pilotAssignmentsApi';

const STORAGE_KEY = 'mod-ledger:pilot-assignments';

// Auth-aware storage adapter for the pilot pool — same two-backend shape as
// evaluationStorage:
//   - Authenticated (Bearer token present): all reads/writes go to the
//     mod-ledger backend via pilotAssignmentsApi.
//   - Unauthenticated (logged-out / free tier): all reads/writes stay in
//     localStorage.
//
// No merging. When a user logs in with local assignments present, the Layout
// migration prompt forces Import-or-Discard (mirrors evaluations; see the
// workspace rule no-silent-local-fallback-when-authed). Until then the
// authenticated list shows only their backend assignments.
class PilotAssignmentStorage {
  // ─── local-only helpers ──────────────────────────────────────────────

  private readLocal(): PilotAssignment[] {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return [];
    try {
      const parsed = JSON.parse(raw);
      if (!Array.isArray(parsed)) return [];
      // Reject malformed blobs (must look like PilotAssignment records).
      if (!parsed.every((a) => typeof a?.modId === 'string' && a?.snapshot)) {
        localStorage.removeItem(STORAGE_KEY);
        return [];
      }
      return parsed as PilotAssignment[];
    } catch {
      return [];
    }
  }

  private writeLocal(assignments: PilotAssignment[]): void {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(assignments));
  }

  private isAuthenticated(): boolean {
    return getAccessToken() != null;
  }

  // Whatever is in localStorage right now, regardless of auth state. The
  // migration prompt uses this to decide whether to show itself.
  listLocal(): PilotAssignment[] {
    return this.readLocal();
  }

  // Destructive: erase all local assignments (the migration Discard flow).
  discardLocal(): void {
    localStorage.removeItem(STORAGE_KEY);
  }

  // ─── unified read/write API (auth-aware) ─────────────────────────────

  async listMine(): Promise<PilotAssignment[]> {
    if (this.isAuthenticated()) {
      return pilotAssignmentsApi.listMine();
    }
    return this.readLocal();
  }

  async assign(input: {
    modId: string;
    snapshot: ModSnapshot;
  }): Promise<PilotAssignment> {
    if (this.isAuthenticated()) {
      return pilotAssignmentsApi.assign(input);
    }
    const now = Date.now();
    const all = this.readLocal();
    const existing = all.find((a) => a.modId === input.modId);
    if (existing) {
      // Idempotent locally too: refresh the snapshot in place.
      existing.snapshot = input.snapshot;
      existing.updatedAt = now;
      this.writeLocal(all);
      return existing;
    }
    const assignment: PilotAssignment = {
      id: crypto.randomUUID(),
      modId: input.modId,
      snapshot: input.snapshot,
      createdAt: now,
      updatedAt: now,
    };
    all.push(assignment);
    this.writeLocal(all);
    return assignment;
  }

  async unassign(modId: string): Promise<void> {
    if (this.isAuthenticated()) {
      await pilotAssignmentsApi.unassign(modId);
      return;
    }
    this.writeLocal(this.readLocal().filter((a) => a.modId !== modId));
  }

  // ─── migration ───────────────────────────────────────────────────────

  // Upload local assignments to the backend. Clears localStorage on full
  // success; on failure (API throws) localStorage is left intact for retry.
  async migrateLocalToBackend(): Promise<PilotMigrationResult> {
    const locals = this.readLocal();
    if (locals.length === 0) {
      return { inserted: [], skippedModIds: [] };
    }
    const result = await pilotAssignmentsApi.migrate(locals);
    this.discardLocal();
    return result;
  }
}

export const pilotAssignmentStorage = new PilotAssignmentStorage();
