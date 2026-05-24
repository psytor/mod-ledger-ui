import type {
  EvaluationAuthor,
  EvaluationSourceTemplate,
  ModSetConfig,
} from './evaluation';

export const EVALUATION_EXPORT_FORMAT = 'mod-ledger.evaluation';
export const EVALUATION_EXPORT_SCHEMA_VERSION = 1;

// Wire format v1. Mirrors the parts of Evaluation that travel between users
// (rule content + author snapshot). Recipient-side facts (id, ownerUserId,
// createdAt, updatedAt, isPublic) are deliberately absent — they get fresh
// values on import.
export type EvaluationExportV1 = {
  format: typeof EVALUATION_EXPORT_FORMAT;
  schemaVersion: 1;
  exportedAt: number;
  evaluation: {
    name: string;
    description: string;
    mod_set_configs: ModSetConfig[];
    master_secondary_targets: Record<number, number>;
    authoredBy: EvaluationAuthor | null;
    sourceTemplate: EvaluationSourceTemplate | null;
  };
};

// Thrown by parseImportJson / importFromJson with a user-facing message.
// Caller displays `.message` directly in the UI.
export class EvaluationImportError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'EvaluationImportError';
  }
}
