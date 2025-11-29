import { ReactNode } from 'react';
import { TopBar, Footer, Container } from '@psytor/astrogators-shared-ui';

interface LayoutProps {
  children: ReactNode;
}

export default function Layout({ children }: LayoutProps) {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', minHeight: '100vh' }}>
      <TopBar appName="Mod Ledger" />
      <Container maxWidth="full" style={{ flex: 1, paddingTop: '2rem', paddingBottom: '2rem' }}>
        {children}
      </Container>
      <Footer />
    </div>
  );
}
