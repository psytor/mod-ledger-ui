import type { ReactNode } from 'react';
import { TopBar, Footer, Container, Button, AllyCodeDropdown, useAuth } from 'astrogators-shared-ui';

interface LayoutProps {
  children: ReactNode;
}

export default function Layout({ children }: LayoutProps) {
  const { user, isAuthenticated, logout, authEnabled } = useAuth();

  const handleLogout = () => {
    logout();
    window.location.href = '/';
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', minHeight: '100vh' }}>
      <TopBar
        logo={
          <a href="/" style={{ textDecoration: 'none', color: 'inherit' }}>
            The Astrogator's Table
          </a>
        }
        leftContent={
          <span style={{ color: 'var(--color-text-secondary)', marginLeft: '1rem' }}>
            / Mod Ledger
          </span>
        }
        rightContent={
          <div style={{ display: 'flex', alignItems: 'center', gap: '1rem' }}>
            <AllyCodeDropdown />
            {isAuthenticated ? (
              <>
                <a href="/profile" style={{ color: 'var(--color-text-secondary)', textDecoration: 'none' }}>
                  {user?.username}
                </a>
                <Button variant="ghost" size="sm" onClick={handleLogout}>
                  Logout
                </Button>
              </>
            ) : authEnabled ? (
              <div style={{ display: 'flex', gap: '0.5rem' }}>
                <a href="/login">
                  <Button variant="ghost" size="sm">
                    Login
                  </Button>
                </a>
                <a href="/register">
                  <Button variant="primary" size="sm">
                    Sign Up
                  </Button>
                </a>
              </div>
            ) : null}
          </div>
        }
      />
      <Container maxWidth="full" style={{ flex: 1, paddingTop: '2rem', paddingBottom: '2rem' }}>
        {children}
      </Container>
      <Footer />
    </div>
  );
}
