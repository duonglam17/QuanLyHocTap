import React from 'react';
import ReactDOM from 'react-dom/client';
import { App } from './app/App.jsx';
import { AuthProvider } from './shared/auth/AuthProvider.jsx';
import { TooltipProvider } from './shared/components/atoms/Tooltip.jsx';
import { Toaster } from './shared/components/molecules/Toaster.jsx';
import './shared/styles/globals.css';

ReactDOM.createRoot(document.getElementById('root')).render(
  <React.StrictMode>
    <AuthProvider>
      <TooltipProvider>
        <App />
        <Toaster />
      </TooltipProvider>
    </AuthProvider>
  </React.StrictMode>
);
