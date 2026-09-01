import styles from './SegmentedToggle.module.css';

interface SegmentedToggleProps<T extends string> {
  options: { value: T; label: string }[];
  value: T;
  onChange: (value: T) => void;
  ariaLabel?: string;
}

/**
 * A small segmented button group — the shared version of the 5-dot/6-dot
 * toggle inlined in RuleBuilderPage / EvaluationView. Used in the Filters
 * drawer for Sort / Group / Lock.
 */
export default function SegmentedToggle<T extends string>({
  options,
  value,
  onChange,
  ariaLabel,
}: SegmentedToggleProps<T>) {
  return (
    <div className={styles.group} role="group" aria-label={ariaLabel}>
      {options.map((opt) => (
        <button
          key={opt.value}
          type="button"
          data-active={opt.value === value}
          className={styles.button}
          onClick={() => onChange(opt.value)}
        >
          {opt.label}
        </button>
      ))}
    </div>
  );
}
