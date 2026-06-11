import { useLayoutEffect, useRef, useState } from 'react';
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

// A CSS `border` on a chamfered Card is clipped away at the cut corners (the
// clip-path removes them), so a dashed border survives only on the straight
// edges. To get an unbroken dashed outline that also traces the diagonal cuts,
// we draw the chamfer polygon ourselves as an SVG that sits OUTSIDE the Card's
// clip-path (over the wrapper), so nothing clips it. These must match shared-ui's
// `chamfered-box-asymmetric`: top/side chamfers 12px, bottom-right cut 24px.
const CHAMFER = 12;
const CHAMFER_BR = 24;
// Half the stroke width — inset the polygon so the dashed line sits fully inside
// the wrapper instead of being half-clipped at its edge.
const STROKE_INSET = 1;

// The 8 vertices of the asymmetric chamfer, in px, for a w×h card.
function chamferPoints(w: number, h: number): string {
  const i = STROKE_INSET;
  return [
    [CHAMFER, i],
    [w - CHAMFER, i],
    [w - i, CHAMFER],
    [w - i, h - CHAMFER_BR],
    [w - CHAMFER_BR, h - i],
    [CHAMFER, h - i],
    [i, h - CHAMFER],
    [i, CHAMFER],
  ]
    .map((p) => p.join(','))
    .join(' ');
}

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

  // Measure the wrapper so the SVG outline can trace the chamfer in real px.
  // ResizeObserver keeps it correct as the grid reflows the card.
  const wrapperRef = useRef<HTMLDivElement>(null);
  const [size, setSize] = useState({ w: 0, h: 0 });
  useLayoutEffect(() => {
    const el = wrapperRef.current;
    if (!el) return;
    const ro = new ResizeObserver(() => {
      setSize({ w: el.clientWidth, h: el.clientHeight });
    });
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

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
    <div className={styles.cardWrapper} ref={wrapperRef}>
      {size.w > 0 && size.h > 0 && (
        <svg
          className={styles.outline}
          width={size.w}
          height={size.h}
          aria-hidden="true"
        >
          <polygon points={chamferPoints(size.w, size.h)} />
        </svg>
      )}
      <Card chamfered chamferSize="asymmetric" padding="none" className={styles.card}>
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
