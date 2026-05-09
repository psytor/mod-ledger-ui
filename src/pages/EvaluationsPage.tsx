import { useState } from 'react';
import { Link } from 'react-router-dom';
import { Button, Card, Container } from 'astrogators-shared-ui';
import Layout from '@/components/layout/Layout';
import { evaluationStorage } from '@/services/evaluationStorage';
import type { Evaluation } from '@/types/evaluation';
import styles from './EvaluationsPage.module.css';

export default function EvaluationsPage() {
  const [evaluations] = useState<Evaluation[]>(() => evaluationStorage.listMine());

  return (
    <Layout>
      <Container maxWidth="lg">
        <div className={styles.page}>
          <Card
            chamfered
            chamferSize="lg"
            variant="outline"
            padding="none"
            showDiagonalBorders
            diagonalBorderColor="var(--color-primary)"
            className={styles.hero}
          >
            <span className={styles.heroAccent} aria-hidden="true" />
            <p className={styles.eyebrow}>Mod Ledger // Evaluations</p>
            <h1 className={styles.title}>Evaluations</h1>
            <p className={styles.subtitle}>
              Score sets, save variants, and replay them across runs. Each evaluation is a saved
              lens for grading the mods you pull.
            </p>
            <div className={styles.heroAction}>
              {evaluations.length > 0 && (
                <span className={styles.heroCount}>
                  <strong>{evaluations.length}</strong> Saved
                </span>
              )}
              <Link to="/evaluations/new">
                <Button variant="primary">New evaluation</Button>
              </Link>
            </div>
          </Card>

          {evaluations.length === 0 ? (
            <Card
              chamfered
              padding="none"
              showDiagonalBorders
              diagonalBorderColor="var(--color-primary)"
              className={styles.empty}
            >
              <span className={styles.emptyAccent} aria-hidden="true" />
              <h2 className={styles.emptyTitle}>No evaluations yet</h2>
              <p className={styles.emptyText}>
                Build your first evaluation to start scoring mods. Configure variants per set, tune
                stat targets, and reuse the result whenever you want a verdict.
              </p>
              <Link to="/evaluations/new" className={styles.emptyAction}>
                <Button variant="primary">Create your first evaluation</Button>
              </Link>
            </Card>
          ) : (
            <>
              <p className={styles.divider}>Saved Loadouts</p>
              <div className={styles.grid}>
                {evaluations.map((e) => (
                  <Link key={e.id} to={`/evaluations/${e.id}`} className={styles.cardLink}>
                    <Card
                      chamfered
                      hoverable
                      padding="none"
                      showDiagonalBorders
                      diagonalBorderColor="var(--color-primary)"
                      className={styles.card}
                    >
                      <span className={styles.cardAccent} aria-hidden="true" />
                      <p className={styles.cardEyebrow}>Evaluation</p>
                      <h2 className={styles.cardName}>{e.name}</h2>
                      {e.description && <p className={styles.cardDesc}>{e.description}</p>}
                      <div className={styles.cardFooter}>
                        <span>Loadout</span>
                        <span className={styles.cardOpen}>Open →</span>
                      </div>
                    </Card>
                  </Link>
                ))}
              </div>
            </>
          )}
        </div>
      </Container>
    </Layout>
  );
}
