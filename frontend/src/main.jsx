import React from 'react';
import ReactDOM from 'react-dom/client';
import { BrowserRouter } from 'react-router-dom';
import App from './App.jsx';
import { AuthProvider } from './store/AuthContext.jsx';
import { SafeturnProvider } from './store/SafeturnContext.jsx';
import { migrateLegacyStorage } from './lib/legacyStorage.js';
import './styles.css';

migrateLegacyStorage();

ReactDOM.createRoot(document.getElementById('root')).render(
  <React.StrictMode>
    <BrowserRouter>
      <AuthProvider>
        <SafeturnProvider>
          <App />
        </SafeturnProvider>
      </AuthProvider>
    </BrowserRouter>
  </React.StrictMode>
);
