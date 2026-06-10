import React from 'react';
import ReactDOM from 'react-dom/client';
import { BrowserRouter } from 'react-router-dom';
import { AuthProvider } from 'astrogators-shared-ui';
import { ModProvider } from './contexts/ModContext';
import { FilterProvider } from './contexts/FilterContext';
import { EvaluationProvider } from './contexts/EvaluationContext';
import { PilotAssignmentProvider } from './contexts/PilotAssignmentContext';
import App from './App';
import './index.css';

// Get API base URL for astrogators-table (authentication)
// Defaults to nginx proxy path for development
const apiBaseURL = import.meta.env.VITE_ASTROGATORS_TABLE_URL || 'http://localhost/astrogators-table';

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <BrowserRouter basename="/mod-ledger">
      <AuthProvider apiBaseUrl={apiBaseURL}>
        <ModProvider>
          <FilterProvider>
            <EvaluationProvider>
              <PilotAssignmentProvider>
                <App />
              </PilotAssignmentProvider>
            </EvaluationProvider>
          </FilterProvider>
        </ModProvider>
      </AuthProvider>
    </BrowserRouter>
  </React.StrictMode>
);
