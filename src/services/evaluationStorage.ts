import type { Evaluation } from '@/types/evaluation';

// Bumped from "mod-ledger:evaluations" — old shape (rules: Rule[]) is incompatible
// with the new variant model. Old key left untouched in localStorage.
const STORAGE_KEY = 'mod-ledger:evaluations:v2';

type CreateInput = Omit<Evaluation, 'id' | 'createdAt' | 'updatedAt'>;
type UpdatePatch = Partial<Omit<Evaluation, 'id' | 'createdAt' | 'updatedAt'>>;

class EvaluationStorage {
  private readAll(): Evaluation[] {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return [];
    try {
      const parsed = JSON.parse(raw);
      return Array.isArray(parsed) ? parsed : [];
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
