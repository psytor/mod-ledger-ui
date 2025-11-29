import { Routes, Route, Navigate } from 'react-router-dom';
import { useAuth, Loader } from '@psytor/astrogators-shared-ui';
import AllyCodeSelectionPage from './pages/AllyCodeSelectionPage';
import ModGridPage from './pages/ModGridPage';

function App() {
  return (
    <Routes>
      {/* Protected routes */}
      <Route
        path="/"
        element={
          <ProtectedRoute>
            <ModLedgerRouter />
          </ProtectedRoute>
        }
      />

      {/* Catch all - redirect to root */}
      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  );
}

// Protected Route wrapper
function ProtectedRoute({ children }: { children: React.ReactNode }) {
  const { isAuthenticated, isLoading } = useAuth();

  if (isLoading) {
    return (
      <div style={{
        display: 'flex',
        justifyContent: 'center',
        alignItems: 'center',
        height: '100vh'
      }}>
        <Loader size="large" />
      </div>
    );
  }

  if (!isAuthenticated) {
    // Redirect to hub login page
    window.location.href = 'http://localhost:5173/login';
    return null;
  }

  return <>{children}</>;
}

// Router that checks for ally code selection
function ModLedgerRouter() {
  const { allyCodes, selectedAllyCode } = useAuth();

  // If no ally codes saved, show selection page
  if (allyCodes.length === 0 || !selectedAllyCode) {
    return <AllyCodeSelectionPage />;
  }

  // Show mod grid with selected ally code
  return <ModGridPage />;
}

export default App;
