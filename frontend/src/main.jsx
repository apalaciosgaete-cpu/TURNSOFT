import React from 'react';
import ReactDOM from 'react-dom/client';
import { BrowserRouter } from 'react-router-dom';
import App from './App.jsx';
import { AuthProvider } from './store/AuthContext.jsx';
import { TurnsoftProvider } from './store/TurnsoftContext.jsx';
import './styles.css';

ReactDOM.createRoot(document.getElementById('root')).render(
  <React.StrictMode>
    <BrowserRouter>
      <AuthProvider>
        <TurnsoftProvider>
          <App />
        </TurnsoftProvider>
      </AuthProvider>
    </BrowserRouter>
  </React.StrictMode>
);
