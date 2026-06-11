import { useState, type CSSProperties } from 'react';
import { Card, Button } from 'astrogators-shared-ui';
import { usePilotAssignment } from '@/contexts/PilotAssignmentContext';
import type { PilotAssignment, ModSnapshot } from '@/types/pilotAssignment';
import ModSprite from './ModSprite';
import styles from './OrphanModCard.module.css';

// The snapshot stores tier as a colour name + letter, not the numeric tier the
// sprite atlas wants. Derive it from the colour (what the live card drew with),
// then fall back to the tier letter, then Gold — so even an older snapshot that
// predates a field still renders something sensible.
const TIER_NUM_BY_COLOR: Record<string, number> = {
  Grey: 1,
  Green: 2,
  Blue: 3,
  Purple: 4,
  Gold: 5,
};
const TIER_NUM_BY_LETTER: Record<string, number> = {
  E: 1,
  D: 2,
  C: 3,
  B: 4,
  A: 5,
};
function snapshotTier(s: ModSnapshot): number {
  return TIER_NUM_BY_COLOR[s.tier_color] ?? TIER_NUM_BY_LETTER[s.tier_name] ?? 5;
}

// The orphan card follows the standard card outline — a solid edge border plus
// the diagonal corner lines that bridge the chamfer gaps — so it reads as a real
// card, but in a muted slate instead of a live tier colour: it's a snapshot, not
// a live mod. Used for both `--border-color` (straight edges) and
// `diagonalBorderColor` (corner lines) so the whole outline is one colour.
const ORPHAN_BORDER = '#64748b';

interface OrphanModCardProps {
  assignment: PilotAssignment;
}

// A pilot-assigned mod that is no longer in the inventory pull. Comlink reports
// only *equipped* mods, so an assigned mod that was unequipped OR sold simply
// vanishes — and the two cases are indistinguishable from the data. Rather than
// silently dropping the assignment (the mod might just be parked on a pilot
// already, doing its job), we redraw it from the snapshot captured at assign
// time and let the player decide: leave it (unequipped) or Remove it (sold).
// Removing is the ONLY way an assignment leaves the pool — never automatic.
export default function OrphanModCard({ assignment }: OrphanModCardProps) {
  const { unassign } = usePilotAssignment();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const s = assignment.snapshot;
  const tier = snapshotTier(s);
  const is6Dot = s.rarity === 6;

  const secondarySlots = Array(4)
    .fill(null)
    .map((_, i) => s.secondaries[i] ?? null);

  const handleRemove = async () => {
    setError(null);
    setBusy(true);
    try {
      await unassign(assignment.modId);
      // On success the context drops this assignment from the map and the card
      // unmounts — so we deliberately don't clear `busy` here (no state update
      // on an unmounted component).
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to remove the assignment.');
      setBusy(false);
    }
  };

  return (
    <div className={styles.cardWrapper}>
      <Card
        chamfered
        chamferSize="asymmetric"
        showDiagonalBorders
        diagonalBorderColor={ORPHAN_BORDER}
        padding="none"
        className={styles.card}
        style={{ '--border-color': ORPHAN_BORDER } as CSSProperties}
      >
        <div className={styles.banner} title="Not in your latest inventory pull">
          Not currently equipped
        </div>

        <div className={styles.cardContent}>
          <div className={styles.ghost}>
            <div className={styles.middleRow}>
              <div className={styles.leftColumn}>
                <div className={styles.dotsContainer}>
                  {Array.from({ length: 7 }, (_, i) => (
                    <div
                      key={i}
                      className={i < s.rarity ? styles.dotActive : styles.dotInactive}
                    />
                  ))}
                </div>
                <div className={styles.spriteContainer}>
                  <ModSprite shape={s.shape} tier={tier} set={s.set} is6Dot={is6Dot} size={80} />
                </div>
                <div className={styles.modMeta}>
                  <span className={styles.modLevel}>
                    {s.level} - {s.tier_name}
                  </span>
                </div>
              </div>

              <div className={styles.rightColumn}>
                <div className={styles.primaryStat}>
                  <span className={styles.primaryName}>{s.primary.stat_name}</span>
                  <span className={styles.primaryValue}>{s.primary.display_value}</span>
                </div>
                <div className={styles.secondaryStats}>
                  {secondarySlots.map((stat, i) => (
                    <div key={i} className={styles.secondaryStat}>
                      {stat ? (
                        <>
                          <span className={styles.statValue}>{stat.display_value}</span>
                          <span className={styles.statName}>{stat.stat_name}</span>
                        </>
                      ) : (
                        <span className={styles.emptySlot}>—</span>
                      )}
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </div>

          <div className={styles.reconcile}>
            {s.character && (
              <p className={styles.lastSeen}>
                Last seen on <strong>{s.character}</strong>
              </p>
            )}
            <Button variant="outline" size="sm" onClick={handleRemove} disabled={busy}>
              {busy ? 'Removing…' : 'Remove'}
            </Button>
            {error && <p className={styles.error}>{error}</p>}
          </div>
        </div>
      </Card>
    </div>
  );
}
