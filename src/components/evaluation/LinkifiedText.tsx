import { Fragment } from 'react';
import styles from './LinkifiedText.module.css';

// Splits on http/https URLs, capturing them so they survive the split. The
// final char class excludes trailing sentence punctuation so a URL at the end
// of a clause ("see https://x.com.") doesn't swallow the period into the link.
const URL_SPLIT_RE = /(https?:\/\/[^\s<]+[^\s<.,;:!?)\]])/g;
// Non-global twin used only to classify each split part — keeping it separate
// avoids the stateful `lastIndex` pitfall of reusing a /g regex with .test().
const URL_TEST_RE = /^https?:\/\//;

interface LinkifiedTextProps {
  text: string;
  /** Optional class applied to each generated anchor. */
  linkClassName?: string;
}

/**
 * Renders free text with bare http(s) URLs turned into safe external links.
 * Presentation-only: it never mutates the text, just wraps matched URLs in
 * `<a target="_blank" rel="noopener noreferrer">`.
 */
export default function LinkifiedText({ text, linkClassName }: LinkifiedTextProps) {
  const parts = text.split(URL_SPLIT_RE);
  return (
    <>
      {parts.map((part, i) =>
        URL_TEST_RE.test(part) ? (
          <a
            key={i}
            href={part}
            target="_blank"
            rel="noopener noreferrer"
            className={linkClassName ?? styles.link}
          >
            {part}
          </a>
        ) : (
          <Fragment key={i}>{part}</Fragment>
        )
      )}
    </>
  );
}
