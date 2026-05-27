import { createContext, useContext, useState, useCallback, useEffect } from 'react';
import type { ReactNode } from 'react';
import { evaluationStorage } from '@/services/evaluationStorage';
import { evaluateAll, applyQualityGates } from '@/utils/evaluationEngine';
import { useMods } from '@/contexts/ModContext';
import type { ParsedMod } from '@/services/modLedgerApi';
import type { Evaluation, VerdictResult } from '@/types/evaluation';

const ACTIVE_ID_KEY = 'mod-ledger:active-evaluation-id';

interface EvaluationContextType {
  activeEvaluationId: string | null;
  verdicts: Map<string, VerdictResult>;
  setActiveEvaluationId: (id: string | null) => void;
  runEvaluation: (mods: ParsedMod[]) => Promise<void>;
  clearVerdicts: () => void;
}

const EvaluationContext = createContext<EvaluationContextType | undefined>(undefined);

export function EvaluationProvider({ children }: { children: ReactNode }) {
  const { primaryStats, secondaryStats } = useMods();
  const [activeEvaluationId, setActiveEvaluationIdState] = useState<string | null>(
    () => localStorage.getItem(ACTIVE_ID_KEY)
  );
  const [verdicts, setVerdicts] = useState<Map<string, VerdictResult>>(new Map());
  // Session-cached eval for the active id. Lets users "Use" a Protocol
  // they don't own without refetching on every grading run. Cleared when
  // activeEvaluationId changes.
  const [cachedEval, setCachedEval] = useState<Evaluation | null>(null);

  useEffect(() => {
    if (activeEvaluationId === null) {
      localStorage.removeItem(ACTIVE_ID_KEY);
    } else {
      localStorage.setItem(ACTIVE_ID_KEY, activeEvaluationId);
    }
  }, [activeEvaluationId]);

  const setActiveEvaluationId = useCallback((id: string | null) => {
    setActiveEvaluationIdState(id);
    setVerdicts(new Map());
    setCachedEval(null);
  }, []);

  const runEvaluation = useCallback(
    async (mods: ParsedMod[]) => {
      if (!activeEvaluationId) return;
      // Reuse the cached eval if it matches; otherwise fetch (covers
      // both owned evals and remote-only Protocols the user is "using").
      let evaluation = cachedEval;
      if (evaluation === null || evaluation.id !== activeEvaluationId) {
        try {
          evaluation = await evaluationStorage.get(activeEvaluationId);
        } catch {
          evaluation = null;
        }
        if (evaluation === null) return;
        setCachedEval(evaluation);
      }
      // Union of primary + secondary stat lists; the engine dedupes by (name, is_percent).
      const statDefs = [...primaryStats, ...secondaryStats];
      const verdictMap = evaluateAll(mods, evaluation, statDefs);
      setVerdicts(applyQualityGates(mods, verdictMap, evaluation, statDefs));
    },
    [activeEvaluationId, cachedEval, primaryStats, secondaryStats]
  );

  const clearVerdicts = useCallback(() => {
    setVerdicts(new Map());
  }, []);

  return (
    <EvaluationContext.Provider
      value={{
        activeEvaluationId,
        verdicts,
        setActiveEvaluationId,
        runEvaluation,
        clearVerdicts,
      }}
    >
      {children}
    </EvaluationContext.Provider>
  );
}

export function useEvaluation() {
  const context = useContext(EvaluationContext);
  if (context === undefined) {
    throw new Error('useEvaluation must be used within an EvaluationProvider');
  }
  return context;
}
