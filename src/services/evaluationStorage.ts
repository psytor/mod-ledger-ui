import type { Evaluation } from '@/types/evaluation';

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
      return parsed;
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
}

export const evaluationStorage = new EvaluationStorage();
