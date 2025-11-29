import styles from './PipIndicator.module.css';

interface PipIndicatorProps {
  dots: number; // 1-6 filled dots
}

export default function PipIndicator({ dots }: PipIndicatorProps) {
  const totalPips = 7;

  return (
    <div className={styles.pipContainer}>
      {Array.from({ length: totalPips }).map((_, index) => (
        <div
          key={index}
          className={`${styles.pip} ${index < dots ? styles.filled : styles.empty}`}
          aria-label={`Pip ${index + 1}`}
        />
      ))}
    </div>
  );
}
