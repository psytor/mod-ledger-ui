import { getAccessToken } from 'astrogators-shared-ui';
import type {
  Evaluation,
  EvaluationAuthor,
  EvaluationVisibility,
} from '@/types/evaluation';
import {
  EVALUATION_EXPORT_FORMAT,
  EVALUATION_EXPORT_SCHEMA_VERSION,
  EvaluationImportError,
  type EvaluationExportV1,
} from '@/types/evaluationExport';
import { evaluationsApi, type MigrationResult } from './evaluationsApi';

const STORAGE_KEY = 'mod-ledger:evaluations';

// One-shot cleanup of pre-current storage shapes. The previous build keyed
// the variant-model data under STORAGE_KEY + ':v2' and left a v1
// { rules: Rule[] } blob untouched under STORAGE_KEY. Both are incompatible
// with the current Evaluation shape. Safe to delete once any browser that
// ran a pre-cleanup build has loaded the app at least once.
localStorage.removeItem('mod-ledger:evaluations:v2');

type CreateInput = Omit<Evaluation, 'id' | 'createdAt' | 'updatedAt'>;
type UpdatePatch = Partial<Omit<Evaluation, 'id' | 'createdAt' | 'updatedAt'>>;

// Auth-aware storage adapter.
//
// Two completely separate backends:
//   - Authenticated (Bearer token present): all reads/writes go to the
//     mod-ledger backend via evaluationsApi.
//   - Unauthenticated: all reads/writes stay in localStorage.
//
// There is no merging or hidden coexistence. When the user is logged in
// and localStorage still has records from their logged-out session, the
// caller (EvaluationsPage) detects that via listLocal() and surfaces the
// non-dismissable MigrationPromptDialog. Until the user picks Import or
// Discard, the list shows only their backend evals — the local copies are
// inert.
class EvaluationStorage {
  // ─── local-only helpers (used by both modes + the migration prompt) ──

  private readLocal(): Evaluation[] {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return [];
    try {
      const parsed = JSON.parse(raw);
      if (!Array.isArray(parsed)) return [];
      // Reject pre-current-shape blobs (v1 had `rules: Rule[]` and no
      // `mod_set_configs`). One bad item wipes the whole key.
      if (!parsed.every((e) => Array.isArray(e?.mod_set_configs))) {
        localStorage.removeItem(STORAGE_KEY);
        return [];
      }
      // Soft-migrate records that pre-date authoredBy/visibility/version.
      // Pre-rename keys (`sourceTemplate`, `isPublic`, `sourceProtocol`)
      // ride along in the spread but become unused excess fields under
      // the current type; nothing reads them (pre-production rename,
      // no compat shim).
      return parsed.map((e) => ({
        authoredBy: null,
        visibility: 'private',
        version: 1,
        ...e,
      }));
    } catch {
      return [];
    }
  }

