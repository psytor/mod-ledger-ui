import { Routes, Route, Navigate } from 'react-router-dom';
import { useAuth } from 'astrogators-shared-ui';
import AllyCodeSelectionPage from './pages/AllyCodeSelectionPage';
import ModGridPage from './pages/ModGridPage';
import EvaluationsPage from './pages/EvaluationsPage';
import EvaluationDetailPage from './pages/EvaluationDetailPage';
import RuleBuilderPage from './pages/RuleBuilderPage';

function App() {
  return (
    <Routes>
      <Route path="/" element={<ModLedgerRouter />} />
      <Route path="/evaluations" element={<EvaluationsPage />} />
      <Route path="/evaluations/new" element={<RuleBuilderPage />} />
      <Route path="/evaluations/:id" element={<EvaluationDetailPage />} />
      <Route path="/evaluations/:id/edit" element={<RuleBuilderPage />} />
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
