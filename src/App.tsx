import { Routes, Route, Navigate } from 'react-router-dom';
import { useAuth } from 'astrogators-shared-ui';
import AllyCodeSelectionPage from './pages/AllyCodeSelectionPage';
import ModGridPage from './pages/ModGridPage';

function App() {
  return (
    <Routes>
      {/* Main route - no authentication required */}
      <Route path="/" element={<ModLedgerRouter />} />

      {/* Catch all - redirect to root */}
      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  );
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