  private writeLocal(evaluations: Evaluation[]): void {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(evaluations));
  }

  private isAuthenticated(): boolean {
    return getAccessToken() != null;
  }

  // Returns whatever is in localStorage right now, regardless of auth
  // state. The migration prompt uses this to decide whether to show
  // itself; ordinary consumers should use listMine().
  listLocal(): Evaluation[] {
    return this.readLocal();
  }

  // Destructive: erase all localStorage evaluations. Used by the migration
  // prompt's Discard flow after the second confirmation.
  discardLocal(): void {
    localStorage.removeItem(STORAGE_KEY);
  }

  // ─── unified read/write API (auth-aware) ─────────────────────────────

  async listMine(): Promise<Evaluation[]> {
    if (this.isAuthenticated()) {
      return evaluationsApi.listMine();
    }
    return this.readLocal();
  }

  async get(id: string): Promise<Evaluation | null> {
    if (this.isAuthenticated()) {
      return evaluationsApi.get(id);
    }
    return this.readLocal().find((e) => e.id === id) ?? null;
  }

  async create(input: CreateInput): Promise<Evaluation> {
    if (this.isAuthenticated()) {
      return evaluationsApi.create({
        name: input.name,
        description: input.description,
        mod_set_configs: input.mod_set_configs,
        master_secondary_targets: input.master_secondary_targets,
      });
    }
    const now = Date.now();
    const evaluation: Evaluation = {
      ...input,
      id: crypto.randomUUID(),
      createdAt: now,
      updatedAt: now,
    };
    const all = this.readLocal();
    all.push(evaluation);
    this.writeLocal(all);
    return evaluation;
  }

  async update(id: string, patch: UpdatePatch): Promise<Evaluation | null> {
    if (this.isAuthenticated()) {
      // Backend only accepts the four user-editable fields. Anything
      // else in the patch (visibility/version/etc.) is ignored.
      const backendPatch: Partial<
        Pick<
          Evaluation,
          'name' | 'description' | 'mod_set_configs' | 'master_secondary_targets'
        >
      > = {};
      if (patch.name !== undefined) backendPatch.name = patch.name;
      if (patch.description !== undefined) backendPatch.description = patch.description;
      if (patch.mod_set_configs !== undefined)
        backendPatch.mod_set_configs = patch.mod_set_configs;
      if (patch.master_secondary_targets !== undefined)
        backendPatch.master_secondary_targets = patch.master_secondary_targets;
      return evaluationsApi.update(id, backendPatch);
    }
    const all = this.readLocal();
    const idx = all.findIndex((e) => e.id === id);
    if (idx === -1) return null;
    const updated: Evaluation = {
      ...all[idx],
      ...patch,
      updatedAt: Date.now(),
    };
    all[idx] = updated;
    this.writeLocal(all);
    return updated;
  }

  async delete(id: string): Promise<void> {
    if (this.isAuthenticated()) {
      await evaluationsApi.delete(id);
      return;
    }
    const all = this.readLocal().filter((e) => e.id !== id);
    this.writeLocal(all);
  }

  // Creating a copy is a backend-only operation. Logged-out callers
  // shouldn't see the affordance at all; if they reach this method anyway,
  // surface a clear error rather than silently creating a detached local copy.
  async createCopy(id: string, name: string): Promise<Evaluation> {
    if (!this.isAuthenticated()) {
      throw new Error('Sign in to copy evaluations.');
    }
    return evaluationsApi.createCopy(id, name);
  }

  // Visibility changes (Share / Stop Sharing / admin Publish) only exist
  // server-side. The backend enforces role-aware transitions; the UI just
  // sends the requested visibility (+ protocol_id on first promotion).
  async setVisibility(
    id: string,
    visibility: EvaluationVisibility,
    opts: { protocolId?: string } = {}
  ): Promise<Evaluation> {
    if (!this.isAuthenticated()) {
      throw new Error('Sign in to change visibility.');
    }
    return evaluationsApi.setVisibility(id, {
      visibility,
      protocolId: opts.protocolId,
    });
  }

  // ─── export / import (offline-friendly, takes the eval directly) ─────

  // Serialize an evaluation to the wire format. The caller passes the
  // already-loaded eval (so this stays synchronous) and the current user
  // for author-snapshot fallback.
  exportToJson(evaluation: Evaluation, author: EvaluationAuthor | null): string {
    const payload: EvaluationExportV1 = {
      format: EVALUATION_EXPORT_FORMAT,
      schemaVersion: EVALUATION_EXPORT_SCHEMA_VERSION,
      exportedAt: Date.now(),
      evaluation: {
        name: evaluation.name,
        description: evaluation.description,
        mod_set_configs: evaluation.mod_set_configs,
        master_secondary_targets: evaluation.master_secondary_targets,
        // Prefer the existing authoredBy (imports carry the original
        // author through subsequent re-exports). Fall back to the
        // exporter's identity when this is a fresh user-created eval.
        authoredBy: evaluation.authoredBy ?? author,
      },
    };
    return JSON.stringify(payload, null, 2);
  }

  // Parse + migrate without writing. UI calls this first to render a
  // preview dialog; importFromJson then commits with an optional rename.
  parseImportJson(json: string): EvaluationExportV1 {
    let raw: unknown;
    try {
      raw = JSON.parse(json);
    } catch {
      throw new EvaluationImportError('File is not valid JSON.');
    }
    return migrate(raw);
  }

  async importFromJson(
    json: string,
    opts: { nameOverride?: string } = {}
  ): Promise<Evaluation> {
    const payload = this.parseImportJson(json);
    const ev = payload.evaluation;
    return this.create({
      ownerUserId: null,
      visibility: 'private',
      version: 1,
      name: opts.nameOverride?.trim() || ev.name,
      description: ev.description,
      mod_set_configs: ev.mod_set_configs,
      master_secondary_targets: ev.master_secondary_targets,
      authoredBy: ev.authoredBy,
    });
  }

  // ─── migration ───────────────────────────────────────────────────────

  // Upload local evals to the backend. Clears localStorage on full
  // success. On partial failure (API throws), localStorage is left
  // intact so the caller can retry.
  async migrateLocalToBackend(): Promise<MigrationResult> {
    const locals = this.readLocal();
    if (locals.length === 0) {
      return { inserted: [], skippedIds: [] };
    }
    const result = await evaluationsApi.migrate(locals);
    // Only clear local once the request returned 2xx — caller's responsibility
    // to handle exceptions (they leave localStorage intact for retry).
    this.discardLocal();
    return result;
  }
}

// Validate + migrate a parsed payload to the current export shape. Today
// only v1 exists, so the function is the seam: future versions register a
// step here. Throws EvaluationImportError with a user-facing message.
function migrate(raw: unknown): EvaluationExportV1 {
  if (!raw || typeof raw !== 'object') {
    throw new EvaluationImportError('Not a mod-ledger evaluation file.');
  }
  const obj = raw as Record<string, unknown>;
  if (obj.format !== EVALUATION_EXPORT_FORMAT) {
    throw new EvaluationImportError('Not a mod-ledger evaluation file.');
  }
  const version = obj.schemaVersion;
  if (typeof version !== 'number') {
    throw new EvaluationImportError('Export file is missing a schema version.');
  }
  if (version > EVALUATION_EXPORT_SCHEMA_VERSION) {
    throw new EvaluationImportError(
      'This file was made by a newer version of the app. Please update.'
    );
  }
  if (version < 1) {
    throw new EvaluationImportError(
      `Unsupported schema version: ${version}.`
    );
  }
  // version === 1: validate shape.
  const ev = obj.evaluation as Record<string, unknown> | undefined;
  if (!ev || typeof ev !== 'object') {
    throw new EvaluationImportError('Export file is missing evaluation data.');
  }
  if (typeof ev.name !== 'string' || !Array.isArray(ev.mod_set_configs)) {
    throw new EvaluationImportError('Export file is malformed.');
  }
  return raw as EvaluationExportV1;
}

export const evaluationStorage = new EvaluationStorage();
