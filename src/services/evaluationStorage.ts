import type { Evaluation, EvaluationAuthor } from '@/types/evaluation';
import {
  EVALUATION_EXPORT_FORMAT,
  EVALUATION_EXPORT_SCHEMA_VERSION,
  EvaluationImportError,
  type EvaluationExportV1,
} from '@/types/evaluationExport';

const STORAGE_KEY = 'mod-ledger:evaluations';

// One-shot cleanup of pre-current storage shapes. The previous build keyed
// the variant-model data under STORAGE_KEY + ':v2' and left a v1
// { rules: Rule[] } blob untouched under STORAGE_KEY. Both are incompatible
// with the current Evaluation shape. Safe to delete once any browser that
// ran a pre-cleanup build has loaded the app at least once.
localStorage.removeItem('mod-ledger:evaluations:v2');

type CreateInput = Omit<Evaluation, 'id' | 'createdAt' | 'updatedAt'>;
type UpdatePatch = Partial<Omit<Evaluation, 'id' | 'createdAt' | 'updatedAt'>>;

class EvaluationStorage {
  private readAll(): Evaluation[] {
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
      // Soft-migrate records that pre-date authoredBy/sourceTemplate.
      return parsed.map((e) => ({
        authoredBy: null,
        sourceTemplate: null,
        ...e,
      }));
    } catch {
      return [];
    }
  }

  private writeAll(evaluations: Evaluation[]): void {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(evaluations));
  }

  listMine(): Evaluation[] {
    return this.readAll();
  }

  listPublic(): Evaluation[] {
    return [];
  }

  get(id: string): Evaluation | null {
    return this.readAll().find((e) => e.id === id) ?? null;
  }

  create(input: CreateInput): Evaluation {
    const now = Date.now();
    const evaluation: Evaluation = {
      ...input,
      id: crypto.randomUUID(),
      createdAt: now,
      updatedAt: now,
    };
    const all = this.readAll();
    all.push(evaluation);
    this.writeAll(all);
    return evaluation;
  }

  update(id: string, patch: UpdatePatch): Evaluation | null {
    const all = this.readAll();
    const idx = all.findIndex((e) => e.id === id);
    if (idx === -1) return null;
    const updated: Evaluation = {
      ...all[idx],
      ...patch,
      updatedAt: Date.now(),
    };
    all[idx] = updated;
    this.writeAll(all);
    return updated;
  }

  delete(id: string): void {
    const all = this.readAll().filter((e) => e.id !== id);
    this.writeAll(all);
  }

  // Serialize an evaluation to the wire format. The caller supplies the
  // current user (the storage layer does not depend on auth). `id`,
  // `ownerUserId`, timestamps, and `isPublic` are stripped — they are
  // recipient-side facts.
  exportToJson(id: string, author: EvaluationAuthor | null): string {
    const ev = this.get(id);
    if (!ev) throw new Error(`Evaluation ${id} not found`);
    const payload: EvaluationExportV1 = {
      format: EVALUATION_EXPORT_FORMAT,
      schemaVersion: EVALUATION_EXPORT_SCHEMA_VERSION,
      exportedAt: Date.now(),
      evaluation: {
        name: ev.name,
        description: ev.description,
        mod_set_configs: ev.mod_set_configs,
        master_secondary_targets: ev.master_secondary_targets,
        // Prefer the existing authoredBy (imports carry the original
        // author through subsequent re-exports). Fall back to the
        // exporter's identity when this is a fresh user-created eval.
        authoredBy: ev.authoredBy ?? author,
        sourceTemplate: ev.sourceTemplate,
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

  importFromJson(
    json: string,
    opts: { nameOverride?: string } = {}
  ): Evaluation {
    const payload = this.parseImportJson(json);
    const ev = payload.evaluation;
    return this.create({
      ownerUserId: null,
      isPublic: false,
      name: opts.nameOverride?.trim() || ev.name,
      description: ev.description,
      mod_set_configs: ev.mod_set_configs,
      master_secondary_targets: ev.master_secondary_targets,
      authoredBy: ev.authoredBy,
      sourceTemplate: ev.sourceTemplate,
    });
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
