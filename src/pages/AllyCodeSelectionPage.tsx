import { useState } from 'react';
import { useAuth, Button, Input, Card, Container } from 'astrogators-shared-ui';
import Layout from '@/components/layout/Layout';
import styles from './AllyCodeSelectionPage.module.css';

export default function AllyCodeSelectionPage() {
  const { allyCodes, addAllyCode, selectAllyCode } = useAuth();
  const [newAllyCode, setNewAllyCode] = useState('');
  const [isAdding, setIsAdding] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleAddAllyCode = async () => {
    if (!newAllyCode.trim()) {
      setError('Please enter an ally code');
      return;
    }

    setIsAdding(true);
    setError(null);

    try {
      await addAllyCode(newAllyCode);
      // After adding, select the new ally code
      selectAllyCode(newAllyCode);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to add ally code');
    } finally {
      setIsAdding(false);
    }
  };

  const handleSelectExisting = (allyCode: string) => {
    selectAllyCode(allyCode);
  };

  return (
    <Layout>
      <Container maxWidth="md">
        <div className={styles.container}>
          <h1 className={styles.title}>Select Ally Code</h1>
          <p className={styles.subtitle}>
            Choose an ally code to view your mods
          </p>

          {allyCodes.length === 0 ? (
            /* No ally codes - show input */
            <Card className={styles.inputCard}>
              <h3>Add Your Ally Code</h3>
              <p className={styles.description}>
                Enter your 9-digit SWGOH ally code to get started
              </p>
              <div className={styles.inputGroup}>
                <Input
                  type="text"
                  placeholder="123-456-789"
                  value={newAllyCode}
                  onChange={(e: React.ChangeEvent<HTMLInputElement>) => setNewAllyCode(e.target.value)}
                  disabled={isAdding}
                />
                <Button
                  onClick={handleAddAllyCode}
                  disabled={isAdding}
                  variant="primary"
                >
                  {isAdding ? 'Adding...' : 'Add & Continue'}
                </Button>
              </div>
              {error && <p className={styles.error}>{error}</p>}
            </Card>
          ) : (
            /* Has ally codes - show grid */
            <>
              <div className={styles.allyCodeGrid}>
                {allyCodes.map((ac) => (
                  <Card
                    key={ac.ally_code}
                    chamfered
                    hoverable
                    onClick={() => handleSelectExisting(ac.ally_code)}
                    className={styles.allyCodeCard}
                  >
                    <div className={styles.playerName}>
                      {ac.player_name || 'Unknown Player'}
                    </div>
                    <div className={styles.allyCode}>{ac.ally_code}</div>
                  </Card>
                ))}
              </div>

              {/* Option to add another */}
              <div className={styles.addAnother}>
                <h3>Or add a new ally code</h3>
                <div className={styles.inputGroup}>
                  <Input
                    type="text"
                    placeholder="123-456-789"
                    value={newAllyCode}
                    onChange={(e: React.ChangeEvent<HTMLInputElement>) => setNewAllyCode(e.target.value)}
                    disabled={isAdding}
                  />
                  <Button
                    onClick={handleAddAllyCode}
                    disabled={isAdding}
                    variant="primary"
                  >
                    {isAdding ? 'Adding...' : 'Add'}
                  </Button>
                </div>
                {error && <p className={styles.error}>{error}</p>}
              </div>
            </>
          )}
        </div>
      </Container>
    </Layout>
  );
}
