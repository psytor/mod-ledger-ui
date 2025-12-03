import React from 'react';
import ReactDOM from 'react-dom/client';
import { BrowserRouter } from 'react-router-dom';
import { AuthProvider } from 'astrogators-shared-ui';
import { ModProvider } from './contexts/ModContext';
import { FilterProvider } from './contexts/FilterContext';
import App from './App';

// Get API base URL for astrogators-table (authentication)
// Defaults to nginx proxy path for development
const apiBaseURL = import.meta.env.VITE_ASTROGATORS_TABLE_URL || 'http://localhost/astrogators-table';

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <BrowserRouter basename="/mod-ledger">
      <AuthProvider apiBaseUrl={apiBaseURL}>
        <ModProvider>
          <FilterProvider>
            <App />
          </FilterProvider>
        </ModProvider>
      </AuthProvider>
    </BrowserRouter>
  </React.StrictMode>
);
