import styles from './ScoreLegend.module.css';

// Explains the band chips shown on each ModCard. Rendered once at the top of
// the push-or-sell views so players aren't left guessing what the % means.
export default function ScoreLegend() {
  return (
    <div className={styles.legend}>
      <span className={styles.intro}>
        <strong>%</strong> shows how close a mod is to a perfect roll — higher
        is better. Mods are ranked only against peers at the same stage.
      </span>
      <span className={styles.items}>
        <span className={styles.item}>
          <span className={`${styles.chip} ${styles.push}`}>↑ Push</span>
          best of its group — worth the upgrade
        </span>
        <span className={styles.item}>
          <span className={`${styles.chip} ${styles.keep}`}>Keep</span>
          middle of the pack — hold for now
        </span>
        <span className={styles.item}>
          <span className={`${styles.chip} ${styles.sell}`}>
            Consider Selling
          </span>
          weakest of its group
        </span>
      </span>
    </div>
  );
}
