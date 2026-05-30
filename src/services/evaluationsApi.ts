/**
 * Evaluations API Client
 *
 * Talks to the mod-ledger backend's /evaluations routes. The backend uses
 * snake_case and ISO datetime strings throughout; this file is the single
 * seam that translates to/from the frontend's Evaluation type.
 *
 * Auth: Bearer token from shared-ui's getAccessToken(). listProtocols and
 * get tolerate the missing-token case (Protocols are world-readable).
 * Everything else 401s without a token — that's a programming error
 * (the storage adapter only calls them when isAuthenticated).
 */
import { getAccessToken } from 'astrogators-shared-ui';
import type { Evaluation, EvaluationVisibility } from '@/types/evaluation';

const BASE_URL = import.meta.env.VITE_MOD_LEDGER_URL || 'http://localhost/mod-ledger';

// What the backend returns for one evaluation. Matches EvaluationResponse
// in mod-ledger/src/schemas/evaluation.py exactly.
interface EvaluationWire {
  id: string;
  owner_user_id: number | null;
  visibility: EvaluationVisibility;
  protocol_id: string | null;
  version: number;
  authored_by_user_id: number | null;
  name: string;
  description: string;
  // JSONB — engine shape; we pass through verbatim.
  mod_set_configs: Evaluation['mod_set_configs'];
  master_secondary_targets: Evaluation['master_secondary_targets'];
  created_at: string;
  updated_at: string;
}

interface MigrationResponseWire {
  inserted: EvaluationWire[];
  skipped_ids: string[];
}

export interface MigrationResult {
  inserted: Evaluation[];
  skippedIds: string[];
}

// Body for create/update — matches EvaluationBase. The backend ignores any
// extra fields (Pydantic strips them) but staying tight keeps intent clear.
interface EvaluationWriteWire {
  id?: string;
  name: string;
  description: string;
  mod_set_configs: Evaluation['mod_set_configs'];
  master_secondary_targets: Evaluation['master_secondary_targets'];
}

function fromWire(w: EvaluationWire): Evaluation {
  return {
    id: w.id,
    ownerUserId: w.owner_user_id,
    visibility: w.visibility,
    version: w.version,
    name: w.name,
    description: w.description,
    mod_set_configs: w.mod_set_configs,
    master_secondary_targets: w.master_secondary_targets,
    // Backend stores only the id; username is not joined. The UI gracefully
    // skips the "Imported by X" badge when username is null.
    authoredBy:
      w.authored_by_user_id == null
        ? null
        : { userId: String(w.authored_by_user_id), username: null },
    createdAt: new Date(w.created_at).getTime(),
    updatedAt: new Date(w.updated_at).getTime(),
  };
}

function toWriteWire(
  ev: Pick<
    Evaluation,
    'name' | 'description' | 'mod_set_configs' | 'master_secondary_targets'
  > & { id?: string }
): EvaluationWriteWire {
  return {
    id: ev.id,
    name: ev.name,
    description: ev.description,
    mod_set_configs: ev.mod_set_configs,
    master_secondary_targets: ev.master_secondary_targets,
  };
}

export class EvaluationsApiError extends Error {
  readonly status: number;
  readonly detail?: unknown;

  constructor(message: string, status: number, detail?: unknown) {
    super(message);
    this.name = 'EvaluationsApiError';
    this.status = status;
    this.detail = detail;
  }
}

class EvaluationsApiClient {
  private url(path: string): string {
    return `${BASE_URL}/api/v1/evaluations${path}`;
  }

  private async request<T>(
    path: string,
    init: RequestInit & { authRequired?: boolean } = {}
  ): Promise<T> {
    const { authRequired = true, headers, ...rest } = init;
    const token = getAccessToken();
    if (authRequired && !token) {
      throw new EvaluationsApiError('Not authenticated', 401);
    }
    const response = await fetch(this.url(path), {
      ...rest,
      headers: {
        'Content-Type': 'application/json',
        ...(token ? { Authorization: `Bearer ${token}` } : {}),
        ...headers,
      },
    });
    if (response.status === 204) {
      // delete returns no body
      return undefined as T;
    }
    if (!response.ok) {
      const body = await response.json().catch(() => ({}));
      const detail =
        typeof body?.detail === 'string'
          ? body.detail
          : `Request failed (${response.status})`;
      throw new EvaluationsApiError(detail, response.status, body);
    }
    return response.json() as Promise<T>;
  }

  async listMine(): Promise<Evaluation[]> {
    const rows = await this.request<EvaluationWire[]>('/mine');
    return rows.map(fromWire);
  }

  async listProtocols(): Promise<Evaluation[]> {
    const rows = await this.request<EvaluationWire[]>('/protocols', {
      authRequired: false,
    });
    return rows.map(fromWire);
  }

  async get(id: string): Promise<Evaluation | null> {
    try {
      const row = await this.request<EvaluationWire>(`/${id}`, {
        authRequired: false,
      });
      return fromWire(row);
    } catch (err) {
      if (err instanceof EvaluationsApiError && err.status === 404) return null;
      throw err;
    }
  }

  async create(
    input: Pick<
      Evaluation,
      'name' | 'description' | 'mod_set_configs' | 'master_secondary_targets'
    >
  ): Promise<Evaluation> {
    const row = await this.request<EvaluationWire>('', {
      method: 'POST',
      body: JSON.stringify(toWriteWire(input)),
    });
    return fromWire(row);
  }

  async update(
    id: string,
    patch: Partial<
      Pick<
        Evaluation,
        'name' | 'description' | 'mod_set_configs' | 'master_secondary_targets'
      >
    >
  ): Promise<Evaluation> {
    const row = await this.request<EvaluationWire>(`/${id}`, {
      method: 'PATCH',
      body: JSON.stringify(patch),
    });
    return fromWire(row);
  }

  async delete(id: string): Promise<void> {
    await this.request<void>(`/${id}`, { method: 'DELETE' });
  }

  // Owner-only Share / Stop-sharing — flips private ↔ manifest. Promotion
  // to Protocol is a separate operation (publish), not a visibility set.
  async setVisibility(
    id: string,
    visibility: Exclude<EvaluationVisibility, 'protocol'>
  ): Promise<Evaluation> {
    const row = await this.request<EvaluationWire>(`/${id}/visibility`, {
      method: 'PATCH',
      body: JSON.stringify({ visibility }),
    });
    return fromWire(row);
  }

  // Admin-only: snapshot a viewable eval into a NEW admin-owned Protocol.
  // Returns the new Protocol (a different id from the source).
  async publish(id: string, protocolId: string): Promise<Evaluation> {
    const row = await this.request<EvaluationWire>(`/${id}/publish`, {
      method: 'POST',
      body: JSON.stringify({ protocol_id: protocolId }),
    });
    return fromWire(row);
  }

  async createCopy(id: string, name: string): Promise<Evaluation> {
    const row = await this.request<EvaluationWire>(`/${id}/copy`, {
      method: 'POST',
      body: JSON.stringify({ name }),
    });
    return fromWire(row);
  }

  // Bulk upload — preserves localStorage ids so retries are idempotent.
  async migrate(evaluations: Evaluation[]): Promise<MigrationResult> {
    const response = await this.request<MigrationResponseWire>('/migrate', {
      method: 'POST',
      body: JSON.stringify({
        evaluations: evaluations.map((e) => toWriteWire({ ...e, id: e.id })),
      }),
    });
    return {
      inserted: response.inserted.map(fromWire),
      skippedIds: response.skipped_ids,
    };
  }
}

export const evaluationsApi = new EvaluationsApiClient();
