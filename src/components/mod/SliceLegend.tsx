import { QUALITY_BAND_INFO, type QualityBand } from '@/utils/modDisposition';
import styles from './SliceLegend.module.css';

// Swatch colour per band — mirrors the card chip tints in ModCard.module.css.
const swatchClass: Record<QualityBand, string> = {
  'slice-sure': styles.sliceSure,
  consider: styles.consider,
  average: styles.average,
  'consider-sell': styles.considerSell,
  sell: styles.sell,
};

/**
 * Static key for the per-mod slicing advice scale. The coloured % on each slice
 * card is read straight from the mod's own quality — this maps each colour to
 * its meaning. No cross-mod comparison is involved, so a mod's band never
 * changes when you filter or sort.
 */
export default function SliceLegend() {
  return (
    <div className={styles.legend}>
      <span className={styles.title}>Slicing advice — each mod's own quality %</span>
      <div className={styles.bands}>
        {QUALITY_BAND_INFO.map(({ band, label, range }) => (
          <span key={band} className={styles.band}>
            <span className={`${styles.swatch} ${swatchClass[band]}`} />
            <span className={styles.range}>{range}</span>
            {label}
          </span>
        ))}
      </div>
    </div>
  );
}
