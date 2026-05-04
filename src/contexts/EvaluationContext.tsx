import { createContext, useContext, useState, useCallback, useEffect } from 'react';
import type { ReactNode } from 'react';
import { evaluationStorage } from '@/services/evaluationStorage';
import { evaluateAll } from '@/utils/evaluationEngine';
import { useMods } from '@/contexts/ModContext';
import type { ParsedMod } from '@/services/modLedgerApi';
import type { VerdictResult } from '@/types/evaluation';

const ACTIVE_ID_KEY = 'mod-ledger:active-evaluation-id';

interface EvaluationContextType {
  activeEvaluationId: string | null;
  verdicts: Map<string, VerdictResult>;
  setActiveEvaluationId: (id: string | null) => void;
  runEvaluation: (mods: ParsedMod[]) => void;
  clearVerdicts: () => void;
}

const EvaluationContext = createContext<EvaluationContextType | undefined>(undefined);

export function EvaluationProvider({ children }: { children: ReactNode }) {
  const { primaryStats, secondaryStats } = useMods();
  const [activeEvaluationId, setActiveEvaluationIdState] = useState<string | null>(
    () => localStorage.getItem(ACTIVE_ID_KEY)
  );
  const [verdicts, setVerdicts] = useState<Map<string, VerdictResult>>(new Map());

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
  }, []);

  const runEvaluation = useCallback(
    (mods: ParsedMod[]) => {
      if (!activeEvaluationId) return;
      const evaluation = evaluationStorage.get(activeEvaluationId);
      if (!evaluation) return;
      // Union of primary + secondary stat lists; the engine dedupes by (name, is_percent).
      const statDefs = [...primaryStats, ...secondaryStats];
      setVerdicts(evaluateAll(mods, evaluation, statDefs));
    },
    [activeEvaluationId, primaryStats, secondaryStats]
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
