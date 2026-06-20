import './index.css';
import React from 'react';
import ReactDOM from 'react-dom/client';
import { BrowserRouter, Routes, Route } from 'react-router-dom';
import App from './App';
import LoginPage from './components/LoginPage';
import LauncherPage from './components/LauncherPage';
import AuthGate from './components/AuthGate';
import { ToastProvider } from './components/ui/Toast';
import ErrorBoundary from './components/ui/ErrorBoundary';
import { MobileImageUploadPage } from './components/pos/MobileImageUploadPage';
import { POSQuickPage } from './components/pos/POSQuickPage';
import LoginTransitionOverlay from './components/LoginTransitionOverlay';

const rootElement = document.getElementById('root');
if (!rootElement) {
  throw new Error('Could not find root element to mount to');
}

const root = ReactDOM.createRoot(rootElement);
root.render(
  <React.StrictMode>
    <BrowserRouter>
      <ErrorBoundary moduleName="App">
        <ToastProvider>
          <LoginTransitionOverlay />
          <Routes>
            <Route path="/login" element={<LoginPage />} />
            <Route path="/launcher" element={<AuthGate><LauncherPage /></AuthGate>} />
            <Route path="/upload-image/:productId" element={<MobileImageUploadPage />} />
            <Route path="/pos-quick" element={<POSQuickPage />} />
            <Route path="/*" element={<App />} />
          </Routes>
        </ToastProvider>
      </ErrorBoundary>
    </BrowserRouter>
  </React.StrictMode>
);
