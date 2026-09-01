import type { CSSProperties, ReactNode } from 'react';
import styles from './FilterChip.module.css';

interface FilterChipProps {
  active: boolean;
  onClick: () => void;
  /** CSS colour for the chip's accent (left bar + active glow). */
  accent?: string;
  title?: string;
  children: ReactNode;
}

/**
 * One toggle chip in the Filters drawer — the drawer's counterpart to the
 * disposition chips in InventoryReadout. Translucent by default, glows in
 * its accent colour when active.
 */
export default function FilterChip({
  active,
  onClick,
  accent,
  title,
  children,
}: FilterChipProps) {
  return (
    <button
      type="button"
      className={`${styles.chip} ${active ? styles.active : ''}`}
      style={accent ? ({ ['--accent']: accent } as CSSProperties) : undefined}
      aria-pressed={active}
      onClick={onClick}
      title={title}
    >
      {children}
    </button>
  );
}
