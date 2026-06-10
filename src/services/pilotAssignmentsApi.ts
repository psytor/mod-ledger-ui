/**
 * Pilot Assignments API Client
 *
 * Talks to the mod-ledger backend's /pilot-assignments routes. The backend uses
 * snake_case and ISO datetime strings; this file is the single seam that
 * translates to/from the frontend's PilotAssignment type.
 *
 * Auth: requests go through shared-ui's authedFetch (injects the bearer token,
 * transparently refreshes on 401). Every route requires auth — the storage
 * adapter only calls these when isAuthenticated.
 */
import { authedFetch, getAccessToken } from 'astrogators-shared-ui';
import type { ModSnapshot, PilotAssignment } from '@/types/pilotAssignment';

const BASE_URL = import.meta.env.VITE_MOD_LEDGER_URL || 'http://localhost/mod-ledger';

// What the backend returns for one assignment. Matches PilotAssignmentResponse
// in mod-ledger/src/schemas/pilot_assignment.py exactly.
interface PilotAssignmentWire {
  id: string;
  owner_user_id: number;
  mod_id: string;
  snapshot: ModSnapshot;
  created_at: string;
  updated_at: string;
}

interface MigrationResponseWire {
  inserted: PilotAssignmentWire[];
  skipped_mod_ids: string[];
}

export interface PilotMigrationResult {
  inserted: PilotAssignment[];
  skippedModIds: string[];
}

// Body for assign / migrate items — matches PilotAssignmentCreate.
interface PilotAssignmentWriteWire {
  id?: string;
  mod_id: string;
  snapshot: ModSnapshot;
}

function fromWire(w: PilotAssignmentWire): PilotAssignment {
  return {
    id: w.id,
    modId: w.mod_id,
    snapshot: w.snapshot,
    createdAt: new Date(w.created_at).getTime(),
    updatedAt: new Date(w.updated_at).getTime(),
  };
}

function toWriteWire(a: {
  id?: string;
  modId: string;
  snapshot: ModSnapshot;
}): PilotAssignmentWriteWire {
  return { id: a.id, mod_id: a.modId, snapshot: a.snapshot };
}

export class PilotAssignmentsApiError extends Error {
  readonly status: number;
  readonly detail?: unknown;

  constructor(message: string, status: number, detail?: unknown) {
    super(message);
    this.name = 'PilotAssignmentsApiError';
    this.status = status;
    this.detail = detail;
  }
}

class PilotAssignmentsApiClient {
  private url(path: string): string {
    return `${BASE_URL}/api/v1/pilot-assignments${path}`;
  }

  private async request<T>(path: string, init: RequestInit = {}): Promise<T> {
    if (!getAccessToken()) {
      throw new PilotAssignmentsApiError('Not authenticated', 401);
    }
    const { headers, ...rest } = init;
    const response = await authedFetch(this.url(path), {
      ...rest,
      headers: { 'Content-Type': 'application/json', ...headers },
    });
    if (response.status === 204) {
      return undefined as T;
    }
    if (!response.ok) {
      const body = await response.json().catch(() => ({}));
      const detail =
        typeof body?.detail === 'string'
          ? body.detail
          : `Request failed (${response.status})`;
      throw new PilotAssignmentsApiError(detail, response.status, body);
    }
    return response.json() as Promise<T>;
  }

  async listMine(): Promise<PilotAssignment[]> {
    const rows = await this.request<PilotAssignmentWire[]>('/mine');
    return rows.map(fromWire);
  }

  async assign(input: { modId: string; snapshot: ModSnapshot }): Promise<PilotAssignment> {
    const row = await this.request<PilotAssignmentWire>('', {
      method: 'POST',
      body: JSON.stringify(toWriteWire(input)),
    });
    return fromWire(row);
  }

  async unassign(modId: string): Promise<void> {
    await this.request<void>(`/${encodeURIComponent(modId)}`, { method: 'DELETE' });
  }

  // Bulk upload — preserves local ids so retries are idempotent (the backend
  // also dedupes on (owner, mod_id)).
  async migrate(assignments: PilotAssignment[]): Promise<PilotMigrationResult> {
    const response = await this.request<MigrationResponseWire>('/migrate', {
      method: 'POST',
      body: JSON.stringify({
        assignments: assignments.map((a) =>
          toWriteWire({ id: a.id, modId: a.modId, snapshot: a.snapshot })
        ),
      }),
    });
    return {
      inserted: response.inserted.map(fromWire),
      skippedModIds: response.skipped_mod_ids,
    };
  }
}

export const pilotAssignmentsApi = new PilotAssignmentsApiClient();
