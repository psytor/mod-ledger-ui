import type { ParsedMod } from '@/services/modLedgerApi';
import type { VerdictResult } from '@/types/evaluation';
import { useFilters } from '@/contexts/FilterContext';
import { applyUnconfiguredFilters } from '@/utils/modFilters';
import ModGrid from './ModGrid';
import styles from './CategoryPreview.module.css';

const PREVIEW_COUNT = 12;

interface SectionShellProps {
  title: string;
  subtitle: string;
  count: number;
  onViewAll: () => void;
  children: React.ReactNode;
}

function SectionShell({
  title,
  subtitle,
  count,
  onViewAll,
  children,
}: SectionShellProps) {
  return (
    <section className={styles.section}>
      <button className={styles.header} onClick={onViewAll}>
        <span className={styles.titleWrap}>
          <span className={styles.title}>{title}</span>
          <span className={styles.subtitle}>{subtitle}</span>
        </span>
        <span className={styles.count}>{count} mods</span>
        <span className={styles.drillHint}>View all →</span>
      </button>
      <div className={styles.body}>{children}</div>
    </section>
  );
}

interface SellPilePreviewProps {
  mods: ParsedMod[];
  verdicts: Map<string, VerdictResult>;
  onModClick: (mod: ParsedMod) => void;
}

export function SellPilePreview({
  mods,
  verdicts,
  onModClick,
}: SellPilePreviewProps) {
  const { setFilter } = useFilters();
  const sellMods = mods.filter(
    (m) => verdicts.get(m.mod_id)?.verdict === 'SELL'
  );
  if (sellMods.length === 0) return null;

  const preview = sellMods.slice(0, PREVIEW_COUNT);

  return (
    <SectionShell
      title="Sell Pile"
      subtitle="Failed primary or secondary rules"
      count={sellMods.length}
      onViewAll={() => setFilter('mode', 'sell-pile')}
    >
      <ModGrid mods={preview} onModClick={onModClick} />
    </SectionShell>
  );
}

interface UnconfiguredPreviewProps {
  mods: ParsedMod[];
  verdicts: Map<string, VerdictResult>;
  onModClick: (mod: ParsedMod) => void;
}

export function UnconfiguredPreview({
  mods,
  verdicts,
  onModClick,
}: UnconfiguredPreviewProps) {
  const { setFilter } = useFilters();
  const unconfMods = applyUnconfiguredFilters(mods, verdicts);
  if (unconfMods.length === 0) return null;

  const bySet = new Map<string, number>();
  for (const mod of unconfMods) {
    bySet.set(mod.set, (bySet.get(mod.set) ?? 0) + 1);
  }
  const sortedSets = [...bySet.entries()].sort((a, b) => b[1] - a[1]);

  const preview = unconfMods.slice(0, PREVIEW_COUNT);

  return (
    <SectionShell
      title="Unconfigured"
      subtitle={`Across ${bySet.size} mod set${bySet.size === 1 ? '' : 's'} without rules`}
      count={unconfMods.length}
      onViewAll={() => setFilter('mode', 'unconfigured')}
    >
      <ul className={styles.setList}>
        {sortedSets.map(([set, count]) => (
          <li key={set} className={styles.setItem}>
            <span className={styles.setName}>{set}</span>
            <span className={styles.setCount}>
              {count} mod{count === 1 ? '' : 's'}
            </span>
          </li>
        ))}
      </ul>
      <ModGrid mods={preview} onModClick={onModClick} />
    </SectionShell>
  );
}
