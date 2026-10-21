import React from 'react';
import ReactDOM from 'react-dom/client';
import { App } from './app/App.jsx';
import { AuthProvider } from './app/auth/AuthContext.jsx';
import './shared/styles/globals.css';

ReactDOM.createRoot(document.getElementById('root')).render(
  <React.StrictMode>
    <AuthProvider>
      <App />
    </AuthProvider>
  </React.StrictMode>
);
