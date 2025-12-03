import React from 'react';
import ReactDOM from 'react-dom/client';
import { BrowserRouter } from 'react-router-dom';
import { AuthProvider, initializeApiClient } from 'astrogators-shared-ui';
import { ModProvider } from './contexts/ModContext';
import { FilterProvider } from './contexts/FilterContext';
import App from './App';

// Build API base URL for astrogators-table (authentication)
const apiHost = import.meta.env.VITE_ASTROGATORS_TABLE_HOST || 'localhost';
const apiPort = import.meta.env.VITE_ASTROGATORS_TABLE_PORT || '8000';
const apiBaseURL = apiPort === '80' || apiPort === '443'
  ? `http://${apiHost}`
  : `http://${apiHost}:${apiPort}`;

// Initialize API client for authentication
// Note: Mod Ledger doesn't require authentication, so no redirect on unauthorized
initializeApiClient({
  baseURL: apiBaseURL,
  onUnauthorized: () => {
    // Do nothing - mod ledger works without auth
    console.log('API unauthorized - continuing without authentication');
  },
});

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <BrowserRouter basename="/mod-ledger">
      <AuthProvider>
        <ModProvider>
          <FilterProvider>
            <App />
          </FilterProvider>
        </ModProvider>
      </AuthProvider>
    </BrowserRouter>
  </React.StrictMode>
);
